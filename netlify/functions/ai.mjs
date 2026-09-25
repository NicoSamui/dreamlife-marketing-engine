// Dreamlife Marketing Engine, KI-Function (Netlify Function 2.0, STARTER, synchron)
//
// Warum ein Starter statt Streaming? Netlify bricht eine streamende Function nach
// ungefaehr 60 Sekunden ab. Die Zielgruppenanalyse (bis zu 14000 Tokens) und grosse
// Assets brauchen laenger. Diese Function prueft alles wie bisher, legt dann nur eine
// Job-Zeile in me_jobs an und stoesst die Background-Function ai-background.mjs an
// (Netlify laesst Background-Functions bis zu 15 Minuten laufen). Der Browser bekommt
// sofort { job_id } zurueck und pollt den Fortschritt ueber das Gateway (me_jobs).
//
// Sicherheit: Projekt/Kampagne/Asset werden HIER serverseitig aus Supabase geladen und
// gegen die uid geprueft (nicht dem Browser vertraut), genau wie zuvor. Die eigentliche
// KI-Arbeit und das Speichern des Ergebnisses passieren in ai-background.mjs, die den
// Job anhand seiner uid erneut serverseitig laedt.
//
// Aufruf: POST /.netlify/functions/ai
//   {uid, task, project_id, campaign_id?, asset_id?, typ?, winkel_id?, hinweis?, mehr?, anzahl?}
// task: analyse | verfeinern (= analyse mit Hinweis) | winkel | asset | konsistenz
// Antwort: {"job_id": "..."} (200) oder {"error": "..."} (4xx/5xx)

