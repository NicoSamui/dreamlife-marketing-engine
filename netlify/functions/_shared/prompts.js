// prompts.js  -  Prompt-Bauer je Aufgabe (Stand 25.09.2026)
//
// Baut System- und User-Prompt fuer ai.mjs. Das System besteht aus dem Basis-Wissen,
// dem passenden Wissensmodul (siehe MODULE_BY_TYPE und §6 der Spezifikation) und der
// Schema-Beschreibung des erwarteten JSON. Das User-Prompt ist der vollstaendige
// Kontext (Brief, Analyse, Winkel, Kampagne, Angebot, Hinweis) als JSON-Text, gekuerzt
// auf hoechstens 60000 Zeichen. Nur serverseitig verwendet, der Browser sieht diese
// Datei nie.

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

const MAX_TOKENS = {
  analyse: 14000,
  verfeinern: 14000,
  winkel: 8000,
  asset: 10000,
  konsistenz: 4000,
};

const TEMPERATURE = {
  analyse: 0.5,
  verfeinern: 0.5,
};
const DEFAULT_TEMPERATURE = 0.7;

const MAX_USER_CHARS = 60000;

// Reihenfolge aller 17 Analyse-Kategorien aus §3 der Spezifikation.
const KATEGORIEN_ALL = [
  "basisprofil", "wissensstand", "marktwissen", "weg_von", "hin_zu", "reale_situationen",
  "disg", "life_force_8", "sekundaere_wuensche_9", "einwaende", "awareness_stufe",
  "glaubenssaetze", "sprache_zitate", "kaufausloeser", "kanaele", "entscheidungsprozess",
  "zusammenfassung",
];

// Aufteilung der 17 Kategorien in 4 Teile fuer die parallelen Hintergrund-Anfragen
// (ai-background.mjs). "meta" gehoert nur zu Teil 4 dazu.
const KATEGORIE_TEILE = {
  1: ["basisprofil", "wissensstand", "marktwissen", "weg_von"],
  2: ["hin_zu", "reale_situationen", "disg", "life_force_8"],
  3: ["sekundaere_wuensche_9", "einwaende", "awareness_stufe", "glaubenssaetze", "sprache_zitate"],
  4: ["kaufausloeser", "kanaele", "entscheidungsprozess", "zusammenfassung"],
};

// ---- Schema-Beschreibungen (aus §3 der Spezifikation) ----

// Baut das Analyse-Schema. Ohne "kategorien" (oder mit einer leeren Liste) das volle
// Schema mit allen 17 Kategorien plus "meta" (Standardfall, Rueckwaertskompatibel).
// Mit "kategorien" nur die genannten Kategorien, "meta" nur wenn "zusammenfassung"
// darunter ist (Teil 4 der Hintergrund-Anfragen, siehe KATEGORIE_TEILE).
function buildAnalyseSchema(kategorien) {
  const teil = Array.isArray(kategorien) && kategorien.length ? kategorien : null;
  const keys = teil || KATEGORIEN_ALL;
  const withMeta = !teil || keys.indexOf("zusammenfassung") !== -1;
  const lines = keys.map((k) => `  "${k}": { "titel": "string", "inhalt": "string (ausfuehrliches Markdown)", "punkte": ["string", "..."] }`);
  if (withMeta) lines.push(`  "meta": { "erzeugt_am": "ISO-Datum als string", "modell": "string", "version": "string" }`);
  let out = "Gib GENAU dieses JSON-Objekt zurueck, keine zusaetzlichen Schluessel, keine fehlenden:\n{\n" + lines.join(",\n") + "\n}\n";
  if (teil) {
    out += "Erzeuge NUR diese Kategorien, jede mindestens so ausfuehrlich wie im Wissensmodul verlangt.\n";
  } else {
    out += "Reihenfolge der Kategorien genau wie oben. \"punkte\" ist optional, \"titel\" und \"inhalt\" sind Pflicht.\n";
  }
  out += "Jede Kategorie braucht einen ausfuehrlichen, konkreten \"inhalt\"-Text (mehrere Absaetze), keine Stichworte statt Text.";
  return out;
}

const ANALYSE_SCHEMA = buildAnalyseSchema();

