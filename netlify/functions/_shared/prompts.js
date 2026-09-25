// prompts.js  -  Prompt-Bauer je Aufgabe (Stand 25.09.2026, Version 1.3, SPEC §12)
//
// Baut System- und User-Prompt fuer ai-background.mjs. Das System besteht aus dem
// Basis-Wissen, dem passenden Wissensmodul (siehe MODULE_BY_TYPE/moduleAndSchemaFor
// und §6/§12.3/§12.4 der Spezifikation) und der Schema-Beschreibung des erwarteten
// JSON. Das User-Prompt ist der vollstaendige Kontext (Firma, Zielgruppe, Analyse,
// Avatar, Winkel, Kampagne, Angebot, Hinweis) als JSON-Text, gekuerzt auf hoechstens
// 120000 Zeichen. Nur serverseitig verwendet, der Browser sieht diese Datei nie.

"use strict";

const knowledge = require("./knowledge.js");
const { truncateCtx } = require("./text.js");

// Welches Wissensmodul zu welchem Asset-Typ gehoert (§4.4 / §6 der Spezifikation).
const MODULE_BY_TYPE = {
  creative: "creatives",
  reel: "reels",
  caption: "social",
  olg: "olg",
  email: "emails",
  vsl: "vsl",
  leadmagnet: "leadmagnet",
  funnel: "funnel",
};

// Grosszuegige Budgets: Opus 5.x denkt vor der Antwort (adaptives Thinking), diese Tokens
// zaehlen mit in max_tokens. Zu kleine Budgets brechen die JSON-Ausgabe mitten im Tool-Aufruf ab.
// kurzprofil/analyse-Teil/avatar_vorschlag nach §12.3/§12.4 (schnelles Modell, kleine Budgets).
const MAX_TOKENS = {
  winkel: 12000,
  asset: 28000,
  konsistenz: 14000,
  decode: 16000,
  kurzprofil: 6000,
  avatar_vorschlag: 5000,
};
// Jeder der 6 Analyse-Teile (A bis F, SPEC §12.3) bekommt dasselbe kleinere Budget,
// egal welche/wie viele Kategorien er traegt (das schnelle Modell antwortet knapper).
const ANALYSE_TEIL_MAX_TOKENS = 9000;

const TEMPERATURE = {
  analyse: 0.5,
  verfeinern: 0.5,
};
const DEFAULT_TEMPERATURE = 0.7;

const MAX_USER_CHARS = 120000;

// Aufgaben, die auf dem SCHNELLEN Modell laufen (SPEC §12.3: "beide mit dem SCHNELLEN
// Modell"). Winkel, Asset, Konsistenz und Decoder bleiben auf dem grossen Modell (MODEL).
const FAST_TASKS = ["kurzprofil", "analyse", "verfeinern", "avatar_vorschlag"];

// modelFor(task): welches Modell fuer eine Aufgabe verwendet wird (SPEC §12.3).
function modelFor(task) {
  if (FAST_TASKS.indexOf(task) !== -1) {
    return process.env.MODEL_FAST || "claude-sonnet-5";
  }
  return process.env.MODEL || "claude-opus-5-5";
}

// effortFor(task): Denk-Budget je Aufgabe (SPEC §12.3/§12.4), an anthropic.js weitergereicht
// (output_config.effort, mit Retry ohne das Feld bei 400, siehe _shared/anthropic.js).
function effortFor(task) {
  if (task === "kurzprofil" || task === "avatar_vorschlag") return "low";
  if (task === "analyse" || task === "verfeinern") return "medium";
  return undefined;
}

// Reihenfolge aller 17 Analyse-Kategorien aus §3 der Spezifikation (unveraendert durch §12.3).
const KATEGORIEN_ALL = [
  "basisprofil", "wissensstand", "marktwissen", "weg_von", "hin_zu", "reale_situationen",
  "disg", "life_force_8", "sekundaere_wuensche_9", "einwaende", "awareness_stufe",
  "glaubenssaetze", "sprache_zitate", "kaufausloeser", "kanaele", "entscheidungsprozess",
  "zusammenfassung",
];

// Aufteilung der 17 Kategorien in 6 Teile A bis F (SPEC §12.3, ersetzt die alten 4 Teile).
// Werden in ai-background.mjs paarweise nacheinander gestartet: (A,B), dann (C,D), dann (E,F).
const KATEGORIE_TEILE = {
  A: ["basisprofil", "wissensstand", "marktwissen"],
  B: ["weg_von", "hin_zu"],
  C: ["reale_situationen", "disg"],
  D: ["life_force_8", "sekundaere_wuensche_9", "einwaende"],
  E: ["awareness_stufe", "glaubenssaetze", "sprache_zitate"],
  F: ["kaufausloeser", "kanaele", "entscheidungsprozess", "zusammenfassung"],
};
// Reihenfolge der Paare, in der die Teile gestartet werden (SPEC §12.3).
const KATEGORIE_PAARE = [["A", "B"], ["C", "D"], ["E", "F"]];

// ---- Schema-Beschreibungen (aus §3 / §12.3 / §12.4 der Spezifikation) ----