import aiGuard from './_shared/ai-guard.js';
import supa from './_shared/supa.js';
import scopedDb from './_shared/scoped-db.js';
import { internalToken } from './_shared/internal.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const VALID_TASKS = ['analyse', 'verfeinern', 'winkel', 'asset', 'konsistenz', 'decode'];
// Eigene Storage-Praefix-URL fuer Referenzbilder des Creative-Decoders (siehe db.js
// upload_reference). Nur Bilder aus diesem Bucket-Pfad duerfen dekodiert werden, damit
// niemand eine beliebige fremde Bild-URL an Anthropic schicken kann.
function refPrefix() {
  return String(process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/storage/v1/object/public/me-creatives/ref/';
}

function cleanId(v) {
  v = (v == null ? '' : '' + v).trim();
  if (!v || v === 'null' || v === 'undefined') return '';
  if (/^\[\[.*\]\]$/.test(v) || /^\{\{.*\}\}$/.test(v)) return '';
  return v;
}
function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Legt den Job serverseitig fehl (bester Versuch, Fehler beim Aufraeumen sind kein Grund
// fuer eine kaputte Antwort an den Browser).
async function markJobFehler(jobId, task, ctx, message) {
  try { await supa.patch('me_jobs', { id: 'eq.' + jobId }, { status: 'fehler', fehler: String(message || '').slice(0, 500) }); } catch (e) {}
  try {
    if ((task === 'analyse' || task === 'verfeinern') && ctx.project) {
      await supa.patch('me_projects', { id: 'eq.' + ctx.project.id }, { analyse_status: 'fehler' });
    } else if (task === 'asset' && ctx.asset) {
      await supa.patch('me_assets', { id: 'eq.' + ctx.asset.id }, { status: 'fehler', fehler: String(message || '').slice(0, 500) });
    } else if (task === 'decode' && ctx.template) {
      await supa.patch('me_templates', { id: 'eq.' + ctx.template.id }, { status: 'fehler', fehler: String(message || '').slice(0, 500) });
    }
  } catch (e) {}
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
  const template_id = cleanId(body.template_id);

  if (!uid) return jsonResp({ error: 'Kein Nutzer erkannt. Bitte über Learning Suite öffnen.' }, 401);
  if (!VALID_TASKS.includes(task)) return jsonResp({ error: 'Unbekannte Aufgabe.' }, 400);
  if (task === 'decode') {
    if (!template_id) return jsonResp({ error: 'Keine Vorlage angegeben.' }, 400);
  } else if (!project_id) {
    return jsonResp({ error: 'Kein Projekt angegeben.' }, 400);
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return jsonResp({ error: 'KI ist noch nicht konfiguriert (ANTHROPIC_API_KEY fehlt im Backend).' }, 503);

  const g = await aiGuard.guard({
    app: 'marketing-engine', kind: 'ai', uid, headers: req.headers,
    defaults: { ipPerHour: 40, uidPerDay: 60, globalPerDay: 1500 },
  });
  if (!g.ok) return jsonResp({ error: g.error }, g.status);

  // ---- Decode: Vorlage serverseitig laden, uid und eigene Storage-URL pruefen ----
  if (task === 'decode') {
    let template;
    try {
      template = await supa.getOne('me_templates', { id: 'eq.' + template_id });
    } catch (e) {
      return jsonResp({ error: 'Vorlage konnte nicht geladen werden.' }, 502);
    }
    if (!template || template.uid !== uid) return jsonResp({ error: 'Kein Zugriff auf diese Vorlage.' }, 403);
    const bildUrl = String(template.bild_url || '');
    if (bildUrl.indexOf(refPrefix()) !== 0) {
      return jsonResp({ error: 'Ungueltige Bild-URL fuer diese Vorlage.' }, 400);
    }

    let job;
    try {
      job = await supa.insert('me_jobs', {
        uid, task: 'decode', typ: null,
        project_id: null, campaign_id: null, asset_id: null, template_id,
        status: 'wartet', chars: 0, teil_fertig: 0, teile: 1,
      });
    } catch (e) {
      return jsonResp({ error: 'Job konnte nicht angelegt werden.' }, 502);
    }
    if (!job || !job.id) return jsonResp({ error: 'Job konnte nicht angelegt werden.' }, 502);

    try {
      await supa.patch('me_templates', { id: 'eq.' + template_id }, { status: 'laeuft', fehler: null });
    } catch (e) { /* nicht abbruchwuerdig */ }

    const base = process.env.URL || '';
    try {
      const res = await fetch(base + '/.netlify/functions/ai-background', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-me-internal': internalToken(job.id) },
        body: JSON.stringify({ job_id: job.id }),
      });
      if (!res || (res.status !== 202 && !res.ok)) {
        await markJobFehler(job.id, task, { template }, 'Die Hintergrund-Verarbeitung konnte nicht gestartet werden.');
        return jsonResp({ error: 'Die Hintergrund-Verarbeitung konnte nicht gestartet werden.' }, 502);
      }
    } catch (e) {
      await markJobFehler(job.id, task, { template }, 'Die Hintergrund-Verarbeitung konnte nicht erreicht werden.');
      return jsonResp({ error: 'Die Hintergrund-Verarbeitung konnte nicht erreicht werden.' }, 502);
    }
    return jsonResp({ job_id: job.id }, 200);
  }

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

  // ---- Vorlage fuer ein Bild-Creative (optional): serverseitig laden, uid und Status pruefen ----
  let template = null;
  if (task === 'asset' && template_id && typ === 'creative') {
    try {
      template = await supa.getOne('me_templates', { id: 'eq.' + template_id });
    } catch (e) {
      return jsonResp({ error: 'Vorlage konnte nicht geladen werden.' }, 502);
    }
    if (!template || template.uid !== uid) return jsonResp({ error: 'Kein Zugriff auf diese Vorlage.' }, 403);
    if (template.status !== 'fertig') return jsonResp({ error: 'Vorlage ist noch nicht fertig.' }, 400);
  }

  // ---- Job anlegen ----
  const istAnalyse = task === 'analyse' || task === 'verfeinern';
  let job;
  try {
    job = await supa.insert('me_jobs', {
      uid, task, typ: typ || null,
      project_id, campaign_id: campaign_id || null, asset_id: asset_id || null,
      template_id: template ? template.id : null,
      status: 'wartet',
      chars: 0, teil_fertig: 0, teile: istAnalyse ? 4 : 1,
    });
  } catch (e) {
    return jsonResp({ error: 'Job konnte nicht angelegt werden.' }, 502);
  }
  if (!job || !job.id) return jsonResp({ error: 'Job konnte nicht angelegt werden.' }, 502);

  const ctx = { project, campaign, asset };

  // Status sofort sichtbar machen, damit ein Neuladen der Seite den Lauf erkennt.
  try {
    if (istAnalyse) {
      await supa.patch('me_projects', { id: 'eq.' + project_id }, { analyse_status: 'laeuft' });
    } else if (task === 'asset' && asset) {
      const patchBody = { status: 'laeuft', fehler: null };
      if (template) patchBody.template_id = template.id;
      await supa.patch('me_assets', { id: 'eq.' + asset.id }, patchBody);
    }
  } catch (e) { /* nicht abbruchwuerdig, die Job-Zeile bleibt die Wahrheit */ }

  // ---- Background-Function anstossen ----
  const base = process.env.URL || '';
  try {
    const res = await fetch(base + '/.netlify/functions/ai-background', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-me-internal': internalToken(job.id) },
      body: JSON.stringify({ job_id: job.id, hinweis, winkel_id, mehr, anzahl }),
    });
    if (!res || (res.status !== 202 && !res.ok)) {
      await markJobFehler(job.id, task, ctx, 'Die Hintergrund-Verarbeitung konnte nicht gestartet werden.');
      return jsonResp({ error: 'Die Hintergrund-Verarbeitung konnte nicht gestartet werden.' }, 502);
    }
  } catch (e) {
    await markJobFehler(job.id, task, ctx, 'Die Hintergrund-Verarbeitung konnte nicht erreicht werden.');
    return jsonResp({ error: 'Die Hintergrund-Verarbeitung konnte nicht erreicht werden.' }, 502);
  }

  return jsonResp({ job_id: job.id }, 200);
};

export const _test = { cleanId, markJobFehler };
