// Dreamlife Marketing Engine, Spracherkennung (Netlify Function 2.0, synchron)
//
// Nimmt eine kurze Sprachaufnahme aus dem Interview-Onboarding entgegen (SPEC §11.4,
// Mikrofon-Button beim Ausfuellen des Briefs, maximal 90s) und schickt sie an OpenAI
// (audio/transcriptions). Kein Streaming, kein Hintergrund-Job: die Transkription ist
// schnell genug fuer eine normale, synchrone Function.
//
// Aufruf: POST /.netlify/functions/transcribe
//   multipart/form-data mit Feldern "file" (Audio-Blob) und "uid"
//   oder JSON {uid, b64, mime}
// Antwort: {"text": "..."} (200) oder {"error": "..."} (4xx/5xx)

import aiGuard from './_shared/ai-guard.js';
import scopedDb from './_shared/scoped-db.js';
import alertMod from './_shared/alert.js';
import textHelpers from './_shared/text.js';

const MODEL = process.env.TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
const MAX_BYTES = 8 * 1024 * 1024;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Dateiname je MIME-Typ, damit OpenAI das Format richtig erkennt (MediaRecorder liefert
// meist audio/webm oder audio/mp4, iOS gelegentlich audio/mp4 bzw. audio/x-m4a).
const EXT_BY_MIME = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
};

function cleanId(v) {
  v = (v == null ? '' : '' + v).trim();
  if (!v || v === 'null' || v === 'undefined') return '';
  if (/^\[\[.*\]\]$/.test(v) || /^\{\{.*\}\}$/.test(v)) return '';
  return v;
}
function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function extFor(mime) {
  const m = String(mime || '').split(';')[0].trim().toLowerCase();
  return EXT_BY_MIME[m] || 'webm';
}

// Liest die Audiodaten aus dem Request, egal ob multipart/form-data oder JSON. Liefert
// {uid, buf, mime} oder {error, uid?}. Wirft nie, damit der Aufrufer immer eine deutsche
// Fehlermeldung zurueckgeben kann.
async function readAudio(req) {
  const contentType = String(req.headers.get('content-type') || '');
  if (contentType.toLowerCase().indexOf('multipart/form-data') !== -1) {
    let form;
    try {
      form = await req.formData();
    } catch (e) {
      return { error: 'Die Anfrage konnte nicht gelesen werden.' };
    }
    const uid = cleanId(form.get('uid'));
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return { error: 'Keine Audiodatei erhalten.', uid };
    let buf;
    try {
      buf = Buffer.from(await file.arrayBuffer());
    } catch (e) {
      return { error: 'Die Audiodatei konnte nicht gelesen werden.', uid };
    }
    const mime = file.type || 'audio/webm';
    return { uid, buf, mime };
  }

  let body = {};
  try {
    body = await req.json();
  } catch (e) {
    return { error: 'Die Anfrage konnte nicht gelesen werden.' };
  }
  const uid = cleanId(body.uid);
  const b64 = typeof body.b64 === 'string' ? body.b64.replace(/^data:[^,]*,/, '') : '';
  if (!b64) return { error: 'Keine Audiodaten erhalten.', uid };
  let buf;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch (e) {
    return { error: 'Ungültige Audiodaten.', uid };
  }
  const mime = body.mime || 'audio/webm';
  return { uid, buf, mime };
}

async function callOpenAI(key, buf, mime) {
  const form = new FormData();
  const filename = 'aufnahme.' + extFor(mime);
  form.append('file', new Blob([buf], { type: mime || 'audio/webm' }), filename);
  form.append('model', MODEL);
  form.append('language', 'de');
  form.append('response_format', 'json');
  return fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key },
    body: form,
  });
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (req.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405);

  if (!scopedDb.originAllowed({ headers: { origin: req.headers.get('origin') || '' } })) {
    return jsonResp({ error: 'Aufruf von fremder Seite nicht erlaubt.' }, 403);
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return jsonResp({ error: 'Spracherkennung ist noch nicht konfiguriert (OPENAI_API_KEY fehlt im Backend).' }, 503);

  const geladen = await readAudio(req);
  if (geladen.error) return jsonResp({ error: geladen.error }, 400);

  const uid = geladen.uid;
  if (!uid) return jsonResp({ error: 'Kein Nutzer erkannt. Bitte über Learning Suite öffnen.' }, 401);
  if (!geladen.buf || !geladen.buf.length) return jsonResp({ error: 'Keine Audiodaten erhalten.' }, 400);
  if (geladen.buf.length > MAX_BYTES) return jsonResp({ error: 'Die Aufnahme ist zu groß (maximal 8 MB).' }, 413);

  const g = await aiGuard.guard({
    app: 'marketing-engine', kind: 'transcribe', uid, headers: req.headers,
    defaults: { ipPerHour: 60, uidPerDay: 120, globalPerDay: 3000 },
  });
  if (!g.ok) return jsonResp({ error: g.error }, g.status);

  let res;
  try {
    res = await callOpenAI(key, geladen.buf, geladen.mime);
  } catch (e) {
    return jsonResp({ error: 'Der Sprach-Dienst ist gerade nicht erreichbar.' }, 502);
  }

  if (!res.ok) {
    let errObj = {};
    try {
      const j = await res.json();
      errObj = (j && j.error) || {};
    } catch (e) { /* Fehlerkoerper nicht lesbar, Standardmeldung */ }
    const grund = alertMod.classifyProviderError(res.status, (errObj.code || '') + ' ' + (errObj.message || ''));
    if (grund) {
      console.error('OpenAI-Anbieterfehler (transcribe)', grund, res.status, errObj.message);
      await alertMod.notifyAdmin(
        'openai-transcribe-' + grund,
        'OpenAI ' + (grund === 'guthaben' ? 'Guthaben aufgebraucht' : 'Schluessel ungueltig') +
          '. Sprachmemos koennen gerade nicht transkribiert werden. Meldung: ' + (errObj.message || ''),
      );
      return jsonResp({ error: alertMod.FREUNDLICH }, 502);
    }
    return jsonResp({ error: errObj.message || 'Die Aufnahme konnte nicht transkribiert werden.' }, 502);
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    return jsonResp({ error: 'Die Antwort des Sprach-Dienstes konnte nicht gelesen werden.' }, 502);
  }
  const text = textHelpers.stripDashes(String((data && data.text) || '').trim());
  return jsonResp({ text }, 200);
};

export const _test = { cleanId, extFor, readAudio, callOpenAI };