// Text des zusaetzlichen Pflichtfelds "avatar_person" in der Kategorie "basisprofil"
// (SPEC §11.2, bleibt als Kompatibilitaetsfeld bestehen, siehe §12.4 "Bau-Auftrag": der
// automatische Merge nach me_projects.avatar entfaellt, das Feld selbst bleibt im Schema).
const AVATAR_PERSON_TEXT = `{ "name": "string (Vorname plus Nachname, typisch fuer die Zielgruppe)", "alter": 34, "beruf": "string", "kurzbeschreibung": "string (2 Saetze)", "bild_prompt": "string (englisch, 60 bis 100 Woerter: Aussehen, Kleidung, Umgebung, Stimmung, neutraler Hintergrund, Portraet, keine Marken, kein Text)" }`;

// Neues Kategorie-Format (SPEC §12.3): titel, kern (3 bis 5 Stichpunkte), inhalt (Markdown,
// kurz), punkte (wie bisher), zahl (optional, eine Kennzahl). hin_zu bekommt zusaetzlich
// "paare" (Ist/Soll-Gegenueberstellung), basisprofil behaelt "avatar_person".
function buildAnalyseSchema(kategorien) {
  const teil = Array.isArray(kategorien) && kategorien.length ? kategorien : null;
  const keys = teil || KATEGORIEN_ALL;
  const withMeta = !teil || keys.indexOf("zusammenfassung") !== -1;
  const lines = keys.map((k) => {
    let extra = "";
    if (k === "basisprofil") extra = `, "avatar_person": ${AVATAR_PERSON_TEXT}`;
    if (k === "hin_zu") extra = `, "paare": [ { "weg_von": "string", "hin_zu": "string" }, "... (5 bis 8 Eintraege)" ]`;
    return `  "${k}": { "titel": "string", "kern": ["string", "string", "string (3 bis 5 Stichpunkte, je max 20 Woerter)"], "inhalt": "string (Markdown, kurze Absaetze)", "punkte": ["string", "..."], "zahl": { "wert": "string", "einheit": "string", "label": "string" }${extra} }`;
  });
  if (withMeta) lines.push(`  "meta": { "erzeugt_am": "ISO-Datum als string", "modell": "string", "version": "string" }`);
  let out = "Gib GENAU dieses JSON-Objekt zurueck, keine zusaetzlichen Schluessel, keine fehlenden:\n{\n" + lines.join(",\n") + "\n}\n";
  if (teil) {
    out += "Erzeuge NUR diese Kategorien, jede so ausfuehrlich wie im Wissensmodul verlangt.\n";
  } else {
    out += "Reihenfolge der Kategorien genau wie oben.\n";
  }
  out += "Jede Kategorie beginnt mit \"kern\" (3 bis 5 Stichpunkte, das Wichtigste zuerst), \"inhalt\" ist kurzes Markdown ";
  out += "(Zwischenueberschriften mit ###, Absaetze max 4 Saetze), nur bei reale_situationen, sprache_zitate, einwaende und ";
  out += "zusammenfassung ausfuehrlicher. \"zahl\" ist optional (eine Kennzahl der Kategorie). \"punkte\" ist optional.";
  if (keys.indexOf("basisprofil") !== -1) {
    out += " Die Kategorie \"basisprofil\" braucht zusaetzlich das Pflichtfeld \"avatar_person\" mit name, alter (Zahl), beruf, kurzbeschreibung und bild_prompt, alle Pflicht.";
  }
  if (keys.indexOf("hin_zu") !== -1) {
    out += " Die Kategorie \"hin_zu\" braucht zusaetzlich das Pflichtfeld \"paare\" mit 5 bis 8 Eintraegen { weg_von, hin_zu }.";
  }
  return out;
}

const ANALYSE_SCHEMA = buildAnalyseSchema();

// Kurzprofil (SPEC §12.3, Stufe 1): kompakte Uebersicht, ein Aufruf, alles in Stichpunkten.
const KURZPROFIL_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "steckbrief": { "wer": "string (1 Satz)", "alter": "string (Spanne, z. B. 35 bis 45)", "situation": "string (Halbsatz)", "einkommen_niveau": "string", "entscheidet": "string" },
  "schmerzen": [ { "titel": "string (max 6 Woerter)", "satz": "string (1 Satz, konkretes Detail)" }, "... (genau 3)" ],
  "wuensche": [ { "titel": "string", "satz": "string" }, "... (genau 3)" ],
  "situationen": [ { "wann_wo": "string (max 8 Woerter)", "was_passiert": "string (1 bis 2 Saetze)" }, "... (genau 3)" ],
  "awareness": { "stufe": "unbewusst|problembewusst|loesungsbewusst|produktbewusst|meistbewusst", "begruendung": "string (1 Satz)" },
  "markt": { "saettigung": "niedrig|mittel|hoch", "satz": "string" },
  "zitate": ["string", "... (genau 5 woertliche Saetze in Ich-Form)"],
  "einwaende": [ { "einwand": "string", "antwort_idee": "string" }, "... (genau 3)" ],
  "kaufausloeser": ["string", "string", "string"],
  "kanaele": ["string", "... (3 bis 5)"],
  "ein_satz": "string (die Zielgruppe in einem Satz)"
}
Knapp, treffend, konkret, keine Einleitungen. Bei duennem Brief plausible Annahmen mit "Annahme:" markieren.`;

// Avatar-Vorschlag (SPEC §12.4): 3 verschiedene Avatare aus Kurzprofil + Analyse.
const AVATAR_VORSCHLAG_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "avatare": [
    {
      "name": "string (typischer Vor- und Nachname, erfunden, kein Prominenter)",
      "alter": 34,
      "beruf": "string",
      "kurzbeschreibung": "string (2 Saetze)",
      "werte": ["string", "... (3 bis 5)"],
      "ziele": "string (1 bis 2 Saetze, was die Person in 12 Monaten erreicht haben will)",
      "sorge": "string (1 Satz)",
      "aussehen": "string (2 Saetze: Aussehen, Kleidung, Auftreten)",
      "motto": "string (max 10 Woerter)",
      "bild_prompt": "string (englisch, 60 bis 100 Woerter: Portraet, Alter, Ausdruck, Kleidung, Umgebung, Licht, Stimmung, ruhiger Hintergrund, keine Marken, kein Text, keine echten Personen)"
    }
  ]
}
Erzeuge GENAU 3 Avatare, die sich klar unterscheiden und alle zum Kurzprofil passen.`;

