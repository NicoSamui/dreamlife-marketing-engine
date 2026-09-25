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
// Job nie doppelt laeuft), laedt Projekt/Firma/Kampagne/Avatar/Asset/Profil anhand der
// Job-uid und macht die eigentliche KI-Arbeit (SPEC §12.3/§12.4/§12.5):
//   - kurzprofil: EIN Aufruf (Stufe 1), speichert me_projects.kurzprofil, stoesst danach
//     automatisch Stufe 2 an (neuer me_jobs-Eintrag task "analyse").
//   - analyse/verfeinern: 6 Teile A bis F, paarweise nacheinander gestartet
//     ((A,B) dann (C,D) dann (E,F)), jeder fertige Teil wird SOFORT in me_projects.analyse
//     gemergt und me_projects.analyse_teile[<Buchstabe>] gesetzt, Fortschritt zusaetzlich
//     ueber me_jobs.teil_fertig und me_jobs.chars.
//   - avatar_vorschlag: EIN Aufruf, legt bis zu 3 Zeilen in me_avatare an.
//   - winkel/asset/konsistenz: ein Aufruf (weiterhin Streaming zu Anthropic, damit
//     me_jobs.chars laufend aktualisiert werden kann), Ergebnis wie bisher speichern.
// Am Ende steht me_jobs.status auf "fertig" (mit kleinem result-Objekt) oder "fehler"
// (mit fehler-Text). Die grossen Ergebnisse liegen in me_projects/me_campaigns/me_assets/me_avatare.

import supa from './_shared/supa.js';
import textHelpers from './_shared/text.js';
import prompts from './_shared/prompts.js';
import { internalToken } from './_shared/internal.js';
import { streamText } from './_shared/anthropic.js';

const CORS = { 'Content-Type': 'application/json' };
const CHARS_MIN_DELTA = 1500;
const CHARS_MIN_INTERVAL_MS = 2000;
const MAX_REF_IMAGE_BYTES = 5 * 1024 * 1024;
const NEUE_VORLAGE_NAME = 'Neue Vorlage';

// Holt das Referenzbild einer Creative-Vorlage (Creative-Decoder), maximal 5 MB, muss ein
// Bild sein (Content-Type image/*). Liefert media_type + Base64-Daten fuer Anthropic.
async function fetchReferenceImage(url) {
  // Nur Bilder aus dem eigenen Speicher (Schutz, falls bild_url nachtraeglich geaendert wurde).
  const prefix = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/storage/v1/object/public/me-creatives/ref/';
  if (process.env.SUPABASE_URL && (String(url || '').indexOf(prefix) !== 0 || /\.\./.test(String(url)))) {
    throw new Error('Das Referenzbild liegt nicht im erlaubten Speicher.');
  }
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error('Das Referenzbild konnte nicht geladen werden.');
  }
  if (!res || !res.ok) throw new Error('Das Referenzbild konnte nicht geladen werden.');
  const ct = String(res.headers.get('content-type') || '').split(';')[0].trim();
  if (!/^image\//i.test(ct)) throw new Error('Das Referenzbild hat keinen gueltigen Bildtyp.');
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_REF_IMAGE_BYTES) throw new Error('Das Referenzbild ist zu gross.');
  return { media_type: ct, data: buf.toString('base64') };
}

function cleanId(v) {
  v = (v == null ? '' : '' + v).trim();
  if (!v || v === 'null' || v === 'undefined') return '';
  return v;
}
function jsonResp(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: CORS });
}

// Laedt die Firma einer Zielgruppe (SPEC §12.1/§12.5): me_firmen ueber project.firma_id,
// uid wird geprueft. Fehlt firma_id oder die Zeile, liefert die Funktion null (kein Fehler,
// eine Zielgruppe ohne Firma ist gueltig, z. B. Altbestand vor der Migration).
async function loadFirma(project, uid) {
  const firmaId = project && cleanId(project.firma_id);
  if (!firmaId) return null;
  try {
    const firma = await supa.getOne('me_firmen', { id: 'eq.' + firmaId });
    if (!firma || firma.uid !== uid) return null;
    return firma;
  } catch (e) {
    return null;
  }
}

