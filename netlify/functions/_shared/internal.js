// internal.js  -  Interner Aufrufschutz zwischen ai.mjs (Starter) und ai-background.mjs
// (Stand 25.09.2026)
//
// Die Background-Function ai-background.mjs ist ueber ihre URL grundsaetzlich von
// aussen erreichbar (Netlify kennt keine "nur intern"-Functions). Damit niemand fremde
// Jobs anstossen oder Jobs mehrfach anschieben kann, muss jeder Aufruf ein Token im
// Header x-me-internal mitbringen: HMAC-SHA256 (Schluessel AI_GUARD_SALT, Nachricht die
// Job-ID) als Hex-String. Nur der Starter kennt AI_GUARD_SALT und kann das Token bauen,
// die Background-Function prueft es gegen dieselbe Berechnung.
//
// Keine Abhaengigkeiten, Node 18+ (nutzt das eingebaute Modul node:crypto).

"use strict";

const crypto = require("crypto");

function internalToken(jobId) {
  const salt = process.env.AI_GUARD_SALT || "dreamlife-ai-guard";
  return crypto.createHmac("sha256", salt).update(String(jobId || "")).digest("hex");
}

module.exports = { internalToken };
