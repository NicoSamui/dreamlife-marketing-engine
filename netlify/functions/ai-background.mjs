// Dreamlife Marketing Engine, KI-Function (Netlify Function 2.0, BACKGROUND)
//
// Dateiname MUSS auf "-background.mjs" enden: nur dann behandelt Netlify die Function
// als Background-Function, antwortet dem Aufrufer sofort mit 202 und laesst sie bis zu
// 15 Minuten weiterlaufen, unabhaengig vom HTTP-Request/Response-Zyklus. Der Rueckgabewert
// dieser Function erreicht darum nie den Aufrufer (ai.mjs) und ist nur fuer Tests relevant.
//
// Wird von ai.mjs (Starter) angestossen: {job_id, hinweis?, winkel_id?, mehr?, anzahl?} im
// Body, Header x-me-internal = HMAC-SHA256(AI_GUARD_SALT, job_id) (siehe _shared/internal.js).
// Laedt den Job serverseitig aus me_jobs, uebernimmt ihn atomar (wartet -> laeuft, damit ein
// Job nie doppelt laeuft), laedt Projekt/Kampagne/Asset/Profil anhand der Job-uid und macht
// die eigentliche KI-Arbeit:
//   - analyse/verfeinern: 4 parallele Anthropic-Aufrufe (je eine Teilmenge der 17
//     Kategorien), Fortschritt ueber me_jobs.teil_fertig und me_jobs.chars.
//   - winkel/asset/konsistenz: ein Aufruf (weiterhin Streaming zu Anthropic, damit
//     me_jobs.chars laufend aktualisiert werden kann), Ergebnis wie bisher speichern.
// Am Ende steht me_jobs.status auf "fertig" (mit kleinem result-Objekt) oder "fehler"
// (mit fehler-Text). Die grossen Ergebnisse liegen in me_projects/me_campaigns/me_assets.

import supa from './_shared/supa.js';
import textHelpers from './_shared/text.js';
import prompts from './_shared/prompts.js';
import { internalToken } from './_shared/internal.js';
import { streamText } from './_shared/anthropic.js';

const MODEL = process.env.MODEL || 'claude-opus-5-5';
const CORS = { 'Content-Type': 'application/json' };
const CHARS_MIN_DELTA = 1500;
const CHARS_MIN_INTERVAL_MS = 2000;