const WINKEL_SCHEMA = `Gib GENAU dieses JSON-Objekt zurueck:
{
  "winkel": [
    {
      "id": "w1",
      "titel": "string",
      "kernbotschaft": "string",
      "bezug": "string (welcher Schmerz oder Wunsch aus der Analyse aufgegriffen wird)",
      "awareness": "unbewusst|problembewusst|loesungsbewusst|produktbewusst|meistbewusst",
      "treiber": "string (Bezug zu Life Force 8)",
      "hook_beispiel": "string",
      "warum_wirkt": "string",
      "formate": ["creative", "reel", "caption", "olg", "email", "vsl", "leadmagnet", "funnel"],
      "risiko": "string"
    }
  ]
}
Ohne "mehr": erzeuge 16 bis 20 unterschiedliche Winkel mit IDs w1, w2, w3 und so weiter, ueber alle
Awareness-Stufen verteilt (Mechanismus-Winkel, Feind-Winkel, Kontrast-Winkel, Story-Winkel, Zahlen-Winkel,
Zeit-Winkel, Identitaets-Winkel). Mit "mehr": erzeuge genau 8 neue Winkel, keine Wiederholung der
bestehenden Titel, IDs fortlaufend ab der im Nutzer-Kontext genannten Nummer.`;

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
};

function moduleAndSchemaFor(task, ctx) {
  if (task === "analyse" || task === "verfeinern") {
    return { moduleKey: "zielgruppe", schemaKey: "analyse" };
  }
  if (task === "winkel") {
    return { moduleKey: "winkel", schemaKey: "winkel" };
  }
  if (task === "konsistenz") {
    return { moduleKey: "konsistenz", schemaKey: "konsistenz" };
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

// Baut das User-Kontextobjekt (vor dem Kuerzen) fuer eine Aufgabe.
function buildUserContext(task, ctx) {
  const project = ctx.project || {};
  const userCtx = { brief: briefFields(project.brief) };

  if (task === "analyse" || task === "verfeinern") {
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

  if (task === "winkel") {
    if (project.analyse) userCtx.analyse = project.analyse;
    if (ctx.mehr && Array.isArray(project.winkel) && project.winkel.length) {
      userCtx.bestehende_winkel_titel = project.winkel.map((w) => w && w.titel).filter(Boolean);
      userCtx.hinweis =
        "Erzeuge 8 neue Winkel, keine Wiederholung der bestehenden, IDs fortlaufend ab w" +
        (project.winkel.length + 1) + ".";
    }
    return userCtx;
  }

  if (task === "asset") {
    if (project.analyse) userCtx.analyse = project.analyse;
    if (Array.isArray(ctx.winkel) && ctx.winkel.length) userCtx.winkel = ctx.winkel;
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
    return userCtx;
  }

  if (task === "konsistenz") {
    if (project.analyse) userCtx.analyse = project.analyse;
    const campaign = ctx.campaign || {};
    userCtx.kampagnenziel = campaign.ziel;
    userCtx.angebot = campaign.angebot;
    if (Array.isArray(ctx.winkel) && ctx.winkel.length) userCtx.winkel = ctx.winkel;
    if (Array.isArray(ctx.assets) && ctx.assets.length) userCtx.assets = ctx.assets;
    return userCtx;
  }

  return userCtx;
}

// ctx = { project, campaign, asset, typ, winkel, winkel_id, profile, hinweis, mehr, anzahl }
function buildPrompt(task, ctx) {
  ctx = ctx || {};
  const { moduleKey, schemaKey } = moduleAndSchemaFor(task, ctx);

  const istAnalyseTeil = schemaKey === "analyse" && Array.isArray(ctx.kategorien) && ctx.kategorien.length;
  const schemaText = schemaKey === "analyse" ? buildAnalyseSchema(ctx.kategorien) : SCHEMAS[schemaKey];

  const system = [knowledge.basis, knowledge[moduleKey], schemaText]
    .filter((s) => typeof s === "string" && s.trim())
    .join("\n\n");

  const userCtx = buildUserContext(task, ctx);
  if (ctx.profile) userCtx.teilnehmer_profil = ctx.profile;

  const priorityKeys = ["analyse", "bestehende_analyse"];
  const truncated = truncateCtx(userCtx, MAX_USER_CHARS, priorityKeys);
  const user = JSON.stringify(truncated);

  // Ein Teil der Analyse (parallele Hintergrund-Anfrage) braucht weniger Tokens als die
  // ganze Analyse, siehe ai-background.mjs.
  const max_tokens = istAnalyseTeil ? 7000 : (MAX_TOKENS[task] || 8000);
  const temperature = Object.prototype.hasOwnProperty.call(TEMPERATURE, task) ? TEMPERATURE[task] : DEFAULT_TEMPERATURE;

  return { system, user, max_tokens, temperature };
}

module.exports = { buildPrompt, SCHEMAS, MODULE_BY_TYPE, KATEGORIEN_ALL, KATEGORIE_TEILE };
