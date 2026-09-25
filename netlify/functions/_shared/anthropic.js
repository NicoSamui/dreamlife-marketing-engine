// anthropic.js  -  Gemeinsamer Anthropic-Aufruf fuer ai-background.mjs (Stand 25.09.2026)
//
// Ruft die Anthropic-Messages-API mit stream:true auf, liest den SSE-Text-Strom und
// liefert den gesammelten Text als Promise. Auto-Retry bei 429/529/5xx/Netzfehler (bis
// zu 3 Versuche, wie bisher in ai.mjs). Kein temperature-Feld im Payload (neuere Modelle
// wie Opus 5.x lehnen es ab). Keine Abhaengigkeiten, Node 18+ (globales fetch).

"use strict";

const { notifyAdmin, classifyProviderError, FREUNDLICH } = require("./alert.js");

const ANTHROPIC_VERSION = "2023-06-01";

async function callOnce(key, payload) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" },
    body: payload,
  });
}

// { key, model, system, user, max_tokens, onDelta(deltaText, gesamtLaenge) } -> Promise<string>
async function streamText(opts) {
  // JSON-Modus (Standard): Die Antwort wird als Tool-Eingabe erzwungen. Damit liefert die API
  // garantiert gueltiges JSON (keine kaputten Anfuehrungszeichen oder Zeilenumbrueche in
  // Strings), auch bei sehr langen Ausgaben. Der Text kommt dann als input_json_delta.
  const json = opts.json !== false;
  // Optionale Bilder (Creative-Decoder): werden als Content-Bloecke VOR dem Text-Block
  // in die erste (und einzige) User-Nachricht gelegt, siehe Anthropic Messages API.
  let userContent = opts.user;
  if (Array.isArray(opts.images) && opts.images.length) {
    userContent = opts.images
      .filter((img) => img && img.media_type && img.data)
      .map((img) => ({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } }))
      .concat([{ type: "text", text: opts.user }]);
  }
  const body = {
    model: opts.model,
    max_tokens: opts.max_tokens,
    stream: true,
    system: opts.system,
    messages: [{ role: "user", content: userContent }],
  };
  if (json) {
    body.tools = [{
      name: "ergebnis",
      description: "Liefert das fertige Ergebnis als JSON-Objekt genau nach dem im System-Prompt beschriebenen Schema.",
      input_schema: (opts.schema && typeof opts.schema === "object") ? opts.schema : { type: "object", additionalProperties: true },
    }];
    // Erzwungenes tool_choice ("tool"/"any") unterstuetzen neuere Modelle nicht mehr, deshalb
    // "auto" plus klare Anweisung im System-Prompt. Antwortet das Modell doch als Text, greift
    // unten der Text-Weg (extractJSON im Aufrufer).
    body.tool_choice = { type: "auto" };
    body.system = String(opts.system || "") + "\n\nAUSGABE: Rufe IMMER das Tool \"ergebnis\" auf und uebergib das komplette Ergebnis-JSON als dessen Eingabe. Kein Text davor oder danach.";
  }
  const payload = JSON.stringify(body);

  let upstream = null;
  let lastMsg = "KI-Fehler.";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt));
    let res;
    try {
      res = await callOnce(opts.key, payload);
    } catch (e) {
      lastMsg = "Die KI ist gerade nicht erreichbar.";
      continue;
    }
    if (res.ok && res.body) { upstream = res; break; }
    let m = "";
    try { const j = await res.json(); m = (j && j.error && j.error.message) || ""; } catch (e) {}
    lastMsg = m || ("KI-Fehler (" + res.status + ").");
    const grund = classifyProviderError(res.status, m);
    if (grund) {
      // Anbieter-Problem (Guthaben/Schluessel): Nico per WhatsApp informieren, Teilnehmer
      // bekommt eine freundliche Meldung statt der englischen Rohmeldung.
      console.error("Anthropic-Anbieterfehler", grund, res.status, m);
      await notifyAdmin("anthropic-" + grund, "Anthropic " + (grund === "guthaben" ? "Guthaben aufgebraucht" : "Schluessel ungueltig") + ". Teilnehmer koennen gerade keine KI-Laeufe starten. Meldung: " + m);
      const err = new Error(FREUNDLICH); err.code = "provider_" + grund; throw err;
    }
    const retriable = res.status === 429 || res.status === 529 || res.status >= 500;
    if (!retriable) break;
  }
  if (!upstream) throw new Error(/ueberlast|overloaded|rate/i.test(lastMsg) ? "Die KI ist gerade stark ausgelastet. Bitte versuch es in ein paar Minuten noch einmal." : lastMsg);

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullText = "";          // alle Zeichen (Text + Tool-JSON), nur fuer Fortschritt/Fallback
  const toolBlocks = [];      // je Tool-Aufruf ein JSON-String (das Modell darf mehrfach aufrufen)
  let textOnly = "";          // reine Textbloecke (Fallback, falls kein Tool-Aufruf kam)
  let current = null;         // aktueller Block: { type, json, text }
  const blockTypes = [];
  let stopReason = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const pl = t.slice(5).trim();
      if (!pl || pl === "[DONE]") continue;
      try {
        const ev = JSON.parse(pl);
        if (ev.type === "content_block_start") {
          const bt = (ev.content_block && ev.content_block.type) || "?";
          blockTypes.push(bt);
          current = { type: bt, json: "", text: "" };
          continue;
        }
        if (ev.type === "content_block_stop") {
          if (current && current.type === "tool_use") toolBlocks.push(current.json);
          if (current && current.type === "text") textOnly += current.text;
          current = null;
          continue;
        }
        if (ev.type === "message_delta" && ev.delta && ev.delta.stop_reason) stopReason = ev.delta.stop_reason;
        if (ev.type === "error" && ev.error) throw new Error("KI-Fehler: " + (ev.error.message || ev.error.type));
        const d = ev.type === "content_block_delta" && ev.delta ? ev.delta : null;
        if (!d) continue;
        let piece = null;
        if (typeof d.partial_json === "string") { piece = d.partial_json; if (current) current.json += piece; }
        else if (typeof d.text === "string") { piece = d.text; if (current) current.text += piece; }
        if (piece !== null) {
          fullText += piece;
          if (opts.onDelta) {
            try { opts.onDelta(piece, fullText.length); } catch (e) { /* Fortschritt ist nie ein Abbruchgrund */ }
          }
        }
      } catch (e) {
        if (e && /^KI-Fehler/.test(e.message)) throw e;
        /* sonst Zeile ueberspringen */
      }
    }
  }
  if (current && current.type === "tool_use") toolBlocks.push(current.json);
  if (current && current.type === "text") textOnly += current.text;

  // Tool-Aufrufe: JSON je Block parsen und zusammenfuehren (Objekte: Schluessel vereinen,
  // gleichnamige Arrays: anhaengen). So bleibt auch ein Modell korrekt, das je Kategorie
  // einen eigenen Tool-Aufruf macht.
  const parsedBlocks = [];
  for (const j of toolBlocks) {
    const s = String(j || "").trim();
    if (!s) continue;
    try { parsedBlocks.push(JSON.parse(s)); } catch (e) { /* kaputten Block ueberspringen */ }
  }
  if (parsedBlocks.length) {
    const merged = parsedBlocks.length === 1 ? parsedBlocks[0] : parsedBlocks.reduce(mergeDeep, {});
    return JSON.stringify(merged);
  }
  if (textOnly.trim()) return textOnly;
  if (fullText.trim()) return fullText;
  throw new Error("Die KI hat keinen Text geliefert (Bloecke: " + (blockTypes.join(",") || "keine") + ", Ende: " + (stopReason || "unbekannt") + ").");
}

function mergeDeep(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const out = Object.assign({}, a);
    for (const k of Object.keys(b)) out[k] = k in out ? mergeDeep(out[k], b[k]) : b[k];
    return out;
  }
  return b === undefined ? a : b;
}

module.exports = { streamText, mergeDeep };