// Kurzform der Winkel (SPEC §11.5): genau 25 Winkel, 5 je Awareness-Stufe, nur noch id, titel,
// kurz (ein Satz), awareness, typ. Keine weiteren Felder mehr in der Erstliste.
const WINKEL_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "winkel": [
    {
      "id": "w1",
      "titel": "string (maximal 6 Woerter)",
      "kurz": "string (genau EIN Satz, maximal 30 Woerter, erklaert den Winkel aus Sicht der Zielgruppe)",
      "awareness": "unbewusst|problembewusst|loesungsbewusst|produktbewusst|meistbewusst",
      "typ": "Mechanismus|Feind|Kontrast|Story|Zahlen|Zeit|Identität|Neue Chance|Warnung|Frage|Geheimnis|Status"
    }
  ]
}
Keine weiteren Felder je Winkel (kein hook_beispiel, kein warum_wirkt, kein risiko, keine formate).
Ohne "mehr": erzeuge genau 25 Winkel mit IDs w1 bis w25, genau 5 je Awareness-Stufe, in dieser
Reihenfolge: unbewusst, problembewusst, loesungsbewusst, produktbewusst, meistbewusst. Mit "mehr":
erzeuge genau 5 neue Winkel NUR fuer die im Nutzer-Kontext genannte Awareness-Stufe, keine
Wiederholung der bestehenden Titel, IDs fortlaufend ab der im Nutzer-Kontext genannten Nummer.`;

const CREATIVE_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "varianten": [
    {
      "headline": "string",
      "subline": "string",
      "primary_text": "string",
      "cta": "string",
      "bild_prompt": "string (englisch, detailliert, ohne Text im Bild, mit Stilangabe)",
      "bild_text": "string (kurzer deutscher Text, der als Headline ins Bild soll)",
      "bilder": { "1:1": null, "4:5": null, "9:16": null }
    }
  ]
}
Erzeuge genau 3 Varianten. Setze "bilder" immer auf { "1:1": null, "4:5": null, "9:16": null }, die Bilder
werden spaeter separat erzeugt.`;

const REEL_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "skripte": [
    {
      "titel": "string",
      "hook_varianten": ["string", "string", "string"],
      "szenen": [
        { "zeit": "string (z. B. 0-3s)", "sprechtext": "string", "bild_hinweis": "string", "text_einblendung": "string" }
      ],
      "cta": "string",
      "caption": "string",
      "hashtags": ["string", "..."],
      "dreh_hinweise": "string"
    }
  ]
}
Erzeuge genau 5 Skripte. "hook_varianten" hat genau 3 Eintraege.`;

const CAPTION_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "beitraege": [
    {
      "plattform": "string",
      "format": "Karussell|Einzelbild|Text|Story",
      "hook": "string",
      "text": "string",
      "cta": "string",
      "hashtags": ["string", "..."]
    }
  ]
}
Erzeuge genau 7 Beitraege.`;

const OLG_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "beitraege": [
    {
      "kanal": "Facebook-Gruppe|LinkedIn|Instagram|Community",
      "typ": "Wert|Story|Umfrage|Ergebnis|Einladung",
      "text": "string",
      "soft_cta": "string"
    }
  ]
}
Erzeuge genau 6 Beitraege. Ziel ist, Kommentare und Direktnachrichten auszuloesen, kein harter Verkauf.`;

const EMAIL_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "sequenz_name": "string",
  "zweck": "string",
  "mails": [
    {
      "nr": 1,
      "tag": 0,
      "betreff_varianten": ["string", "string", "string"],
      "preheader": "string",
      "text": "string",
      "cta": "string",
      "ps": "string"
    }
  ]
}
Erzeuge 5 bis 7 Mails, "nr" fortlaufend ab 1, "betreff_varianten" hat genau 3 Eintraege, genau ein CTA je Mail.`;

const VSL_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "titel": "string",
  "dauer_min": 45,
  "struktur": [
    { "abschnitt": "string", "minute": "string (z. B. 0-5)", "sprechtext": "string", "folie_hinweis": "string", "ziel": "string" }
  ],
  "cta_text": "string",
  "hinweise": "string"
}
Baue die Struktur nach dem Steigner-Webinar-Aufbau (Minutenplan, Autoritaet, Hoffnung, Ja-Strasse,
Kernangebot, Garantie, Verknappung, CTA).`;

const LEADMAGNET_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "titel": "string",
  "untertitel": "string",
  "versprechen": "string",
  "einleitung": "string",
  "kapitel": [
    { "ueberschrift": "string", "text": "string", "punkte": ["string", "..."] }
  ],
  "checkliste": ["string", "..."],
  "abschluss_cta": "string",
  "autor_box": "string"
}
Erzeuge 5 bis 7 Kapitel, der Leadmagnet loest ein einziges enges Problem vollstaendig (Hormozi 100M Leads).`;

