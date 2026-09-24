// supa.js  -  Mini-Helfer fuer Supabase-Zugriffe mit dem Service-Key (Stand 25.09.2026)
//
// Wird nur serverseitig aus den Functions ai.mjs und image.mjs verwendet, um Projekt,
// Kampagne und Asset zu laden, Ergebnisse zu speichern und Bilder in den Storage-Bucket
// hochzuladen. Kein Zugriff durch den Browser. Keine Abhaengigkeiten, Node 18+.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Fallback SUPABASE_SERVICE_KEY)

"use strict";

class SupaError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "SupaError";
    this.status = status;
  }
}

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function base() {
  return String(env("SUPABASE_URL", "")).replace(/\/+$/, "");
}

function key() {
  return env("SUPABASE_SERVICE_ROLE_KEY", env("SUPABASE_SERVICE_KEY", ""));
}

function requireConfig() {
  const b = base();
  const k = key();
  if (!b || !k) {
    throw new SupaError(503, "Die Datenbank ist noch nicht eingerichtet.");
  }
  return { base: b, key: k };
}

function authHeaders(k, extra) {
  return Object.assign({ apikey: k, Authorization: "Bearer " + k }, extra || {});
}

function filtersToQuery(filters) {
  const p = new URLSearchParams();
  for (const [name, value] of Object.entries(filters || {})) {
    p.append(name, value);
  }
  return p.toString();
}

async function readErrorText(res) {
  try {
    const t = await res.text();
    return t ? t.slice(0, 300) : "";
  } catch (e) {
    return "";
  }
}

// Liefert genau eine Zeile oder null (0 Treffer), wirft bei Datenbankfehlern.
async function getOne(table, filters) {
  const { base: b, key: k } = requireConfig();
  const qs = filtersToQuery(filters);
  const res = await fetch(`${b}/rest/v1/${table}?${qs}`, {
    headers: authHeaders(k, { Accept: "application/vnd.pgrst.object+json" }),
  });
  if (res.status === 406) return null; // kein Treffer (oder mehrdeutig): als "nicht gefunden" behandeln
  if (!res.ok) {
    const t = await readErrorText(res);
    throw new SupaError(502, "Konnte " + table + " nicht laden: " + t);
  }
  return res.json();
}

// query ist ein fertiger PostgREST-Query-String, z. B. "select=*&order=created_at.desc&limit=50"
async function select(table, query) {
  const { base: b, key: k } = requireConfig();
  const q = query ? String(query).replace(/^\?/, "") : "";
  const res = await fetch(`${b}/rest/v1/${table}${q ? "?" + q : ""}`, {
    headers: authHeaders(k),
  });
  if (!res.ok) {
    const t = await readErrorText(res);
    throw new SupaError(502, "Konnte " + table + " nicht laden: " + t);
  }
  return res.json();
}

async function patch(table, filters, body) {
  const { base: b, key: k } = requireConfig();
  const qs = filtersToQuery(filters);
  const res = await fetch(`${b}/rest/v1/${table}?${qs}`, {
    method: "PATCH",
    headers: authHeaders(k, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await readErrorText(res);
    throw new SupaError(res.status >= 500 ? 502 : res.status, "Speichern in " + table + " fehlgeschlagen: " + t);
  }
  const t = await res.text();
  return t ? JSON.parse(t) : [];
}

async function insert(table, row) {
  const { base: b, key: k } = requireConfig();
  const res = await fetch(`${b}/rest/v1/${table}`, {
    method: "POST",
    headers: authHeaders(k, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const t = await readErrorText(res);
    throw new SupaError(res.status >= 500 ? 502 : res.status, "Anlegen in " + table + " fehlgeschlagen: " + t);
  }
  const t = await res.text();
  const j = t ? JSON.parse(t) : [];
  return Array.isArray(j) ? j[0] : j;
}

// Laedt ein Bild mit dem Service-Key in einen Storage-Bucket hoch (kein Ueberschreiben fremder Pfade,
// zufaellige Pfade sind eindeutig). Liefert die oeffentliche URL.
async function uploadImage(bucket, path, buffer, mime) {
  const { base: b, key: k } = requireConfig();
  const res = await fetch(`${b}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: authHeaders(k, {
      "Content-Type": mime || "image/jpeg",
      "x-upsert": "true",
      "Cache-Control": "max-age=31536000",
    }),
    body: buffer,
  });
  if (!res.ok) {
    const t = await readErrorText(res);
    throw new SupaError(502, "Bild-Upload fehlgeschlagen: " + t);
  }
  return publicUrl(bucket, path);
}

function publicUrl(bucket, path) {
  return `${base()}/storage/v1/object/public/${bucket}/${path}`;
}

module.exports = { getOne, select, patch, insert, uploadImage, publicUrl, SupaError };