// Laedt den fuer eine Kampagne gewaehlten Avatar (SPEC §12.4/§12.5): me_avatare ueber
// campaign.avatar_id, uid und project_id werden geprueft. Ohne avatar_id oder bei einem
// fremden/fehlenden Avatar liefert die Funktion null (Kampagnen ohne Avatar sind gueltig).
async function loadAvatarRow(campaign, uid) {
  const avatarId = campaign && cleanId(campaign.avatar_id);
  if (!avatarId) return null;
  try {
    const avatar = await supa.getOne('me_avatare', { id: 'eq.' + avatarId });
    if (!avatar || avatar.uid !== uid || avatar.project_id !== campaign.project_id) return null;
    return avatar;
  } catch (e) {
    return null;
  }
}

// Stoesst einen neu angelegten Job bei sich selbst (dieser Function) an, mit demselben
// internen Token-Schutz wie ai.mjs (SPEC §12.3, Stufe 1 -> Stufe 2). Liefert true bei Erfolg.
async function kickOffJob(jobId) {
  const base = process.env.URL || '';
  try {
    const res = await fetch(base + '/.netlify/functions/ai-background', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-me-internal': internalToken(jobId) },
      body: JSON.stringify({ job_id: jobId }),
    });
    return !!res && (res.status === 202 || res.ok);
  } catch (e) {
    return false;
  }
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

  // Hinweis: "analyse"/"verfeinern" werden NICHT mehr hier gespeichert (SPEC §12.3): die
  // 6 Teile A bis F speichern sich progressiv selbst (siehe runAnalysePartsProgressive unten),
  // damit die Oberflaeche sich Kategorie fuer Kategorie fuellt statt am Ende in einem Schritt.

  if (realTask === 'kurzprofil') {
    await supa.patch('me_projects', { id: 'eq.' + ctx.project.id }, {
      kurzprofil: parsed, kurzprofil_status: 'fertig', updated_at: nowIso,
    });
    return { ok: true };
  }

  if (realTask === 'avatar_vorschlag') {
    const avatare = Array.isArray(parsed.avatare) ? parsed.avatare : [];
    const rows = avatare.slice(0, 3).map((a) => {
      const profil = Object.assign({}, a);
      delete profil.name;
      return { uid: ctx.uid, project_id: ctx.project.id, name: a.name, profil, bilder: [], gewaehlt: null };
    });
    const ids = [];
    for (const row of rows) {
      try {
        const inserted = await supa.insert('me_avatare', row);
        if (inserted && inserted.id) ids.push(inserted.id);
      } catch (e) {
        console.warn('avatar_vorschlag: Zeile konnte nicht angelegt werden', e && e.message);
      }
    }
    return { avatar_ids: ids };
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

  if (realTask === 'decode') {
    const patchBody = { decode: parsed, status: 'fertig', fehler: null, updated_at: nowIso };
    // Der eigene Name wird nur ersetzt, wenn der Teilnehmer die Vorlage noch nicht
    // umbenannt hat (Standardname "Neue Vorlage"), damit ein eigener Name nie ueberschrieben wird.
    if ((ctx.template.name || NEUE_VORLAGE_NAME) === NEUE_VORLAGE_NAME && parsed && parsed.name_vorschlag) {
      patchBody.name = String(parsed.name_vorschlag).slice(0, 120);
    }
    await supa.patch('me_templates', { id: 'eq.' + ctx.template.id }, patchBody);
    return { ok: true };
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
    } else if (realTask === 'kurzprofil' && ctx.project) {
      await supa.patch('me_projects', { id: 'eq.' + ctx.project.id }, { kurzprofil_status: 'fehler' });
    } else if (realTask === 'asset' && ctx.asset) {
      await supa.patch('me_assets', { id: 'eq.' + ctx.asset.id }, { status: 'fehler', fehler: msg });
    } else if (realTask === 'decode' && ctx.template) {
      await supa.patch('me_templates', { id: 'eq.' + ctx.template.id }, { status: 'fehler', fehler: msg });
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

// Fuehrt die 6 Analyse-Teile A bis F progressiv aus (SPEC §12.3): paarweise nacheinander
// gestartet ((A,B), dann (C,D), dann (E,F)), innerhalb eines Paars parallel. Nach JEDEM
// fertigen Teil wird die Analyse-Zeile frisch geladen, die Kategorien des Teils gemergt,
// analyse_teile[<Buchstabe>] gesetzt und sofort gespeichert, damit sich die Oberflaeche
// Kategorie fuer Kategorie fuellt. Ein einzelner Teil-Fehler setzt nur diesen Buchstaben auf
// "fehler" und blockiert die anderen Teile nicht. Am Ende: analyse_status "fertig", wenn
// mindestens 12 der 17 Kategorien vorhanden sind (mit einem Nachlauf-Versuch fuer fehlende
// Kategorien), sonst "fehler". Speichert direkt in me_projects und liefert nur ein kleines
// Ergebnis-Objekt fuer den Job zurueck (kein Rueckgabewert zum weiteren Speichern noetig).
async function runAnalysePartsProgressive(job, ctx, key, reportChars) {
  const teile = prompts.KATEGORIE_TEILE;
  const paare = prompts.KATEGORIE_PAARE;
  const buchstaben = paare.reduce((acc, p) => acc.concat(p), []);
  const charsByTeil = {};
  buchstaben.forEach((b) => { charsByTeil[b] = 0; });
  let teilFertigCount = 0;

  function totalChars() {
    return buchstaben.reduce((sum, b) => sum + charsByTeil[b], 0);
  }

  // Serialisiert das Lesen+Mergen+Schreiben je Teil (nicht die KI-Aufrufe selbst): zwei Teile
  // eines Paars laufen bei Anthropic parallel, aber wenn beide fast gleichzeitig fertig werden,
  // wuerde ein "frisch laden -> mergen -> schreiben" ohne diese Schlange den jeweils anderen
  // Teil ueberschreiben (verlorenes Update). Die Kette stellt sicher, dass jeder Teil seinen
  // Schreibvorgang erst beginnt, wenn der vorherige abgeschlossen ist, dabei aber sofort dran
  // ist, sobald er an der Reihe ist (kein Warten auf das ganze Paar).
  let schreibKette = Promise.resolve();
  function serialisiert(fn) {
    const lauf = schreibKette.then(fn, fn);
    schreibKette = lauf.then(() => {}, () => {});
    return lauf;
  }

  async function persistFertig(letter, kategorien, parsed) {
    let fresh = null;
    try { fresh = await supa.getOne('me_projects', { id: 'eq.' + ctx.project.id }); } catch (e) { /* nutze alten Stand */ }
    const bestehendeAnalyse = (fresh && fresh.analyse && typeof fresh.analyse === 'object') ? fresh.analyse : {};
    const mergedAnalyse = Object.assign({}, bestehendeAnalyse);
    kategorien.forEach((k) => { if (parsed && parsed[k]) mergedAnalyse[k] = parsed[k]; });
    const bestehendeTeile = (fresh && fresh.analyse_teile && typeof fresh.analyse_teile === 'object') ? fresh.analyse_teile : {};
    const analyseTeile = Object.assign({}, bestehendeTeile, { [letter]: 'fertig' });
    await supa.patch('me_projects', { id: 'eq.' + ctx.project.id }, { analyse: mergedAnalyse, analyse_teile: analyseTeile });
    teilFertigCount += 1;
    await setTeilFertig(job.id, teilFertigCount);
  }

  async function persistFehler(letter) {
    try {
      let fresh = null;
      try { fresh = await supa.getOne('me_projects', { id: 'eq.' + ctx.project.id }); } catch (e2) { /* nutze alten Stand */ }
      const bestehendeTeile = (fresh && fresh.analyse_teile && typeof fresh.analyse_teile === 'object') ? fresh.analyse_teile : {};
      await supa.patch('me_projects', { id: 'eq.' + ctx.project.id }, { analyse_teile: Object.assign({}, bestehendeTeile, { [letter]: 'fehler' }) });
    } catch (e2) { /* nicht abbruchwuerdig */ }
  }

  async function runOne(letter) {
    const kategorien = teile[letter];
    try {
      const promptData = prompts.buildPrompt('analyse', {
        project: ctx.project, firma: ctx.firma, hinweis: ctx.hinweis, profile: ctx.profile, kategorien,
      });
      const fullText = await streamText({
        key, model: promptData.model, effort: promptData.effort,
        system: promptData.system, user: promptData.user, max_tokens: promptData.max_tokens, schema: promptData.input_schema,
        onDelta: (deltaText) => { charsByTeil[letter] += deltaText.length; reportChars(totalChars()); },
      });
      const parsed = textHelpers.deepStripDashes(textHelpers.extractJSON(fullText));
      await serialisiert(() => persistFertig(letter, kategorien, parsed));
      return { letter, ok: true };
    } catch (e) {
      console.warn('Analyse-Teil fehlgeschlagen', letter, e && e.message);
      await serialisiert(() => persistFehler(letter));
      return { letter, ok: false, error: e && e.message };
    }
  }

  for (const paar of paare) {
    await Promise.all(paar.map(runOne));
  }
  reportChars(totalChars(), true);

  // Endstand laden: mindestens 12 der 17 Kategorien muessen vorhanden sein, sonst einmaliger
  // Nachlauf fuer die fehlenden Kategorien (wie bisher bei der 4-Teile-Version).
  let finalProject = null;
  try { finalProject = await supa.getOne('me_projects', { id: 'eq.' + ctx.project.id }); } catch (e) { /* siehe unten */ }
  let analyse = (finalProject && finalProject.analyse && typeof finalProject.analyse === 'object') ? finalProject.analyse : {};
  let fehlend = prompts.KATEGORIEN_ALL.filter((k) => !analyse[k]);

  if (fehlend.length) {
    try {
      const pd = prompts.buildPrompt('analyse', { project: ctx.project, firma: ctx.firma, hinweis: ctx.hinweis, profile: ctx.profile, kategorien: fehlend });
      const txt = await streamText({
        key, model: pd.model, effort: pd.effort, system: pd.system, user: pd.user, max_tokens: pd.max_tokens, schema: pd.input_schema,
        onDelta: (d) => reportChars(totalChars() + d.length),
      });
      const nach = textHelpers.deepStripDashes(textHelpers.extractJSON(txt));
      fehlend.forEach((k) => { if (nach && nach[k]) analyse[k] = nach[k]; });
    } catch (e) {
      console.warn('Analyse-Nachlauf fehlgeschlagen', e && e.message);
    }
    fehlend = prompts.KATEGORIEN_ALL.filter((k) => !analyse[k]);
  }

  const vorhandenCount = prompts.KATEGORIEN_ALL.length - fehlend.length;
  const status = vorhandenCount >= 12 ? 'fertig' : 'fehler';
  if (status === 'fertig' && (!analyse.meta || typeof analyse.meta !== 'object')) {
    analyse.meta = { erzeugt_am: new Date().toISOString(), modell: prompts.modelFor('analyse'), version: '1.3' };
  }
  await supa.patch('me_projects', { id: 'eq.' + ctx.project.id }, { analyse, analyse_status: status, updated_at: new Date().toISOString() });
  if (status !== 'fertig') {
    throw new Error('Die Zielgruppenanalyse konnte nicht vollstaendig erstellt werden (' + vorhandenCount + ' von ' + prompts.KATEGORIEN_ALL.length + ' Kategorien).');
  }
  return { ok: true, kategorien: vorhandenCount };
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
  const ctx = { hinweis: body.hinweis, mehr: !!body.mehr, winkel_id: body.winkel_id, anzahl: body.anzahl, awareness: body.awareness };

  let template = null;

  try {
    if (job.project_id) {
      project = await supa.getOne('me_projects', { id: 'eq.' + job.project_id });
      if (!project || project.uid !== uid) throw new Error('Kein Zugriff auf dieses Projekt.');
      ctx.project = project;
      // Firma der Zielgruppe (SPEC §12.1/§12.5): eigener Kontext-Block fuer alle Aufgaben.
      // Fehlt firma_id oder die Zeile, bleibt ctx.firma null (kein Fehler).
      ctx.firma = await loadFirma(project, uid);
    }

    if (job.template_id) {
      template = await supa.getOne('me_templates', { id: 'eq.' + job.template_id });
      if (!template || template.uid !== uid) throw new Error('Kein Zugriff auf diese Vorlage.');
      ctx.template = template;
    }

    if (job.campaign_id) {
      campaign = await supa.getOne('me_campaigns', { id: 'eq.' + job.campaign_id });
      if (!campaign || campaign.uid !== uid || campaign.project_id !== job.project_id) throw new Error('Kein Zugriff auf diese Kampagne.');
      ctx.campaign = campaign;
      // Gewaehlter Avatar der Kampagne (SPEC §12.4/§12.5), ohne bilder/bild_prompt im Prompt.
      ctx.avatarRow = await loadAvatarRow(campaign, uid);
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

    let saveCtx = { project, campaign, asset, template, uid, typ, mehr: ctx.mehr };
    let jobResult;

    if (task === 'kurzprofil') {
      const promptData = prompts.buildPrompt('kurzprofil', { project, firma: ctx.firma });
      const fullText = await streamText({
        key, model: promptData.model, effort: promptData.effort,
        system: promptData.system, user: promptData.user, max_tokens: promptData.max_tokens, schema: promptData.input_schema,
        onDelta: (_delta, total) => reportChars(total),
      });
      reportChars(fullText.length, true);
      const parsed = textHelpers.deepStripDashes(textHelpers.extractJSON(fullText));
      await saveResult('kurzprofil', parsed, saveCtx);

      // SPEC §12.3: nach dem Kurzprofil startet automatisch Stufe 2 (Detailanalyse, 6 Teile).
      let analyseJobId = null;
      try {
        const analyseJob = await supa.insert('me_jobs', {
          uid, task: 'analyse', typ: null,
          project_id: project.id, campaign_id: null, asset_id: null,
          status: 'wartet', chars: 0, teil_fertig: 0, teile: 6,
        });
        analyseJobId = analyseJob && analyseJob.id;
        if (analyseJobId) {
          await supa.patch('me_projects', { id: 'eq.' + project.id }, { analyse_status: 'laeuft', analyse_teile: {} });
          const gestartet = await kickOffJob(analyseJobId);
          if (!gestartet) {
            await supa.patch('me_projects', { id: 'eq.' + project.id }, { analyse_status: 'fehler' });
          }
        }
      } catch (e) {
        console.warn('Stufe 2 (Analyse) konnte nicht automatisch gestartet werden', e && e.message);
        try { await supa.patch('me_projects', { id: 'eq.' + project.id }, { analyse_status: 'fehler' }); } catch (e2) {}
      }
      jobResult = { ok: true, analyse_job_id: analyseJobId };
    } else if (task === 'avatar_vorschlag') {
      const promptData = prompts.buildPrompt('avatar_vorschlag', { project, firma: ctx.firma });
      const fullText = await streamText({
        key, model: promptData.model, effort: promptData.effort,
        system: promptData.system, user: promptData.user, max_tokens: promptData.max_tokens, schema: promptData.input_schema,
        onDelta: (_delta, total) => reportChars(total),
      });
      reportChars(fullText.length, true);
      const parsed = textHelpers.deepStripDashes(textHelpers.extractJSON(fullText));
      jobResult = await saveResult('avatar_vorschlag', parsed, saveCtx);
    } else if (task === 'analyse' || task === 'verfeinern') {
      jobResult = await runAnalysePartsProgressive(job, ctx, key, reportChars);
    } else if (task === 'decode') {
      const image = await fetchReferenceImage(template.bild_url);
      const promptData = prompts.buildPrompt('decode', { template });
      const fullText = await streamText({
        key, model: promptData.model, effort: promptData.effort,
        system: promptData.system, user: promptData.user, max_tokens: promptData.max_tokens,
        schema: promptData.input_schema, images: [image],
        onDelta: (_delta, total) => reportChars(total),
      });
      reportChars(fullText.length, true);
      let parsed = textHelpers.extractJSON(fullText);
      parsed = textHelpers.deepStripDashes(parsed);
      jobResult = await saveResult('decode', parsed, saveCtx);
    } else {
      const promptData = prompts.buildPrompt(task, {
        project, firma: ctx.firma, campaign, asset, typ, winkel: ctx.winkel, winkel_id: ctx.winkel_id, avatarRow: ctx.avatarRow,
        profile, hinweis: ctx.hinweis, mehr: ctx.mehr, anzahl: ctx.anzahl, assets: assetsCtx, template,
        awareness: ctx.awareness,
      });
      const fullText = await streamText({
        key, model: promptData.model, effort: promptData.effort,
        system: promptData.system, user: promptData.user, max_tokens: promptData.max_tokens, schema: promptData.input_schema,
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

export const _test = {
  extractTitel, saveResult, saveError, cleanId, makeCharsReporter, runAnalysePartsProgressive,
  fetchReferenceImage, loadFirma, loadAvatarRow, kickOffJob,
};
