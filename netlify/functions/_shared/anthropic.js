// anthropic.js  -  Gemeinsamer Anthropic-Aufruf fuer ai-background.mjs (Stand 25.09.2026)
//
// Ruft die Anthropic-Messages-API mit stream:true auf, liest den SSE-Text-Strom und
// liefert den gesammelten Text als Promise. Auto-Retry bei 429/529/5xx/Netzfehler (bis
// zu 3 Versuche, wie bisher in ai.mjs). Kein temperature-Feld im Payload (neuere Modelle
// wie Opus 5.x lehnen es ab). Keine Abhaengigkeiten, Node 18+ (globales fetch).

"use strict";

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
  const body = {
    model: opts.model,
    max_tokens: opts.max_tokens,
    stream: true,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  };
  if (json) {
    body.tools = [{
      name: "ergebnis",
      description: "Liefert das fertige Ergebnis als JSON-Objekt genau nach dem im System-Prompt beschriebenen Schema.",
      input_schema: { type: "object", additionalProperties: true },
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
    const retriable = res.status === 429 || res.status === 529 || res.status >= 500;
    if (!retriable) break;
  }
  if (!upstream) throw new Error(lastMsg);

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullText = "";

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
        const d = ev.type === "content_block_delta" && ev.delta ? ev.delta : null;
        const piece = d ? (typeof d.partial_json === "string" ? d.partial_json : (typeof d.text === "string" ? d.text : null)) : null;
        if (piece !== null) {
          fullText += piece;
          if (opts.onDelta) {
            try { opts.onDelta(piece, fullText.length); } catch (e) { /* Fortschritt ist nie ein Abbruchgrund */ }
          }
        }
      } catch (e) { /* Zeile ueberspringen */ }
    }
  }
  if (!fullText.trim()) throw new Error("Die KI hat keinen Text geliefert.");
  return fullText;
}

module.exports = { streamText };