const FUNNEL_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "funnel_typ": "string",
  "begruendung": "string",
  "schritte": [
    {
      "nr": 1,
      "seite": "string",
      "ziel": "string",
      "headline": "string",
      "subheadline": "string",
      "abschnitte": [ { "titel": "string", "text": "string" } ],
      "cta": "string",
      "hinweise": "string"
    }
  ],
  "nachfass": [ { "zeitpunkt": "string (z. B. sofort, Tag 1, Tag 3)", "kanal": "E-Mail|WhatsApp|SMS|Anruf", "ziel": "string", "text": "string (fertiger Kurztext)" } ],
  "kennzahlen_ziel": "string (gut lesbarer Text mit Zeilenumbruechen)"
}
Waehle den Funnel-Typ passend zum Angebot und begruende ihn kurz (Eric Steigner). "nachfass" hat 6 bis 10 Eintraege als Objekte.`;

const DECODE_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "name_vorschlag": "string",
  "format": "string (z. B. 1:1, 4:5, 9:16 oder anderes)",
  "aufbau": {
    "beschreibung": "string",
    "blickfuehrung": "string",
    "zonen": [ { "element": "string", "position": "string", "flaeche_prozent": 20, "ausrichtung": "string" } ]
  },
  "headline": { "text": "string", "typ": "string", "formel": "string", "woerter": 6, "hebel": "string" },
  "subline": { "text": "string", "formel": "string" },
  "cta": { "text": "string", "form": "string", "position": "string", "formel": "string" },
  "weitere_texte": [ { "text": "string", "rolle": "string" } ],
  "typografie": { "stil": "string", "gewicht": "string", "schreibweise": "string", "groessenverhaeltnis": "string", "hervorhebung": "string", "farbe_kontrast": "string" },
  "farben": [ { "hex": "string", "rolle": "string" } ],
  "bildstil": { "art": "string", "szene": "string", "person": "string", "licht": "string", "perspektive": "string", "stimmung": "string", "look": "string" },
  "psychologie": { "emotion": "string", "awareness": "string", "treiber": "string", "scroll_stopper": "string" },
  "warum_wirkt": "string",
  "stil_prompt": "string (englisch, 80 bis 160 Woerter, mit Platzhaltern in eckigen Klammern)",
  "copy_formeln": { "headline": "string", "subline": "string", "cta": "string", "anleitung": "string" },
  "regeln": ["string", "..."]
}
"zonen" hat 3 bis 8 Eintraege, "farben" 3 bis 6 Eintraege, "regeln" 4 bis 8 Eintraege. Alles ausser
"stil_prompt" auf Deutsch, in einfacher Sprache, ohne lange Gedankenstriche.`;

