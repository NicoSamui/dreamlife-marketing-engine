// alert.js  -  Benachrichtigt Nico per WhatsApp (CallMeBot), wenn ein KI-Anbieter ausfaellt
// (z. B. Guthaben aufgebraucht, Schluessel ungueltig). Hoechstens eine Nachricht je Grund
// und 6 Stunden (Drossel ueber die RPC api_rate_hit). Fehler hier blockieren nie die App.
//
// Env: CALLMEBOT_PHONE, CALLMEBOT_APIKEY (fehlen sie, passiert nichts),
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (fuer die Drossel)

"use strict";

async function throttleOk(bucket) {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  if (!base || !key) return true;
  try {
    const r = await fetch(base + "/rest/v1/rpc/api_rate_hit", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_uid: "system", p_bucket: bucket, p_window_seconds: 21600, p_max: 1 }),
    });
    if (!r.ok) return true;
    return (await r.json()) !== false;
  } catch (e) { return true; }
}

async function notifyAdmin(grund, text) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apikey) return false;
  try {
    if (!(await throttleOk("me-alert:" + grund))) return false;
    const msg = "Marketing Engine: " + String(text || grund).slice(0, 600);
    const url = "https://api.callmebot.com/whatsapp.php?phone=" + encodeURIComponent(phone) +
      "&text=" + encodeURIComponent(msg) + "&apikey=" + encodeURIComponent(apikey);
    const r = await fetch(url);
    return r.ok;
  } catch (e) { return false; }
}

// Erkennt Anbieter-Fehler, die nicht der Teilnehmer verursacht hat und die Nico beheben muss.
function classifyProviderError(status, message) {
  const m = String(message || "").toLowerCase();
  if (/credit balance|billing|insufficient_quota|exceeded your current quota|payment/.test(m)) return "guthaben";
  if (status === 401 || status === 403 || /invalid x-api-key|incorrect api key|authentication/.test(m)) return "schluessel";
  return null;
}

const FREUNDLICH = "Die KI ist gerade nicht verfügbar. Das Dreamlife-Team ist schon informiert. Bitte versuch es später noch einmal.";

module.exports = { notifyAdmin, classifyProviderError, FREUNDLICH };
