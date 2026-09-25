#!/usr/bin/env node
// bundle-knowledge.mjs, baut netlify/functions/_shared/knowledge.js aus den Markdown-
// Dateien in netlify/functions/_shared/knowledge/*.md (Stand 25.09.2026).
//
// Aufruf: node tools/bundle-knowledge.mjs
// Wird NICHT deployt (siehe §2 der Spezifikation), nur beim Bauen/Aktualisieren der
// Wissensmodule ausgefuehrt. Fehlt eine .md-Datei (weil ein anderer Agent noch daran
// arbeitet), wird an ihrer Stelle ein leerer String eingetragen und eine Warnung
// ausgegeben, statt eigene Inhalte zu erfinden.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(__dirname, "..", "netlify", "functions", "_shared", "knowledge");
const OUT_FILE = path.join(__dirname, "..", "netlify", "functions", "_shared", "knowledge.js");

// Reihenfolge und Namen exakt nach §6 der Spezifikation (Dateiname ohne .md = Schluessel).
const KEYS = [
  "basis", "zielgruppe", "winkel", "creatives", "reels", "social",
  "olg", "emails", "vsl", "leadmagnet", "funnel", "konsistenz", "decoder",
];

function main() {
  const values = {};
  let gefuellt = 0;
  for (const key of KEYS) {
    const file = path.join(KNOWLEDGE_DIR, key + ".md");
    if (existsSync(file)) {
      values[key] = readFileSync(file, "utf8");
      gefuellt++;
    } else {
      values[key] = "";
      console.warn("bundle-knowledge: Wissensmodul fehlt noch, wird leer eingetragen: " + key + ".md");
    }
  }

  const lines = [];
  lines.push("// knowledge.js, AUTOMATISCH ERZEUGT von tools/bundle-knowledge.mjs.");
  lines.push("// Nicht von Hand bearbeiten. Quelle: netlify/functions/_shared/knowledge/*.md");
  lines.push('"use strict";');
  lines.push("");
  lines.push("module.exports = {");
  for (const key of KEYS) {
    lines.push("  " + key + ": " + JSON.stringify(values[key]) + ",");
  }
  lines.push("};");
  lines.push("");

  writeFileSync(OUT_FILE, lines.join("\n"), "utf8");
  console.log("bundle-knowledge: knowledge.js geschrieben (" + gefuellt + "/" + KEYS.length + " Module gefuellt).");
}

main();
