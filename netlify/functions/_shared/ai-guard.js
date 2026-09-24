// ai-guard.js  -  Kostenbremse fuer KI-Funktionen der Dreamlife-Apps (Stand 24.09.2026)
//
// Ablage: netlify/functions/_shared/ai-guard.js (je App eine identische Kopie).
// Der Ordner _shared enthaelt weder _shared.js noch index.js und wird daher von
// Netlify NICHT als eigene Funktion veroeffentlicht. Die Funktionen binden die Datei
// per relativem require/import ein, der Bundler packt sie mit in das Funktions-Paket.
//
// Was die Datei prueft (in dieser Reihenfolge):
//   1. uid-Format wie im Gateway (UID_RE aus scoped-db.js).
//   2. Drossel pro IP (IP als SHA-256-Hash, nie im Klartext gespeichert).
//   3. Drossel pro uid (optional, fuer Funktionen ohne eigenes Tageslimit).
//   4. Globales Tageslimit je App und Funktionsart, gegen verteilte Angriffe.
// Gezaehlt wird ueber die RPC api_rate_hit (Supabase, nur mit Service-Key).
// Feste Zeitfenster (UTC), abgelehnte Aufrufe zaehlen im laufenden Fenster mit.
// Eine abgelehnte Stufe erhoeht die folgenden Zaehler nicht.
//
// Fail-open: Fehlt der Service-Key oder ist die RPC nicht erreichbar bzw. meldet einen
// Fehler, wird NICHT blockiert (Verfuegbarkeit fuer echte Teilnehmer geht vor). Das
// wird per console.warn protokolliert. In diesem Fall wirken nur uid-Format und die
// bestehenden Limits der jeweiligen Funktion.
//
// Env (alle optional):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Fallback SUPABASE_SERVICE_KEY)
//   AI_IP_MAX_PER_HOUR[_<ART>]       Aufrufe pro IP und Stunde
//   AI_UID_MAX_PER_DAY[_<ART>]       Aufrufe pro uid und Tag (nur wo aktiviert)
//   AI_GLOBAL_MAX_PER_DAY[_<ART>]    Aufrufe der ganzen App pro Tag
//   AI_GUARD_SALT                    zusaetzliches Salz fuer den IP-Hash
// <ART> ist die Funktionsart in Grossbuchstaben, z.B. AI_IP_MAX_PER_HOUR_IMAGE.
// Die spezifische Variable hat Vorrang vor der allgemeinen, diese vor dem Standardwert.
// Keine Abhaengigkeiten, Node 18+.

"use strict";

const UID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{5,99}$/;
const HOUR = 3600;
const DAY = 86400;

// Deutsche Meldungen im Stil der bestehenden Fehlermeldungen.
const MSG = {
  noUid: "Kein Nutzer erkannt. Bitte über Learning Suite öffnen.",
  badUid: "Ungültige Nutzer-ID. Bitte die App über Learning Suite öffnen.",
  ip: "Zu viele KI-Anfragen von deinem Anschluss. Bitte warte etwas und versuch es in einer Stunde nochmal.",
  uid: "Dein KI-Tageslimit ist erreicht. Morgen geht es weiter.",
  global: "Die KI ist für heute ausgelastet. Bitte versuch es morgen nochmal.",
};

// Wie cleanId in den Funktionen: leere Werte und ungeloeste Platzhalter gelten als fehlend.
function cleanId(v) {
  v = (v == null ? "" : "" + v).trim();
  if (!v || v === "null" || v === "undefined") return "";
  if (/^\[\[.*\]\]$/.test(v) || /^\{\{.*\}\}$/.test(v)) return "";
  return v;
}

function envInt(names, fallback) {
  for (const n of names) {
    const raw = process.env[n];
    if (raw === undefined || raw === "") continue;
    const x = parseInt(raw, 10);
    if (Number.isFinite(x) && x > 0) return x;
  }
  return fallback;
}

// Liest einen Header aus einem Lambda-Objekt (event.headers) oder einem Headers-Objekt (Request).
function header(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) if (k.toLowerCase() === lower) return String(headers[k] || "");
  return "";
}

