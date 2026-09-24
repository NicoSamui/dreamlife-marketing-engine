// Dreamlife Marketing Engine, KI-Function (Netlify Function 2.0, STREAMING NDJSON)
//
// Warum Streaming? Die Zielgruppenanalyse braucht bis zu einigen Minuten. Eine normale
// Netlify-Function wird nach ~10s abgebrochen. Wir oeffnen die Antwort deshalb sofort
// und schicken alle 2s einen Heartbeat sowie zwischendurch den bereits erzeugten Text,
// damit das UI Fortschritt zeigen kann (gleiches Muster wie image.mjs).
//
// Protokoll (NDJSON, eine JSON-Zeile pro Ereignis):
//   {"type":"start"}
//   {"type":"ping"}                         (alle 2s)
//   {"type":"delta","text":"..."}           (neu erzeugter Text, alle ~400 Zeichen)
//   {"type":"done","result":{...}}
//   {"type":"error","message":"..."}
//
// Sicherheit: Projekt/Kampagne/Asset werden HIER serverseitig aus Supabase geladen und
// gegen die uid geprueft (nicht dem Browser vertraut). Prompts liegen nur in _shared/
// (prompts.js, knowledge.js), der Browser schickt nur task, IDs und kurze Nutzereingaben.
//
// Aufruf: POST /.netlify/functions/ai
//   {uid, task, project_id, campaign_id?, asset_id?, typ?, winkel_id?, hinweis?, mehr?, anzahl?}
// task: analyse | verfeinern (= analyse mit Hinweis) | winkel | asset | konsistenz

import aiGuard from './_shared/ai-guard.js';
import supa from './_shared/supa.js';
import textHelpers from './_shared/text.js';
import prompts from './_shared/prompts.js';
import scopedDb from './_shared/scoped-db.js';

const MODEL = process.env.MODEL || 'claude-opus-5-5';
const ANTHROPIC_VERSION = '2023-06-01';
const DELTA_CHUNK = 400;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const VALID_TASKS = ['analyse', 'verfeinern', 'winkel', 'asset', 'konsistenz'];

function cleanId(v) {
  v = (v == null ? '' : '' + v).trim();
  if (!v || v === 'null' || v === 'undefined') return '';
  if (/^\[\[.*\]\]$/.test(v) || /^\{\{.*\}\}$/.test(v)) return '';
  return v;
}
function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Ermittelt einen kurzen, lesbaren Titel fuer ein Asset aus dem erzeugten Inhalt.
function extractTitel(typ, parsed) {
  try {
    if (typ === 'creative') return (parsed.varianten && parsed.varianten[0] && parsed.varianten[0].headline) || 'Bild-Creatives';
    if (typ === 'reel') return (parsed.skripte && parsed.skripte[0] && parsed.skripte[0].titel) || 'Reel-Skripte';
    if (typ === 'caption') return 'Social-Media-Captions';
    if (typ === 'olg') return 'Beitraege fuer organische Lead-Generierung';
    if (typ === 'email') return parsed.sequenz_name || 'E-Mail-Sequenz';
    if (typ === 'vsl') return parsed.titel || 'VSL-Skript';
    if (typ === 'leadmagnet') return parsed.titel || 'Leadmagnet';
    if (typ === 'funnel') return parsed.funnel_typ || 'Funnel-Blueprint';
  } catch (e) { /* Fallback unten */ }
  return 'Asset';
}

// Speichert das fertige Ergebnis serverseitig an der richtigen Stelle (§4.2 der Spezifikation).
async function saveResult(task, parsed, ctx) {
  const realTask = task === 'verfeinern' ? 'analyse' : task;
  const nowIso = new Date().toISOString();

  if (realTask === 'analyse') {
    await supa.patch('me_projects', { id: 'eq.' + ctx.project.id }, {
      analyse: parsed, analyse_status: 'fertig', updated_at: nowIso,
    });
    return { analyse: parsed };
  }

  if (realTask === 'winkel') {
    const neu = Array.isArray(parsed.winkel) ? parsed.winkel : [];
    let out = neu;
    if (ctx.mehr && Array.isArray(ctx.project.winkel) && ctx.project.winkel.length) {
      out = ctx.project.winkel.concat(neu);
    }
    await supa.patch('me_projects', { id: 'eq.' + ctx.project.id }, { winkel: out, updated_at: nowIso });
    return { winkel: out };
  }

  if (realTask === 'asset') {
    const titel = extractTitel(ctx.typ, parsed);
    await supa.patch('me_assets', { id: 'eq.' + ctx.asset.id }, {
      content: parsed, titel, status: 'fertig', fehler: null, updated_at: nowIso,
    });
    return { content: parsed, titel };
  }

  if (realTask === 'konsistenz') {
    await supa.patch('me_campaigns', { id: 'eq.' + ctx.campaign.id }, { konsistenz: parsed, updated_at: nowIso });
    return { konsistenz: parsed };
  }

  throw new Error('Unbekannte Aufgabe beim Speichern: ' + task);
}

