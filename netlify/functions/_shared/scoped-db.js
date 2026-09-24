// scoped-db.js  -  Sicherheits-Gateway fuer Dreamlife-Teilnehmer-Apps (Stand 24.09.2026)
//
// Der Browser spricht nicht mehr direkt mit Supabase. Er schickt PostgREST-Anfragen an
// diese Netlify-Funktion. Die Funktion
//   - prueft die Learning-Suite-uid (Format),
//   - erlaubt nur konfigurierte Tabellen und Methoden,
//   - haengt bei Lesen/Aendern/Loeschen immer "<owner>=eq.<uid>" an (nur eigene Zeilen),
//   - setzt beim Schreiben die owner-Spalte zwangsweise auf die uid,
//   - verhindert, dass ein Upsert fremde Zeilen ueberschreibt,
//   - verbietet Joins/Embeds, or/and-Filter und Filter auf die owner-Spalte,
//   - leitet mit dem geheimen Service-Key weiter.
// Admin-Modus (optional): gueltiges Supabase-Login-Token einer freigegebenen E-Mail
// (Env ADMIN_EMAILS) hebt die owner-Bindung fuer freigegebene Tabellen auf.
// Keine Abhaengigkeiten, Node 18+ (globales fetch).

"use strict";

const UID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{5,99}$/;
const COL_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FILTER_RE = /^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|in|is|cs|cd)\./;
const SELECT_RE = /^[A-Za-z0-9_,*:\->\s]+$/;
const ORDER_RE = /^[A-Za-z0-9_,.\->]+$/;
const PREFER_OK = new Set([
  "return=minimal", "return=representation", "return=headers-only",
  "resolution=merge-duplicates", "resolution=ignore-duplicates",
  "count=exact", "count=planned", "count=estimated", "missing=default",
]);
const ACCEPT_OK = new Set(["application/json", "application/vnd.pgrst.object+json", "*/*"]);
const MAX_BODY = 4 * 1024 * 1024;

class GwError extends Error {
  constructor(status, code, msg) { super(msg); this.status = status; this.code = code; }
}
const bad = (m) => new GwError(400, "bad_request", m);
const forbidden = (m) => new GwError(403, "forbidden", m);

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function cleanPrefer(p) {
  if (!p) return "";
  return String(p).split(",").map(s => s.trim()).filter(s => PREFER_OK.has(s)).join(",");
}
function cleanAccept(a) {
  if (!a) return "application/json";
  const first = String(a).split(",")[0].trim();
  return ACCEPT_OK.has(first) ? first : "application/json";
}

// Zerlegt "tabelle?query" und validiert die Parameter.
function parsePath(path) {
  if (typeof path !== "string" || path.length > 4000) throw bad("Ungueltiger Pfad.");
  const q = path.indexOf("?");
  const table = decodeURIComponent(q < 0 ? path : path.slice(0, q)).replace(/^\/+/, "");
  const params = new URLSearchParams(q < 0 ? "" : path.slice(q + 1));
  return { table, params };
}

