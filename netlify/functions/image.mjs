// Dreamlife Marketing Engine, KI-Bild (Netlify Function 2.0, STREAMING NDJSON)
//
// Erzeugt ein einzelnes Creative-Bild (ein Format einer Variante) und speichert die
// oeffentliche URL serverseitig in me_assets.content.varianten[i].bilder[format].
// Gleiches Streaming-Muster wie ai.mjs: sofort antworten, Heartbeat alle 2s, waehrend
// OpenAI rechnet (kann bis zu ~2 Minuten dauern).
//
// Protokoll (NDJSON):
//   {"type":"start"}
//   {"type":"ping"}                 (alle 2s)
//   {"type":"done","url":"..."}
//   {"type":"error","message":"..."}
//
// Aufruf: POST /.netlify/functions/image  {uid, asset_id, variante, format, stil?}
// variante = Index in content.varianten (0-basiert), format = "1:1" | "4:5" | "9:16".
//
// Task "avatar" (SPEC §11.3): POST /.netlify/functions/image {uid, task:'avatar', project_id, stil}
// erzeugt EIN Portraet des Avatars (Zielperson) aus avatar.bild_prompt der Zielgruppenanalyse,
// stil in foto|illustration|karikatur, Groesse immer 1024x1024. Ohne "task" oder mit
// task:"creative" laeuft der bisherige Ablauf (Bild-Creative-Variante/Format) unveraendert weiter.

import { randomUUID } from 'node:crypto';
import aiGuard from './_shared/ai-guard.js';
import scopedDb from './_shared/scoped-db.js';
import alertMod from './_shared/alert.js';
import supa from './_shared/supa.js';

const MODEL = process.env.IMAGE_MODEL || 'gpt-image-2';
const BUCKET = 'me-creatives';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// gpt-image-2 lehnt manche Groessen je nach Kontostatus ab (400). Bei Ablehnung wird
// einmalig auf die Rueckfall-Groesse gewechselt.
const SIZE_BY_FORMAT = { '1:1': '1024x1024', '4:5': '1024x1280', '9:16': '1024x1824' };
const FALLBACK_SIZE_BY_FORMAT = { '1:1': '1024x1024', '4:5': '1024x1536', '9:16': '1024x1536' };

// Stil-Anweisungen fuer Avatar-Portraets (SPEC §11.3). Immer ein einzelnes Portraet ohne Text.
const AVATAR_STIL_ANWEISUNG = {
  foto: 'photorealistic portrait, natural light, 85mm lens, shallow depth of field, calm neutral background, genuine expression',
  illustration: 'modern flat vector illustration portrait, soft colors, friendly, clean shapes, minimal background',
  karikatur: 'good-natured caricature portrait, exaggerated but likeable features, playful, warm colors, no mockery, clean background',
};
const AVATAR_SUFFIX = 'no text, no logos, no watermark, single person, head and shoulders';
const AVATAR_STILE = Object.keys(AVATAR_STIL_ANWEISUNG);

function cleanId(v) {
  v = (v == null ? '' : '' + v).trim();
  if (!v || v === 'null' || v === 'undefined') return '';
  if (/^\[\[.*\]\]$/.test(v) || /^\{\{.*\}\}$/.test(v)) return '';
  return v;
}
function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function randomPath() {
  const d = new Date();
  const ym = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
  return 'v1/' + ym + '/' + randomUUID() + '.jpg';
}

function avatarPath() {
  const d = new Date();
  const ym = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
  return 'avatar/' + ym + '/' + randomUUID() + '.jpg';
}

function buildAvatarPrompt(bildPrompt, stil) {
  let prompt = bildPrompt + '. ' + AVATAR_STIL_ANWEISUNG[stil] + '. ' + AVATAR_SUFFIX + '.';
  return prompt.length > 4000 ? prompt.slice(0, 4000) : prompt;
}

function buildPrompt(bildPrompt, bildText, stil) {
  let prompt = bildPrompt;
  if (stil) prompt += '. Stil: ' + stil;
  if (bildText) {
    prompt += '. Setze folgenden kurzen deutschen Text als gut lesbare Headline in das Bild, ' +
      'exakt so geschrieben: "' + bildText + '". Werbeanzeigen-Look, kein Logo, kein Kleingedrucktes.';
  } else {
    prompt += '. Werbeanzeigen-Look, kein Text im Bild, kein Logo, kein Kleingedrucktes.';
  }
  return prompt.length > 4000 ? prompt.slice(0, 4000) : prompt;
}