// Setzt bei einem Fehler den passenden Status, damit das UI ihn anzeigen kann.
async function saveError(task, ctx, message) {
  const realTask = task === 'verfeinern' ? 'analyse' : task;
  const msg = String(message || 'Unbekannter Fehler.').slice(0, 500);
  try {
    if (realTask === 'analyse' && ctx.project) {
      await supa.patch('me_projects', { id: 'eq.' + ctx.project.id }, { analyse_status: 'fehler' });
    } else if (realTask === 'asset' && ctx.asset) {
      await supa.patch('me_assets', { id: 'eq.' + ctx.asset.id }, { status: 'fehler', fehler: msg });
    }
    // winkel/konsistenz haben kein eigenes Fehler-Statusfeld, der Fehler geht nur an den Client.
  } catch (e) {
    console.error('ai.mjs saveError fehlgeschlagen', e && e.message);
  }
}

// Kurzer Profilblock aus ls_members (nie E-Mail, Telefon oder uid).
function profileBlock(m) {
  if (!m || typeof m !== 'object') return null;
  const parts = [];
  if (m.first_name) parts.push('Vorname: ' + m.first_name);
  if (m.dienstleistung) parts.push('Dienstleistung laut LearningSuite: ' + m.dienstleistung);
  if (m.methode) parts.push('Methode: ' + m.methode);
  if (m.zielgruppe_branche) parts.push('Zielgruppe/Branche: ' + m.zielgruppe_branche);
  if (m.angebotssatz) parts.push('Angebotssatz: ' + m.angebotssatz);
  if (!parts.length) return null;
  return 'Profil des Teilnehmers (Hintergrund, der Brief hat Vorrang): ' + parts.join('. ').slice(0, 1500);
}