function buildQuery(cfg, method, params, uid, scoped) {
  const out = new URLSearchParams();
  let onConflict = null;
  let hasLimit = false;
  for (const [k, v] of params) {
    if (k === "select") {
      if (!SELECT_RE.test(v) || v.includes("(")) throw forbidden("select mit Verknuepfungen ist nicht erlaubt.");
      out.append(k, v);
    } else if (k === "order") {
      if (!ORDER_RE.test(v)) throw bad("order ungueltig.");
      out.append(k, v);
    } else if (k === "limit" || k === "offset") {
      if (!/^\d{1,6}$/.test(v)) throw bad(k + " ungueltig.");
      if (k === "limit") hasLimit = true;
      out.append(k, v);
    } else if (k === "on_conflict") {
      const cols = v.split(",");
      if (!cols.every(c => COL_RE.test(c))) throw bad("on_conflict ungueltig.");
      onConflict = cols;
      out.append(k, v);
    } else if (k === "columns") {
      const cols = v.replace(/"/g, "").split(",");
      if (!cols.every(c => COL_RE.test(c))) throw bad("columns ungueltig.");
      if (scoped && !cols.includes(cfg.owner)) cols.push(cfg.owner); // erzwungene uid darf nicht verloren gehen
      out.append(k, cols.join(","));
    } else {
      if (!COL_RE.test(k) || k === "or" || k === "and" || k === "not") throw forbidden("Filter nicht erlaubt: " + k);
      if (!FILTER_RE.test(v)) throw forbidden("Filter-Operator nicht erlaubt.");
      if (scoped && k === cfg.owner) {
        if (v !== "eq." + uid) throw forbidden("Fremde Daten sind nicht abrufbar.");
        continue; // wird unten verbindlich gesetzt
      }
      out.append(k, v);
    }
  }
  if (scoped && method !== "POST") out.append(cfg.owner, "eq." + uid);
  if (method === "GET" && !hasLimit) out.append("limit", String(cfg.maxRows || 1000));
  return { query: out.toString(), onConflict };
}

function sbHeaders(key, extra) {
  return Object.assign({ apikey: key, Authorization: "Bearer " + key }, extra || {});
}

async function upstream(url, key, init) {
  return fetch(url, Object.assign({}, init, { headers: sbHeaders(key, init && init.headers) }));
}

// Prueft, ob ein Upsert fremde Zeilen treffen wuerde (fremde owner oder owner NULL).
async function assertNoForeignConflict(base, key, table, cfg, rows, conflictCols, uid) {
  if (!conflictCols || !conflictCols.length) return;
  if (conflictCols.includes(cfg.owner)) return; // Konflikt nur innerhalb der eigenen Zeilen moeglich
  const complete = rows.filter(r => conflictCols.every(c => r[c] !== undefined && r[c] !== null));
  if (!complete.length) return;
  const ownerChecks = [`${cfg.owner}=neq.${encodeURIComponent(uid)}`, `${cfg.owner}=is.null`];
  const probe = async (filter) => {
    for (const oc of ownerChecks) {
      const r = await upstream(`${base}/rest/v1/${table}?select=${cfg.owner}&${filter}&${oc}&limit=1`, key, {});
      if (!r.ok) throw new GwError(502, "upstream", "Pruefung fehlgeschlagen.");
      if ((await r.json()).length) throw new GwError(409, "conflict_foreign", "Dieser Datensatz gehoert nicht dir.");
    }
  };
  if (conflictCols.length === 1) {
    const col = conflictCols[0];
    const vals = [...new Set(complete.map(r => String(r[col])))];
    for (let i = 0; i < vals.length; i += 100) {
      const chunk = vals.slice(i, i + 100).map(v => '"' + v.replace(/"/g, '""') + '"').join(",");
      await probe(`${col}=in.(${encodeURIComponent(chunk)})`);
    }
  } else {
    for (const row of complete.slice(0, 500)) {
      await probe(conflictCols.map(c => `${c}=eq.${encodeURIComponent(String(row[c]))}`).join("&"));
    }
  }
}

async function adminEmail(base, key, token, allowed) {
  if (!token || !allowed.length) return null;
  const r = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json();
  const em = String(u && u.email || "").toLowerCase();
  return allowed.includes(em) ? em : null;
}

async function rateOk(base, key, uid, bucket, windowSec, max) {
  try {
    const r = await fetch(`${base}/rest/v1/rpc/api_rate_hit`, {
      method: "POST",
      headers: sbHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify({ p_uid: uid, p_bucket: bucket, p_window_seconds: windowSec, p_max: max }),
    });
    if (!r.ok) return true; // fail-open: Verfuegbarkeit vor Drossel
    return (await r.json()) !== false;
  } catch (e) { return true; }
}

function json(status, obj, extraHeaders) {
  return {
    statusCode: status,
    headers: Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, extraHeaders || {}),
    body: JSON.stringify(obj),
  };
}

// options:
//   app: Kurzname (fuer Rate-Limit-Bucket)
//   tables: { name: { owner, methods:[...], conflictKeys:[...], maxRows, admin:boolean } }
//   actions: { name: async (ctx) => ({status, body}) }  ctx = { uid, body, db, base, key, admin }
//   rate: { windowSec, max }
//   adminEnv: Name der Env-Var mit erlaubten Admin-E-Mails (Standard ADMIN_EMAILS)
// Eigene Origins: Netlify-Site-URL(s) plus optional ALLOWED_ORIGINS (Komma-Liste). Ohne
// Origin-Header (Server-zu-Server, curl, Tests) wird nicht blockiert.
function ownOrigins() {
  const list = [env("URL", ""), env("DEPLOY_PRIME_URL", ""), env("DEPLOY_URL", "")]
    .concat(String(env("ALLOWED_ORIGINS", "")).split(","))
    .map((x) => String(x || "").trim().replace(/\/+$/, "").toLowerCase())
    .filter(Boolean);
  return new Set(list);
}
function originAllowed(event) {
  const h = (event && event.headers) || {};
  let origin = "";
  for (const k of Object.keys(h)) if (k.toLowerCase() === "origin") { origin = String(h[k] || ""); break; }
  origin = origin.trim().replace(/\/+$/, "").toLowerCase();
  if (!origin || origin === "null") return !origin; // kein Origin: ok; "null" (sandbox/file): nein
  const own = ownOrigins();
  if (own.size === 0) return true; // lokal ohne Netlify-Env: nicht blockieren
  return own.has(origin);
}

function createGateway(options) {
  const tables = options.tables || {};
  const actions = options.actions || {};
  const rate = options.rate || { windowSec: 600, max: 1500 };
  const appName = options.app || "app";

  return async function handler(event) {
    const base = env("SUPABASE_URL", "").replace(/\/+$/, "");
    const key = env("SUPABASE_SERVICE_ROLE_KEY", env("SUPABASE_SERVICE_KEY", ""));
    if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: {}, body: "" };
    if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });
    // Origin-Schutz (24.09.2026): uid-gebundene Aufrufe nur von der eigenen Site. Browser senden
    // bei Cross-Origin-POSTs immer einen Origin-Header; eine fremde Seite (z. B. eine auf
    // website-parkplatz.de veroeffentlichte Teilnehmerseite) koennte sonst "blind" mit einer
    // erratenen uid schreiben, auch wenn sie die Antwort nicht lesen darf.
    if (!originAllowed(event)) return json(403, { error: "foreign_origin", message: "Aufruf von fremder Seite nicht erlaubt." });
    if (!base || !key) return json(503, { error: "not_configured", message: "Server ist noch nicht eingerichtet." });
    if ((event.body || "").length > MAX_BODY) return json(413, { error: "too_large" });

    let req;
    try { req = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "bad_json" }); }

    try {
      const allowedAdmins = String(env(options.adminEnv || "ADMIN_EMAILS", "")).toLowerCase().split(/[,\s]+/).filter(Boolean);
      const admin = req.adminToken ? await adminEmail(base, key, String(req.adminToken), allowedAdmins) : null;
      if (req.adminToken && !admin) throw new GwError(401, "admin_denied", "Kein Admin-Zugang.");

      const uid = typeof req.uid === "string" ? req.uid.trim() : "";
      if (!admin && !UID_RE.test(uid)) throw new GwError(401, "no_uid", "Nicht angemeldet.");

      const rateId = admin ? "admin:" + admin : uid;
      if (!(await rateOk(base, key, rateId, appName, rate.windowSec, rate.max))) {
        throw new GwError(429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.");
      }

      const db = {
        base, key,
        get: async (path) => { const r = await upstream(`${base}/rest/v1/${path}`, key, {}); if (!r.ok) throw new GwError(502, "upstream", await r.text()); return r.json(); },
        send: async (method, path, body, prefer) => {
          const r = await upstream(`${base}/rest/v1/${path}`, key, { method, headers: { "Content-Type": "application/json", Prefer: prefer || "return=minimal" }, body: body === undefined ? undefined : JSON.stringify(body) });
          if (!r.ok) throw new GwError(r.status, "upstream", await r.text());
          const t = await r.text(); return t ? JSON.parse(t) : null;
        },
      };

      if (req.op && req.op !== "rest") {
        const fn = Object.prototype.hasOwnProperty.call(actions, req.op) ? actions[req.op] : null;
        if (typeof fn !== "function") throw bad("Unbekannte Aktion.");
        const res = await fn({ uid, body: req, db, base, key, admin });
        return json(res.status || 200, res.body === undefined ? {} : res.body);
      }

      // ---- generischer, auf die uid begrenzter PostgREST-Durchgang ----
      const method = String(req.method || "GET").toUpperCase();
      if (!["GET", "HEAD", "POST", "PATCH", "DELETE"].includes(method)) throw bad("Methode nicht erlaubt.");
      const { table, params } = parsePath(req.path);
      const cfg = tables[table];
      if (!cfg) throw forbidden("Tabelle nicht freigegeben.");
      const scoped = !(admin && cfg.admin);
      if (!admin && cfg.adminOnly) throw forbidden("Nur fuer Admins.");
      const methods = scoped ? (cfg.methods || ["GET"]) : (cfg.adminMethods || cfg.methods || ["GET"]);
      if (!methods.includes(method === "HEAD" ? "GET" : method)) throw forbidden("Methode fuer diese Tabelle nicht erlaubt.");

      // Heute hat die Tabelle keine DELETE-Policy: Loeschen war stets wirkungslos (204, 0 Zeilen).
      // Mit noopDelete bleibt das exakt so, damit keine Teilnehmerdaten verloren gehen.
      if (method === "DELETE" && cfg.noopDelete) {
        return { statusCode: 204, headers: { "Cache-Control": "no-store", "Content-Range": "*/0" }, body: "" };
      }
      const { query, onConflict } = buildQuery(cfg, method, params, uid, scoped);
      let body = req.body;
      const prefer = cleanPrefer(req.prefer);

      if (method === "POST") {
        const rows = Array.isArray(body) ? body : [body];
        if (!rows.length || rows.some(r => !r || typeof r !== "object" || Array.isArray(r))) throw bad("Ungueltige Daten.");
        if (rows.length > (cfg.maxWrite || 1000)) throw bad("Zu viele Zeilen auf einmal.");
        if (scoped) {
          for (const r of rows) r[cfg.owner] = uid;
          if (/resolution=/.test(prefer)) {
            await assertNoForeignConflict(base, key, table, cfg, rows, onConflict || cfg.conflictKeys, uid);
          }
        }
        if (cfg.beforeWrite) for (const r of rows) cfg.beforeWrite(r, { uid, admin });
        body = Array.isArray(body) ? rows : rows[0];
      } else if (method === "PATCH") {
        if (!body || typeof body !== "object" || Array.isArray(body)) throw bad("Ungueltige Daten.");
        if (scoped && Object.prototype.hasOwnProperty.call(body, cfg.owner)) body[cfg.owner] = uid;
        if (cfg.beforeWrite) cfg.beforeWrite(body, { uid, admin });
      } else {
        body = undefined;
      }

      const headers = { Accept: cleanAccept(req.accept) };
      if (prefer) headers.Prefer = prefer;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const r = await upstream(`${base}/rest/v1/${table}${query ? "?" + query : ""}`, key, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await r.text();
      const out = { "Content-Type": r.headers.get("content-type") || "application/json", "Cache-Control": "no-store" };
      const cr = r.headers.get("content-range");
      if (cr) out["Content-Range"] = cr;
      return { statusCode: r.status, headers: out, body: text };
    } catch (e) {
      if (e instanceof GwError) return json(e.status, { error: e.code, message: e.message });
      console.error("gateway", e);
      return json(500, { error: "server", message: "Serverfehler." });
    }
  };
}

module.exports = { createGateway, GwError, UID_RE, originAllowed, _test: { buildQuery, parsePath, cleanPrefer, ownOrigins } };