async function callOpenAI(key, prompt, size) {
  const payload = JSON.stringify({
    model: MODEL, prompt, size, quality: 'medium', n: 1,
    output_format: 'jpeg', output_compression: 85, moderation: 'auto',
  });
  return fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: payload,
  });
}

// Bis zu 3 Versuche insgesamt. Bei 400 wird einmal auf die Rueckfall-Groesse gewechselt
// (zaehlt als ein Versuch), bei 429/5xx wird mit derselben Groesse erneut versucht.
// Moderation/andere Fehler werden nicht wiederholt.
async function generateImage(key, prompt, size, fallbackSize) {
  let currentSize = size;
  let usedFallback = false;
  let lastMsg = 'Bild konnte nicht erzeugt werden.';

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt));
    let res;
    try {
      res = await callOpenAI(key, prompt, currentSize);
    } catch (e) {
      lastMsg = 'Der Bild-Dienst ist gerade nicht erreichbar.';
      continue;
    }

    if (res.ok) {
      const j = await res.json().catch(() => null);
      const b64 = j && j.data && j.data[0] && j.data[0].b64_json;
      if (b64) return { ok: true, b64, size: currentSize };
      lastMsg = 'Der Bild-Dienst hat kein Bild zurueckgegeben.';
      continue;
    }

    let errObj = {};
    try { const j = await res.json(); errObj = (j && j.error) || {}; } catch (e) {}

    if (errObj.code === 'moderation_blocked') {
      return { ok: false, moderation: true, message: 'Die Bildbeschreibung wurde von der Inhaltsprüfung abgelehnt. Bitte formuliere sie anders.' };
    }

    if (res.status === 400 && !usedFallback && fallbackSize && fallbackSize !== currentSize) {
      usedFallback = true;
      currentSize = fallbackSize;
      lastMsg = errObj.message || 'Bildgroesse wurde abgelehnt, Rueckfall auf eine andere Groesse.';
      continue;
    }

    lastMsg = errObj.message || ('Bild-Dienst meldet Fehler ' + res.status + '.');
    const grund = alertMod.classifyProviderError(res.status, (errObj.code || '') + ' ' + (errObj.message || ''));
    if (grund) {
      console.error('OpenAI-Anbieterfehler', grund, res.status, errObj.message);
      await alertMod.notifyAdmin('openai-' + grund, 'OpenAI ' + (grund === 'guthaben' ? 'Guthaben aufgebraucht' : 'Schluessel ungueltig') + '. Teilnehmer koennen gerade keine KI-Bilder erzeugen. Meldung: ' + (errObj.message || ''));
      return { ok: false, message: alertMod.FREUNDLICH };
    }
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable) break;
  }
  return { ok: false, message: lastMsg };
}

