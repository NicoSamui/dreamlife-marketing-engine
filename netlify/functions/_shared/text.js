// text.js  -  Text-Helfer fuer KI-Antworten (Stand 25.09.2026)
//
// Ersetzt lange Gedankenstriche (Regel §1.6 der Spezifikation), holt ein JSON-Objekt
// aus einem KI-Antworttext (auch bei abgeschnittenem Ende) und kuerzt einen Kontext
// auf eine maximale Zeichenzahl, ohne den Brief zu verkuerzen. Keine Abhaengigkeiten.

"use strict";

// Die drei langen Gedankenstriche werden ueber ihre Code-Punkte gebaut (nicht als
// Zeichen im Quelltext), damit diese Datei selbst die Regel aus §1.6 der Spezifikation
// einhaelt: keine langen Gedankenstriche in irgendeiner Datei des Projekts.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const HORIZ_BAR = String.fromCharCode(0x2015);
const DASH_CHARS = EN_DASH + EM_DASH + HORIZ_BAR;
const DASH_RE = new RegExp("\\s*[" + DASH_CHARS + "]\\s*", "g");

// Ersetzt lange Gedankenstriche (Geviertstrich, Halbgeviertstrich, horizontaler Strich)
// kontextabhaengig: zwischen zwei Ziffern durch " bis " (Zahlenspanne), vor einem neuen
// Satz (naechstes Zeichen gross geschrieben, kein Komma/Doppelpunkt davor) durch ". ",
// sonst durch ", ".
function stripDashes(str) {
  if (typeof str !== "string" || (str.indexOf(EN_DASH) < 0 && str.indexOf(EM_DASH) < 0 && str.indexOf(HORIZ_BAR) < 0)) {
    return str;
  }
  return str.replace(DASH_RE, (match, offset, full) => {
    const before = full.slice(0, offset);
    const after = full.slice(offset + match.length);
    const prevChar = before.slice(-1);
    const nextChar = after.slice(0, 1);
    if (/[0-9]/.test(prevChar) && /[0-9]/.test(nextChar)) {
      return " bis ";
    }
    if (nextChar && /[A-ZÄÖÜ]/.test(nextChar) && prevChar && !/[,;:(„"]/.test(prevChar)) {
      return ". ";
    }
    return ", ";
  });
}

// Wendet stripDashes rekursiv auf alle Strings in einem Objekt/Array an.
function deepStripDashes(value) {
  if (typeof value === "string") return stripDashes(value);
  if (Array.isArray(value)) return value.map(deepStripDashes);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = deepStripDashes(value[k]);
    return out;
  }
  return value;
}

// Versucht, ein abgeschnittenes JSON-Fragment zu reparieren: entfernt ein angefangenes
// letztes Element nach dem letzten Komma, schliesst eine offene Zeichenkette und haengt
// die noch offenen Klammern in der richtigen Reihenfolge an.
function repairTruncatedJson(fragment) {
  let inString = false;
  let escape = false;
  const stack = [];
  for (let i = 0; i < fragment.length; i++) {
    const c = fragment[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (c === "\\") {
        escape = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") stack.pop();
  }
  let out = fragment;
  if (inString) out += '"';
  out = out.replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i] === "{" ? "}" : "]";
  }
  return out;
}

// Holt das erste vollstaendige JSON-Objekt aus einem KI-Antworttext: entfernt Codefences,
// nimmt den Bereich vom ersten "{" bis zum letzten "}" und parst ihn. Gelingt das nicht
// (zum Beispiel weil der Text mitten im Satz abgeschnitten wurde), wird eine Reparatur
// versucht (offene Klammern und Anfuehrungszeichen schliessen). Schlaegt auch das fehl,
// wirft die Funktion einen Fehler mit einer klaren deutschen Meldung.
function extractJSON(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Die KI-Antwort war leer, es konnte kein JSON gelesen werden.");
  }
  let t = text.trim();
  t = t.replace(/^```[a-zA-Z0-9_-]*\s*/, "").replace(/```\s*$/, "").trim();

  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1) {
    throw new Error("Die KI-Antwort enthielt kein JSON-Objekt.");
  }

  if (last > first) {
    const candidate = t.slice(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // weiter unten Reparatur versuchen
    }
  }

  const repaired = repairTruncatedJson(t.slice(first));
  try {
    return JSON.parse(repaired);
  } catch (e) {
    throw new Error("Die KI-Antwort konnte nicht als JSON gelesen werden (" + e.message + ").");
  }
}

function stringSize(value) {
  try {
    return JSON.stringify(value).length;
  } catch (e) {
    return 0;
  }
}

function collectStrings(node, path, out) {
  if (typeof node === "string") {
    out.push({ path, len: node.length });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectStrings(v, path.concat(i), out));
    return;
  }
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) collectStrings(node[k], path.concat(k), out);
  }
}

function getAt(root, path) {
  return path.reduce((n, k) => (n == null ? n : n[k]), root);
}

function setAt(root, path, val) {
  let n = root;
  for (let i = 0; i < path.length - 1; i++) n = n[path[i]];
  n[path[path.length - 1]] = val;
}

// Kuerzt lange Strings in "obj" so lange, bis JSON.stringify(obj) hoechstens maxChars
// Zeichen hat. Die Schluessel aus priorityKeys werden zuerst gekuerzt (dort die laengsten
// Strings zuerst), erst danach alle uebrigen Felder. Das Feld "brief" wird nie angetastet.
function truncateCtx(obj, maxChars, priorityKeys) {
  const limit = maxChars || 60000;
  const priority = priorityKeys || [];
  let clone;
  try {
    clone = JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return obj;
  }
  if (stringSize(clone) <= limit) return clone;

  function shrinkList(list) {
    list.sort((a, b) => b.len - a.len);
    for (const item of list) {
      if (stringSize(clone) <= limit) return;
      const cur = getAt(clone, item.path);
      if (typeof cur !== "string" || cur.length < 200) continue;
      const over = stringSize(clone) - limit;
      const cut = Math.min(cur.length - 100, Math.ceil(over * 1.2) + 50);
      if (cut <= 0) continue;
      const kept = cur.slice(0, Math.max(100, cur.length - cut));
      setAt(clone, item.path, kept + " [gekuerzt]");
    }
  }

  for (const key of priority) {
    if (!(key in clone)) continue;
    const list = [];
    collectStrings(clone[key], [key], list);
    shrinkList(list);
    if (stringSize(clone) <= limit) return clone;
  }

  const rest = [];
  for (const key of Object.keys(clone)) {
    if (priority.includes(key) || key === "brief") continue;
    collectStrings(clone[key], [key], rest);
  }
  shrinkList(rest);

  return clone;
}

module.exports = {
  stripDashes, deepStripDashes, extractJSON, truncateCtx, repairTruncatedJson,
  EN_DASH, EM_DASH, HORIZ_BAR,
};