function cleanId(v) {
  v = (v == null ? '' : '' + v).trim();
  if (!v || v === 'null' || v === 'undefined') return '';
  return v;
}
function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
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
    return { ok: true };
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
    return { titel };
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
  } catch (e) {
    console.error('ai-background.mjs saveError fehlgeschlagen', e && e.message);
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

// Baut einen Fortschritts-Melder, der me_jobs.chars hoechstens alle 2s und nur bei
// mindestens 1500 neuen Zeichen aktualisiert (Fehler beim Schreiben werden ignoriert,
// Fortschritt ist nie ein Abbruchgrund). "force" umgeht die Drosselung (letzter Stand).
function makeCharsReporter(jobId) {
  let lastSent = -1;
  let lastTime = 0;
  return function report(total, force) {
    const now = Date.now();
    if (!force && lastSent >= 0 && (total - lastSent < CHARS_MIN_DELTA || now - lastTime < CHARS_MIN_INTERVAL_MS)) return;
    lastSent = total;
    lastTime = now;
    supa.patch('me_jobs', { id: 'eq.' + jobId }, { chars: total }).catch(() => {});
  };
}

async function setTeilFertig(jobId, teil) {
  try { await supa.patch('me_jobs', { id: 'eq.' + jobId }, { teil_fertig: teil }); } catch (e) {}
}

// Fuehrt die 4 parallelen Analyse-Teile aus und liefert das zusammengefuegte Ergebnis.
async function runAnalyseParts(job, ctx, key, reportChars) {
  const teile = prompts.KATEGORIE_TEILE;
  const nummern = Object.keys(teile).map(Number).sort((a, b) => a - b);
  const charsByTeil = {};
  nummern.forEach((n) => { charsByTeil[n] = 0; });
  let fertigCount = 0;

  function totalChars() {
    return nummern.reduce((sum, n) => sum + charsByTeil[n], 0);
  }

  const jobs = nummern.map((n) => {
    const kategorien = teile[n];
    const promptData = prompts.buildPrompt('analyse', {
      project: ctx.project, hinweis: ctx.hinweis, profile: ctx.profile, kategorien,
    });
    return streamText({
      key, model: MODEL, system: promptData.system, user: promptData.user, max_tokens: promptData.max_tokens, schema: promptData.input_schema,
      onDelta: (deltaText) => {
        charsByTeil[n] += deltaText.length;
        reportChars(totalChars());
      },
    }).then((fullText) => {
      let parsed = textHelpers.extractJSON(fullText);
      parsed = textHelpers.deepStripDashes(parsed);
      fertigCount += 1;
      setTeilFertig(job.id, fertigCount);
      return { n, parsed };
    });
  });

  const results = await Promise.all(jobs);
  reportChars(totalChars(), true);

  const byTeil = {};
  results.forEach((r) => { byTeil[r.n] = r.parsed; });

  const merged = {};
  prompts.KATEGORIEN_ALL.forEach((k) => {
    for (const n of nummern) {
      const part = byTeil[n];
      if (part && part[k]) { merged[k] = part[k]; break; }
    }
  });

  // Nachlauf: fehlende Kategorien (z. B. durch abgeschnittene Antworten) in EINEM weiteren
  // Aufruf nachholen. Bleibt danach noch etwas leer, wird die Kategorie als Hinweis gefuellt,
  // damit die Analyse nie mit Luecken abgespeichert wird, ohne dass der Teilnehmer es sieht.
  const fehlend = prompts.KATEGORIEN_ALL.filter((k) => !merged[k]);
  if (fehlend.length) {
    try {
      const pd = prompts.buildPrompt('analyse', { project: ctx.project, hinweis: ctx.hinweis, profile: ctx.profile, kategorien: fehlend });
      const txt = await streamText({ key, model: MODEL, system: pd.system, user: pd.user, max_tokens: pd.max_tokens, schema: pd.input_schema,
        onDelta: (d) => { charsByTeil[nummern[0]] += d.length; reportChars(totalChars()); } });
      const nach = textHelpers.deepStripDashes(textHelpers.extractJSON(txt));
      fehlend.forEach((k) => { if (nach && nach[k]) merged[k] = nach[k]; });
    } catch (e) {
      console.warn('Analyse-Nachlauf fehlgeschlagen', e && e.message);
    }
    prompts.KATEGORIEN_ALL.filter((k) => !merged[k]).forEach((k) => {
      merged[k] = { titel: k, inhalt: 'Diese Kategorie konnte nicht erzeugt werden. Bitte "Verfeinern mit Hinweis" nutzen und diese Kategorie nennen.', punkte: [] };
    });
  }
  merged.meta = { erzeugt_am: new Date().toISOString(), modell: MODEL, version: '1.0' };
  return merged;
}

const key = process.env.ANTHROPIC_API_KEY;

export default async (req) => {
  let body = {};
  try { body = await req.json(); } catch (e) {}

  const jobId = cleanId(body.job_id);
  const token = req.headers.get('x-me-internal') || '';
  if (!jobId || !token || token !== internalToken(jobId)) {
    return jsonResp({ error: 'forbidden' }, 403);
  }

  let job;
  try {
    job = await supa.getOne('me_jobs', { id: 'eq.' + jobId });
  } catch (e) {
    return jsonResp({ error: 'Job konnte nicht geladen werden.' }, 502);
  }
  if (!job) return jsonResp({ error: 'Job nicht gefunden.' }, 404);

  // Atomar von "wartet" auf "laeuft" setzen: kommt keine Zeile zurueck, hat ein anderer
  // Lauf den Job schon uebernommen (oder er ist nicht mehr wartend) -> abbrechen.
  let claimed;
  try {
    claimed = await supa.patch('me_jobs', { id: 'eq.' + jobId, status: 'eq.wartet' }, {
      status: 'laeuft', updated_at: new Date().toISOString(),
    });
  } catch (e) {
    return jsonResp({ error: 'Job konnte nicht gestartet werden.' }, 502);
  }
  if (!Array.isArray(claimed) || !claimed.length) {
    return jsonResp({ ok: false, message: 'Job laeuft schon oder ist nicht mehr wartend.' }, 200);
  }

  if (!key) {
    await saveError(job.task, {}, 'KI ist noch nicht konfiguriert (ANTHROPIC_API_KEY fehlt im Backend).');
    try { await supa.patch('me_jobs', { id: 'eq.' + jobId }, { status: 'fehler', fehler: 'KI ist noch nicht konfiguriert.' }); } catch (e) {}
    return jsonResp({ error: 'not_configured' }, 503);
  }

  const uid = job.uid;
  const task = job.task;
  const reportChars = makeCharsReporter(jobId);

  let project = null, campaign = null, asset = null;
  const ctx = { hinweis: body.hinweis, mehr: !!body.mehr, winkel_id: body.winkel_id, anzahl: body.anzahl };

  try {
    project = await supa.getOne('me_projects', { id: 'eq.' + job.project_id });
    if (!project || project.uid !== uid) throw new Error('Kein Zugriff auf dieses Projekt.');
    ctx.project = project;

    if (job.campaign_id) {
      campaign = await supa.getOne('me_campaigns', { id: 'eq.' + job.campaign_id });
      if (!campaign || campaign.uid !== uid || campaign.project_id !== job.project_id) throw new Error('Kein Zugriff auf diese Kampagne.');
      ctx.campaign = campaign;
    }

    let typ = job.typ;
    if (job.asset_id) {
      asset = await supa.getOne('me_assets', { id: 'eq.' + job.asset_id });
      if (!asset || asset.uid !== uid || asset.campaign_id !== job.campaign_id) throw new Error('Kein Zugriff auf dieses Asset.');
      typ = asset.typ;
    }
    ctx.asset = asset;
    ctx.typ = typ;

    let winkelListe = [];
    if (campaign && Array.isArray(project.winkel)) {
      const ids = new Set((campaign.winkel_ids || []).map(String));
      winkelListe = project.winkel.filter((w) => w && ids.has(String(w.id)));
    }
    ctx.winkel = winkelListe;

    let profile = null;
    try {
      const member = await supa.getOne('ls_members', { uid: 'eq.' + uid });
      profile = profileBlock(member);
    } catch (e) { /* optional */ }
    ctx.profile = profile;

    // Konsistenz-Check: alle fertigen Assets der Kampagne mitgeben (kompakt, je Asset gekuerzt).
    let assetsCtx = [];
    if (task === 'konsistenz' && campaign) {
      try {
        // Nur die NEUESTE fertige Version je Asset-Typ pruefen: aeltere Entwuerfe desselben
        // Typs sind keine Widersprueche der Kampagne, sondern verworfene Varianten.
        const rows = await supa.select('me_assets', 'select=typ,titel,content,created_at&campaign_id=eq.' + campaign.id + '&status=eq.fertig&order=created_at.desc&limit=60');
        const seen = new Set();
        const neueste = (Array.isArray(rows) ? rows : []).filter((r) => { if (seen.has(r.typ)) return false; seen.add(r.typ); return true; });
        assetsCtx = neueste.map((r) => {
          let inhalt = '';
          try { inhalt = JSON.stringify(r.content || {}); } catch (e) { inhalt = ''; }
          if (inhalt.length > 9000) inhalt = inhalt.slice(0, 9000) + ' ...[gekuerzt]';
          return { typ: r.typ, titel: r.titel, inhalt };
        });
      } catch (e) { console.warn('Assets fuer Konsistenz nicht ladbar', e && e.message); }
    }

    let saveCtx = { project, campaign, asset, uid, typ, mehr: ctx.mehr };
    let jobResult;

    if (task === 'analyse' || task === 'verfeinern') {
      const merged = await runAnalyseParts(job, ctx, key, reportChars);
      await saveResult(task, merged, saveCtx);
      jobResult = { ok: true };
    } else {
      const promptData = prompts.buildPrompt(task, {
        project, campaign, asset, typ, winkel: ctx.winkel, winkel_id: ctx.winkel_id,
        profile, hinweis: ctx.hinweis, mehr: ctx.mehr, anzahl: ctx.anzahl, assets: assetsCtx,
      });
      const fullText = await streamText({
        key, model: MODEL, system: promptData.system, user: promptData.user, max_tokens: promptData.max_tokens, schema: promptData.input_schema,
        onDelta: (_delta, total) => reportChars(total),
      });
      reportChars(fullText.length, true);
      let parsed = textHelpers.extractJSON(fullText);
      parsed = textHelpers.deepStripDashes(parsed);
      jobResult = await saveResult(task, parsed, saveCtx);
    }

    await supa.patch('me_jobs', { id: 'eq.' + jobId }, {
      status: 'fertig', result: jobResult, teil_fertig: job.teile || 1, updated_at: new Date().toISOString(),
    });
    return jsonResp({ ok: true }, 200);
  } catch (err) {
    const message = (err && err.message) || 'Unerwarteter Fehler.';
    try { await saveError(task, ctx, message); } catch (e) {}
    try { await supa.patch('me_jobs', { id: 'eq.' + jobId }, { status: 'fehler', fehler: String(message).slice(0, 500) }); } catch (e) {}
    return jsonResp({ error: message }, 200);
  }
};

export const _test = { extractTitel, saveResult, saveError, cleanId, makeCharsReporter, runAnalyseParts };