const KONSISTENZ_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "score": 80,
  "befunde": [
    { "asset_typ": "string", "problem": "string", "vorschlag": "string", "schwere": "hoch|mittel|niedrig" }
  ],
  "fazit": "string"
}
"score" ist eine Zahl von 0 bis 100.`;

const SCHEMAS = {
  analyse: ANALYSE_SCHEMA,
  kurzprofil: KURZPROFIL_SCHEMA,
  avatar_vorschlag: AVATAR_VORSCHLAG_SCHEMA,
  winkel: WINKEL_SCHEMA,
  creative: CREATIVE_SCHEMA,
  reel: REEL_SCHEMA,
  caption: CAPTION_SCHEMA,
  olg: OLG_SCHEMA,
  email: EMAIL_SCHEMA,
  vsl: VSL_SCHEMA,
  leadmagnet: LEADMAGNET_SCHEMA,
  funnel: FUNNEL_SCHEMA,
  konsistenz: KONSISTENZ_SCHEMA,
  decode: DECODE_SCHEMA,
};

function moduleAndSchemaFor(task, ctx) {
  if (task === "analyse" || task === "verfeinern") {
    return { moduleKey: "zielgruppe", schemaKey: "analyse" };
  }
  if (task === "kurzprofil") {
    return { moduleKey: "kurzprofil", schemaKey: "kurzprofil" };
  }
  if (task === "avatar_vorschlag") {
    return { moduleKey: "avatar_vorschlag", schemaKey: "avatar_vorschlag" };
  }
  if (task === "winkel") {
    return { moduleKey: "winkel", schemaKey: "winkel" };
  }
  if (task === "konsistenz") {
    return { moduleKey: "konsistenz", schemaKey: "konsistenz" };
  }
  if (task === "decode") {
    return { moduleKey: "decoder", schemaKey: "decode" };
  }
  if (task === "asset") {
    const typ = ctx && ctx.typ;
    const moduleKey = MODULE_BY_TYPE[typ];
    if (!moduleKey || !SCHEMAS[typ]) {
      throw new Error("Unbekannter Asset-Typ: " + typ);
    }
    return { moduleKey, schemaKey: typ };
  }
  throw new Error("Unbekannte Aufgabe: " + task);
}

function briefFields(brief) {
  const out = {};
  if (!brief || typeof brief !== "object") return out;
  for (const k of Object.keys(brief)) {
    const v = brief[k];
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

// firma (SPEC §12.5): me_firmen.info + name, als eigener Block. ctx.firma ist die serverseitig
// geladene me_firmen-Zeile (siehe ai-background.mjs), oder null/undefined ohne Firma.
function firmaContext(firma) {
  if (!firma || typeof firma !== "object") return undefined;
  const info = (firma.info && typeof firma.info === "object") ? firma.info : {};
  const out = { name: firma.name };
  const infoOut = briefFields(info);
  if (Object.keys(infoOut).length) out.info = infoOut;
  return out;
}

// zielgruppe (SPEC §12.5): { name, produkt, brief, kurzprofil }. "brief" enthaelt nur noch
// produktbezogene Felder (Firmenfelder kommen aus firmaContext, SPEC §12.1). "kurzprofil"
// fehlt, solange noch keins existiert (z. B. waehrend die Function selbst das Kurzprofil
// erzeugt) oder wenn die Aufgabe bewusst ohne Kurzprofil im Kontext laufen soll.
function zielgruppeContext(project, includeKurzprofil) {
  const out = {};
  if (project.name) out.name = project.name;
  if (project.produkt) out.produkt = project.produkt;
  const brief = briefFields(project.brief);
  if (Object.keys(brief).length) out.brief = brief;
  if (includeKurzprofil && project.kurzprofil && typeof project.kurzprofil === "object" && Object.keys(project.kurzprofil).length) {
    out.kurzprofil = project.kurzprofil;
  }
  return out;
}

// avatar (SPEC §12.4/§12.5): bei Kampagnen der gewaehlte Avatar aus me_avatare, OHNE
// bild_prompt/bilder (die KI braucht nur die Persoenlichkeits-Felder). ctx.avatarRow ist die
// serverseitig geladene me_avatare-Zeile (siehe ai-background.mjs), uid bereits geprueft.
function avatarContext(avatarRow) {
  if (!avatarRow || typeof avatarRow !== "object") return undefined;
  const profil = (avatarRow.profil && typeof avatarRow.profil === "object") ? avatarRow.profil : {};
  const out = { name: avatarRow.name };
  for (const k of Object.keys(profil)) {
    if (k === "bild_prompt") continue;
    if (profil[k] === undefined || profil[k] === null || profil[k] === "") continue;
    out[k] = profil[k];
  }
  return out;
}

function buildUserContext(task, ctx) {
  // decode hat keinen Brief/Projekt-Bezug (siehe SPEC §10): nur die Aufgabe und der
  // aktuelle Name der Vorlage gehen in den User-Kontext.
  if (task === "decode") {
    return { aufgabe: "Zerlege das beigefügte Werbebild nach der Anweisung.", vorlagen_name: (ctx.template && ctx.template.name) || "" };
  }

  const project = ctx.project || {};
  const userCtx = {};
  const firma = firmaContext(ctx.firma);
  if (firma) userCtx.firma = firma;

  if (task === "kurzprofil") {
    // Stufe 1 (SPEC §12.3): noch kein Kurzprofil und keine Analyse im Kontext, nur Firma
    // und Zielgruppe (Produkt/Brief).
    userCtx.zielgruppe = zielgruppeContext(project, false);
    return userCtx;
  }

  if (task === "avatar_vorschlag") {
    // SPEC §12.4: braucht Kurzprofil UND Analyse (wo vorhanden), um 3 Avatare vorzuschlagen.
    userCtx.zielgruppe = zielgruppeContext(project, true);
    if (project.analyse) userCtx.analyse = project.analyse;
    return userCtx;
  }

  if (task === "analyse" || task === "verfeinern") {
    // Stufe 2 (SPEC §12.3): das Kurzprofil geht als Kontext mit ("bleib konsistent"), aber
    // keine bestehende Analyse ausserhalb von "verfeinern" (die entsteht hier gerade erst).
    userCtx.zielgruppe = zielgruppeContext(project, true);
    if (ctx.hinweis && project.analyse) {
      let bestehende = project.analyse;
      if (Array.isArray(ctx.kategorien) && ctx.kategorien.length) {
        const gefiltert = {};
        ctx.kategorien.forEach((k) => { if (project.analyse[k]) gefiltert[k] = project.analyse[k]; });
        bestehende = gefiltert;
      }
      userCtx.bestehende_analyse = bestehende;
      userCtx.hinweis = "Verfeinere die bestehende Analyse, behalte Gutes, arbeite den Hinweis ein: " + ctx.hinweis;
    } else if (ctx.hinweis) {
      userCtx.hinweis = "Bitte beruecksichtige zusaetzlich: " + ctx.hinweis;
    }
    return userCtx;
  }

  // Ab hier: winkel, asset, konsistenz. Alle bekommen firma + zielgruppe (mit Kurzprofil)
  // und die volle Analyse (SPEC §12.5).
  userCtx.zielgruppe = zielgruppeContext(project, true);

  if (task === "winkel") {
    if (project.analyse) userCtx.analyse = project.analyse;
    if (ctx.mehr) {
      const bestehende = Array.isArray(project.winkel) ? project.winkel : [];
      userCtx.bestehende_winkel_titel = bestehende.map((w) => w && w.titel).filter(Boolean);
      userCtx.awareness_stufe = ctx.awareness;
      userCtx.hinweis =
        "Erzeuge genau 5 neue Winkel NUR fuer die Awareness-Stufe " + ctx.awareness +
        ", keine Wiederholung der bestehenden Titel, IDs fortlaufend ab w" + (bestehende.length + 1) + ".";
    }
    return userCtx;
  }

  if (task === "asset") {
    if (project.analyse) userCtx.analyse = project.analyse;
    const avatar = avatarContext(ctx.avatarRow);
    if (avatar) userCtx.avatar = avatar;
    if (Array.isArray(ctx.winkel) && ctx.winkel.length) userCtx.winkel = ctx.winkel;
    // Die neuen Kurz-Winkel (SPEC §11.5) sind bewusst nur Skizzen (id, titel, kurz, awareness,
    // typ), alte Winkel-Objekte mit kernbotschaft usw. werden unveraendert durchgereicht.
    userCtx.winkel_hinweis = "Die Winkel sind bewusst kurze Skizzen. Baue sie selbst aus: Hook, Mechanismus, Beweisidee, konkrete Szene.";
    if (ctx.winkel_id) {
      userCtx.winkel_fokus = "Nur der Winkel mit id " + ctx.winkel_id + " steht im Fokus dieses Assets.";
    } else {
      userCtx.winkel_fokus = "Verteile die gewaehlten Winkel ueber die Varianten/Elemente.";
    }
    const campaign = ctx.campaign || {};
    userCtx.kampagnenziel = campaign.ziel;
    userCtx.angebot = campaign.angebot;
    if (ctx.hinweis) userCtx.hinweis = ctx.hinweis;
    if (ctx.anzahl) {
      userCtx.anzahl_hinweis = "Wunsch des Teilnehmers zur Anzahl: " + ctx.anzahl + ". Halte dich sonst an die Vorgabe im Schema.";
    }
    if (ctx.template && ctx.typ === "creative") {
      userCtx.vorlage = { name: ctx.template.name, decode: ctx.template.decode };
      userCtx.vorlage_anweisung = "Baue ALLE Varianten exakt nach dieser Vorlage: gleicher Aufbau, gleiche " +
        "Headline-, Subline- und CTA-Formeln (Platzhalter mit Inhalten aus Analyse, Winkeln und Angebot fuellen), " +
        "gleiche Regeln. Der bild_prompt jeder Variante MUSS auf dem stil_prompt der Vorlage basieren, Platzhalter " +
        "durch passende Szenen dieser Zielgruppe ersetzt. bild_text folgt der Headline-Formel.";
    }
    return userCtx;
  }

  if (task === "konsistenz") {
    if (project.analyse) userCtx.analyse = project.analyse;
    const avatar = avatarContext(ctx.avatarRow);
    if (avatar) userCtx.avatar = avatar;
    const campaign = ctx.campaign || {};
    userCtx.kampagnenziel = campaign.ziel;
    userCtx.angebot = campaign.angebot;
    if (Array.isArray(ctx.winkel) && ctx.winkel.length) userCtx.winkel = ctx.winkel;
    if (Array.isArray(ctx.assets) && ctx.assets.length) userCtx.assets = ctx.assets;
    return userCtx;
  }

  return userCtx;
}


// ---- JSON-Schemas fuer den erzwungenen Tool-Aufruf (anthropic.js) ----
// Das Modell haelt sich an ein echtes input_schema deutlich zuverlaessiger als an eine
// Textbeschreibung (z. B. keine Strings statt Arrays). Die Textschemas oben bleiben als
// Erklaerung im System-Prompt.
const S = {
  str: { type: "string" },
  strArr: { type: "array", items: { type: "string" } },
  obj: (props, required) => ({ type: "object", properties: props, required: required || Object.keys(props), additionalProperties: true }),
};
// Neues Kategorie-Format (SPEC §12.3): kern (3 bis 5 Stichpunkte) plus optionale Kennzahl.
const KAT = S.obj({
  titel: S.str,
  kern: { type: "array", items: S.str, minItems: 3, maxItems: 5 },
  inhalt: S.str,
  punkte: S.strArr,
  zahl: S.obj({ wert: S.str, einheit: S.str, label: S.str }, []),
}, ["titel", "kern", "inhalt"]);
// Zusatzfeld avatar_person, nur in der Kategorie "basisprofil" (SPEC §11.2/§12.4), Pflicht.
const AVATAR_PERSON = S.obj({
  name: S.str, alter: { type: "integer" }, beruf: S.str, kurzbeschreibung: S.str, bild_prompt: S.str,
}, ["name", "alter", "beruf", "kurzbeschreibung", "bild_prompt"]);
const KAT_BASISPROFIL = S.obj({
  titel: S.str, kern: { type: "array", items: S.str, minItems: 3, maxItems: 5 }, inhalt: S.str, punkte: S.strArr,
  zahl: S.obj({ wert: S.str, einheit: S.str, label: S.str }, []), avatar_person: AVATAR_PERSON,
}, ["titel", "kern", "inhalt", "avatar_person"]);
// Zusatzfeld paare, nur in der Kategorie "hin_zu" (SPEC §12.3), Pflicht.
const KAT_HINZU = S.obj({
  titel: S.str, kern: { type: "array", items: S.str, minItems: 3, maxItems: 5 }, inhalt: S.str, punkte: S.strArr,
  zahl: S.obj({ wert: S.str, einheit: S.str, label: S.str }, []),
  paare: { type: "array", items: S.obj({ weg_von: S.str, hin_zu: S.str }, ["weg_von", "hin_zu"]), minItems: 5, maxItems: 8 },
}, ["titel", "kern", "inhalt", "paare"]);
function analyseJsonSchema(kategorien) {
  const keys = Array.isArray(kategorien) && kategorien.length ? kategorien : KATEGORIEN_ALL;
  const props = {};
  keys.forEach((k) => {
    if (k === "basisprofil") props[k] = KAT_BASISPROFIL;
    else if (k === "hin_zu") props[k] = KAT_HINZU;
    else props[k] = KAT;
  });
  props.meta = S.obj({ erzeugt_am: S.str, modell: S.str, version: S.str }, []);
  return { type: "object", properties: props, required: keys, additionalProperties: false };
}
const JSON_SCHEMAS = {
  kurzprofil: S.obj({
    steckbrief: S.obj({ wer: S.str, alter: S.str, situation: S.str, einkommen_niveau: S.str, entscheidet: S.str }),
    schmerzen: { type: "array", items: S.obj({ titel: S.str, satz: S.str }), minItems: 3, maxItems: 3 },
    wuensche: { type: "array", items: S.obj({ titel: S.str, satz: S.str }), minItems: 3, maxItems: 3 },
    situationen: { type: "array", items: S.obj({ wann_wo: S.str, was_passiert: S.str }), minItems: 3, maxItems: 3 },
    awareness: S.obj({
      stufe: { type: "string", enum: ["unbewusst", "problembewusst", "loesungsbewusst", "produktbewusst", "meistbewusst"] },
      begruendung: S.str,
    }),
    markt: S.obj({ saettigung: { type: "string", enum: ["niedrig", "mittel", "hoch"] }, satz: S.str }),
    zitate: { type: "array", items: S.str, minItems: 5, maxItems: 5 },
    einwaende: { type: "array", items: S.obj({ einwand: S.str, antwort_idee: S.str }), minItems: 3, maxItems: 3 },
    kaufausloeser: { type: "array", items: S.str, minItems: 3, maxItems: 3 },
    kanaele: { type: "array", items: S.str, minItems: 3, maxItems: 5 },
    ein_satz: S.str,
  }),
  avatar_vorschlag: S.obj({
    avatare: {
      type: "array", minItems: 3, maxItems: 3,
      items: S.obj({
        name: S.str, alter: { type: "integer" }, beruf: S.str, kurzbeschreibung: S.str,
        werte: { type: "array", items: S.str, minItems: 3, maxItems: 5 },
        ziele: S.str, sorge: S.str, aussehen: S.str, motto: S.str, bild_prompt: S.str,
      }, ["name", "alter", "beruf", "kurzbeschreibung", "werte", "ziele", "sorge", "aussehen", "motto", "bild_prompt"]),
    },
  }),
  winkel: S.obj({
    winkel: { type: "array", items: S.obj({
      id: S.str, titel: S.str, kurz: S.str,
      awareness: { type: "string", enum: ["unbewusst", "problembewusst", "loesungsbewusst", "produktbewusst", "meistbewusst"] },
      typ: { type: "string", enum: ["Mechanismus", "Feind", "Kontrast", "Story", "Zahlen", "Zeit", "Identität", "Neue Chance", "Warnung", "Frage", "Geheimnis", "Status"] },
    }, ["id", "titel", "kurz", "awareness", "typ"]) },
  }),
  creative: S.obj({
    varianten: { type: "array", items: S.obj({
      headline: S.str, subline: S.str, primary_text: S.str, cta: S.str, bild_prompt: S.str, bild_text: S.str,
      bilder: S.obj({ "1:1": { type: ["string", "null"] }, "4:5": { type: ["string", "null"] }, "9:16": { type: ["string", "null"] } }, []),
    }, ["headline", "subline", "primary_text", "cta", "bild_prompt", "bild_text"]) },
  }),
  reel: S.obj({
    skripte: { type: "array", items: S.obj({
      titel: S.str, hook_varianten: S.strArr,
      szenen: { type: "array", items: S.obj({ zeit: S.str, sprechtext: S.str, bild_hinweis: S.str, text_einblendung: S.str }) },
      cta: S.str, caption: S.str, hashtags: S.strArr, dreh_hinweise: S.str,
    }) },
  }),
  caption: S.obj({
    beitraege: { type: "array", items: S.obj({ plattform: S.str, format: S.str, hook: S.str, text: S.str, cta: S.str, hashtags: S.strArr }) },
  }),
  olg: S.obj({
    beitraege: { type: "array", items: S.obj({ kanal: S.str, typ: S.str, text: S.str, soft_cta: S.str }) },
  }),
  email: S.obj({
    sequenz_name: S.str, zweck: S.str,
    mails: { type: "array", items: S.obj({ nr: { type: "integer" }, tag: { type: "integer" }, betreff_varianten: S.strArr, preheader: S.str, text: S.str, cta: S.str, ps: S.str }) },
  }),
  vsl: S.obj({
    titel: S.str, dauer_min: { type: "number" },
    struktur: { type: "array", items: S.obj({ abschnitt: S.str, minute: S.str, sprechtext: S.str, folie_hinweis: S.str, ziel: S.str }) },
    cta_text: S.str, hinweise: S.str,
  }),
  leadmagnet: S.obj({
    titel: S.str, untertitel: S.str, versprechen: S.str, einleitung: S.str,
    kapitel: { type: "array", items: S.obj({ ueberschrift: S.str, text: S.str, punkte: S.strArr }, ["ueberschrift", "text"]) },
    checkliste: S.strArr, abschluss_cta: S.str, autor_box: S.str,
  }),
  funnel: S.obj({
    funnel_typ: S.str, begruendung: S.str,
    schritte: { type: "array", items: S.obj({
      nr: { type: "integer" }, seite: S.str, ziel: S.str, headline: S.str, subheadline: S.str,
      abschnitte: { type: "array", items: S.obj({ titel: S.str, text: S.str }) }, cta: S.str, hinweise: S.str,
    }) },
    nachfass: { type: "array", items: S.obj({ zeitpunkt: S.str, kanal: S.str, ziel: S.str, text: S.str }) },
    kennzahlen_ziel: S.str,
  }),
  konsistenz: S.obj({
    score: { type: "integer" },
    befunde: { type: "array", items: S.obj({ asset_typ: S.str, problem: S.str, vorschlag: S.str, schwere: { type: "string", enum: ["hoch", "mittel", "niedrig"] } }) },
    fazit: S.str,
  }),
  decode: S.obj({
    name_vorschlag: S.str, format: S.str,
    aufbau: S.obj({
      beschreibung: S.str, blickfuehrung: S.str,
      zonen: { type: "array", items: S.obj({ element: S.str, position: S.str, flaeche_prozent: { type: "number" }, ausrichtung: S.str }) },
    }),
    headline: S.obj({ text: S.str, typ: S.str, formel: S.str, woerter: { type: "integer" }, hebel: S.str }),
    subline: S.obj({ text: S.str, formel: S.str }),
    cta: S.obj({ text: S.str, form: S.str, position: S.str, formel: S.str }),
    weitere_texte: { type: "array", items: S.obj({ text: S.str, rolle: S.str }) },
    typografie: S.obj({ stil: S.str, gewicht: S.str, schreibweise: S.str, groessenverhaeltnis: S.str, hervorhebung: S.str, farbe_kontrast: S.str }),
    farben: { type: "array", items: S.obj({ hex: S.str, rolle: S.str }) },
    bildstil: S.obj({ art: S.str, szene: S.str, person: S.str, licht: S.str, perspektive: S.str, stimmung: S.str, look: S.str }),
    psychologie: S.obj({ emotion: S.str, awareness: S.str, treiber: S.str, scroll_stopper: S.str }),
    warum_wirkt: S.str, stil_prompt: S.str,
    copy_formeln: S.obj({ headline: S.str, subline: S.str, cta: S.str, anleitung: S.str }),
    regeln: S.strArr,
  }, ["name_vorschlag", "format", "aufbau", "headline", "subline", "cta", "typografie", "farben", "bildstil", "psychologie", "warum_wirkt", "stil_prompt", "copy_formeln", "regeln"]),
};

// ctx = { project, firma, campaign, asset, typ, winkel, winkel_id, avatarRow, profile, hinweis, mehr, anzahl, kategorien }
function buildPrompt(task, ctx) {
  ctx = ctx || {};
  const { moduleKey, schemaKey } = moduleAndSchemaFor(task, ctx);

  const istAnalyseTeil = schemaKey === "analyse";
  const schemaText = schemaKey === "analyse" ? buildAnalyseSchema(ctx.kategorien) : SCHEMAS[schemaKey];

  const system = [knowledge.basis, knowledge[moduleKey], schemaText]
    .filter((s) => typeof s === "string" && s.trim())
    .join("\n\n");

  const userCtx = buildUserContext(task, ctx);
  if (ctx.profile) userCtx.teilnehmer_profil = ctx.profile;

  // Kuerzungs-Prioritaet (SPEC §12.5): kurzprofil > brief > kern > inhalt. truncateCtx (siehe
  // _shared/text.js) kuerzt/entfernt zuerst alle "inhalt"-Felder, dann die hier genannten
  // Teilbaeume (Rueckwaertskompatibilitaet), dann "kern", dann "brief", zuletzt "kurzprofil".
  const priorityKeys = ["analyse", "bestehende_analyse"];
  const truncated = truncateCtx(userCtx, MAX_USER_CHARS, priorityKeys);
  const user = JSON.stringify(truncated);

  let max_tokens;
  if (istAnalyseTeil) max_tokens = ANALYSE_TEIL_MAX_TOKENS;
  else max_tokens = MAX_TOKENS[task] || MAX_TOKENS[schemaKey] || 20000;

  const temperature = Object.prototype.hasOwnProperty.call(TEMPERATURE, task) ? TEMPERATURE[task] : DEFAULT_TEMPERATURE;

  const input_schema = schemaKey === "analyse" ? analyseJsonSchema(ctx.kategorien) : JSON_SCHEMAS[schemaKey];
  const model = modelFor(task);
  const effort = effortFor(task);
  return { system, user, max_tokens, temperature, input_schema, model, effort };
}

module.exports = {
  buildPrompt, SCHEMAS, JSON_SCHEMAS, MODULE_BY_TYPE, KATEGORIEN_ALL, KATEGORIE_TEILE,
  KATEGORIE_PAARE, modelFor, effortFor,
};
