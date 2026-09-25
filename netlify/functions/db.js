// db.js  -  Sicherheits-Gateway fuer die Dreamlife Marketing Engine (Stand 25.09.2026)
//
// Der Browser spricht nicht direkt mit Supabase, sondern mit dieser Funktion
// (/.netlify/functions/db). Sie leitet mit dem geheimen Service-Key weiter und
// begrenzt jeden Zugriff auf die Zeilen der eigenen Learning-Suite-uid.
//
// Tabellen: me_projects, me_campaigns, me_assets, me_templates (owner-Spalte "uid"),
// ls_members (Identitaets-Abgleich, ein Upsert je uid), me_jobs (nur lesbar).
// Loeschen ist echt (mit Cascade auf Kampagnen und Assets ueber die Datenbank-
// Foreign-Keys). Aktion: upload_reference (Creative-Decoder, siehe unten).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (oder SUPABASE_SERVICE_KEY)

"use strict";

const crypto = require("crypto");
const { createGateway, GwError } = require("./_shared/scoped-db.js");

const BUCKET = "me-creatives";
// Rohbild max. ca. 2,9 MB (Base64 ca. 3,9 MB, passt unter die 4 MB des Gateways).
const MAX_IMAGE_BYTES = 2900 * 1024;
// Eigene Drossel nur fuer Referenzbild-Uploads (zusaetzlich zur allgemeinen Gateway-Drossel).
const UPLOAD_RATE = { windowSec: 3600, max: 40 };

// Bildtyp aus den ersten Bytes bestimmen (nicht aus der Angabe des Browsers), genau wie
// im Website-Builder (refs/code/db-websites.js).
function detectImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

function randomPath(ext) {
  const d = new Date();
  const ym = d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
  return "ref/" + ym + "/" + crypto.randomUUID() + "." + ext;
}

async function uploadRateOk(ctx) {
  try {
    const r = await ctx.db.send("POST", "rpc/api_rate_hit", {
      p_uid: ctx.uid, p_bucket: "marketing-engine-upload",
      p_window_seconds: UPLOAD_RATE.windowSec, p_max: UPLOAD_RATE.max,
    }, "return=representation");
    return r !== false;
  } catch (e) { return true; } // fail-open wie im Kern
}

// Laedt ein Referenzbild fuer den Creative-Decoder in den Bucket me-creatives hoch.
// Der Pfad enthaelt keine uid (ref/<jahr-monat>/<uuid>.<ext>), kein Ueberschreiben
// (x-upsert false). Liefert nur die oeffentliche URL.
async function uploadReference(ctx) {
  const b64 = typeof ctx.body.b64 === "string" ? ctx.body.b64.replace(/^data:[^,]*,/, "") : "";
  if (!b64) throw new GwError(400, "bad_request", "Kein Bild erhalten.");
  if (b64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8) throw new GwError(413, "too_large", "Das Bild ist zu gross.");
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(b64)) throw new GwError(400, "bad_request", "Ungueltige Bilddaten.");
  const buf = Buffer.from(b64, "base64");
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) throw new GwError(413, "too_large", "Das Bild ist zu gross.");
  const kind = detectImage(buf);
  if (!kind) throw new GwError(415, "bad_type", "Nur JPG, PNG oder WebP erlaubt.");
  if (!(await uploadRateOk(ctx))) throw new GwError(429, "rate_limited", "Zu viele Bilder in kurzer Zeit. Bitte spaeter erneut versuchen.");

  const path = randomPath(kind.ext);
  const r = await fetch(`${ctx.base}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: ctx.key, Authorization: "Bearer " + ctx.key,
      "Content-Type": kind.mime, "x-upsert": "false", "Cache-Control": "max-age=31536000",
    },
    body: buf,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("upload_reference", r.status, t.slice(0, 200));
    throw new GwError(502, "upload_failed", "Upload fehlgeschlagen (" + r.status + ").");
  }
  return { status: 200, body: { url: `${ctx.base}/storage/v1/object/public/${BUCKET}/${path}` } };
}

exports.handler = createGateway({
  app: "marketing-engine",
  tables: {
    me_projects: {
      owner: "uid",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      conflictKeys: ["id"],
      maxRows: 500,
      maxWrite: 5,
    },
    me_campaigns: {
      owner: "uid",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      conflictKeys: ["id"],
      maxRows: 500,
      maxWrite: 5,
    },
    me_assets: {
      owner: "uid",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      conflictKeys: ["id"],
      maxRows: 1000,
      maxWrite: 5,
    },
    // me_templates: Creative-Vorlagen aus dem Creative-Decoder (siehe SPEC §10).
    me_templates: {
      owner: "uid",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      conflictKeys: ["id"],
      maxRows: 200,
      maxWrite: 5,
    },
    ls_members: {
      owner: "uid",
      methods: ["GET", "POST"],
      conflictKeys: ["uid"],
      maxRows: 1,
      maxWrite: 1,
    },
    // me_jobs: Hintergrund-Jobs fuer die KI-Function (ai.mjs / ai-background.mjs).
    // Der Browser darf nur seine eigenen Jobs lesen (Fortschritt pollen), nie schreiben:
    // Anlegen und Aktualisieren passiert ausschliesslich serverseitig mit dem Service-Key.
    me_jobs: {
      owner: "uid",
      methods: ["GET"],
      maxRows: 50,
    },
  },
  actions: {
    upload_reference: uploadReference,
  },
  rate: { windowSec: 600, max: 1500 },
});

exports._test = { detectImage, randomPath, MAX_IMAGE_BYTES, UPLOAD_RATE };