function clientIp(headers) {
  const raw = header(headers, "x-nf-client-connection-ip") || header(headers, "x-forwarded-for");
  return String(raw).split(",")[0].trim() || "unknown";
}

async function sha256hex(s) {
  const c = globalThis.crypto;
  if (c && c.subtle && typeof TextEncoder !== "undefined") {
    const buf = await c.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback fuer Node ohne globales WebCrypto
  return require("crypto").createHash("sha256").update(s).digest("hex");
}

function supa() {
  const base = String(process.env.SUPABASE_URL || "https://pkugrquuudreqkwletyv.supabase.co").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  return { base, key };
}

// true = erlaubt, false = Limit erreicht, null = nicht pruefbar (fail-open)
async function rateHit(id, bucket, windowSec, max) {
  const { base, key } = supa();
  if (!key) return null;
  try {
    const r = await fetch(base + "/rest/v1/rpc/api_rate_hit", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_uid: id, p_bucket: bucket, p_window_seconds: windowSec, p_max: max }),
    });
    if (!r.ok) return null;
    return (await r.json()) !== false;
  } catch (e) {
    return null;
  }
}

// Liefert die wirksamen Grenzen fuer eine App und Funktionsart.
function limits(opts) {
  const kind = String(opts.kind || "ai").toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const d = opts.defaults || {};
  return {
    ipPerHour: envInt(["AI_IP_MAX_PER_HOUR_" + kind, "AI_IP_MAX_PER_HOUR"], d.ipPerHour || 40),
    uidPerDay: d.uidPerDay ? envInt(["AI_UID_MAX_PER_DAY_" + kind, "AI_UID_MAX_PER_DAY"], d.uidPerDay) : 0,
    globalPerDay: envInt(["AI_GLOBAL_MAX_PER_DAY_" + kind, "AI_GLOBAL_MAX_PER_DAY"], d.globalPerDay || 1500),
  };
}

// Nur das Format pruefen. Ergebnis: { ok, uid } oder { ok:false, status, error, code }.
function checkUid(rawUid, messages) {
  const m = Object.assign({}, MSG, messages || {});
  const uid = cleanId(rawUid);
  if (!uid) return { ok: false, status: 401, code: "no_uid", error: m.noUid };
  if (!UID_RE.test(uid)) return { ok: false, status: 400, code: "bad_uid", error: m.badUid };
  return { ok: true, uid };
}

// Hauptpruefung.
// opts: { app, kind, uid, headers, defaults:{ipPerHour, uidPerDay, globalPerDay}, messages }
// Ergebnis: { ok:true, uid, failOpen } oder { ok:false, status, code, error }
async function guard(opts) {
  const u = checkUid(opts.uid, opts.messages);
  if (!u.ok) return u;
  const m = Object.assign({}, MSG, opts.messages || {});
  const app = String(opts.app || "app");
  const kind = String(opts.kind || "ai");
  const lim = limits(opts);
  const prefix = "ai:" + app + ":" + kind;
  const salt = process.env.AI_GUARD_SALT || "dreamlife-ai-guard";
  const ipId = "ip:" + (await sha256hex(salt + "|" + app + "|" + clientIp(opts.headers))).slice(0, 32);
  let failOpen = false;

  const steps = [
    { id: ipId, bucket: prefix + ":ip", win: HOUR, max: lim.ipPerHour, code: "rate_ip", error: m.ip },
  ];
  if (lim.uidPerDay) steps.push({ id: u.uid, bucket: prefix + ":uid", win: DAY, max: lim.uidPerDay, code: "rate_uid", error: m.uid });
  steps.push({ id: "all", bucket: prefix + ":global", win: DAY, max: lim.globalPerDay, code: "rate_global", error: m.global });

  for (const s of steps) {
    const res = await rateHit(s.id, s.bucket, s.win, s.max);
    if (res === null) { failOpen = true; continue; }
    if (res === false) return { ok: false, status: 429, code: s.code, error: s.error };
  }
  if (failOpen) console.warn("ai-guard: Drossel nicht pruefbar (fail-open)", app, kind);
  return { ok: true, uid: u.uid, failOpen };
}

module.exports = { guard, checkUid, cleanId, clientIp, limits, UID_RE, MSG };