async function callAnthropicOnce(key, payload) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
    body: payload,
  });
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (req.method !== 'POST') return jsonResp({ error: 'Method not allowed' }, 405);

  // Origin-Schutz wie im Gateway: uid-gebundene KI-Aufrufe nur von der eigenen Site.
  if (!scopedDb.originAllowed({ headers: { origin: req.headers.get('origin') || '' } })) {
    return jsonResp({ error: 'Aufruf von fremder Seite nicht erlaubt.' }, 403);
  }

  let body = {};
  try { body = await req.json(); } catch (e) {}

  const uid = cleanId(body.uid);
  const task = String(body.task || '').trim();
  const project_id = cleanId(body.project_id);
  const campaign_id = cleanId(body.campaign_id);
  const asset_id = cleanId(body.asset_id);
  const typBody = String(body.typ || '').trim();
  const winkel_id = body.winkel_id ? String(body.winkel_id).trim().slice(0, 40) : '';
  const hinweis = body.hinweis ? String(body.hinweis).trim().slice(0, 4000) : '';
  const mehr = !!body.mehr;
  const anzahl = Number.isFinite(body.anzahl) ? body.anzahl : null;

  if (!uid) return jsonResp({ error: 'Kein Nutzer erkannt. Bitte über Learning Suite öffnen.' }, 401);
  if (!VALID_TASKS.includes(task)) return jsonResp({ error: 'Unbekannte Aufgabe.' }, 400);
  if (!project_id) return jsonResp({ error: 'Kein Projekt angegeben.' }, 400);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return jsonResp({ error: 'KI ist noch nicht konfiguriert (ANTHROPIC_API_KEY fehlt im Backend).' }, 503);

  const g = await aiGuard.guard({
    app: 'marketing-engine', kind: 'ai', uid, headers: req.headers,
    defaults: { ipPerHour: 40, uidPerDay: 60, globalPerDay: 1500 },
  });
  if (!g.ok) return jsonResp({ error: g.error }, g.status);

  // ---- Projekt/Kampagne/Asset serverseitig laden und die uid pruefen ----
  let project;
  try {
    project = await supa.getOne('me_projects', { id: 'eq.' + project_id });
  } catch (e) {
    return jsonResp({ error: 'Projekt konnte nicht geladen werden.' }, 502);
  }
  if (!project || project.uid !== uid) return jsonResp({ error: 'Kein Zugriff auf dieses Projekt.' }, 403);

  let campaign = null;
  if (task === 'asset' || task === 'konsistenz') {
    if (!campaign_id) return jsonResp({ error: 'Keine Kampagne angegeben.' }, 400);
    try {
      campaign = await supa.getOne('me_campaigns', { id: 'eq.' + campaign_id });
    } catch (e) {
      return jsonResp({ error: 'Kampagne konnte nicht geladen werden.' }, 502);
    }
    if (!campaign || campaign.uid !== uid || campaign.project_id !== project_id) {
      return jsonResp({ error: 'Kein Zugriff auf diese Kampagne.' }, 403);
    }
  }

  let asset = null;
  let typ = typBody;
  if (task === 'asset') {
    if (!asset_id) return jsonResp({ error: 'Kein Asset angegeben.' }, 400);
    try {
      asset = await supa.getOne('me_assets', { id: 'eq.' + asset_id });
    } catch (e) {
      return jsonResp({ error: 'Asset konnte nicht geladen werden.' }, 502);
    }
    if (!asset || asset.uid !== uid || asset.campaign_id !== campaign_id) {
      return jsonResp({ error: 'Kein Zugriff auf dieses Asset.' }, 403);
    }
    typ = asset.typ;
  }

  // gewaehlte Winkel der Kampagne (fuer asset/konsistenz)
  let winkelListe = [];
  if (campaign && Array.isArray(project.winkel)) {
    const ids = new Set((campaign.winkel_ids || []).map(String));
    winkelListe = project.winkel.filter((w) => w && ids.has(String(w.id)));
  }

  // Teilnehmer-Profil optional aus ls_members lesen (wird NIE vom Browser geschickt).
  let profile = null;
  try {
    const member = await supa.getOne('ls_members', { uid: 'eq.' + uid });
    profile = profileBlock(member);
  } catch (e) { /* optional, Fehler beim Laden des Profils ist kein Abbruchgrund */ }

  // Analyse laeuft: Status sofort setzen, damit ein Neuladen der Seite den Lauf anzeigt.
  if (task === 'analyse' || task === 'verfeinern') {
    try { await supa.patch('me_projects', { id: 'eq.' + project_id }, { analyse_status: 'laeuft' }); } catch (e) {}
  }

  let promptData;
  try {
    promptData = prompts.buildPrompt(task, {
      project, campaign, asset, typ, winkel: winkelListe, winkel_id, profile, hinweis, mehr, anzahl,
    });
  } catch (e) {
    return jsonResp({ error: e.message || 'Aufgabe konnte nicht vorbereitet werden.' }, 400);
  }

  const encoder = new TextEncoder();
  const saveCtx = { project, campaign, asset, uid, typ, mehr };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); } catch (e) {}
      };
      send({ type: 'start' });
      const beat = setInterval(() => send({ type: 'ping' }), 2000);

      try {
        // Kein temperature-Feld: neuere Modelle (Opus 5.x) lehnen es ab.
        const payload = JSON.stringify({
          model: MODEL,
          max_tokens: promptData.max_tokens,
          stream: true,
          system: promptData.system,
          messages: [{ role: 'user', content: promptData.user }],
        });

        // Auto-Retry gegen Ueberlastung (429/529), 5xx und Netzfehler. Andere Fehler nicht wiederholen.
        let upstream = null;
        let lastMsg = 'KI-Fehler.';
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt));
          let res;
          try {
            res = await callAnthropicOnce(key, payload);
          } catch (e) {
            lastMsg = 'Die KI ist gerade nicht erreichbar.';
            continue;
          }
          if (res.ok && res.body) { upstream = res; break; }
          let m = '';
          try { const j = await res.json(); m = (j && j.error && j.error.message) || ''; } catch (e) {}
          lastMsg = m || ('KI-Fehler (' + res.status + ').');
          const retriable = res.status === 429 || res.status === 529 || res.status >= 500;
          if (!retriable) break;
        }
        if (!upstream) throw new Error(lastMsg);

        // ---- SSE lesen, Text sammeln, alle ~400 Zeichen ein Delta senden ----
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let fullText = '';
        let sentLen = 0;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const pl = t.slice(5).trim();
            if (!pl || pl === '[DONE]') continue;
            try {
              const ev = JSON.parse(pl);
              if (ev.type === 'content_block_delta' && ev.delta && typeof ev.delta.text === 'string') {
                fullText += ev.delta.text;
                if (fullText.length - sentLen >= DELTA_CHUNK) {
                  send({ type: 'delta', text: fullText.slice(sentLen) });
                  sentLen = fullText.length;
                }
              }
            } catch (e) { /* Zeile ueberspringen */ }
          }
        }
        if (fullText.length > sentLen) {
          send({ type: 'delta', text: fullText.slice(sentLen) });
          sentLen = fullText.length;
        }
        if (!fullText.trim()) throw new Error('Die KI hat keinen Text geliefert.');

        let parsed = textHelpers.extractJSON(fullText);
        parsed = textHelpers.deepStripDashes(parsed);

        const result = await saveResult(task, parsed, saveCtx);
        clearInterval(beat);
        send({ type: 'done', result });
      } catch (err) {
        clearInterval(beat);
        const message = (err && err.message) || 'Unerwarteter Fehler.';
        // Auch bei Abbruch/Timeout versuchen, den Fehlerstatus zu speichern.
        try { await saveError(task, saveCtx, message); } catch (e) {}
        send({ type: 'error', message });
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

export const _test = { extractTitel, saveResult, saveError, cleanId };