// Task "avatar" (SPEC §11.3): erzeugt genau ein Portraet aus avatar.bild_prompt, Groesse
// immer 1024x1024. Speichert in me_projects.avatar.bilder (Eintrag fuer diesen Stil ersetzen,
// sonst anhaengen), gewaehlt wird nur gesetzt, wenn noch keiner gewaehlt war.
async function handleAvatar(uid, body, key) {
  const project_id = cleanId(body.project_id);
  const stil = AVATAR_STILE.includes(body.stil) ? body.stil : null;

  if (!project_id) return jsonResp({ error: 'Kein Projekt angegeben.' }, 400);
  if (!stil) return jsonResp({ error: 'Ungültiger Stil. Erlaubt sind foto, illustration oder karikatur.' }, 400);

  let project;
  try {
    project = await supa.getOne('me_projects', { id: 'eq.' + project_id });
  } catch (e) {
    return jsonResp({ error: 'Projekt konnte nicht geladen werden.' }, 502);
  }
  if (!project || project.uid !== uid) return jsonResp({ error: 'Kein Zugriff auf dieses Projekt.' }, 403);

  const avatar = (project.avatar && typeof project.avatar === 'object') ? project.avatar : {};
  const bildPromptRoh = String(avatar.bild_prompt || '').trim();
  if (!bildPromptRoh) return jsonResp({ error: 'Bitte zuerst die Zielgruppenanalyse erstellen.' }, 400);

  const prompt = buildAvatarPrompt(bildPromptRoh, stil);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); } catch (e) {}
      };
      send({ type: 'start' });
      const beat = setInterval(() => send({ type: 'ping' }), 2000);

      try {
        const result = await generateImage(key, prompt, '1024x1024', '1024x1024');
        if (!result.ok) {
          clearInterval(beat);
          send({ type: 'error', message: result.message || 'Bild konnte nicht erzeugt werden.' });
          try { controller.close(); } catch (e) {}
          return;
        }

        let url;
        try {
          url = await supa.uploadImage(BUCKET, avatarPath(), Buffer.from(result.b64, 'base64'), 'image/jpeg');
        } catch (e) {
          clearInterval(beat);
          send({ type: 'error', message: 'Das Bild konnte nicht gespeichert werden.' });
          try { controller.close(); } catch (e2) {}
          return;
        }

        // Zeile frisch laden (Bilder anderer Stile koennen inzwischen geschrieben haben),
        // avatar.bilder mergen statt ueberschreiben.
        let fresh = null;
        try { fresh = await supa.getOne('me_projects', { id: 'eq.' + project_id }); } catch (e) { /* nutze alten Stand */ }
        const baseProject = fresh || project;
        const baseAvatar = Object.assign({}, (baseProject.avatar && typeof baseProject.avatar === 'object') ? baseProject.avatar : {});
        const bilder = Array.isArray(baseAvatar.bilder) ? baseAvatar.bilder.slice() : [];
        const idx = bilder.findIndex((b) => b && b.stil === stil);
        if (idx >= 0) bilder[idx] = { stil, url }; else bilder.push({ stil, url });
        baseAvatar.bilder = bilder;
        if (!baseAvatar.gewaehlt) baseAvatar.gewaehlt = stil;

        try {
          await supa.patch('me_projects', { id: 'eq.' + project_id }, { avatar: baseAvatar, updated_at: new Date().toISOString() });
        } catch (e) {
          console.error('image.mjs: Speichern des Avatar-Bilds fehlgeschlagen', e && e.message);
          // Das Bild liegt bereits im Bucket, die URL wird trotzdem an den Browser geliefert.
        }

        clearInterval(beat);
        send({ type: 'done', url, stil });
      } catch (err) {
        clearInterval(beat);
        send({ type: 'error', message: 'Unerwarteter Fehler beim Erzeugen des Bildes.' });
      } finally {
        clearInterval(beat);
        try { controller.close(); } catch (e) {}
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (req.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405);

  if (!scopedDb.originAllowed({ headers: { origin: req.headers.get('origin') || '' } })) {
    return jsonResp({ error: 'Aufruf von fremder Seite nicht erlaubt.' }, 403);
  }

  let body = {};
  try { body = await req.json(); } catch (e) {}

  const uid = cleanId(body.uid);
  const task = body.task === 'avatar' ? 'avatar' : 'creative';

  if (!uid) return jsonResp({ error: 'Kein Nutzer erkannt. Bitte über Learning Suite öffnen.' }, 401);

  const keyEarly = process.env.OPENAI_API_KEY;
  if (!keyEarly) return jsonResp({ error: 'KI-Bilder sind noch nicht konfiguriert (OPENAI_API_KEY fehlt im Backend).' }, 503);

  const gEarly = await aiGuard.guard({
    app: 'marketing-engine', kind: 'image', uid, headers: req.headers,
    defaults: { ipPerHour: 20, uidPerDay: 30, globalPerDay: 300 },
    messages: { uid: 'Dein Tageslimit für KI-Bilder ist erreicht. Morgen geht es weiter.' },
  });
  if (!gEarly.ok) return jsonResp({ error: gEarly.error }, gEarly.status);

  if (task === 'avatar') {
    return handleAvatar(uid, body, keyEarly);
  }

  const asset_id = cleanId(body.asset_id);
  const variante = Number.isInteger(body.variante) ? body.variante : parseInt(body.variante, 10);
  const format = ['1:1', '4:5', '9:16'].includes(body.format) ? body.format : null;
  const stil = body.stil ? String(body.stil).trim().slice(0, 300) : '';
  const key = keyEarly;

  if (!asset_id) return jsonResp({ error: 'Kein Asset angegeben.' }, 400);
  if (!Number.isInteger(variante) || variante < 0) return jsonResp({ error: 'Ungültige Variante.' }, 400);
  if (!format) return jsonResp({ error: 'Ungültiges Format. Erlaubt sind 1:1, 4:5 oder 9:16.' }, 400);

  let asset;
  try {
    asset = await supa.getOne('me_assets', { id: 'eq.' + asset_id });
  } catch (e) {
    return jsonResp({ error: 'Asset konnte nicht geladen werden.' }, 502);
  }
  if (!asset || asset.uid !== uid) return jsonResp({ error: 'Kein Zugriff auf dieses Asset.' }, 403);
  if (asset.typ !== 'creative') return jsonResp({ error: 'Nur Bild-Creatives haben Bild-Varianten.' }, 400);

  const varianten = (asset.content && Array.isArray(asset.content.varianten)) ? asset.content.varianten : [];
  const variantData = varianten[variante];
  if (!variantData) return jsonResp({ error: 'Diese Variante gibt es nicht.' }, 400);

  const bildPromptRoh = String(variantData.bild_prompt || '').trim();
  const bildText = String(variantData.bild_text || '').trim();
  if (!bildPromptRoh) return jsonResp({ error: 'Kein Bild-Prompt für diese Variante vorhanden.' }, 400);

  const prompt = buildPrompt(bildPromptRoh, bildText, stil);
  const size = SIZE_BY_FORMAT[format];
  const fallbackSize = FALLBACK_SIZE_BY_FORMAT[format];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); } catch (e) {}
      };
      send({ type: 'start' });
      const beat = setInterval(() => send({ type: 'ping' }), 2000);

      try {
        const result = await generateImage(key, prompt, size, fallbackSize);
        if (!result.ok) {
          clearInterval(beat);
          send({ type: 'error', message: result.message || 'Bild konnte nicht erzeugt werden.' });
          try { controller.close(); } catch (e) {}
          return;
        }

        let url;
        try {
          url = await supa.uploadImage(BUCKET, randomPath(), Buffer.from(result.b64, 'base64'), 'image/jpeg');
        } catch (e) {
          clearInterval(beat);
          send({ type: 'error', message: 'Das Bild konnte nicht gespeichert werden.' });
          try { controller.close(); } catch (e2) {}
          return;
        }

        // Zeile frisch laden (andere Formate/Varianten koennen inzwischen geschrieben haben),
        // die Variante mergen und zurueckschreiben, statt den ganzen content zu ueberschreiben.
        let fresh = null;
        try { fresh = await supa.getOne('me_assets', { id: 'eq.' + asset_id }); } catch (e) { /* nutze alten Stand */ }
        const baseAsset = fresh || asset;
        const freshVarianten = (baseAsset.content && Array.isArray(baseAsset.content.varianten))
          ? baseAsset.content.varianten.slice()
          : varianten.slice();
        const target = Object.assign({}, freshVarianten[variante] || variantData);
        target.bilder = Object.assign({ '1:1': null, '4:5': null, '9:16': null }, target.bilder || {});
        target.bilder[format] = url;
        freshVarianten[variante] = target;
        const newContent = Object.assign({}, baseAsset.content || {}, { varianten: freshVarianten });

        try {
          await supa.patch('me_assets', { id: 'eq.' + asset_id }, { content: newContent, updated_at: new Date().toISOString() });
        } catch (e) {
          console.error('image.mjs: Speichern der Bild-URL fehlgeschlagen', e && e.message);
          // Das Bild liegt bereits im Bucket, die URL wird trotzdem an den Browser geliefert.
        }

        clearInterval(beat);
        send({ type: 'done', url });
      } catch (err) {
        clearInterval(beat);
        send({ type: 'error', message: 'Unerwarteter Fehler beim Erzeugen des Bildes.' });
      } finally {
        clearInterval(beat);
        try { controller.close(); } catch (e) {}
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};

export const _test = {
  generateImage, buildPrompt, randomPath, SIZE_BY_FORMAT, FALLBACK_SIZE_BY_FORMAT,
  avatarPath, buildAvatarPrompt, AVATAR_STIL_ANWEISUNG, AVATAR_STILE,
};
