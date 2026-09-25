/* ============================================================================
   Dreamlife Marketing Engine - app.js
   Eine IIFE, kein Modul-System, ES2018. Siehe docs/FRONTEND.md fuer die
   Landkarte (Funktionen, Routen, Zustaende).
   ============================================================================ */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     0) Kleine Helfer
     ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function inlineMd(s) {
    var e = esc(s);
    e = e.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return e;
  }

  /* Minimaler Markdown-Renderer: Absaetze, Zeilenumbrueche, **fett**, "- " Listen. */
  function mdMini(raw) {
    if (!raw) return '<p class="dlm-empty-txt">Nicht vorhanden.</p>';
    var text = String(raw).replace(/\\r\\n|\\n/g, '\n').replace(/\r\n/g, '\n');
    var blocks = text.split(/\n{2,}/);
    var out = blocks.map(function (block) {
      var lines = block.split('\n').filter(function (l) { return l.length; });
      if (!lines.length) return '';
      var listLines = lines.filter(function (l) { return /^\s*-\s+/.test(l); });
      if (listLines.length === lines.length) {
        return '<ul>' + lines.map(function (l) {
          return '<li>' + inlineMd(l.replace(/^\s*-\s+/, '')) + '</li>';
        }).join('') + '</ul>';
      }
      return '<p>' + lines.map(inlineMd).join('<br>') + '</p>';
    });
    var html = out.join('');
    return html || '<p class="dlm-empty-txt">Nicht vorhanden.</p>';
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function uid8() {
    return Math.random().toString(36).slice(2, 10);
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { toast('Kopiert.'); }, function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
    return Promise.resolve();
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Kopiert.');
    } catch (e) { toast('Kopieren nicht möglich.'); }
  }

  /* ------------------------------------------------------------------
     1) Texte (T)
     ------------------------------------------------------------------ */
  var T = {
    lockTitle: 'Anmeldung erforderlich',
    lockText: 'Die Dreamlife Marketing Engine öffnet sich nur über deinen Mitgliederbereich in LearningSuite.',
    hello: 'Hallo',
    breadcrumbProjects: 'Projekte',
    footerVersion: 'Version',
    newVersion: 'Neue Version, bitte neu laden.',
    reload: 'Neu laden',
    newProject: 'Neues Projekt',
    newProjectTitle: 'Neues Projekt anlegen',
    projectName: 'Name des Projekts',
    projectNamePh: 'z. B. Coaching für Zahnärzte',
    create: 'Anlegen',
    cancel: 'Abbrechen',
    save: 'Speichern',
    rename: 'Umbenennen',
    archive: 'Archivieren',
    delete: 'Löschen',
    projectsEmpty: 'Noch kein Projekt angelegt. Leg dein erstes Projektordner an.',
    tabBrief: 'Brief',
    tabZielgruppe: 'Zielgruppe',
    tabWinkel: 'Winkel',
    tabKampagnen: 'Kampagnen',
    briefHelp: 'Je konkreter, desto besser wird die Analyse.',
    briefSaved: 'Gespeichert.',
    zielgruppeEmptyTitle: 'Noch keine Zielgruppenanalyse',
    zielgruppeEmptyText: 'Erzeuge eine ausführliche Zielgruppenanalyse auf Basis deines Briefs. Das dauert 2 bis 4 Minuten, du kannst währenddessen den Tab wechseln.',
    zielgruppeCreate: 'Zielgruppenanalyse erstellen',
    zielgruppeRefine: 'Verfeinern mit Hinweis',
    zielgruppeRedo: 'Komplett neu erzeugen',
    zielgruppeExport: 'Als Text exportieren',
    zielgruppeRedoConfirm: 'Die bestehende Analyse wird ersetzt. Fortfahren?',
    winkelEmptyTitle: 'Noch keine Marketing-Winkel',
    winkelEmptyText: 'Lass aus deiner Analyse 16 bis 20 Marketing-Winkel erzeugen und wähle davon 5 bis 10 aus.',
    winkelCreate: 'Marketing-Winkel erzeugen',
    winkelMore: '8 weitere Winkel',
    winkelCountUnder: 'gewählt (mindestens 5 nötig)',
    winkelCountOk: 'gewählt',
    winkelCountOver: 'zu viele gewählt (maximal 10)',
    kampagnenEmptyTitle: 'Noch keine Kampagne angelegt',
    kampagnenEmpty: 'Leg deine erste Kampagne an, um daraus fertige Marketing-Assets zu erzeugen.',
    assetsEmptyText: 'Für diese Auswahl gibt es noch keine Assets. Erzeuge oben in der Asset-Werkstatt dein erstes Asset.',
    kampagneNew: 'Neue Kampagne',
    kampagneNewTitle: 'Neue Kampagne anlegen',
    kampagneName: 'Name der Kampagne',
    kampagneZiel: 'Ziel',
    kampagneWinkel: 'Winkel (mindestens einer)',
    kampagneAngebot: 'Angebot',
    needFiveWinkel: 'Wähle zuerst mindestens 5 Winkel aus, bevor du eine Kampagne anlegst.',
    needAnalyse: 'Erzeuge zuerst eine Zielgruppenanalyse.',
    consistencyCheck: 'Konsistenz prüfen',
    consistencyRunning: 'Prüft Konsistenz...',
    assetsTitle: 'Asset-Werkstatt',
    assetGenerate: 'Erzeugen',
    assetFocusWinkel: 'Winkel-Fokus (optional)',
    assetHint: 'Hinweis (optional)',
    assetListTitle: 'Alle Assets',
    assetFilterAll: 'Alle',
    assetCopyAll: 'Alles kopieren',
    assetRegenerate: 'Neu erzeugen',
    assetDelete: 'Löschen',
    assetExport: 'Als Text exportieren',
    assetPrint: 'Als PDF drucken',
    assetBack: 'Zurück zur Kampagne',
    cancelRun: 'Abbrechen',
    statusLaeuft: 'Läuft',
    statusFertig: 'Fertig',
    statusFehler: 'Fehler',
    statusLeer: 'Leer',
    introTitle1: '1. Projekt anlegen',
    introText1: 'Leg für jede Geschäftsidee ein Projekt an: Firma, Branche, Dienstleistungen und Angebot.',
    introTitle2: '2. Zielgruppe und Winkel',
    introText2: 'Aus deinem Brief entsteht eine ausführliche Zielgruppenanalyse. Daraus wählst du 5 bis 10 Marketing-Winkel aus.',
    introTitle3: '3. Kampagnen und Assets',
    introText3: 'Pro Kampagne erzeugst du fertige Marketing-Assets: Bild-Creatives, Reels, Captions, E-Mails, VSL, Leadmagnet und Funnel.',
    introNext: 'Weiter',
    introBack: 'Zurück',
    introDone: 'Los geht\'s',
    formatImg: 'Bild erzeugen',
    imgLoading: 'Bild wird erzeugt...',
    imgDownload: 'Herunterladen',
    genericError: 'Da ist etwas schiefgelaufen.',
    confirmDeleteAsset: 'Dieses Asset wirklich löschen?',
    confirmDeleteProject: 'Dieses Projekt wirklich archivieren?'
  };

  var STATUS_TEXTS = {
    analyse: [
      'Lese deinen Brief', 'Baue das Basisprofil', 'Suche die echten Schmerzpunkte (WEG VON)',
      'Formuliere den Wunschzustand (HIN ZU)', 'Schreibe reale Alltagssituationen', 'Ordne die DISG-Typen ein',
      'Bewerte die Life Force 8', 'Sammle Einwände und Glaubenssätze', 'Notiere wörtliche Sätze deiner Zielgruppe',
      'Fasse zusammen'
    ],
    winkel: ['Lese die Analyse', 'Sammle Ansatzpunkte', 'Formuliere Winkel', 'Prüfe auf Vielfalt', 'Ordne die Liste'],
    asset: ['Lese Analyse und Winkel', 'Baue die Struktur', 'Schreibe die Texte', 'Prüft Sprache und Länge', 'Speichert Ergebnis'],
    konsistenz: ['Lese alle Assets der Kampagne', 'Vergleicht Tonalität', 'Prüft Widersprüche', 'Fasst zusammen']
  };

  /* Feste Reihenfolge und Anzeige-Labels nach SPEC §3 (Befund 2). Schluessel
     bleiben unveraendert (Backend-Daten), nur die Anzeige-Titel haben
     Umlaute. "meta" ist kein Kategorie-Eintrag und wird nie gerendert. */
  var ANALYSE_CATS = [
    ['basisprofil', 'Basisprofil'], ['wissensstand', 'Wissensstand'], ['marktwissen', 'Marktwissen'],
    ['weg_von', 'WEG VON: der Ist-Zustand'], ['hin_zu', 'HIN ZU: der Wunschzustand'],
    ['reale_situationen', 'Reale Situationen aus dem Alltag'], ['disg', 'DISG-Modell'],
    ['life_force_8', 'Life Force 8'], ['sekundaere_wuensche_9', '9 sekundäre Wünsche'],
    ['einwaende', 'Einwände'], ['awareness_stufe', 'Awareness-Stufe'], ['glaubenssaetze', 'Glaubenssätze'],
    ['sprache_zitate', 'Sprache und wörtliche Zitate'], ['kaufausloeser', 'Kaufauslöser'],
    ['kanaele', 'Kanäle'], ['entscheidungsprozess', 'Entscheidungsprozess'], ['zusammenfassung', 'Zusammenfassung']
  ];

  /* Kleine Inline-SVG-Icons (Befund 6), keine externen Assets. */
  var ICONS = {
    bild: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="8.5" cy="10" r="1.6"></circle><path d="M21 16l-5.5-5.5L9 17"></path></svg>',
    video: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"></rect><path d="M16 10.5l5-3v9l-5-3"></path></svg>',
    sprechblase: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-4 4V5z"></path></svg>',
    gruppe: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"></circle><path d="M2 20c0-3.3 3-6 7-6s7 2.7 7 6"></path><circle cx="17.5" cy="9" r="2.4"></circle><path d="M16 14.2c2.7.3 5 2.3 5 5.8"></path></svg>',
    brief: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path></svg>',
    play: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M10 8.5l6 3.5-6 3.5v-7z"></path></svg>',
    dokument: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"></path><path d="M15 3v4h4"></path><path d="M9 12h7M9 16h7"></path></svg>',
    trichter: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16l-6 8v6l-4 2v-8z"></path></svg>',
    ordner: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z"></path></svg>'
  };

  var ASSET_TYPES = [
    { typ: 'creative', label: 'Bild-Creatives', icon: ICONS.bild, desc: 'Werbeanzeigen mit Headline, Text und KI-Bild in drei Formaten.' },
    { typ: 'reel', label: 'Reel-Skripte', icon: ICONS.video, desc: 'Kurzvideo-Skripte mit Hook, Szenen und Caption.' },
    { typ: 'caption', label: 'Social-Captions', icon: ICONS.sprechblase, desc: 'Beiträge für Social-Media-Feeds.' },
    { typ: 'olg', label: 'OLG-Beiträge', icon: ICONS.gruppe, desc: 'Organische Beiträge für Gruppen und Communities.' },
    { typ: 'email', label: 'E-Mail-Sequenz', icon: ICONS.brief, desc: 'Mehrteilige E-Mail-Serie zum Angebot.' },
    { typ: 'vsl', label: 'VSL-Skript', icon: ICONS.play, desc: 'Sprechtext für ein Video-Sales-Letter.' },
    { typ: 'leadmagnet', label: 'PDF-Leadmagnet', icon: ICONS.dokument, desc: 'Kostenloses PDF mit Kapiteln und Checkliste.' },
    { typ: 'funnel', label: 'Funnel-Blueprint', icon: ICONS.trichter, desc: 'Aufbau eines kompletten Funnels in Schritten.' }
  ];
  function assetLabel(typ) {
    var f = ASSET_TYPES.filter(function (a) { return a.typ === typ; })[0];
    return f ? f.label : typ;
  }

  var ZIELE = [
    ['leads', 'Leads'], ['termine', 'Termine'], ['verkauf', 'Verkauf'], ['reichweite', 'Reichweite'], ['launch', 'Launch']
  ];
  var PREISNIVEAU = [['guenstig', 'Günstig'], ['mittel', 'Mittel'], ['premium', 'Premium'], ['hochpreisig', 'Hochpreisig']];
  var B2B_B2C = [['b2b', 'B2B'], ['b2c', 'B2C'], ['beides', 'Beides']];
  var TONALITAET = [['seriös', 'Seriös'], ['locker', 'Locker'], ['emotional', 'Emotional'], ['direkt', 'Direkt'], ['premium', 'Premium']];
  var AWARENESS = [
    ['unbewusst', 'Unbewusst'], ['problembewusst', 'Problembewusst'], ['loesungsbewusst', 'Lösungsbewusst'],
    ['produktbewusst', 'Produktbewusst'], ['meistbewusst', 'Meistbewusst']
  ];

  /* ------------------------------------------------------------------
     2) Zustand
     ------------------------------------------------------------------ */
  var STATE = {
    profile: null,
    projects: null,
    project: null,
    campaigns: null,
    campaign: null,
    assets: null,
    openAssetId: null,
    assetFilter: 'alle',
    winkelFilter: 'alle',
    running: {}      /* key -> { controller, statusIdx, chars, timer } */
  };

  /* ------------------------------------------------------------------
     3) DB-Gateway
     ------------------------------------------------------------------ */
  var DB = {
    request: function (method, path, body, prefer) {
      var uid = STATE.profile ? STATE.profile.uid : '';
      return fetch('/.netlify/functions/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid, method: method, path: path, body: body, prefer: prefer })
      }).then(function (r) {
        return r.text().then(function (txt) {
          var json = null;
          try { json = txt ? JSON.parse(txt) : null; } catch (e) { json = null; }
          if (!r.ok || (json && json.error)) {
            var msg = (json && (json.message || json.error)) || ('Fehler ' + r.status);
            toast(String(msg));
            throw new Error(String(msg));
          }
          return json;
        });
      }).catch(function (err) {
        if (!/^Fehler|./.test('')) {}
        throw err;
      });
    },
    get: function (path) { return DB.request('GET', path); },
    post: function (path, body, prefer) { return DB.request('POST', path, body, prefer || 'return=representation'); },
    patch: function (path, body) { return DB.request('PATCH', path, body); },
    del: function (path) { return DB.request('DELETE', path); }
  };

  /* ------------------------------------------------------------------
     4) NDJSON-Streaming (AI / IMG)
     ------------------------------------------------------------------ */
  function streamNDJSON(url, payload, opts) {
    opts = opts || {};
    var onDelta = opts.onDelta || function () {};
    var signal = opts.signal;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: signal
    }).then(function (r) {
      if (!r.ok || !r.body) {
        return r.text().then(function (t) {
          throw new Error(t || ('Fehler ' + r.status));
        });
      }
      var reader = r.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buf = '';
      return new Promise(function (resolve, reject) {
        function pump() {
          reader.read().then(function (res) {
            if (res.done) {
              if (buf.trim()) handleLine(buf);
              resolve();
              return;
            }
            buf += decoder.decode(res.value, { stream: true });
            var lines = buf.split('\n');
            buf = lines.pop();
            for (var i = 0; i < lines.length; i++) handleLine(lines[i]);
            pump();
          }, function (err) { reject(err); });
        }
        var settled = false;
        function handleLine(line) {
          line = line.trim();
          if (!line) return;
          var evt;
          try { evt = JSON.parse(line); } catch (e) { return; }
          if (evt.type === 'ping' || evt.type === 'start') return;
          if (evt.type === 'delta') { onDelta(evt.text || ''); return; }
          if (evt.type === 'done') { settled = true; resolve(evt.result); }
          else if (evt.type === 'error') { settled = true; reject(new Error(evt.message || T.genericError)); }
        }
        var origResolve = resolve, origReject = reject;
        resolve = function (v) { if (!settled) { settled = true; origResolve(v); } };
        reject = function (e) { if (!settled) { settled = true; origReject(e); } };
        pump();
      });
    });
  }
  var IMG = { stream: function (payload, opts) { return streamNDJSON('/.netlify/functions/image', payload, opts); } };

  /* ------------------------------------------------------------------
     4b) KI-Jobs (Hintergrund-Function + Polling)
     ------------------------------------------------------------------
     ai.mjs legt nur noch einen Job an und antwortet sofort mit {job_id}.
     Die eigentliche Arbeit macht ai-background.mjs (bis zu 15 Minuten,
     Netlify Pro). Der Browser pollt den Fortschritt ueber das Gateway
     (Tabelle me_jobs, nur lesbar). So uebersteht ein Lauf auch ein
     Neuladen der Seite (siehe resumeRunningJobs). */
  var JOB_POLL_MS = 2500;

  // Haengt sich an einen bestehenden Job (job_id) und pollt, bis er fertig
  // oder fehlerhaft ist. onProgress(job) wird bei jedem Tick aufgerufen.
  function pollJob(jobId, onProgress) {
    var cancelled = false;
    var timer = null;
    var promise = new Promise(function (resolve, reject) {
      function tick() {
        if (cancelled) return;
        DB.get('me_jobs?select=*&id=eq.' + jobId).then(function (rows) {
          if (cancelled) return;
          var job = rows && rows[0];
          if (!job) { timer = setTimeout(tick, JOB_POLL_MS); return; }
          if (onProgress) onProgress(job);
          if (job.status === 'fertig') { resolve(job.result || {}); return; }
          if (job.status === 'fehler') { reject(new Error(job.fehler || T.genericError)); return; }
          timer = setTimeout(tick, JOB_POLL_MS);
        }).catch(function () {
          if (!cancelled) timer = setTimeout(tick, JOB_POLL_MS);
        });
      }
      tick();
    });
    return {
      promise: promise,
      cancel: function () { cancelled = true; if (timer) clearTimeout(timer); }
    };
  }

  // Startet einen neuen Job ueber ai.mjs und pollt ihn danach. Rueckgabe wie pollJob
  // ({promise, cancel}); cancel() bricht nur das Polling ab (der Hintergrund-Lauf laeuft
  // serverseitig weiter, siehe SPEC F), und zeigt einen Hinweis-Toast.
  function jobRun(payload, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || function () {};
    var cancelledBeforeStart = false;
    var inner = null;
    var promise = fetch('/.netlify/functions/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.text().then(function (txt) {
        var json = null;
        try { json = txt ? JSON.parse(txt) : null; } catch (e) { json = null; }
        if (!r.ok || !json || !json.job_id) {
          var msg = (json && (json.message || json.error)) || ('Fehler ' + r.status);
          throw new Error(String(msg));
        }
        return json.job_id;
      });
    }).then(function (jobId) {
      if (cancelledBeforeStart) return Promise.reject(new Error('cancelled'));
      inner = pollJob(jobId, onProgress);
      return inner.promise;
    });
    return {
      promise: promise,
      cancel: function () {
        cancelledBeforeStart = true;
        if (inner) inner.cancel();
        toast('Läuft im Hintergrund weiter.');
      }
    };
  }
  var AI = { run: jobRun, resume: pollJob };

  /* ------------------------------------------------------------------
     5) Toast
     ------------------------------------------------------------------ */
  function toast(msg) {
    var wrap = $('dlm-toasts');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'dlm-toast';
    el.textContent = msg;
    wrap.appendChild(el);
    // Lange Meldungen (z. B. Fehler) bleiben laenger stehen.
    var dauer = Math.min(12000, Math.max(3200, String(msg || '').length * 55));
    setTimeout(function () { el.classList.add('dlm-toast-out'); }, dauer);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, dauer + 500);
  }

  /* ------------------------------------------------------------------
     6) Dialog
     ------------------------------------------------------------------ */
  function dialog(opts) {
    var host = $('dlm-dialogs');
    var wrap = document.createElement('div');
    wrap.className = 'dlm-dialog-scrim';
    wrap.innerHTML =
      '<div class="dlm-dialog" role="dialog" aria-modal="true" aria-labelledby="dlm-dlg-title">' +
      '<h3 id="dlm-dlg-title">' + esc(opts.title || '') + '</h3>' +
      '<div class="dlm-dialog-body"></div>' +
      '<div class="dlm-dialog-actions"></div>' +
      '</div>';
    host.appendChild(wrap);
    var bodyEl = qs('.dlm-dialog-body', wrap);
    if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body;
    else if (opts.body) bodyEl.appendChild(opts.body);

    var actionsEl = qs('.dlm-dialog-actions', wrap);
    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); document.removeEventListener('keydown', onKey); }
    arr(opts.actions).forEach(function (a) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dlp-btn ' + (a.primary ? 'dlp-primary' : 'dlp-ghost');
      btn.textContent = a.label;
      btn.addEventListener('click', function () {
        var res = a.onClick ? a.onClick(wrap) : undefined;
        if (res !== false) close();
      });
      actionsEl.appendChild(btn);
    });
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', function (e) { if (e.target === wrap && opts.dismissible !== false) close(); });
    return { close: close, el: wrap };
  }

  function confirmDialog(text, onYes) {
    dialog({
      title: 'Bitte bestätigen',
      body: '<p>' + esc(text) + '</p>',
      actions: [
        { label: T.cancel },
        { label: 'Ja, fortfahren', primary: true, onClick: onYes }
      ]
    });
  }

  /* ------------------------------------------------------------------
     7) Theme
     ------------------------------------------------------------------ */
  function applyTheme(mode) {
    document.documentElement.setAttribute('data-mode', mode);
    try { localStorage.setItem('dlm-mode', mode); } catch (e) {}
    var moon = $('dlm-theme-ic-moon'), sun = $('dlm-theme-ic-sun');
    if (moon && sun) { moon.hidden = mode === 'dark'; sun.hidden = mode !== 'dark'; }
  }
  function wireTheme() {
    var btn = $('dlm-theme-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-mode') || 'dark';
      applyTheme(cur === 'dark' ? 'normal' : 'dark');
    });
  }

  /* ------------------------------------------------------------------
     8) Intro-Overlay
     ------------------------------------------------------------------ */
  var INTRO_STEPS = [
    { title: T.introTitle1, text: T.introText1 },
    { title: T.introTitle2, text: T.introText2 },
    { title: T.introTitle3, text: T.introText3 }
  ];
  var introIdx = 0;
  function paintIntro() {
    var spans = qsa('#dlm-intro-steps span');
    spans.forEach(function (s, i) { s.classList.toggle('on', i <= introIdx); });
    $('dlm-intro-title').textContent = INTRO_STEPS[introIdx].title;
    $('dlm-intro-text').textContent = INTRO_STEPS[introIdx].text;
    $('dlm-intro-back').hidden = introIdx === 0;
    $('dlm-intro-next').textContent = introIdx === INTRO_STEPS.length - 1 ? T.introDone : T.introNext;
  }
  function openIntro() { introIdx = 0; paintIntro(); $('dlm-intro').classList.add('dlp-open'); }
  function closeIntro(markSeen) {
    $('dlm-intro').classList.remove('dlp-open');
    if (markSeen) { try { localStorage.setItem('dlm-intro-seen', '1'); } catch (e) {} }
  }
  function wireIntro() {
    $('dlm-intro-next').addEventListener('click', function () {
      if (introIdx < INTRO_STEPS.length - 1) { introIdx++; paintIntro(); }
      else closeIntro(true);
    });
    $('dlm-intro-back').addEventListener('click', function () { if (introIdx > 0) { introIdx--; paintIntro(); } });
    $('dlm-intro-scrim').addEventListener('click', function () { closeIntro(true); });
  }

  /* ------------------------------------------------------------------
     9) Version-Check
     ------------------------------------------------------------------ */
  function versionNewer(a, b) {
    var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (var i = 0; i < 3; i++) {
      if ((x[i] || 0) > (y[i] || 0)) return true;
      if ((x[i] || 0) < (y[i] || 0)) return false;
    }
    return false;
  }
  function checkVersion() {
    fetch('/version.json?ts=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.version && versionNewer(j.version, window.APP_VERSION || '1.0.0')) {
          var el = $('dlm-update');
          if (el) el.hidden = false;
        }
      }).catch(function () {});
  }

  /* ------------------------------------------------------------------
     10) Breadcrumb / Begruessung
     ------------------------------------------------------------------ */
  function renderCrumbs(route) {
    var el = $('dlm-crumbs');
    if (!el) return;
    var parts = [{ label: T.breadcrumbProjects, href: '#/' }];
    if (route.name === 'project' || route.name === 'campaign') {
      var pname = STATE.project ? STATE.project.name : '...';
      parts.push({ label: pname, href: '#/p/' + route.projectId });
    }
    if (route.name === 'campaign') {
      var cname = STATE.campaign ? STATE.campaign.name : '...';
      parts.push({ label: cname, href: null });
    }
    el.innerHTML = parts.map(function (p, i) {
      var sep = i > 0 ? '<span class="dlm-crumb-sep">&rsaquo;</span>' : '';
      if (p.href) return sep + '<a class="dlm-crumb" href="' + esc(p.href) + '">' + esc(p.label) + '</a>';
      return sep + '<span class="dlm-crumb dlm-crumb-current">' + esc(p.label) + '</span>';
    }).join('');
  }
  function renderHello() {
    var el = $('dlm-hello');
    if (!el) return;
    var name = STATE.profile ? window.DL_IDENTITY.greetingName(STATE.profile) : '';
    el.textContent = name ? (T.hello + ', ' + name) : '';
  }

  /* ------------------------------------------------------------------
     11) Router
     ------------------------------------------------------------------ */
  function parseHash() {
    var h = location.hash || '#/';
    h = h.replace(/^#/, '');
    var qIdx = h.indexOf('?');
    var path = qIdx === -1 ? h : h.slice(0, qIdx);
    var query = qIdx === -1 ? '' : h.slice(qIdx + 1);
    var params = {};
    query.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = i === -1 ? kv : kv.slice(0, i);
      var v = i === -1 ? '' : decodeURIComponent(kv.slice(i + 1));
      params[decodeURIComponent(k)] = v;
    });
    var parts = path.split('/').filter(Boolean);
    var route = { name: 'projects', params: params };
    if (parts[0] === 'p' && parts[1]) {
      route.projectId = parts[1];
      if (parts[2] === 'k' && parts[3]) { route.name = 'campaign'; route.campaignId = parts[3]; }
      else route.name = 'project';
    }
    return route;
  }

  function setTab(tab) {
    var route = parseHash();
    location.hash = '#/p/' + route.projectId + (tab ? ('?tab=' + tab) : '');
  }

  function route() {
    var r = parseHash();
    if (r.name === 'projects') { STATE.project = null; STATE.campaign = null; renderCrumbs(r); renderProjectsView(); return; }
    if (r.name === 'project') { renderProjectRoute(r); return; }
    if (r.name === 'campaign') { renderCampaignRoute(r); return; }
  }

  /* ------------------------------------------------------------------
     12) Ansicht: Projekte
     ------------------------------------------------------------------ */
  function statusChips(p) {
    var an = p.analyse_status === 'fertig' ? 'Analyse fertig' : (p.analyse_status === 'laeuft' ? 'Analyse laeuft' : 'Analyse offen');
    var anCls = p.analyse_status === 'fertig' ? 'dlm-chip-ok' : (p.analyse_status === 'laeuft' ? 'dlm-chip-warn' : '');
    var wn = arr(p.winkel_auswahl).length;
    return '<span class="dlm-chip ' + anCls + '">' + esc(an) + '</span>' +
      '<span class="dlm-chip">Winkel ' + wn + '/10</span>';
  }

  function renderProjectsView() {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-head-row"><h1>' + esc(T.breadcrumbProjects) + '</h1>' +
      '<button type="button" class="dlp-btn dlp-primary" data-action="new-project">' + esc(T.newProject) + '</button></div>' +
      '<div id="dlm-projects-grid" class="dlm-grid dlm-projects-grid"><div class="dlm-loading">Lädt...</div></div></div>';

    DB.get('me_projects?select=*&archiviert=eq.false&order=updated_at.desc').then(function (rows) {
      STATE.projects = rows || [];
      var grid = $('dlm-projects-grid');
      if (!grid) return;
      var newTile = '<div class="dlp-card dlm-project-card-new" data-action="new-project">' +
        '<span class="dlm-new-plus" aria-hidden="true">+</span><span>' + esc(T.newProject) + '</span></div>';
      if (!STATE.projects.length) {
        grid.innerHTML = '<div class="dlm-empty-block"><h3>' + esc(T.projectsEmpty) + '</h3>' +
          '<p>Leg dein erstes Projekt an und starte mit dem Brief.</p>' +
          '<button type="button" class="dlp-btn dlp-primary" data-action="new-project">' + esc(T.newProject) + '</button></div>';
        return;
      }
      grid.innerHTML = STATE.projects.map(function (p) {
        return '<div class="dlp-card dlm-project-card" data-open-project="' + esc(p.id) + '">' +
          '<div class="dlm-card-menu" data-menu="' + esc(p.id) + '">' +
          '<button type="button" class="dlm-icon-btn" data-action="project-menu" data-id="' + esc(p.id) + '" aria-label="Menü">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle></svg></button></div>' +
          '<h3 class="dlm-project-title">' + ICONS.ordner + '<span>' + esc(p.name) + '</span></h3>' +
          '<p class="dlm-muted dlm-branch-row">' + esc((p.brief && p.brief.branche) || 'Ohne Branche') + '</p>' +
          '<div class="dlm-chips">' + statusChips(p) + '<span class="dlm-chip">Kampagnen&nbsp;<span data-camp-count="' + esc(p.id) + '">...</span></span></div>' +
          '<p class="dlm-muted dlm-small">Zuletzt bearbeitet ' + esc(fmtDate(p.updated_at)) + '</p>' +
          '</div>';
      }).join('') + newTile;
      STATE.projects.forEach(function (p) {
        DB.get('me_campaigns?select=id&project_id=eq.' + p.id).then(function (rows) {
          var el = qs('[data-camp-count="' + p.id + '"]', grid);
          if (el) el.textContent = String(arr(rows).length);
        }).catch(function () {});
      });
    }).catch(function () {
      var grid = $('dlm-projects-grid');
      if (grid) grid.innerHTML = '<div class="dlm-empty">' + esc(T.genericError) + '</div>';
    });
  }

  function openNewProjectDialog() {
    dialog({
      title: T.newProjectTitle,
      body: '<label class="dlm-field"><span>' + esc(T.projectName) + '</span>' +
        '<input type="text" id="dlm-new-project-name" placeholder="' + esc(T.projectNamePh) + '" maxlength="120"></label>',
      actions: [
        { label: T.cancel },
        {
          label: T.create, primary: true, onClick: function () {
            var name = qs('#dlm-new-project-name').value.trim();
            if (!name) { toast('Bitte einen Namen eingeben.'); return false; }
            DB.post('me_projects', { name: name, brief: {} }, 'return=representation').then(function (rows) {
              var p = rows && rows[0];
              if (p) location.hash = '#/p/' + p.id;
            });
          }
        }
      ]
    });
    setTimeout(function () { var el = qs('#dlm-new-project-name'); if (el) el.focus(); }, 30);
  }

  function openProjectMenu(id, anchorEl) {
    var p = arr(STATE.projects).filter(function (x) { return x.id === id; })[0];
    dialog({
      title: p ? p.name : 'Projekt',
      body: '<label class="dlm-field"><span>' + esc(T.rename) + '</span><input type="text" id="dlm-rename-input" value="' + esc(p ? p.name : '') + '"></label>',
      actions: [
        { label: T.cancel },
        {
          label: T.archive, onClick: function () {
            confirmDialog(T.confirmDeleteProject, function () {
              DB.patch('me_projects?id=eq.' + id, { archiviert: true }).then(function () { renderProjectsView(); });
            });
            return false;
          }
        },
        {
          label: T.save, primary: true, onClick: function () {
            var name = qs('#dlm-rename-input').value.trim();
            if (!name) return false;
            DB.patch('me_projects?id=eq.' + id, { name: name }).then(function () { renderProjectsView(); });
          }
        }
      ]
    });
  }

  /* ------------------------------------------------------------------
     13) Ansicht: Projekt (Stepper: Brief / Zielgruppe / Winkel / Kampagnen)
     ------------------------------------------------------------------ */
  function tabStatus(project) {
    var winkelCount = arr(project.winkel_auswahl).length;
    return {
      brief: true,
      zielgruppe: project.analyse_status === 'fertig',
      winkel: project.analyse_status === 'fertig',
      winkelDone: winkelCount >= 5,
      kampagnen: winkelCount >= 5
    };
  }

  function renderProjectRoute(r) {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-loading">Lädt...</div></div>';
    DB.get('me_projects?select=*&id=eq.' + r.projectId).then(function (rows) {
      var p = rows && rows[0];
      if (!p) { app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">Projekt nicht gefunden.</div></div>'; return; }
      STATE.project = p;
      resumeRunningJobs(p.id, null, function () { renderProjectRoute(parseHash()); });
      renderCrumbs(r);
      var tab = r.params.tab || 'brief';
      var st = tabStatus(p);
      if (tab === 'winkel' && !st.winkel) tab = 'brief';
      if (tab === 'kampagnen' && !st.kampagnen) { /* zeigt Hinweis, kein redirect noetig */ }

      app.innerHTML =
        '<div class="dlm-wrap">' +
        '<h1 class="dlm-title">' + esc(p.name) + '</h1>' +
        '<nav class="dlm-stepper" id="dlm-stepper">' +
        stepperTab(1, 'brief', T.tabBrief, true, true, tab, '') +
        stepperTab(2, 'zielgruppe', T.tabZielgruppe, true, st.zielgruppe, tab, '') +
        stepperTab(3, 'winkel', T.tabWinkel, st.winkel, st.winkelDone, tab, 'Erst Zielgruppenanalyse erstellen') +
        stepperTab(4, 'kampagnen', T.tabKampagnen, st.kampagnen, st.kampagnen, tab, 'Erst 5 bis 10 Winkel wählen') +
        '</nav>' +
        '<div id="dlm-tab-body"></div>' +
        '</div>';

      qsa('.dlm-tab', $('dlm-stepper')).forEach(function (btn) {
        if (btn.classList.contains('dlm-tab-disabled')) return;
        btn.addEventListener('click', function () { setTab(btn.getAttribute('data-tab')); });
      });

      var body = $('dlm-tab-body');
      if (tab === 'brief') renderBriefTab(body, p);
      else if (tab === 'zielgruppe') renderZielgruppeTab(body, p);
      else if (tab === 'winkel') renderWinkelTab(body, p);
      else renderKampagnenTab(body, p);
    }).catch(function () {
      app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">' + esc(T.genericError) + '</div></div>';
    });
  }

  var ICON_CHECK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"></path></svg>';

  /* Stepper-Tab (Befund 5): Nummer als Kreis, Haken bei erledigt,
     ausgegraut + Tooltip bei deaktiviert. */
  function stepperTab(num, key, label, enabled, done, current, disabledHint) {
    var cls = 'dlm-tab' + (key === current ? ' dlm-tab-active' : '') + (enabled ? '' : ' dlm-tab-disabled');
    var circle = '<span class="dlm-tab-num' + (done ? ' dlm-tab-num-done' : '') + '">' + (done ? ICON_CHECK : num) + '</span>';
    var title = !enabled && disabledHint ? ' title="' + esc(disabledHint) + '"' : '';
    return '<button type="button" class="' + cls + '" data-tab="' + key + '"' + title + (enabled ? '' : ' aria-disabled="true"') + '>' + circle + '<span>' + esc(label) + '</span></button>';
  }

  /* --- Brief ------------------------------------------------------- */
  var BRIEF_FIELDS = [
    ['firma', 'Firma', 'text', false],
    ['branche', 'Branche', 'text', false],
    ['dienstleistungen', 'Dienstleistungen', 'textarea', false],
    ['angebot_kurz', 'Angebot kurz beschrieben', 'textarea', true],
    ['zielkunde_vermutung', 'Vermutete Zielkunde', 'textarea', true],
    ['preisniveau', 'Preisniveau', 'select', true, PREISNIVEAU],
    ['region', 'Region', 'text', true],
    ['b2b_b2c', 'B2B oder B2C', 'select', true, B2B_B2C],
    ['usp', 'USP (Alleinstellungsmerkmal)', 'textarea', true],
    ['kunden_beispiele', 'Kundenbeispiele', 'textarea', true],
    ['wettbewerber', 'Wettbewerber', 'textarea', true],
    ['tonalitaet', 'Tonalität', 'select', true, TONALITAET],
    ['website', 'Website', 'text', true],
    ['bestehende_texte', 'Bestehende Texte (Stilreferenz)', 'textarea', true],
    ['notizen', 'Notizen', 'textarea', true]
  ];

  function renderBriefTab(body, p) {
    var brief = p.brief || {};
    var html = '<form id="dlm-brief-form" class="dlm-form">';
    BRIEF_FIELDS.forEach(function (f) {
      var key = f[0], label = f[1], type = f[2], optional = f[3], opts = f[4];
      var val = brief[key] || '';
      html += '<label class="dlm-field"><span>' + esc(label) + (optional ? ' <em>(optional)</em>' : '') + '</span>';
      if (type === 'textarea') {
        html += '<textarea name="' + key + '" rows="3" maxlength="4000">' + esc(val) + '</textarea>';
      } else if (type === 'select') {
        html += '<select name="' + key + '"><option value="">Bitte wählen</option>' +
          opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') +
          '</select>';
      } else {
        html += '<input type="text" name="' + key + '" value="' + esc(val) + '" maxlength="200">';
      }
      html += '<span class="dlm-help">' + esc(T.briefHelp) + '</span></label>';
    });
    html += '<p class="dlm-save-hint" id="dlm-brief-savehint">&nbsp;</p></form>';
    body.innerHTML = html;

    var form = $('dlm-brief-form');
    var save = debounce(function () {
      var brief2 = {};
      BRIEF_FIELDS.forEach(function (f) {
        var el = form.elements[f[0]];
        if (el) brief2[f[0]] = el.value;
      });
      DB.patch('me_projects?id=eq.' + p.id, { brief: brief2 }).then(function () {
        var hint = $('dlm-brief-savehint');
        if (hint) hint.textContent = T.briefSaved + ' ' + new Date().toLocaleTimeString('de-DE');
        p.brief = brief2;
      });
    }, 800);
    form.addEventListener('input', save);
    form.addEventListener('change', save);
  }

  /* --- Zielgruppe --------------------------------------------------- */
  function renderZielgruppeTab(body, p) {
    if (p.analyse_status === 'laeuft') { renderAnalyseProgress(body, p); return; }
    if (p.analyse_status !== 'fertig' || !p.analyse) {
      body.innerHTML = '<div class="dlm-empty-block">' +
        '<h3>' + esc(T.zielgruppeEmptyTitle) + '</h3><p>' + esc(T.zielgruppeEmptyText) + '</p>' +
        '<button type="button" class="dlp-btn dlp-primary" data-action="run-analyse" data-id="' + esc(p.id) + '">' + esc(T.zielgruppeCreate) + '</button>' +
        '</div>';
      return;
    }
    var analyse = p.analyse;
    var html = '<div class="dlm-toolbar">' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="refine-analyse" data-id="' + esc(p.id) + '">' + esc(T.zielgruppeRefine) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="redo-analyse" data-id="' + esc(p.id) + '">' + esc(T.zielgruppeRedo) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="export-analyse" data-id="' + esc(p.id) + '">' + esc(T.zielgruppeExport) + '</button>' +
      '</div><div class="dlm-accordion" id="dlm-analyse-acc">';
    ANALYSE_CATS.forEach(function (c, i) {
      var key = c[0], fallbackTitle = c[1];
      var cat = analyse[key] || {};
      // Der feste deutsche Titel hat Vorrang; der KI-Titel nur, wenn er kein roher Schluessel ist.
      var katTitel = (cat.titel && String(cat.titel).replace(/_/g, ' ').toLowerCase() !== key.replace(/_/g, ' ') && String(cat.titel).length > 3) ? cat.titel : fallbackTitle;
      var open = i < 2;
      var num = String(i + 1); if (num.length < 2) num = '0' + num;
      html += '<div class="dlm-acc-item' + (open ? ' dlm-acc-open' : '') + '" data-cat="' + key + '">' +
        '<button type="button" class="dlm-acc-head" data-action="toggle-acc">' +
        '<span><span class="dlm-acc-num">' + num + '</span>' + esc(katTitel) + '</span>' +
        '<svg class="dlm-acc-caret" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg>' +
        '</button>' +
        '<div class="dlm-acc-body">' +
        '<div class="dlm-acc-view">' + mdMini(cat.inhalt) +
        (arr(cat.punkte).length ? '<ul class="dlm-punkte">' + arr(cat.punkte).map(function (pt) { return '<li>' + esc(pt) + '</li>'; }).join('') + '</ul>' : '') +
        '</div>' +
        '<div class="dlm-acc-edit" hidden><textarea rows="8">' + esc(cat.inhalt || '') + '</textarea>' +
        '<div class="dlm-acc-edit-actions"><button type="button" class="dlp-btn dlp-primary" data-action="save-cat" data-cat="' + key + '">' + esc(T.save) + '</button>' +
        '<button type="button" class="dlp-btn dlp-ghost" data-action="cancel-cat">' + esc(T.cancel) + '</button></div></div>' +
        '<div class="dlm-acc-actions">' +
        '<button type="button" class="dlm-text-btn" data-action="edit-cat" data-cat="' + key + '">Bearbeiten</button>' +
        '<button type="button" class="dlm-text-btn" data-action="copy-cat" data-cat="' + key + '">Kopieren</button>' +
        '</div></div></div>';
    });
    html += '</div>';
    body.innerHTML = html;
  }

  function renderAnalyseProgress(body, p) {
    body.innerHTML = progressCardHtml('analyse');
    wireProgressCancel('analyse', p.id, function () { /* Hinweis-Toast kommt aus jobRun/pollJob.cancel() */ });
    startProgressRotation('analyse');
  }

  /* Basiskategorie fuer STATUS_TEXTS-Lookup, da Kinds wie "asset-creative"
     nicht direkt in STATUS_TEXTS stehen (Absturzsicherheit). */
  function progressBaseKind(kind) {
    if (STATUS_TEXTS[kind]) return kind;
    if (kind.indexOf('asset-') === 0) return 'asset';
    return 'analyse';
  }
  function progressTitle(kind) {
    if (kind === 'analyse') return 'Zielgruppenanalyse wird erstellt';
    if (kind === 'winkel') return 'Marketing-Winkel werden erzeugt';
    if (kind === 'konsistenz') return 'Konsistenz wird geprüft';
    if (kind.indexOf('asset-') === 0) return assetLabel(kind.slice(6)) + ' werden erzeugt';
    return 'Wird erzeugt';
  }
  function progressCardHtml(kind) {
    var base = progressBaseKind(kind);
    return '<div class="dlm-progress-card">' +
      '<h3 class="dlm-progress-title">' + esc(progressTitle(kind)) + '</h3>' +
      '<p class="dlm-progress-hint">Das dauert 2 bis 4 Minuten, du kannst währenddessen den Tab wechseln.</p>' +
      '<div class="dlm-progress-bar dlm-progress-indeterminate"><div class="dlm-progress-fill" id="dlm-progress-fill-' + kind + '"></div></div>' +
      '<p class="dlm-progress-status" id="dlm-progress-status-' + kind + '">' + esc(STATUS_TEXTS[base][0]) + '</p>' +
      '<p class="dlm-progress-chars" id="dlm-progress-chars-' + kind + '">0 Zeichen</p>' +
      '<p class="dlm-progress-teil" id="dlm-progress-teil-' + kind + '" hidden></p>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="cancel-run" data-kind="' + kind + '">' + esc(T.cancelRun) + '</button>' +
      '</div>';
  }
  function startProgressRotation(kind) {
    var idx = 0;
    var list = STATUS_TEXTS[progressBaseKind(kind)];
    var el = $('dlm-progress-status-' + kind);
    var timer = setInterval(function () {
      idx = (idx + 1) % list.length;
      var e = $('dlm-progress-status-' + kind);
      if (e) e.textContent = list[idx]; else clearInterval(timer);
    }, 6000);
    STATE.running[kind + '-rot'] = timer;
  }
  function stopProgressRotation(kind) {
    if (STATE.running[kind + '-rot']) { clearInterval(STATE.running[kind + '-rot']); delete STATE.running[kind + '-rot']; }
  }
  function updateProgressChars(kind, n) {
    var el = $('dlm-progress-chars-' + kind);
    if (el) el.textContent = n + ' Zeichen';
    var fill = $('dlm-progress-fill-' + kind);
    if (fill) fill.style.width = Math.min(96, 8 + n / 80) + '%';
  }
  // Zeigt bei mehrteiligen Jobs (Analyse: 4 Teile) den Fortschritt "Teil x von 4 fertig".
  function updateProgressTeil(kind, teil, teile) {
    var el = $('dlm-progress-teil-' + kind);
    if (!el) return;
    if (teile && teile > 1) {
      el.hidden = false;
      el.textContent = 'Teil ' + (teil || 0) + ' von ' + teile + ' fertig';
    } else {
      el.hidden = true;
    }
  }
  function wireProgressCancel(kind, id, onCancel) {
    var btn = qs('[data-action="cancel-run"][data-kind="' + kind + '"]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var r = STATE.running[kind + '-' + id];
      if (r && r.cancel) r.cancel();
      stopProgressRotation(kind);
      if (onCancel) onCancel();
    });
  }
  // Bricht das Polling fuer einen Job-Schluessel ab (der Hintergrund-Lauf laeuft weiter).
  function cancelRunning(key) {
    var r = STATE.running[key];
    if (r && r.cancel) r.cancel();
    delete STATE.running[key];
  }
  function progressKindFromJob(job) {
    if (job.task === 'analyse' || job.task === 'verfeinern') return 'analyse';
    if (job.task === 'winkel') return 'winkel';
    if (job.task === 'konsistenz') return 'konsistenz';
    if (job.task === 'asset') return 'asset-' + job.typ;
    return job.task;
  }
  function runningKeyFromJob(job) {
    var kind = progressKindFromJob(job);
    if (kind === 'analyse') return 'analyse-' + job.project_id;
    if (kind === 'winkel') return 'winkel-' + job.project_id;
    if (kind === 'konsistenz') return 'konsistenz-' + job.campaign_id;
    if (kind.indexOf('asset-') === 0) return 'asset-' + job.campaign_id + '-' + job.typ;
    return kind + '-' + job.id;
  }
  // Erkennt beim Oeffnen eines Projekts/einer Kampagne noch laufende Jobs (Neuladen der
  // Seite waehrend ein Hintergrund-Lauf noch geht) und haengt sich wieder an sie an, damit
  // die Fortschrittskarte weiter aktualisiert wird (SPEC §F).
  function resumeRunningJobs(projectId, campaignId, rerender) {
    DB.get('me_jobs?select=*&status=in.(wartet,laeuft)&order=created_at.desc&limit=20').then(function (jobs) {
      arr(jobs).forEach(function (job) {
        if (job.project_id !== projectId) return;
        if (campaignId && job.campaign_id && job.campaign_id !== campaignId) return;
        var key = runningKeyFromJob(job);
        if (STATE.running[key]) return;
        var kind = progressKindFromJob(job);
        var poll = pollJob(job.id, function (j) {
          updateProgressChars(kind, j.chars || 0);
          updateProgressTeil(kind, j.teil_fertig, j.teile);
        });
        STATE.running[key] = { cancel: poll.cancel, jobId: job.id };
        poll.promise.then(function () {
          delete STATE.running[key];
          stopProgressRotation(kind);
          rerender();
        }).catch(function (err) {
          delete STATE.running[key];
          stopProgressRotation(kind);
          toast(err && err.message ? err.message : T.genericError);
          rerender();
        });
      });
    }).catch(function () {});
    // Fehlgeschlagene Laeufe der letzten 30 Minuten einmal pro Sitzung melden, damit ein
    // Fehler nach Neuladen oder Tab-Wechsel nicht still verschwindet.
    var seit = new Date(Date.now() - 30 * 60000).toISOString();
    DB.get('me_jobs?select=id,task,typ,fehler,project_id,campaign_id,updated_at&status=eq.fehler&updated_at=gt.' + encodeURIComponent(seit) + '&order=updated_at.desc&limit=5').then(function (jobs) {
      STATE.seenFailed = STATE.seenFailed || {};
      var neu = arr(jobs).filter(function (job) {
        if (job.project_id !== projectId) return false;
        if (campaignId && job.campaign_id && job.campaign_id !== campaignId) return false;
        if (STATE.seenFailed[job.id]) return false;
        STATE.seenFailed[job.id] = true;
        return true;
      });
      if (!neu.length) return;
      var namen = [];
      neu.forEach(function (job) {
        var was = job.task === 'winkel' ? 'Winkel' : job.task === 'konsistenz' ? 'Konsistenz-Check' : job.task === 'asset' ? assetLabel(job.typ) : 'Zielgruppenanalyse';
        if (namen.indexOf(was) < 0) namen.push(was);
      });
      toast((neu.length === 1 ? namen[0] + ' ist fehlgeschlagen: ' + (neu[0].fehler || T.genericError) : 'Einige Läufe sind fehlgeschlagen (' + namen.join(', ') + '): ' + (neu[0].fehler || T.genericError)) + ' Bitte starte sie noch einmal.');
    }).catch(function () {});
  }

  function runAnalyse(id, opts) {
    opts = opts || {};
    STATE.running['analyse-' + id] = { pending: true };
    renderProjectRoute(parseHash());
    var run = AI.run({ uid: STATE.profile.uid, task: 'analyse', project_id: id, hinweis: opts.hinweis || undefined }, {
      onProgress: function (job) {
        updateProgressChars('analyse', job.chars || 0);
        updateProgressTeil('analyse', job.teil_fertig, job.teile);
      }
    });
    STATE.running['analyse-' + id] = { cancel: run.cancel };
    run.promise.then(function () {
      delete STATE.running['analyse-' + id];
      stopProgressRotation('analyse');
      renderProjectRoute(parseHash());
    }).catch(function (err) {
      delete STATE.running['analyse-' + id];
      stopProgressRotation('analyse');
      toast(err && err.message ? err.message : T.genericError);
      renderProjectRoute(parseHash());
    });
  }

  /* --- Winkel -------------------------------------------------------- */
  function renderWinkelTab(body, p) {
    var st = tabStatus(p);
    if (!st.zielgruppe) {
      body.innerHTML = '<div class="dlm-empty-block"><p>' + esc(T.needAnalyse) + '</p></div>';
      return;
    }
    if (STATE.running['winkel-' + p.id]) { body.innerHTML = progressCardHtml('winkel'); startProgressRotation('winkel'); return; }
    var winkel = p.winkel || [];
    if (!winkel.length) {
      body.innerHTML = '<div class="dlm-empty-block">' +
        '<h3>' + esc(T.winkelEmptyTitle) + '</h3><p>' + esc(T.winkelEmptyText) + '</p>' +
        '<button type="button" class="dlp-btn dlp-primary" data-action="run-winkel" data-id="' + esc(p.id) + '">' + esc(T.winkelCreate) + '</button>' +
        '</div>';
      return;
    }
    var auswahl = p.winkel_auswahl || [];
    var count = auswahl.length;
    var countCls = count < 5 ? 'dlm-count-bad' : (count > 10 ? 'dlm-count-bad' : 'dlm-count-ok');
    var countText = count > 10 ? T.winkelCountOver : (count < 5 ? T.winkelCountUnder : T.winkelCountOk);
    var awarenessSet = {};
    winkel.forEach(function (w) { if (w.awareness) awarenessSet[w.awareness] = true; });

    var html = '<div class="dlm-sticky-counter ' + countCls + '">' + count + ' von 5 bis 10 ' + esc(countText) + '</div>';
    html += '<div class="dlm-filter-chips" id="dlm-winkel-filters">' +
      '<button type="button" class="dlm-chip dlm-filter-chip' + (STATE.winkelFilter === 'alle' ? ' dlm-chip-active' : '') + '" data-filter="alle">Alle</button>' +
      AWARENESS.filter(function (a) { return awarenessSet[a[0]]; }).map(function (a) {
        return '<button type="button" class="dlm-chip dlm-filter-chip' + (STATE.winkelFilter === a[0] ? ' dlm-chip-active' : '') + '" data-filter="' + esc(a[0]) + '">' + esc(a[1]) + '</button>';
      }).join('') + '</div>';
    html += '<div class="dlm-winkel-list">';
    winkel.forEach(function (w) {
      if (STATE.winkelFilter !== 'alle' && w.awareness !== STATE.winkelFilter) return;
      var checked = auswahl.indexOf(w.id) !== -1;
      html += '<div class="dlm-winkel-card' + (checked ? ' dlm-winkel-checked' : '') + '" data-winkel-id="' + esc(w.id) + '">' +
        '<label class="dlm-winkel-check"><input type="checkbox" data-action="toggle-winkel" data-id="' + esc(w.id) + '"' + (checked ? ' checked' : '') + '>' +
        '<span></span></label>' +
        '<div class="dlm-winkel-main">' +
        '<h4>' + esc(w.titel || 'Ohne Titel') + '</h4>' +
        '<p class="dlm-muted">' + esc(w.kernbotschaft || '') + '</p>' +
        '<div class="dlm-chips">' +
        (w.awareness ? '<span class="dlm-chip">' + esc(w.awareness) + '</span>' : '') +
        (w.treiber ? '<span class="dlm-chip">' + esc(w.treiber) + '</span>' : '') +
        (Array.isArray(w.formate) ? w.formate.map(function (f) { return '<span class="dlm-chip">' + esc(f) + '</span>'; }).join('') : '') +
        '</div>' +
        '<button type="button" class="dlm-text-btn" data-action="toggle-winkel-detail" data-id="' + esc(w.id) + '">Details</button>' +
        '<div class="dlm-winkel-detail" hidden>' +
        '<p><strong>Hook-Beispiel:</strong> ' + esc(w.hook_beispiel || 'Nicht vorhanden') + '</p>' +
        '<p><strong>Warum wirkt:</strong> ' + esc(w.warum_wirkt || 'Nicht vorhanden') + '</p>' +
        '<p><strong>Bezug:</strong> ' + esc(w.bezug || 'Nicht vorhanden') + '</p>' +
        '<p><strong>Risiko:</strong> ' + esc(w.risiko || 'Nicht vorhanden') + '</p>' +
        '</div></div></div>';
    });
    html += '</div><div class="dlm-toolbar"><button type="button" class="dlp-btn dlp-ghost" data-action="run-winkel-more" data-id="' + esc(p.id) + '">' + esc(T.winkelMore) + '</button></div>';
    body.innerHTML = html;
  }

  function runWinkel(id, mehr) {
    renderProjectRoute(parseHash());
    var run = AI.run({ uid: STATE.profile.uid, task: 'winkel', project_id: id, mehr: !!mehr }, {
      onProgress: function (job) { updateProgressChars('winkel', job.chars || 0); }
    });
    STATE.running['winkel-' + id] = { cancel: run.cancel };
    startProgressRotation('winkel');
    run.promise.then(function () {
      delete STATE.running['winkel-' + id];
      stopProgressRotation('winkel');
      renderProjectRoute(parseHash());
    }).catch(function (err) {
      delete STATE.running['winkel-' + id];
      stopProgressRotation('winkel');
      toast(err && err.message ? err.message : T.genericError);
      renderProjectRoute(parseHash());
    });
  }

  function toggleWinkelAuswahl(projectId, winkelId, checked) {
    var p = STATE.project;
    var auswahl = arr(p.winkel_auswahl).slice();
    var idx = auswahl.indexOf(winkelId);
    if (checked && idx === -1) {
      if (auswahl.length >= 10) { toast(T.winkelCountOver); renderProjectRoute(parseHash()); return; }
      auswahl.push(winkelId);
    } else if (!checked && idx !== -1) {
      auswahl.splice(idx, 1);
    }
    p.winkel_auswahl = auswahl;
    DB.patch('me_projects?id=eq.' + projectId, { winkel_auswahl: auswahl }).then(function () {
      renderProjectRoute(parseHash());
    });
  }

  /* --- Kampagnen ------------------------------------------------------ */
  function renderKampagnenTab(body, p) {
    var st = tabStatus(p);
    if (!st.kampagnen) {
      body.innerHTML = '<div class="dlm-empty-block"><p>' + esc(T.needFiveWinkel) + '</p></div>';
      return;
    }
    body.innerHTML = '<div class="dlm-toolbar"><button type="button" class="dlp-btn dlp-primary" data-action="new-campaign" data-id="' + esc(p.id) + '">' + esc(T.kampagneNew) + '</button></div>' +
      '<div id="dlm-campaigns-list" class="dlm-grid"><div class="dlm-loading">Lädt...</div></div>';
    DB.get('me_campaigns?select=*&project_id=eq.' + p.id + '&order=created_at.desc').then(function (rows) {
      STATE.campaigns = rows || [];
      var list = $('dlm-campaigns-list');
      if (!list) return;
      if (!STATE.campaigns.length) {
        list.innerHTML = '<div class="dlm-empty-block"><h3>' + esc(T.kampagnenEmptyTitle) + '</h3><p>' + esc(T.kampagnenEmpty) + '</p>' +
          '<button type="button" class="dlp-btn dlp-primary" data-action="new-campaign" data-id="' + esc(p.id) + '">' + esc(T.kampagneNew) + '</button></div>';
        return;
      }
      list.innerHTML = STATE.campaigns.map(function (c) {
        return '<div class="dlp-card dlm-campaign-card" data-open-campaign="' + esc(c.id) + '">' +
          '<h3>' + esc(c.name) + '</h3>' +
          '<p class="dlm-muted">Ziel: ' + esc(zielLabel(c.ziel)) + '</p>' +
          '<div class="dlm-asset-icons" data-camp-assets="' + esc(c.id) + '"></div>' +
          '</div>';
      }).join('');
      qsa('[data-open-campaign]', list).forEach(function (el) {
        el.addEventListener('click', function () { location.hash = '#/p/' + p.id + '/k/' + el.getAttribute('data-open-campaign'); });
      });
      STATE.campaigns.forEach(function (c) {
        DB.get('me_assets?select=typ,status&campaign_id=eq.' + c.id).then(function (assetRows) {
          var el = qs('[data-camp-assets="' + c.id + '"]', list);
          if (!el) return;
          var counts = {};
          arr(assetRows).forEach(function (a) { counts[a.typ] = (counts[a.typ] || 0) + 1; });
          el.innerHTML = ASSET_TYPES.map(function (t) {
            var n = counts[t.typ] || 0;
            return '<span class="dlm-asset-icon' + (n ? ' dlm-asset-icon-on' : '') + '" title="' + esc(t.label) + '">' + n + '</span>';
          }).join('');
        }).catch(function () {});
      });
    });
  }
  function zielLabel(z) { var f = ZIELE.filter(function (x) { return x[0] === z; })[0]; return f ? f[1] : z; }

  function openNewCampaignDialog(projectId) {
    var p = STATE.project;
    var auswahl = p.winkel_auswahl || [];
    var winkelMap = {};
    arr(p.winkel).forEach(function (w) { winkelMap[w.id] = w; });
    var body = document.createElement('div');
    body.innerHTML =
      '<label class="dlm-field"><span>' + esc(T.kampagneName) + '</span><input type="text" id="dlm-camp-name" maxlength="120"></label>' +
      '<label class="dlm-field"><span>' + esc(T.kampagneZiel) + '</span><select id="dlm-camp-ziel">' +
      ZIELE.map(function (z) { return '<option value="' + esc(z[0]) + '">' + esc(z[1]) + '</option>'; }).join('') + '</select></label>' +
      '<fieldset class="dlm-field"><legend>' + esc(T.kampagneWinkel) + '</legend>' +
      auswahl.map(function (wid) {
        var w = winkelMap[wid];
        return '<label class="dlm-checkline"><input type="checkbox" value="' + esc(wid) + '"> ' + esc(w ? w.titel : wid) + '</label>';
      }).join('') + '</fieldset>' +
      '<label class="dlm-field"><span>Angebot: Was genau</span><textarea id="dlm-camp-was" rows="2"></textarea></label>' +
      '<label class="dlm-field"><span>CTA</span><input type="text" id="dlm-camp-cta"></label>' +
      '<label class="dlm-field"><span>Link <em>(optional)</em></span><input type="text" id="dlm-camp-link"></label>' +
      '<label class="dlm-field"><span>Leadmagnet-Thema <em>(optional)</em></span><input type="text" id="dlm-camp-lm"></label>' +
      '<label class="dlm-field"><span>Preis/Aktion <em>(optional)</em></span><input type="text" id="dlm-camp-preis"></label>' +
      '<label class="dlm-field"><span>Notizen <em>(optional)</em></span><textarea id="dlm-camp-notizen" rows="2"></textarea></label>';
    dialog({
      title: T.kampagneNewTitle,
      body: body,
      actions: [
        { label: T.cancel },
        {
          label: T.create, primary: true, onClick: function (wrap) {
            var name = qs('#dlm-camp-name', wrap).value.trim();
            var ziel = qs('#dlm-camp-ziel', wrap).value;
            var winkelIds = qsa('input[type=checkbox]:checked', wrap).map(function (c) { return c.value; });
            if (!name) { toast('Bitte einen Namen eingeben.'); return false; }
            if (!winkelIds.length) { toast('Bitte mindestens einen Winkel wählen.'); return false; }
            var angebot = {
              was: qs('#dlm-camp-was', wrap).value,
              cta: qs('#dlm-camp-cta', wrap).value,
              link: qs('#dlm-camp-link', wrap).value,
              leadmagnet_thema: qs('#dlm-camp-lm', wrap).value,
              preis: qs('#dlm-camp-preis', wrap).value,
              notizen: qs('#dlm-camp-notizen', wrap).value
            };
            DB.post('me_campaigns', { project_id: projectId, name: name, ziel: ziel, winkel_ids: winkelIds, angebot: angebot }, 'return=representation').then(function (rows) {
              var c = rows && rows[0];
              if (c) location.hash = '#/p/' + projectId + '/k/' + c.id;
            });
          }
        }
      ]
    });
  }

  /* ------------------------------------------------------------------
     14) Ansicht: Kampagne
     ------------------------------------------------------------------ */
  function renderCampaignRoute(r) {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-loading">Lädt...</div></div>';
    Promise.all([
      DB.get('me_projects?select=*&id=eq.' + r.projectId),
      DB.get('me_campaigns?select=*&id=eq.' + r.campaignId),
      DB.get('me_assets?select=*&campaign_id=eq.' + r.campaignId + '&order=created_at.desc')
    ]).then(function (res) {
      var p = res[0] && res[0][0];
      var c = res[1] && res[1][0];
      var assets = res[2] || [];
      if (!p || !c) { app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">Kampagne nicht gefunden.</div></div>'; return; }
      STATE.project = p; STATE.campaign = c; STATE.assets = assets;
      resumeRunningJobs(p.id, c.id, function () { renderCampaignRoute(parseHash()); });
      renderCrumbs(r);
      renderCampaignBody(r, p, c, assets);
    }).catch(function () {
      app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">' + esc(T.genericError) + '</div></div>';
    });
  }

  function winkelById(p, id) {
    return arr(p.winkel).filter(function (w) { return w.id === id; })[0];
  }

  function renderCampaignBody(r, p, c, assets) {
    var app = $('app');
    var winkelChips = arr(c.winkel_ids).map(function (wid) {
      var w = winkelById(p, wid);
      return '<span class="dlm-chip">' + esc(w ? w.titel : wid) + '</span>';
    }).join('');

    var counts = {};
    assets.forEach(function (a) { counts[a.typ] = (counts[a.typ] || 0) + 1; });

    var html = '<div class="dlm-wrap">' +
      '<div class="dlm-head-row"><div><h1 class="dlm-title">' + esc(c.name) + '</h1>' +
      '<p class="dlm-muted">Ziel: ' + esc(zielLabel(c.ziel)) + '</p>' +
      '<div class="dlm-chips">' + winkelChips + '</div></div>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="check-consistency" data-id="' + esc(c.id) + '">' + esc(T.consistencyCheck) + '</button>' +
      '</div>';

    if (STATE.running['konsistenz-' + c.id]) {
      html += progressCardHtml('konsistenz');
    } else if (c.konsistenz) {
      html += renderKonsistenz(c.konsistenz);
    }

    html += '<h2 class="dlm-subtitle">' + esc(T.assetsTitle) + '</h2><div class="dlm-tiles">';
    ASSET_TYPES.forEach(function (t) {
      var running = !!STATE.running['asset-' + c.id + '-' + t.typ];
      html += '<div class="dlm-tile">' +
        '<div class="dlm-tile-head"><span class="dlm-tile-icon">' + t.icon + '</span><h4>' + esc(t.label) + '</h4></div>' +
        '<p class="dlm-muted">' + esc(t.desc) + '</p>' +
        '<span class="dlm-chip dlm-tile-count">' + (counts[t.typ] || 0) + ' vorhanden</span>' +
        (running
          ? '<div class="dlm-tile-progress" id="dlm-tile-progress-' + t.typ + '">' + progressCardHtml('asset-' + t.typ) + '</div>'
          : '<button type="button" class="dlp-btn dlp-primary" data-action="open-generate" data-typ="' + t.typ + '">' + esc(T.assetGenerate) + '</button>') +
        '</div>';
    });
    html += '</div>';

    html += '<h2 class="dlm-subtitle">' + esc(T.assetListTitle) + '</h2>';
    html += '<div class="dlm-filter-chips" id="dlm-asset-filters">' +
      '<button type="button" class="dlm-chip dlm-filter-chip' + (STATE.assetFilter === 'alle' ? ' dlm-chip-active' : '') + '" data-afilter="alle">' + esc(T.assetFilterAll) + '</button>' +
      ASSET_TYPES.map(function (t) {
        return '<button type="button" class="dlm-chip dlm-filter-chip' + (STATE.assetFilter === t.typ ? ' dlm-chip-active' : '') + '" data-afilter="' + t.typ + '">' + esc(t.label) + '</button>';
      }).join('') + '</div>';
    html += '<div class="dlm-asset-cards">';
    var filtered = assets.filter(function (a) { return STATE.assetFilter === 'alle' || a.typ === STATE.assetFilter; });
    if (!filtered.length) html += '<div class="dlm-empty-block"><h3>Noch keine Assets</h3><p>' + esc(T.assetsEmptyText) + '</p></div>';
    filtered.forEach(function (a) {
      var effStatus = effectiveAssetStatus(a, c.id);
      html += '<div class="dlp-card dlm-asset-card" data-open-asset="' + esc(a.id) + '">' +
        '<div class="dlm-chips"><span class="dlm-chip">' + esc(assetLabel(a.typ)) + '</span>' +
        '<span class="dlm-chip ' + statusChipCls(effStatus) + '">' + esc(statusLabel(effStatus)) + '</span></div>' +
        '<h4>' + esc(a.titel || assetLabel(a.typ)) + '</h4>' +
        '<p class="dlm-small">' + esc(fmtDate(a.created_at)) + '</p></div>';
    });
    html += '</div>';

    if (STATE.openAssetId) {
      var asset = assets.filter(function (a) { return a.id === STATE.openAssetId; })[0];
      if (asset) html += '<div class="dlm-asset-panel" id="dlm-asset-panel">' + renderAssetPanel(p, c, asset) + '</div>';
    }
    html += '</div>';
    app.innerHTML = html;

    if (STATE.openAssetId) {
      var panel = $('dlm-asset-panel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    ASSET_TYPES.forEach(function (t) {
      if (STATE.running['asset-' + c.id + '-' + t.typ]) startProgressRotation('asset-' + t.typ);
    });
    if (STATE.running['konsistenz-' + c.id]) startProgressRotation('konsistenz');
  }

  function statusLabel(s) {
    if (s === 'fehler_abgebrochen') return 'Abgebrochen, bitte neu erzeugen';
    return s === 'fertig' ? T.statusFertig : (s === 'laeuft' ? T.statusLaeuft : (s === 'fehler' ? T.statusFehler : T.statusLeer));
  }
  function statusChipCls(s) {
    if (s === 'fehler_abgebrochen') return 'dlm-chip-danger';
    return s === 'fertig' ? 'dlm-chip-ok' : (s === 'fehler' ? 'dlm-chip-danger' : (s === 'laeuft' ? 'dlm-chip-warn' : ''));
  }
  // Ein Asset, das seit ueber 20 Minuten "laeuft" zeigt, aber keinen erkannten laufenden
  // Job (mehr) hat, gilt als abgebrochen (z. B. Netlify-Neustart). Nur Anzeige, keine
  // Datenbank-Aenderung noetig, ein neuer Erzeugen-Lauf ueberschreibt es ohnehin.
  var ASSET_STALE_MS = 20 * 60 * 1000;
  function effectiveAssetStatus(a, campaignId) {
    if (a.status !== 'laeuft') return a.status;
    var key = 'asset-' + campaignId + '-' + a.typ;
    if (STATE.running[key]) return a.status;
    var ts = new Date(a.updated_at || a.created_at || 0).getTime();
    if (ts && (Date.now() - ts) > ASSET_STALE_MS) return 'fehler_abgebrochen';
    return a.status;
  }

  function renderKonsistenz(k) {
    var score = typeof k.score === 'number' ? k.score : 0;
    var sevCls = { hoch: 'dlm-chip-danger', mittel: 'dlm-chip-warn', niedrig: '' };
    var html = '<div class="dlm-konsistenz-card">' +
      '<div class="dlm-score-ring" style="--val:' + score + '"><span>' + score + '</span></div>' +
      '<div class="dlm-konsistenz-body">' + mdMini(k.fazit || 'Keine Zusammenfassung.') +
      '<ul class="dlm-befunde">' + arr(k.befunde).map(function (b) {
        return '<li><span class="dlm-chip ' + (sevCls[b.schwere] || '') + '">' + esc(b.schwere || '') + '</span> ' +
          '<strong>' + esc(assetLabel(b.asset_typ)) + ':</strong> ' + esc(b.problem || '') + ' ' +
          (b.vorschlag ? '<em>Vorschlag: ' + inlineMd(b.vorschlag) + '</em>' : '') + '</li>';
      }).join('') + '</ul></div></div>';
    return html;
  }

  function runConsistency(campaignId) {
    STATE.running['konsistenz-' + campaignId] = { pending: true };
    renderCampaignRoute(parseHash());
    var run = AI.run({ uid: STATE.profile.uid, task: 'konsistenz', project_id: STATE.project.id, campaign_id: campaignId }, {
      onProgress: function (job) { updateProgressChars('konsistenz', job.chars || 0); }
    });
    STATE.running['konsistenz-' + campaignId] = { cancel: run.cancel };
    run.promise.then(function () {
      delete STATE.running['konsistenz-' + campaignId];
      stopProgressRotation('konsistenz');
      renderCampaignRoute(parseHash());
    }).catch(function (err) {
      delete STATE.running['konsistenz-' + campaignId];
      stopProgressRotation('konsistenz');
      toast(err && err.message ? err.message : T.genericError);
      renderCampaignRoute(parseHash());
    });
  }

  /* --- Asset erzeugen ------------------------------------------------ */
  function openGenerateDialog(typ) {
    var c = STATE.campaign, p = STATE.project;
    var winkelOpts = arr(c.winkel_ids).map(function (wid) {
      var w = winkelById(p, wid);
      return '<option value="' + esc(wid) + '">' + esc(w ? w.titel : wid) + '</option>';
    }).join('');
    var body = document.createElement('div');
    body.innerHTML =
      '<label class="dlm-field"><span>' + esc(T.assetFocusWinkel) + '</span><select id="dlm-gen-winkel"><option value="">Ueber alle Winkel verteilen</option>' + winkelOpts + '</select></label>' +
      '<label class="dlm-field"><span>' + esc(T.assetHint) + '</span><textarea id="dlm-gen-hint" rows="2"></textarea></label>';
    dialog({
      title: assetLabel(typ) + ' erzeugen',
      body: body,
      actions: [
        { label: T.cancel },
        {
          label: T.assetGenerate, primary: true, onClick: function (wrap) {
            var winkelId = qs('#dlm-gen-winkel', wrap).value;
            var hint = qs('#dlm-gen-hint', wrap).value;
            startAssetGeneration(typ, winkelId, hint);
          }
        }
      ]
    });
  }

  function startAssetGeneration(typ, winkelId, hint) {
    var c = STATE.campaign, p = STATE.project;
    DB.post('me_assets', { project_id: p.id, campaign_id: c.id, typ: typ, status: 'laeuft', winkel_id: winkelId || null }, 'return=representation').then(function (rows) {
      var asset = rows && rows[0];
      STATE.running['asset-' + c.id + '-' + typ] = { assetId: asset ? asset.id : null };
      renderCampaignRoute(parseHash());
      var run = AI.run({ uid: STATE.profile.uid, task: 'asset', project_id: p.id, campaign_id: c.id, asset_id: asset ? asset.id : undefined, typ: typ, winkel_id: winkelId || undefined, hinweis: hint || undefined }, {
        onProgress: function (job) { updateProgressChars('asset-' + typ, job.chars || 0); }
      });
      STATE.running['asset-' + c.id + '-' + typ] = { assetId: asset ? asset.id : null, cancel: run.cancel };
      run.promise.then(function () {
        delete STATE.running['asset-' + c.id + '-' + typ];
        stopProgressRotation('asset-' + typ);
        renderCampaignRoute(parseHash());
      }).catch(function (err) {
        delete STATE.running['asset-' + c.id + '-' + typ];
        stopProgressRotation('asset-' + typ);
        if (asset) DB.patch('me_assets?id=eq.' + asset.id, { status: 'fehler', fehler: String(err && err.message || T.genericError) }).catch(function () {});
        toast(err && err.message ? err.message : T.genericError);
        renderCampaignRoute(parseHash());
      });
    }).catch(function () {
      delete STATE.running['asset-' + c.id + '-' + typ];
    });
  }

  function cancelAssetRun(typ) {
    var c = STATE.campaign;
    var run = STATE.running['asset-' + c.id + '-' + typ];
    if (run && run.cancel) run.cancel();
    delete STATE.running['asset-' + c.id + '-' + typ];
    stopProgressRotation('asset-' + typ);
    renderCampaignRoute(parseHash());
  }

  function deleteAsset(id) {
    DB.del('me_assets?id=eq.' + id).then(function () {
      if (STATE.openAssetId === id) STATE.openAssetId = null;
      renderCampaignRoute(parseHash());
    });
  }

  /* ------------------------------------------------------------------
     15) Asset-Panel: Rendering je Typ
     ------------------------------------------------------------------ */
  function renderAssetPanel(p, c, asset) {
    var head = '<div class="dlm-asset-panel-head">' +
      '<h3>' + esc(asset.titel || assetLabel(asset.typ)) + '</h3>' +
      '<div class="dlm-panel-actions">' +
      (asset.typ === 'leadmagnet' && asset.status === 'fertig' ? '<button type="button" class="dlp-btn dlp-ghost" data-action="print-leadmagnet" data-id="' + esc(asset.id) + '">' + esc(T.assetPrint) + '</button>' : '') +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="copy-all-asset" data-id="' + esc(asset.id) + '">' + esc(T.assetCopyAll) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="export-asset" data-id="' + esc(asset.id) + '">' + esc(T.assetExport) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="regenerate-asset" data-id="' + esc(asset.id) + '" data-typ="' + esc(asset.typ) + '">' + esc(T.assetRegenerate) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="delete-asset" data-id="' + esc(asset.id) + '">' + esc(T.assetDelete) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="close-asset">Schließen</button>' +
      '</div></div>';

    var effStatus = effectiveAssetStatus(asset, c.id);
    if (effStatus === 'fehler_abgebrochen') return head + '<div class="dlm-empty dlm-chip-danger-bg">Abgebrochen, bitte neu erzeugen.</div>';
    if (asset.status === 'laeuft') return head + '<div class="dlm-empty">Wird gerade erzeugt...</div>';
    if (asset.status === 'fehler') return head + '<div class="dlm-empty dlm-chip-danger-bg">Fehler: ' + esc(asset.fehler || T.genericError) + '</div>';
    if (!asset.content) return head + '<div class="dlm-empty">Nicht vorhanden.</div>';

    var body = '';
    try {
      switch (asset.typ) {
        case 'creative': body = renderCreative(asset); break;
        case 'reel': body = renderReel(asset); break;
        case 'caption': body = renderCaptionLike(asset, 'beitraege'); break;
        case 'olg': body = renderOlg(asset); break;
        case 'email': body = renderEmail(asset); break;
        case 'vsl': body = renderVsl(asset); break;
        case 'leadmagnet': body = renderLeadmagnet(asset); break;
        case 'funnel': body = renderFunnel(asset); break;
        default: body = '<div class="dlm-empty">Unbekannter Asset-Typ.</div>';
      }
    } catch (e) {
      body = '<div class="dlm-empty">Nicht vorhanden.</div>';
    }
    return head + '<div class="dlm-asset-body">' + body + '</div>';
  }

  function copyBtn(text) {
    return '<button type="button" class="dlm-text-btn dlm-copy-btn" data-copy="' + encodeURIComponent(text || '') + '">Kopieren</button>';
  }

  /* Schema-Angleichung (Befund 3): hashtags koennen Array ODER String sein. */
  function arr(v) { if (Array.isArray(v)) return v; if (v === null || v === undefined || v === '') return []; return [v]; }
  function hashtagsArr(h) {
    if (Array.isArray(h)) return h;
    return String(h || '').split(/\s+/).filter(Boolean);
  }

  function renderCreative(asset) {
    var content = asset.content || {};
    var varianten = arr(content.varianten);
    if (!varianten.length) return '<div class="dlm-empty">Nicht vorhanden.</div>';
    return varianten.map(function (v, i) {
      v = v || {};
      var bilder = v.bilder || {};
      var formats = ['1:1', '4:5', '9:16'];
      return '<div class="dlm-variant-card">' +
        '<h4>Variante ' + (i + 1) + '</h4>' +
        '<p class="dlm-headline">' + esc(v.headline || 'Nicht vorhanden') + '</p>' +
        '<p class="dlm-muted">' + esc(v.subline || '') + '</p>' +
        '<p>' + inlineMd(v.primary_text || 'Nicht vorhanden') + '</p>' +
        '<span class="dlm-cta-badge">' + esc(v.cta || 'Nicht vorhanden') + '</span>' +
        copyBtn([v.headline, v.subline, v.primary_text, v.cta].filter(Boolean).join('\n\n')) +
        '<details class="dlm-details"><summary>Bild-Prompt</summary><p class="dlm-mono">' + esc(v.bild_prompt || 'Nicht vorhanden') + '</p></details>' +
        '<div class="dlm-img-row">' + formats.map(function (fmt) {
          var url = bilder[fmt];
          var ratioCls = fmt === '1:1' ? 'dlm-ratio-1x1' : (fmt === '4:5' ? 'dlm-ratio-4x5' : 'dlm-ratio-9x16');
          return '<div class="dlm-img-slot">' +
            '<div class="dlm-img-ph ' + ratioCls + '" data-img-slot="' + esc(asset.id) + ':' + i + ':' + esc(fmt) + '">' +
            (url ? '<img src="' + esc(url) + '" alt="">' : '<span>' + esc(fmt) + '</span>') + '</div>' +
            (url
              ? '<a class="dlm-text-btn" href="' + esc(url) + '" download target="_blank" rel="noopener">' + esc(T.imgDownload) + '</a>'
              : '<button type="button" class="dlp-btn dlp-ghost dlm-small-btn" data-action="gen-image" data-asset="' + esc(asset.id) + '" data-variant="' + i + '" data-format="' + esc(fmt) + '">' + esc(T.formatImg) + ' ' + esc(fmt) + '</button>') +
            '</div>';
        }).join('') + '</div>' +
        '</div>';
    }).join('');
  }

  function renderReel(asset) {
    var skripte = arr((asset.content || {}).skripte);
    if (!skripte.length) return '<div class="dlm-empty">Nicht vorhanden.</div>';
    return skripte.map(function (s, i) {
      s = s || {};
      var rows = (Array.isArray(s.szenen) ? s.szenen : []).map(function (sz) {
        sz = sz || {};
        return '<tr><td>' + esc(sz.zeit || '') + '</td><td>' + esc(sz.sprechtext || '') + '</td><td>' + esc(sz.bild_hinweis || '') + '</td><td>' + esc(sz.text_einblendung || '') + '</td></tr>';
      }).join('');
      return '<div class="dlm-variant-card">' +
        '<h4>' + esc(s.titel || ('Skript ' + (i + 1))) + '</h4>' +
        '<ul class="dlm-punkte">' + arr(s.hook_varianten).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' +
        '<table class="dlm-table"><thead><tr><th>Zeit</th><th>Sprechtext</th><th>Bild</th><th>Einblendung</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<p><strong>CTA:</strong> ' + esc(s.cta || 'Nicht vorhanden') + '</p>' +
        '<p>' + inlineMd(s.caption || '') + '</p>' +
        '<p class="dlm-muted">' + hashtagsArr(s.hashtags).map(function (h) { return esc(h); }).join(' ') + '</p>' +
        '<p class="dlm-small">' + esc(s.dreh_hinweise || '') + '</p>' +
        copyBtn([s.titel, arr(s.hook_varianten).join(' / '), s.caption].filter(Boolean).join('\n\n')) +
        '</div>';
    }).join('');
  }

  function renderCaptionLike(asset, key) {
    var items = (asset.content || {})[key] || [];
    if (!items.length) return '<div class="dlm-empty">Nicht vorhanden.</div>';
    return items.map(function (b) {
      b = b || {};
      return '<div class="dlm-post-card">' +
        '<div class="dlm-chips"><span class="dlm-chip">' + esc(b.plattform || '') + '</span><span class="dlm-chip">' + esc(b.format || '') + '</span></div>' +
        '<p><strong>' + esc(b.hook || '') + '</strong></p>' +
        '<p>' + inlineMd(b.text || 'Nicht vorhanden') + '</p>' +
        '<span class="dlm-cta-badge">' + esc(b.cta || '') + '</span>' +
        '<p class="dlm-muted">' + hashtagsArr(b.hashtags).map(function (h) { return esc(h); }).join(' ') + '</p>' +
        copyBtn([b.hook, b.text, b.cta].filter(Boolean).join('\n\n')) +
        '</div>';
    }).join('');
  }

  function renderOlg(asset) {
    var items = (asset.content || {}).beitraege || [];
    if (!items.length) return '<div class="dlm-empty">Nicht vorhanden.</div>';
    return items.map(function (b) {
      b = b || {};
      return '<div class="dlm-post-card">' +
        '<div class="dlm-chips"><span class="dlm-chip">' + esc(b.kanal || '') + '</span><span class="dlm-chip">' + esc(b.typ || '') + '</span></div>' +
        '<p>' + inlineMd(b.text || 'Nicht vorhanden') + '</p>' +
        (b.soft_cta ? '<span class="dlm-cta-badge">' + esc(b.soft_cta) + '</span>' : '') +
        copyBtn(b.text) +
        '</div>';
    }).join('');
  }

  function renderEmail(asset) {
    var content = asset.content || {};
    var mails = arr(content.mails);
    if (!mails.length) return '<div class="dlm-empty">Nicht vorhanden.</div>';
    var html = '<p class="dlm-muted">' + esc(content.sequenz_name || '') + ' - ' + esc(content.zweck || '') + '</p><div class="dlm-accordion">';
    html += mails.map(function (m, i) {
      m = m || {};
      return '<div class="dlm-acc-item' + (i === 0 ? ' dlm-acc-open' : '') + '">' +
        '<button type="button" class="dlm-acc-head" data-action="toggle-acc"><span>Mail ' + esc(m.nr || (i + 1)) + ' - Tag ' + esc(m.tag || '') + '</span>' +
        '<svg class="dlm-acc-caret" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button>' +
        '<div class="dlm-acc-body"><div class="dlm-acc-view">' +
        '<ul class="dlm-punkte">' + (Array.isArray(m.betreff_varianten) ? m.betreff_varianten : []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' +
        '<p class="dlm-muted">' + esc(m.preheader || '') + '</p>' +
        '<div>' + inlineMd(m.text || 'Nicht vorhanden') + '</div>' +
        '<span class="dlm-cta-badge">' + esc(m.cta || '') + '</span>' +
        (m.ps ? '<p class="dlm-small">PS: ' + inlineMd(m.ps) + '</p>' : '') +
        copyBtn([m.betreff_varianten && m.betreff_varianten[0], m.text, m.cta, m.ps].filter(Boolean).join('\n\n')) +
        '</div></div></div>';
    }).join('');
    html += '</div>';
    return html;
  }

  function renderVsl(asset) {
    var content = asset.content || {};
    var struktur = arr(content.struktur);
    if (!struktur.length) return '<div class="dlm-empty">Nicht vorhanden.</div>';
    return '<h4>' + esc(content.titel || '') + ' (' + esc(content.dauer_min || '?') + ' Min.)</h4>' +
      '<div class="dlm-vsl-list">' + struktur.map(function (s) {
        s = s || {};
        return '<div class="dlm-vsl-row"><div class="dlm-vsl-time">' + esc(s.minute || '') + '<br><span class="dlm-muted">' + esc(s.abschnitt || '') + '</span></div>' +
          '<div class="dlm-vsl-content"><p>' + inlineMd(s.sprechtext || 'Nicht vorhanden') + '</p>' +
          '<p class="dlm-small">Folie: ' + esc(s.folie_hinweis || '') + '</p>' +
          '<p class="dlm-small">Ziel: ' + esc(s.ziel || '') + '</p></div></div>';
      }).join('') + '</div>' +
      '<p><strong>CTA:</strong> ' + esc(content.cta_text || 'Nicht vorhanden') + '</p>' +
      '<p class="dlm-muted">' + esc(content.hinweise || '') + '</p>' +
      copyBtn(struktur.map(function (s) { return s.sprechtext; }).filter(Boolean).join('\n\n'));
  }

  function renderLeadmagnet(asset) {
    var c = asset.content || {};
    var kapitel = arr(c.kapitel).map(function (k) { return (k && typeof k === 'object') ? k : { ueberschrift: '', text: String(k || '') }; });
    return '<div class="dlm-book">' +
      '<div class="dlm-book-cover"><h2>' + esc(c.titel || 'Ohne Titel') + '</h2><p>' + inlineMd(c.untertitel || '') + '</p><p class="dlm-muted">' + inlineMd(c.versprechen || '') + '</p></div>' +
      mdMini(c.einleitung) +
      kapitel.map(function (k, i) {
        k = k || {};
        var punkte = Array.isArray(k.punkte) ? k.punkte : [];
        return '<div class="dlm-chapter"><h4>' + (i + 1) + '. ' + esc(k.ueberschrift || '') + '</h4>' +
          '<div>' + mdMini(k.text) + '</div>' +
          (punkte.length ? '<ul class="dlm-punkte">' + punkte.map(function (pt) { return '<li>' + inlineMd(pt) + '</li>'; }).join('') + '</ul>' : '') +
          '</div>';
      }).join('') +
      (Array.isArray(c.checkliste) && c.checkliste.length ? '<h4>Checkliste</h4><ul class="dlm-punkte">' + c.checkliste.map(function (pt) { return '<li>' + inlineMd(pt) + '</li>'; }).join('') + '</ul>' : '') +
      (c.abschluss_cta ? '<div class="dlm-cta-box">' + mdMini(c.abschluss_cta) + '</div>' : '') +
      (c.autor_box ? '<div class="dlm-muted">' + mdMini(c.autor_box) + '</div>' : '');
  }

  /* Nachfass ist ein Array von Objekten {zeitpunkt, kanal, ziel, text},
     toleriert aber auch einfache Strings (Befund 3). */
  function renderNachfass(list) {
    if (!Array.isArray(list) || !list.length) return '';
    var rows = list.map(function (n) {
      return (n && typeof n === 'object') ? n : { zeitpunkt: '', kanal: '', ziel: '', text: String(n || '') };
    });
    return '<h4 class="dlm-subtitle-sm">Nachfass</h4><div class="dlm-nachfass-list">' + rows.map(function (n) {
      return '<div class="dlm-nachfass-item">' +
        '<div class="dlm-chips">' +
        (n.zeitpunkt ? '<span class="dlm-chip">' + esc(n.zeitpunkt) + '</span>' : '') +
        (n.kanal ? '<span class="dlm-chip">' + esc(n.kanal) + '</span>' : '') +
        '</div>' +
        (n.ziel ? '<p class="dlm-muted">Ziel: ' + esc(n.ziel) + '</p>' : '') +
        '<p>' + inlineMd(n.text || 'Nicht vorhanden') + '</p>' +
        copyBtn(n.text) +
        '</div>';
    }).join('') + '</div>';
  }

  function renderFunnel(asset) {
    var c = asset.content || {};
    var schritte = arr(c.schritte).map(function (st) { return (st && typeof st === 'object') ? st : { seite: '', headline: String(st || '') }; });
    return '<p class="dlm-muted"><strong>' + esc(c.funnel_typ || '') + '</strong> - ' + esc(c.begruendung || '') + '</p>' +
      '<div class="dlm-funnel-flow">' + schritte.map(function (s) {
        s = s || {};
        var abschnitte = Array.isArray(s.abschnitte) ? s.abschnitte : [];
        return '<div class="dlm-funnel-step"><div class="dlm-funnel-num">' + esc(s.nr || '') + '</div>' +
          '<div><h4>' + esc(s.seite || '') + '</h4><p class="dlm-muted">Ziel: ' + esc(s.ziel || '') + '</p>' +
          '<p class="dlm-headline">' + esc(s.headline || '') + '</p><p>' + esc(s.subheadline || '') + '</p>' +
          abschnitte.map(function (a) { a = a || {}; return '<p><strong>' + esc(a.titel || '') + ':</strong> ' + esc(a.text || '') + '</p>'; }).join('') +
          '<span class="dlm-cta-badge">' + esc(s.cta || '') + '</span>' +
          (s.hinweise ? '<p class="dlm-small">' + inlineMd(s.hinweise) + '</p>' : '') +
          '</div></div>';
      }).join('') + '</div>' +
      renderNachfass(c.nachfass) +
      (c.kennzahlen_ziel ? '<h4 class="dlm-subtitle-sm">Kennzahlen-Ziel</h4>' + mdMini(typeof c.kennzahlen_ziel === 'string' ? c.kennzahlen_ziel : JSON.stringify(c.kennzahlen_ziel)) : '');
  }

  function assetAllText(asset) {
    try { return JSON.stringify(asset.content, null, 2); } catch (e) { return ''; }
  }

  function assetToMarkdown(asset) {
    var lines = ['# ' + (asset.titel || assetLabel(asset.typ)), ''];
    lines.push(assetAllText(asset));
    return lines.join('\n');
  }

  function printLeadmagnet(asset, project) {
    var c = asset.content || {};
    var win = window.open('', '_blank');
    if (!win) { toast('Bitte Pop-ups erlauben.'); return; }
    var firma = (project.brief && project.brief.firma) || '';
    var kapitelHtml = (Array.isArray(c.kapitel) ? c.kapitel : []).map(function (k, i) {
      k = k || {};
      var punkte = Array.isArray(k.punkte) ? k.punkte : [];
      return '<section class="chapter"><h2>' + (i + 1) + '. ' + esc(k.ueberschrift || '') + '</h2>' + mdMini(k.text) +
        (punkte.length ? '<ul>' + punkte.map(function (pt) { return '<li>' + inlineMd(pt) + '</li>'; }).join('') + '</ul>' : '') + '</section>';
    }).join('');
    var checklisteHtml = (c.checkliste && c.checkliste.length)
      ? '<section class="chapter"><h2>Checkliste</h2><ul class="checklist">' + c.checkliste.map(function (pt) { return '<li><span class="box"></span>' + inlineMd(pt) + '</li>'; }).join('') + '</ul></section>'
      : '';
    var html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><title>' + esc(c.titel || 'Leadmagnet') + '</title>' +
      '<style>' +
      '@page{size:A4;margin:22mm 18mm}' +
      'body{font-family:Georgia,\'Times New Roman\',serif;color:#111;line-height:1.6;font-size:12.5pt}' +
      '.cover{height:240mm;display:flex;flex-direction:column;justify-content:center;text-align:center;page-break-after:always}' +
      '.cover h1{font-size:30pt;margin-bottom:10px}' +
      '.cover p{font-size:14pt;color:#333}' +
      '.chapter{page-break-before:always}' +
      '.chapter:first-of-type{page-break-before:auto}' +
      'h2{font-size:18pt;border-bottom:1px solid #ccc;padding-bottom:6px}' +
      'ul.checklist{list-style:none;padding:0}' +
      'ul.checklist li{margin:8px 0;padding-left:26px;position:relative}' +
      'ul.checklist .box{position:absolute;left:0;top:2px;width:16px;height:16px;border:1.5px solid #333}' +
      '.cta{margin-top:26px;padding:16px;border:1px solid #333;text-align:center}.autor{margin-top:22px;font-size:11pt;color:#333}' +
      'footer{position:fixed;bottom:8mm;left:0;right:0;text-align:center;font-size:9pt;color:#666}' +
      '</style></head><body>' +
      '<div class="cover"><h1>' + esc(c.titel || '') + '</h1><p>' + inlineMd(c.untertitel || '') + '</p><p>' + inlineMd(c.versprechen || '') + '</p></div>' +
      '<section class="chapter">' + mdMini(c.einleitung) + '</section>' +
      kapitelHtml + checklisteHtml +
      (c.abschluss_cta ? '<div class="cta">' + mdMini(c.abschluss_cta) + '</div>' : '') +
      (c.autor_box ? '<div class="autor">' + mdMini(c.autor_box) + '</div>' : '') +
      '<footer>' + esc(firma) + '</footer>' +
      '</body></html>';
    win.document.open(); win.document.write(html); win.document.close();
    setTimeout(function () { try { win.focus(); win.print(); } catch (e) {} }, 300);
  }

  /* --- Bild-Erzeugung -------------------------------------------------- */
  function generateImage(assetId, variant, format) {
    var slot = qs('[data-img-slot="' + assetId + ':' + variant + ':' + format + '"]');
    if (slot) slot.innerHTML = '<span>' + esc(T.imgLoading) + '</span>';
    IMG.stream({ uid: STATE.profile.uid, asset_id: assetId, variante: Number(variant), format: format }, {
      onDelta: function () {}
    }).then(function (result) {
      renderCampaignRoute(parseHash());
    }).catch(function (err) {
      toast(err && err.message ? err.message : T.genericError);
      renderCampaignRoute(parseHash());
    });
  }

  /* ------------------------------------------------------------------
     16) Event-Delegation
     ------------------------------------------------------------------ */
  function wireGlobalEvents() {
    document.body.addEventListener('click', function (e) {
      var t = e.target;

      var newProjectBtn = t.closest('[data-action="new-project"]');
      if (newProjectBtn) { openNewProjectDialog(); return; }

      var menuBtn = t.closest('[data-action="project-menu"]');
      if (menuBtn) { e.stopPropagation(); openProjectMenu(menuBtn.getAttribute('data-id')); return; }

      var openProject = t.closest('[data-open-project]');
      if (openProject) { location.hash = '#/p/' + openProject.getAttribute('data-open-project'); return; }

      var runAnalyseBtn = t.closest('[data-action="run-analyse"]');
      if (runAnalyseBtn) { runAnalyse(runAnalyseBtn.getAttribute('data-id')); return; }

      var refineBtn = t.closest('[data-action="refine-analyse"]');
      if (refineBtn) {
        var pid = refineBtn.getAttribute('data-id');
        var body = document.createElement('div');
        body.innerHTML = '<label class="dlm-field"><span>Was soll sich ändern?</span><textarea id="dlm-refine-text" rows="4"></textarea></label>';
        dialog({
          title: T.zielgruppeRefine, body: body,
          actions: [{ label: T.cancel }, {
            label: 'Verfeinern', primary: true, onClick: function (wrap) {
              runAnalyse(pid, { hinweis: qs('#dlm-refine-text', wrap).value });
            }
          }]
        });
        return;
      }

      var redoBtn = t.closest('[data-action="redo-analyse"]');
      if (redoBtn) {
        var pid2 = redoBtn.getAttribute('data-id');
        confirmDialog(T.zielgruppeRedoConfirm, function () { runAnalyse(pid2); });
        return;
      }

      var exportBtn = t.closest('[data-action="export-analyse"]');
      if (exportBtn) {
        var p = STATE.project;
        var lines = ['# Zielgruppenanalyse - ' + p.name, ''];
        ANALYSE_CATS.forEach(function (c) {
          var cat = (p.analyse || {})[c[0]] || {};
          lines.push('## ' + (cat.titel || c[1]), '', cat.inhalt || 'Nicht vorhanden', '');
        });
        download('zielgruppenanalyse-' + p.id + '.md', lines.join('\n'));
        return;
      }

      var runWinkelBtn = t.closest('[data-action="run-winkel"]');
      if (runWinkelBtn) { runWinkel(runWinkelBtn.getAttribute('data-id'), false); return; }
      var moreWinkelBtn = t.closest('[data-action="run-winkel-more"]');
      if (moreWinkelBtn) { runWinkel(moreWinkelBtn.getAttribute('data-id'), true); return; }

      var toggleDetail = t.closest('[data-action="toggle-winkel-detail"]');
      if (toggleDetail) {
        var card = toggleDetail.closest('.dlm-winkel-card');
        var det = qs('.dlm-winkel-detail', card);
        det.hidden = !det.hidden;
        return;
      }

      var filterChip = t.closest('#dlm-winkel-filters [data-filter]');
      if (filterChip) { STATE.winkelFilter = filterChip.getAttribute('data-filter'); renderProjectRoute(parseHash()); return; }

      var afilterChip = t.closest('#dlm-asset-filters [data-afilter]');
      if (afilterChip) { STATE.assetFilter = afilterChip.getAttribute('data-afilter'); renderCampaignRoute(parseHash()); return; }

      var accHead = t.closest('[data-action="toggle-acc"]');
      if (accHead) { accHead.closest('.dlm-acc-item').classList.toggle('dlm-acc-open'); return; }

      var editCat = t.closest('[data-action="edit-cat"]');
      if (editCat) {
        var item = editCat.closest('.dlm-acc-item');
        item.classList.add('dlm-acc-open');
        qs('.dlm-acc-view', item).hidden = true;
        qs('.dlm-acc-edit', item).hidden = false;
        return;
      }
      var cancelCat = t.closest('[data-action="cancel-cat"]');
      if (cancelCat) {
        var item2 = cancelCat.closest('.dlm-acc-item');
        qs('.dlm-acc-view', item2).hidden = false;
        qs('.dlm-acc-edit', item2).hidden = true;
        return;
      }
      var saveCat = t.closest('[data-action="save-cat"]');
      if (saveCat) {
        var key = saveCat.getAttribute('data-cat');
        var item3 = saveCat.closest('.dlm-acc-item');
        var text = qs('.dlm-acc-edit textarea', item3).value;
        var p2 = STATE.project;
        var analyse = Object.assign({}, p2.analyse);
        analyse[key] = Object.assign({}, analyse[key], { inhalt: text });
        DB.patch('me_projects?id=eq.' + p2.id, { analyse: analyse }).then(function () {
          p2.analyse = analyse;
          renderProjectRoute(parseHash());
        });
        return;
      }
      var copyCat = t.closest('[data-action="copy-cat"]');
      if (copyCat) {
        var key2 = copyCat.getAttribute('data-cat');
        var cat = (STATE.project.analyse || {})[key2] || {};
        copyText(cat.inhalt || '');
        return;
      }

      var newCampBtn = t.closest('[data-action="new-campaign"]');
      if (newCampBtn) { openNewCampaignDialog(newCampBtn.getAttribute('data-id')); return; }

      var openCamp = t.closest('[data-open-campaign]');
      if (openCamp) { location.hash = '#/p/' + STATE.project.id + '/k/' + openCamp.getAttribute('data-open-campaign'); return; }

      var checkCons = t.closest('[data-action="check-consistency"]');
      if (checkCons) { runConsistency(checkCons.getAttribute('data-id')); return; }

      var openGen = t.closest('[data-action="open-generate"]');
      if (openGen) { openGenerateDialog(openGen.getAttribute('data-typ')); return; }

      var cancelRun = t.closest('[data-action="cancel-run"]');
      if (cancelRun) {
        var kind = cancelRun.getAttribute('data-kind');
        if (kind && kind.indexOf('asset-') === 0) { cancelAssetRun(kind.slice(6)); return; }
        if (kind === 'konsistenz') {
          delete STATE.running['konsistenz-' + STATE.campaign.id];
          stopProgressRotation('konsistenz');
          renderCampaignRoute(parseHash());
          return;
        }
        return;
      }

      var openAsset = t.closest('[data-open-asset]');
      if (openAsset) { STATE.openAssetId = openAsset.getAttribute('data-open-asset'); renderCampaignRoute(parseHash()); return; }

      var closeAsset = t.closest('[data-action="close-asset"]');
      if (closeAsset) { STATE.openAssetId = null; renderCampaignRoute(parseHash()); return; }

      var delAsset = t.closest('[data-action="delete-asset"]');
      if (delAsset) {
        var aid = delAsset.getAttribute('data-id');
        confirmDialog(T.confirmDeleteAsset, function () { deleteAsset(aid); });
        return;
      }

      var regenAsset = t.closest('[data-action="regenerate-asset"]');
      if (regenAsset) {
        var typ = regenAsset.getAttribute('data-typ');
        var oldId = regenAsset.getAttribute('data-id');
        STATE.openAssetId = null;
        deleteAsset(oldId);
        setTimeout(function () { openGenerateDialog(typ); }, 200);
        return;
      }

      var exportAsset = t.closest('[data-action="export-asset"]');
      if (exportAsset) {
        var asset = arr(STATE.assets).filter(function (a) { return a.id === exportAsset.getAttribute('data-id'); })[0];
        if (asset) download('asset-' + asset.typ + '-' + asset.id + '.md', assetToMarkdown(asset));
        return;
      }
      var copyAllAsset = t.closest('[data-action="copy-all-asset"]');
      if (copyAllAsset) {
        var asset2 = arr(STATE.assets).filter(function (a) { return a.id === copyAllAsset.getAttribute('data-id'); })[0];
        if (asset2) copyText(assetAllText(asset2));
        return;
      }
      var printLm = t.closest('[data-action="print-leadmagnet"]');
      if (printLm) {
        var asset3 = arr(STATE.assets).filter(function (a) { return a.id === printLm.getAttribute('data-id'); })[0];
        if (asset3) printLeadmagnet(asset3, STATE.project);
        return;
      }

      var copyBtnEl = t.closest('[data-copy]');
      if (copyBtnEl) { copyText(decodeURIComponent(copyBtnEl.getAttribute('data-copy'))); return; }

      var genImgBtn = t.closest('[data-action="gen-image"]');
      if (genImgBtn) {
        generateImage(genImgBtn.getAttribute('data-asset'), genImgBtn.getAttribute('data-variant'), genImgBtn.getAttribute('data-format'));
        return;
      }
    });

    document.body.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches('[data-action="toggle-winkel"]')) {
        toggleWinkelAuswahl(STATE.project.id, t.getAttribute('data-id'), t.checked);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && STATE.openAssetId) { STATE.openAssetId = null; renderCampaignRoute(parseHash()); }
    });
  }

  /* ------------------------------------------------------------------
     17) Boot
     ------------------------------------------------------------------ */
  function boot() {
    var initialMode = 'dark';
    try { var m = localStorage.getItem('dlm-mode'); if (m === 'dark' || m === 'normal') initialMode = m; } catch (e) {}
    applyTheme(initialMode);
    wireTheme();

    var profile = window.DL_IDENTITY.read();
    if (!profile.uid) { $('dlm-lock').hidden = false; return; }
    STATE.profile = profile;

    $('dlm-app').hidden = false;
    $('dlm-version').textContent = window.APP_VERSION || '1.0.0';
    renderHello();
    wireGlobalEvents();
    wireIntro();
    checkVersion();
    setInterval(checkVersion, 10 * 60 * 1000);
    $('dlm-update-go') && $('dlm-update-go').addEventListener('click', function () { location.reload(); });

    window.DL_IDENTITY.sync(profile, 'marketing-engine', function (path, body, prefer) {
      return DB.post(path, body, prefer);
    });

    window.addEventListener('hashchange', route);
    route();

    var seen = null;
    try { seen = localStorage.getItem('dlm-intro-seen'); } catch (e) {}
    if (!seen) openIntro();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
