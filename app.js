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
    breadcrumbProjects: 'Avatare',
    footerVersion: 'Version',
    newVersion: 'Neue Version, bitte neu laden.',
    reload: 'Neu laden',
    newProject: 'Neuen Avatar anlegen',
    newProjectTitle: 'Neuen Avatar anlegen',
    projectName: 'Name deines Avatars',
    projectNamePh: 'z. B. Coaching für Zahnärzte',
    create: 'Anlegen',
    cancel: 'Abbrechen',
    save: 'Speichern',
    rename: 'Umbenennen',
    archive: 'Archivieren',
    delete: 'Löschen',
    projectsEmpty: 'Noch kein Avatar angelegt. Leg deinen ersten Avatar an.',
    tabBrief: 'Brief',
    tabZielgruppe: 'Zielgruppe',
    tabWinkel: 'Winkel',
    tabAvatar: 'Avatar',
    tabAvatarHint: 'Erst Zielgruppenanalyse erstellen',
    tabKampagnen: 'Kampagnen',
    briefHelp: 'Je konkreter, desto besser wird die Analyse.',
    briefSaved: 'Gespeichert.',
    briefEditAll: 'Alle Felder bearbeiten',
    briefRestartInterview: 'Interview neu starten',
    briefRestartInterviewConfirm: 'Das Interview wird von vorn gestartet, deine bisherigen Antworten bleiben im Formular erhalten. Fortfahren?',
    laterAnswered: 'Später beantworten',
    zielgruppeEmptyTitle: 'Noch keine Zielgruppenanalyse',
    zielgruppeEmptyText: 'Erzeuge eine ausführliche Zielgruppenanalyse auf Basis deines Briefs. Das dauert 2 bis 4 Minuten, du kannst währenddessen den Tab wechseln.',
    zielgruppeCreate: 'Zielgruppenanalyse erstellen',
    zielgruppeRefine: 'Verfeinern mit Hinweis',
    zielgruppeRedo: 'Komplett neu erzeugen',
    zielgruppeExport: 'Als Text exportieren',
    zielgruppeRedoConfirm: 'Die bestehende Analyse wird ersetzt. Fortfahren?',
    winkelEmptyTitle: 'Noch keine Marketing-Winkel',
    winkelEmptyText: 'Lass aus deiner Analyse 25 Marketing-Winkel erzeugen (5 je Awareness-Stufe) und wähle davon 5 bis 10 aus.',
    winkelCreate: 'Marketing-Winkel erzeugen',
    winkelMoreStufe: '5 weitere für diese Stufe',
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
    kampagneBauen: 'Kampagne bauen',
    kampagneBauenHint: 'Wähle zuerst 5 bis 10 Winkel aus, dann kannst du eine Kampagne bauen.',
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
    introTitle1: '1. Avatar anlegen',
    introText1: 'Leg für jede Zielperson einen Avatar an. Im Interview erzählst du in wenigen Fragen von Firma, Branche und Angebot, per Text oder Sprachmemo.',
    introTitle2: '2. Zielgruppe und Winkel',
    introText2: 'Aus dem Interview entsteht eine ausführliche Zielgruppenanalyse mit Avatar-Bild. Daraus wählst du 5 bis 10 Marketing-Winkel aus.',
    introTitle3: '3. Kampagne bauen',
    introText3: 'Sobald du Winkel gewählt hast, baust du eine Kampagne und erzeugst fertige Marketing-Assets: Bild-Creatives, Reels, Captions, E-Mails, VSL, Leadmagnet und Funnel.',
    introNext: 'Weiter',
    introBack: 'Zurück',
    introDone: 'Los geht\'s',
    navAvatare: 'Avatare',
    navVorlagen: 'Vorlagen',
    navHilfe: 'Hilfe',
    formatImg: 'Bild erzeugen',
    imgLoading: 'Bild wird erzeugt...',
    imgDownload: 'Herunterladen',
    genericError: 'Da ist etwas schiefgelaufen.',
    confirmDeleteAsset: 'Dieses Asset wirklich löschen?',
    confirmDeleteProject: 'Diesen Avatar wirklich archivieren?',
    vorlagenNav: 'Creative-Vorlagen',
    vorlagenTitle: 'Creative-Vorlagen',
    vorlagenIntro: 'Lade ein Werbebild hoch, das dir gefällt. Die KI zerlegt Aufbau, Headline, Design und Wirkung und macht daraus eine Vorlage, nach der du eigene Creatives erzeugst.',
    vorlagenDropText: 'Bild hierher ziehen oder klicken zum Auswählen',
    vorlagenDropHint: 'JPG, PNG oder WebP',
    vorlagenEmptyTitle: 'Noch keine Vorlage',
    vorlagenEmptyText: 'Lade dein erstes Werbebild hoch, um eine Vorlage zu erstellen.',
    vorlagenBadType: 'Nur JPG, PNG oder WebP sind erlaubt.',
    vorlagenDecoding: 'Creative wird decodiert',
    vorlagenDecodingHint: 'Das dauert etwa 1 Minute.',
    vorlagenRedo: 'Neu decodieren',
    vorlagenRetry: 'Erneut versuchen',
    vorlagenConfirmDelete: 'Diese Vorlage wirklich löschen?',
    vorlagenConfirmRedo: 'Die bestehende Analyse wird ersetzt. Fortfahren?',
    vorlagenNotFound: 'Vorlage nicht gefunden.',
    assetVorlage: 'Vorlage (optional)',
    assetVorlageNone: 'Ohne Vorlage',
    interviewWeiter: 'Weiter',
    interviewZurueck: 'Zurück',
    interviewPflicht: 'Diese Frage ist Pflicht, bitte etwas eintragen.',
    interviewFrageVon: 'Frage {n} von {gesamt}',
    interviewMicStart: 'Sprachmemo aufnehmen',
    interviewMicStop: 'Aufnahme beenden',
    interviewMicUnavailable: 'Mikrofon nicht verfügbar, bitte tippen.',
    interviewTranscribing: 'Wird umgewandelt...',
    interviewSummaryTitle: 'Alles zusammengefasst',
    interviewSummaryText: 'Prüfe deine Angaben, du kannst noch alles ändern.',
    interviewStartAnalyse: 'Zielgruppenanalyse starten',
    avatarBilderHint: 'Bilder gibt es nach der Zielgruppenanalyse.',
    avatarBilderTitle: 'Avatar-Bilder',
    avatarBildErzeugen: 'Erzeugen',
    avatarBilderAlle: 'Alle drei erzeugen',
    avatarBildLaeuft: 'Wird erzeugt...',
    avatarAusgestalten: 'Avatar ausgestalten',
    avatarZeileOhneName: 'Noch kein Avatar ausgestaltet',
    avatarBildHinweisLeer: 'Für Bilder braucht die KI zuerst einen Bild-Prompt, Alter, Beruf oder Aussehen. Fülle rechts das Profil aus oder erzeuge zuerst die Zielgruppenanalyse.',
    avatarLabelName: 'Name',
    avatarLabelAlter: 'Alter',
    avatarLabelBeruf: 'Beruf',
    avatarLabelKurz: 'Kurzbeschreibung',
    avatarLabelWerte: 'Werte',
    avatarWertePh: 'Wert eingeben und Enter oder Komma drücken...',
    avatarLabelZiele: 'Ziele',
    avatarZielePh: 'Was will diese Person in den nächsten 12 Monaten erreichen?',
    avatarLabelSorge: 'Größte Sorge',
    avatarLabelAussehen: 'Aussehen und Auftreten',
    avatarAussehenPh: 'Wie sieht die Person aus, wie kleidet sie sich? Fließt in die Bilder ein.',
    avatarLabelMotto: 'Lebensmotto',
    avatarUebernehmen: 'Vorschläge aus der Analyse übernehmen',
    avatarGespeichert: 'Gespeichert.',
    avatarVisitenkarteTitel: 'Avatar-Visitenkarte',
    freebieTheme: 'Design',
    freebieAkzent: 'Akzentfarbe',
    freebiePrint: 'Als PDF drucken',
    freebieDownload: 'HTML herunterladen',
    freebieCopyText: 'Text kopieren'
  };

  var AWARENESS_INFO = {
    unbewusst: 'Die Person weiß noch nicht, dass sie ein Problem hat.',
    problembewusst: 'Sie spürt das Problem, kennt aber keine Lösung.',
    loesungsbewusst: 'Sie kennt Lösungswege, aber nicht dein Angebot.',
    produktbewusst: 'Sie kennt dein Angebot, ist aber noch nicht überzeugt.',
    meistbewusst: 'Sie ist fast entschlossen und braucht den letzten Anstoß.'
  };

  var TYP_LABEL = {
    Mechanismus: 'Mechanismus', Feind: 'Feind', Kontrast: 'Kontrast', Story: 'Story', Zahlen: 'Zahlen',
    Zeit: 'Zeit', Identität: 'Identität', 'Neue Chance': 'Neue Chance', Warnung: 'Warnung',
    Frage: 'Frage', Geheimnis: 'Geheimnis', Status: 'Status'
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
    konsistenz: ['Lese alle Assets der Kampagne', 'Vergleicht Tonalität', 'Prüft Widersprüche', 'Fasst zusammen'],
    decode: ['Analysiert Aufbau und Blickführung', 'Liest Headline, Subline und CTA', 'Bestimmt Farben und Typografie', 'Fasst Psychologie und Wirkung zusammen']
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

  /* Zielgruppen-Bereiche nach SPEC §11.6: 4 grosse Bereiche mit Sprungleiste. */
  var ANALYSE_AREAS = [
    { key: 'wer', label: 'Wer', cats: ['basisprofil', 'wissensstand', 'marktwissen'] },
    { key: 'schmerz', label: 'Schmerz und Wunsch', cats: ['weg_von', 'hin_zu', 'reale_situationen'] },
    { key: 'psychologie', label: 'Psychologie', cats: ['disg', 'life_force_8', 'sekundaere_wuensche_9', 'einwaende', 'awareness_stufe', 'glaubenssaetze', 'sprache_zitate'] },
    { key: 'kaufen', label: 'Kaufen', cats: ['kaufausloeser', 'kanaele', 'entscheidungsprozess', 'zusammenfassung'] }
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

  /* Interview-Fragen nach SPEC §11.4, feste Reihenfolge, feste Zuordnung zu Brief-Feldern. */
  var INTERVIEW_QUESTIONS = [
    { feld: 'firma', frage: 'Wie heißt dein Unternehmen oder dein Projekt?', optional: false, type: 'text' },
    { feld: 'branche', frage: 'In welcher Branche bist du unterwegs?', optional: false, type: 'text' },
    { feld: 'dienstleistungen', frage: 'Was genau bietest du an? Erzähl ruhig ausführlich.', optional: false, type: 'textarea' },
    { feld: 'angebot_kurz', frage: 'Wenn du dein Angebot in einem Satz erklären müsstest, wie klingt der?', optional: true, type: 'textarea' },
    { feld: 'zielkunde_vermutung', frage: 'Wer ist deiner Meinung nach dein idealer Kunde? Beschreib die Person, so gut du kannst.', optional: true, type: 'textarea' },
    { feld: 'preisniveau', frage: 'Auf welchem Preisniveau bewegst du dich?', optional: true, type: 'chips', options: PREISNIVEAU },
    { feld: 'b2b_b2c', frage: 'Verkaufst du an Unternehmen oder an Privatpersonen?', optional: true, type: 'chips', options: B2B_B2C },
    { feld: 'region', frage: 'In welcher Region bist du aktiv?', optional: true, type: 'text' },
    { feld: 'usp', frage: 'Was machst du anders oder besser als andere?', optional: true, type: 'textarea' },
    { feld: 'kunden_beispiele', frage: 'Erzähl von zwei oder drei echten Kunden: Wer waren sie, was war ihr Problem?', optional: true, type: 'textarea' },
    { feld: 'wettbewerber', frage: 'Wer sind deine wichtigsten Wettbewerber?', optional: true, type: 'textarea' },
    { feld: 'tonalitaet', frage: 'Welche Tonalität passt zu dir?', optional: true, type: 'chips', options: TONALITAET },
    { feld: 'notizen', frage: 'Gibt es noch etwas, das die KI wissen sollte?', optional: true, type: 'textarea' }
  ];
  var AVATAR_STILE = [['foto', 'Foto'], ['illustration', 'Illustration'], ['karikatur', 'Karikatur']];
  /* Vorschlags-Chips fuer das Feld "Werte" im Tab Avatar (Profil-Formular). */
  var AVATAR_WERTE_VORSCHLAEGE = ['Sicherheit', 'Freiheit', 'Familie', 'Anerkennung', 'Wachstum', 'Gesundheit', 'Kontrolle', 'Ehrlichkeit', 'Erfolg', 'Ruhe'];

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
    templates: null,
    template: null,
    running: {},      /* key -> { controller, statusIdx, chars, timer } */
    interviewIdx: {},  /* project.id -> aktuell angezeigte Fragen-Nr (1-basiert, > Anzahl = Zusammenfassung) */
    recording: null,   /* { recorder, stream, chunks, timer, seconds, feld } - aktuelle Sprachmemo-Aufnahme */
    freebieDesign: {}  /* asset.id -> { theme, akzent } waehrend der Bearbeitung im Asset-Panel */
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
    del: function (path) { return DB.request('DELETE', path); },
    /* Ruft eine Gateway-Aktion auf (z. B. upload_reference), statt des generischen
       PostgREST-Durchgangs. Body-Felder werden neben {uid, op} mitgeschickt. */
    op: function (op, extra) {
      var uid = STATE.profile ? STATE.profile.uid : '';
      var payload = Object.assign({ uid: uid, op: op }, extra || {});
      return fetch('/.netlify/functions/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
      });
    }
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
    if (route.name === 'project' || route.name === 'campaign' || route.name === 'kampagnen') {
      var pname = STATE.project ? avatarDisplayName(STATE.project) : '...';
      parts.push({ label: pname, href: '#/p/' + route.projectId });
    }
    if (route.name === 'kampagnen') {
      parts.push({ label: T.tabKampagnen, href: null });
    }
    if (route.name === 'campaign') {
      var cname = STATE.campaign ? STATE.campaign.name : '...';
      parts.push({ label: T.tabKampagnen, href: '#/p/' + route.projectId + '/kampagnen' });
      parts.push({ label: cname, href: null });
    }
    if (route.name === 'vorlagen' || route.name === 'vorlage-detail') {
      parts.push({ label: T.vorlagenNav, href: route.name === 'vorlagen' ? null : '#/vorlagen' });
    }
    if (route.name === 'vorlage-detail') {
      var tname = STATE.template ? STATE.template.name : '...';
      parts.push({ label: tname, href: null });
    }
    // Erste Ebene (Avatare/Vorlagen) steht schon als Hauptpunkt in der Leiste, deshalb nur die tieferen Ebenen zeigen.
    if (parts.length > 1) parts = parts.slice(1);
    else parts = [];
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
      else if (parts[2] === 'kampagnen') { route.name = 'kampagnen'; }
      else route.name = 'project';
    } else if (parts[0] === 'vorlagen') {
      if (parts[1]) { route.name = 'vorlage-detail'; route.templateId = parts[1]; }
      else route.name = 'vorlagen';
    }
    return route;
  }

  function setTab(tab) {
    var route = parseHash();
    location.hash = '#/p/' + route.projectId + (tab ? ('?tab=' + tab) : '');
  }

  function route() {
    var r = parseHash();
    updateNavActive(r);
    if (r.name === 'projects') { STATE.project = null; STATE.campaign = null; renderCrumbs(r); renderProjectsView(); return; }
    if (r.name === 'project') { renderProjectRoute(r); return; }
    if (r.name === 'kampagnen') { renderProjectKampagnenRoute(r); return; }
    if (r.name === 'campaign') { renderCampaignRoute(r); return; }
    if (r.name === 'vorlagen') { STATE.project = null; STATE.campaign = null; STATE.template = null; renderCrumbs(r); renderVorlagenView(); return; }
    if (r.name === 'vorlage-detail') { renderVorlagenDetailRoute(r); return; }
  }

  function updateNavActive(r) {
    var isVorlagen = r.name === 'vorlagen' || r.name === 'vorlage-detail';
    qsa('[data-nav]').forEach(function (el) {
      var on = (el.getAttribute('data-nav') === 'vorlagen') === isVorlagen;
      el.classList.toggle('dlm-nav-active', on);
    });
  }

  /* ------------------------------------------------------------------
     12) Ansicht: Avatare (SPEC §11.1)
     ------------------------------------------------------------------ */
  function statusChips(p) {
    var an = p.analyse_status === 'fertig' ? 'Analyse fertig' : (p.analyse_status === 'laeuft' ? 'Analyse laeuft' : 'Analyse offen');
    var anCls = p.analyse_status === 'fertig' ? 'dlm-chip-ok' : (p.analyse_status === 'laeuft' ? 'dlm-chip-warn' : '');
    var wn = arr(p.winkel_auswahl).length;
    return '<span class="dlm-chip ' + anCls + '">' + esc(an) + '</span>' +
      '<span class="dlm-chip">Winkel ' + wn + '/10</span>';
  }

  /* Avatar-Objekt (immer ein Objekt, nie null/undefined). */
  function avatarOf(p) { return (p && p.avatar && typeof p.avatar === 'object') ? p.avatar : {}; }
  function avatarDisplayName(p) { var a = avatarOf(p); return a.name || (p && p.name) || ''; }
  function avatarInitials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function avatarChosenImageUrl(p) {
    var a = avatarOf(p);
    var bilder = Array.isArray(a.bilder) ? a.bilder : [];
    var chosen = a.gewaehlt ? bilder.filter(function (b) { return b && b.stil === a.gewaehlt; })[0] : bilder[0];
    return chosen ? chosen.url : null;
  }
  function avatarPicHtml(p, size) {
    var url = avatarChosenImageUrl(p);
    var name = avatarDisplayName(p);
    if (url) return '<img class="dlm-avatar-pic" style="width:' + size + 'px;height:' + size + 'px;" src="' + esc(url) + '" alt="">';
    return '<span class="dlm-avatar-pic dlm-avatar-initials" style="width:' + size + 'px;height:' + size + 'px;">' + esc(avatarInitials(name)) + '</span>';
  }
  function kampagneBauenBtn(p, cls) {
    var enabled = arr(p.winkel_auswahl).length >= 5;
    var title = enabled ? '' : ' title="' + esc(T.kampagneBauenHint) + '"';
    return '<button type="button" class="dlp-btn dlp-primary ' + (cls || '') + '" data-action="go-kampagnen" data-id="' + esc(p.id) + '"' +
      (enabled ? '' : ' disabled') + title + '>' + esc(T.kampagneBauen) + '</button>';
  }

  function renderProjectsView() {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-head-row"><h1>' + esc(T.breadcrumbProjects) + '</h1>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button type="button" class="dlp-btn dlp-primary" data-action="new-project">' + esc(T.newProject) + '</button>' +
      '</div></div>' +
      '<div id="dlm-projects-grid" class="dlm-grid dlm-projects-grid"><div class="dlm-loading">Lädt...</div></div></div>';

    DB.get('me_projects?select=*&archiviert=eq.false&order=updated_at.desc').then(function (rows) {
      STATE.projects = rows || [];
      var grid = $('dlm-projects-grid');
      if (!grid) return;
      var newTile = '<div class="dlp-card dlm-project-card-new" data-action="new-project">' +
        '<span class="dlm-new-plus" aria-hidden="true">+</span><span>' + esc(T.newProject) + '</span></div>';
      if (!STATE.projects.length) {
        grid.innerHTML = '<div class="dlm-empty-block"><h3>' + esc(T.projectsEmpty) + '</h3>' +
          '<p>Leg deinen ersten Avatar an und starte mit dem Interview.</p>' +
          '<button type="button" class="dlp-btn dlp-primary" data-action="new-project">' + esc(T.newProject) + '</button></div>';
        return;
      }
      grid.innerHTML = STATE.projects.map(function (p) {
        var a = avatarOf(p);
        var berufZeile = [a.alter ? (a.alter + ' Jahre') : '', a.beruf || ''].filter(Boolean).join(' · ');
        return '<div class="dlp-card dlm-project-card dlm-avatar-card" data-open-project="' + esc(p.id) + '">' +
          '<div class="dlm-card-menu" data-menu="' + esc(p.id) + '">' +
          '<button type="button" class="dlm-icon-btn" data-action="project-menu" data-id="' + esc(p.id) + '" aria-label="Menü">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle></svg></button></div>' +
          '<div class="dlm-avatar-card-head">' + avatarPicHtml(p, 56) +
          '<div><h3 class="dlm-project-title"><span>' + esc(avatarDisplayName(p) || p.name) + '</span></h3>' +
          (berufZeile ? '<p class="dlm-muted dlm-small">' + esc(berufZeile) + '</p>' : '') +
          (a.motto ? '<p class="dlm-avatar-motto-mini">&raquo;' + esc(a.motto) + '&laquo;</p>' : '') + '</div></div>' +
          '<p class="dlm-muted dlm-branch-row dlm-small">' + esc([p.brief && p.brief.firma, p.brief && p.brief.branche].filter(Boolean).join(' · ') || 'Ohne Branche') + '</p>' +
          '<div class="dlm-chips">' + statusChips(p) + '<span class="dlm-chip">Kampagnen&nbsp;<span data-camp-count="' + esc(p.id) + '">...</span></span></div>' +
          '<p class="dlm-muted dlm-small">Zuletzt bearbeitet ' + esc(fmtDate(p.updated_at)) + '</p>' +
          '<div class="dlm-avatar-card-actions">' +
          '<a class="dlp-btn dlp-ghost" href="#/p/' + esc(p.id) + '">Öffnen</a>' +
          kampagneBauenBtn(p) +
          '</div></div>';
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
            DB.post('me_projects', { name: name, brief: {}, interview: { frage: 1, uebersprungen: [], fertig: false } }, 'return=representation').then(function (rows) {
              var p = rows && rows[0];
              if (p) location.hash = '#/p/' + p.id + '?tab=interview';
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
    var a = avatarOf(project);
    return {
      brief: true,
      zielgruppe: project.analyse_status === 'fertig',
      winkel: project.analyse_status === 'fertig',
      winkelDone: winkelCount >= 5,
      avatar: project.analyse_status === 'fertig',
      avatarDone: !!(a.name && avatarChosenImageUrl(project)),
      kampagnen: winkelCount >= 5
    };
  }

  /* Stepper im Avatar hat nach SPEC §11.1 nur noch 3 Schritte: Brief, Zielgruppe, Winkel.
     Kampagnen sind kein Stepper-Schritt mehr, sondern eine eigene Route (#/p/<id>/kampagnen),
     erreichbar ueber den Primaer-Button "Kampagne bauen". */
  function renderProjectRoute(r) {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-loading">Lädt...</div></div>';
    DB.get('me_projects?select=*&id=eq.' + r.projectId).then(function (rows) {
      var p = rows && rows[0];
      if (!p) { app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">Avatar nicht gefunden.</div></div>'; return; }
      STATE.project = p;
      resumeRunningJobs(p.id, null, function () { renderProjectRoute(parseHash()); });
      renderCrumbs(r);
      var tab = r.params.tab || 'brief';
      if (tab === 'interview') tab = 'brief';
      var st = tabStatus(p);
      if (tab === 'winkel' && !st.winkel) tab = 'brief';
      if (tab === 'avatar' && !st.avatar) tab = 'brief';

      app.innerHTML =
        '<div class="dlm-wrap">' +
        '<div class="dlm-head-row">' +
        '<div class="dlm-avatar-headline">' + avatarPicHtml(p, 48) + '<div><h1 class="dlm-title">' + esc(avatarDisplayName(p) || p.name) + '</h1>' +
        (avatarOf(p).motto ? '<p class="dlm-avatar-motto-mini">&raquo;' + esc(avatarOf(p).motto) + '&laquo;</p>' : '') + '</div></div>' +
        kampagneBauenBtn(p) +
        '</div>' +
        '<nav class="dlm-stepper" id="dlm-stepper">' +
        stepperTab(1, 'brief', T.tabBrief, true, true, tab, '') +
        stepperTab(2, 'zielgruppe', T.tabZielgruppe, true, st.zielgruppe, tab, '') +
        stepperTab(3, 'winkel', T.tabWinkel, st.winkel, st.winkelDone, tab, T.tabAvatarHint) +
        stepperTab(4, 'avatar', T.tabAvatar, st.avatar, st.avatarDone, tab, T.tabAvatarHint) +
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
      else if (tab === 'avatar') renderAvatarTab(body, p);
      else renderWinkelTab(body, p);
    }).catch(function () {
      app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">' + esc(T.genericError) + '</div></div>';
    });
  }

  /* Route #/p/<id>/kampagnen: eigene Seite mit der Kampagnenliste des Avatars
     (SPEC §11.1), ausserhalb des Steppers. */
  function renderProjectKampagnenRoute(r) {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-loading">Lädt...</div></div>';
    DB.get('me_projects?select=*&id=eq.' + r.projectId).then(function (rows) {
      var p = rows && rows[0];
      if (!p) { app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">Avatar nicht gefunden.</div></div>'; return; }
      STATE.project = p;
      renderCrumbs(r);
      app.innerHTML = '<div class="dlm-wrap">' +
        '<div class="dlm-head-row">' +
        '<div class="dlm-avatar-headline">' + avatarPicHtml(p, 48) + '<h1 class="dlm-title">' + esc(T.tabKampagnen) + ' · ' + esc(avatarDisplayName(p) || p.name) + '</h1></div>' +
        '<a class="dlp-btn dlp-ghost" href="#/p/' + esc(p.id) + '">Zum Avatar</a>' +
        '</div>' +
        '<div id="dlm-tab-body"></div></div>';
      renderKampagnenTab($('dlm-tab-body'), p);
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

  function briefFieldLabel(key) {
    var f = BRIEF_FIELDS.filter(function (x) { return x[0] === key; })[0];
    return f ? f[1] : key;
  }

  /* Tab Brief (SPEC §11.4): zeigt fuer Avatare mit interview.fertig das Formular,
     sonst das Interview-Onboarding. */
  function renderBriefTab(body, p) {
    var interview = p.interview || {};
    if (interview.fertig) renderBriefForm(body, p);
    else renderInterviewFlow(body, p);
  }

  function renderBriefForm(body, p) {
    var brief = p.brief || {};
    var interview = p.interview || {};
    var uebersprungen = arr(interview.uebersprungen);
    var html = '<div class="dlm-toolbar">' +
      '<button type="button" class="dlm-text-btn" data-action="restart-interview" data-id="' + esc(p.id) + '">' + esc(T.briefRestartInterview) + '</button>' +
      '</div>';
    if (uebersprungen.length) {
      html += '<div class="dlm-chips" style="margin-bottom:14px;">' + uebersprungen.map(function (feld) {
        return '<button type="button" class="dlm-chip dlm-chip-warn dlm-skip-chip" data-action="jump-interview" data-id="' + esc(p.id) + '" data-feld="' + esc(feld) + '">' +
          esc(T.laterAnswered) + ': ' + esc(briefFieldLabel(feld)) + '</button>';
      }).join('') + '</div>';
    }
    html += '<form id="dlm-brief-form" class="dlm-form">';
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

  /* ------------------------------------------------------------------
     13b) Interview-Onboarding (SPEC §11.4)
     ------------------------------------------------------------------ */
  function interviewCurrentIdx(p) {
    if (typeof STATE.interviewIdx[p.id] === 'number') return STATE.interviewIdx[p.id];
    var fromSrv = (p.interview && p.interview.frage) || 1;
    return Math.max(1, Math.min(fromSrv, INTERVIEW_QUESTIONS.length + 1));
  }
  function interviewSetIdx(p, idx) {
    STATE.interviewIdx[p.id] = idx;
  }

  function stopRecording(discard) {
    var rec = STATE.recording;
    if (!rec) return;
    STATE.recording = null;
    if (rec.timer) clearInterval(rec.timer);
    try { if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop(); } catch (e) {}
    if (rec.stream) rec.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e2) {} });
    if (discard) rec._discard = true;
  }

  function renderInterviewFlow(body, p) {
    var idx = interviewCurrentIdx(p);
    if (idx > INTERVIEW_QUESTIONS.length) { renderInterviewSummary(body, p); return; }
    var q = INTERVIEW_QUESTIONS[idx - 1];
    var brief = p.brief || {};
    var val = brief[q.feld] || '';
    var total = INTERVIEW_QUESTIONS.length;
    var pct = Math.round(((idx - 1) / total) * 100);
    var micSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

    var html = '<div class="dlm-interview">' +
      '<p class="dlm-interview-progress-label">' + esc(T.interviewFrageVon.replace('{n}', idx).replace('{gesamt}', total)) + '</p>' +
      '<div class="dlm-progress-bar"><div class="dlm-progress-fill" style="width:' + pct + '%;animation:none;"></div></div>' +
      '<h2 class="dlm-interview-frage">' + esc(q.frage) + '</h2>';

    if (q.type === 'chips') {
      html += '<div class="dlm-chips dlm-interview-chips" id="dlm-interview-chips">' + q.options.map(function (o) {
        return '<button type="button" class="dlm-chip dlm-filter-chip' + (val === o[0] ? ' dlm-chip-active' : '') + '" data-chip-val="' + esc(o[0]) + '">' + esc(o[1]) + '</button>';
      }).join('') + '</div><input type="hidden" id="dlm-interview-input" value="' + esc(val) + '">';
    } else {
      html += '<textarea id="dlm-interview-input" rows="' + (q.type === 'textarea' ? 6 : 2) + '" maxlength="4000" placeholder="Antwort eingeben...">' + esc(val) + '</textarea>';
      if (micSupported) {
        html += '<div class="dlm-interview-mic">' +
          '<button type="button" class="dlp-btn dlp-ghost" id="dlm-mic-btn" data-action="mic-toggle">' + esc(T.interviewMicStart) + '</button>' +
          '<span id="dlm-mic-status" class="dlm-small"></span></div>';
      }
    }

    html += '<div class="dlm-interview-actions">' +
      (idx > 1 ? '<button type="button" class="dlp-btn dlp-ghost" data-action="interview-back">' + esc(T.interviewZurueck) + '</button>' : '<span></span>') +
      '<span style="flex:1 1 auto;"></span>' +
      (q.optional ? '<button type="button" class="dlp-btn dlp-ghost" data-action="interview-skip">' + esc(T.laterAnswered) + '</button>' : '') +
      '<button type="button" class="dlp-btn dlp-primary" data-action="interview-next">' + esc(T.interviewWeiter) + '</button>' +
      '</div></div>';
    body.innerHTML = html;

    if (q.type === 'chips') {
      qsa('#dlm-interview-chips [data-chip-val]', body).forEach(function (btn) {
        btn.addEventListener('click', function () {
          qsa('#dlm-interview-chips .dlm-chip', body).forEach(function (b) { b.classList.remove('dlm-chip-active'); });
          btn.classList.add('dlm-chip-active');
          $('dlm-interview-input').value = btn.getAttribute('data-chip-val');
        });
      });
    }

    var micBtn = $('dlm-mic-btn');
    if (micBtn) micBtn.addEventListener('click', function () { interviewMicToggle(p, q); });

    qs('[data-action="interview-back"]', body) && qs('[data-action="interview-back"]', body).addEventListener('click', function () {
      stopRecording(true);
      interviewSetIdx(p, Math.max(1, idx - 1));
      renderBriefTab(body, p);
    });
    qs('[data-action="interview-skip"]', body) && qs('[data-action="interview-skip"]', body).addEventListener('click', function () {
      stopRecording(true);
      var interview = Object.assign({ frage: 1, uebersprungen: [] }, p.interview);
      var skip = arr(interview.uebersprungen).slice();
      if (skip.indexOf(q.feld) === -1) skip.push(q.feld);
      interview.uebersprungen = skip;
      interview.frage = idx + 1;
      interview.fertig = idx + 1 > total;
      DB.patch('me_projects?id=eq.' + p.id, { interview: interview }).then(function () {
        p.interview = interview;
        interviewSetIdx(p, idx + 1);
        renderBriefTab(body, p);
      });
    });
    qs('[data-action="interview-next"]', body).addEventListener('click', function () {
      stopRecording(true);
      var inputEl = $('dlm-interview-input');
      var value = inputEl ? inputEl.value.trim() : '';
      if (!q.optional && !value) { toast(T.interviewPflicht); return; }
      var brief2 = Object.assign({}, p.brief);
      brief2[q.feld] = value;
      var interview = Object.assign({ frage: 1, uebersprungen: [] }, p.interview);
      var skip = arr(interview.uebersprungen).filter(function (f) { return f !== q.feld; });
      interview.uebersprungen = skip;
      interview.frage = idx + 1;
      interview.fertig = idx + 1 > total;
      DB.patch('me_projects?id=eq.' + p.id, { brief: brief2, interview: interview }).then(function () {
        p.brief = brief2;
        p.interview = interview;
        interviewSetIdx(p, idx + 1);
        renderBriefTab(body, p);
      });
    });
  }

  function interviewMicToggle(p, q) {
    var btn = $('dlm-mic-btn');
    var status = $('dlm-mic-status');
    if (STATE.recording) { stopRecording(); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var mime = (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
        ? 'audio/webm;codecs=opus' : 'audio/mp4';
      var recorder;
      try { recorder = new MediaRecorder(stream, { mimeType: mime }); } catch (e) { recorder = new MediaRecorder(stream); mime = recorder.mimeType || mime; }
      var chunks = [];
      var seconds = 0;
      var rec = { recorder: recorder, stream: stream, chunks: chunks, seconds: 0, _discard: false };
      STATE.recording = rec;
      recorder.addEventListener('dataavailable', function (e) { if (e.data && e.data.size) chunks.push(e.data); });
      recorder.addEventListener('stop', function () {
        stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e2) {} });
        if (rec._discard || !chunks.length) return;
        var blob = new Blob(chunks, { type: mime.split(';')[0] });
        transcribeBlob(blob, mime);
      });
      recorder.start();
      if (btn) { btn.textContent = T.interviewMicStop; btn.classList.add('dlm-mic-recording'); }
      rec.timer = setInterval(function () {
        rec.seconds += 1;
        if (status) status.textContent = rec.seconds + ' s';
        if (rec.seconds >= 90) stopRecording();
      }, 1000);
    }).catch(function () {
      toast(T.interviewMicUnavailable);
      if (btn) btn.hidden = true;
    });
  }

  function transcribeBlob(blob, mime) {
    var status = $('dlm-mic-status');
    var btn = $('dlm-mic-btn');
    if (btn) { btn.textContent = T.interviewMicStart; btn.classList.remove('dlm-mic-recording'); btn.disabled = true; }
    if (status) status.textContent = T.interviewTranscribing;
    var ext = mime.indexOf('mp4') !== -1 ? 'mp4' : 'webm';
    var fd = new FormData();
    fd.append('file', blob, 'memo.' + ext);
    fd.append('uid', STATE.profile ? STATE.profile.uid : '');
    fetch('/.netlify/functions/transcribe', { method: 'POST', body: fd }).then(function (r) { return r.json(); }).then(function (res) {
      if (btn) btn.disabled = false;
      if (status) status.textContent = '';
      var text = res && res.text ? String(res.text) : '';
      if (!text) { toast(T.genericError); return; }
      var inputEl = $('dlm-interview-input');
      if (inputEl) inputEl.value = (inputEl.value ? inputEl.value.trim() + '\n' : '') + text;
    }).catch(function () {
      if (btn) btn.disabled = false;
      if (status) status.textContent = '';
      toast(T.genericError);
    });
  }

  function renderInterviewSummary(body, p) {
    var interview = Object.assign({ frage: INTERVIEW_QUESTIONS.length + 1, uebersprungen: [] }, p.interview);
    if (!interview.fertig) {
      interview.fertig = true;
      DB.patch('me_projects?id=eq.' + p.id, { interview: interview }).then(function () { p.interview = interview; });
    }
    var brief = p.brief || {};
    var html = '<div class="dlm-interview-summary">' +
      '<h2 class="dlm-interview-frage">' + esc(T.interviewSummaryTitle) + '</h2>' +
      '<p class="dlm-muted">' + esc(T.interviewSummaryText) + '</p>' +
      '<form id="dlm-brief-form" class="dlm-form">';
    BRIEF_FIELDS.forEach(function (f) {
      var key = f[0], label = f[1], type = f[2], optional = f[3], opts = f[4];
      var val = brief[key] || '';
      html += '<label class="dlm-field"><span>' + esc(label) + (optional ? ' <em>(optional)</em>' : '') + '</span>';
      if (type === 'textarea') html += '<textarea name="' + key + '" rows="3" maxlength="4000">' + esc(val) + '</textarea>';
      else if (type === 'select') {
        html += '<select name="' + key + '"><option value="">Bitte wählen</option>' +
          opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
      } else html += '<input type="text" name="' + key + '" value="' + esc(val) + '" maxlength="200">';
      html += '</label>';
    });
    html += '</form>' +
      '<div class="dlm-interview-actions"><span style="flex:1 1 auto;"></span>' +
      '<button type="button" class="dlp-btn dlp-primary dlp-lg" data-action="interview-start-analyse" data-id="' + esc(p.id) + '">' + esc(T.interviewStartAnalyse) + '</button>' +
      '</div></div>';
    body.innerHTML = html;

    var form = $('dlm-brief-form');
    var save = debounce(function () {
      var brief2 = {};
      BRIEF_FIELDS.forEach(function (f) { var el = form.elements[f[0]]; if (el) brief2[f[0]] = el.value; });
      DB.patch('me_projects?id=eq.' + p.id, { brief: brief2 }).then(function () { p.brief = brief2; });
    }, 800);
    form.addEventListener('input', save);
    form.addEventListener('change', save);
  }

  /* --- Zielgruppe --------------------------------------------------- */
  /* Kompakte Avatar-Zeile im Tab Zielgruppe (der grosse Bild-/Profil-Bereich
     ist in den eigenen Schritt "Avatar" umgezogen, siehe renderAvatarTab). */
  function renderAvatarZeile(p) {
    var a = avatarOf(p);
    var berufZeile = [a.alter ? (a.alter + ' Jahre') : '', a.beruf || ''].filter(Boolean).join(' · ');
    return '<div class="dlm-avatar-zeile">' + avatarPicHtml(p, 48) +
      '<div class="dlm-avatar-zeile-info"><strong>' + esc(a.name || T.avatarZeileOhneName) + '</strong>' +
      (berufZeile ? '<span class="dlm-muted dlm-small">' + esc(berufZeile) + '</span>' : '') + '</div>' +
      '<a class="dlp-btn dlp-ghost" href="#/p/' + esc(p.id) + '?tab=avatar">' + esc(T.avatarAusgestalten) + '</a>' +
      '</div>';
  }

  /* --- Avatar (Bild-Bereich, aus dem Tab Zielgruppe hierher verschoben) --- */
  function avatarSlotHtml(p, a, stil, label) {
    var bilder = Array.isArray(a.bilder) ? a.bilder : [];
    var eintrag = bilder.filter(function (b) { return b && b.stil === stil; })[0];
    var running = !!STATE.running['avatar-' + p.id + '-' + stil];
    var chosen = a.gewaehlt === stil;
    return '<div class="dlm-avatar-slot' + (chosen ? ' dlm-avatar-slot-chosen' : '') + '">' +
      (running
        ? '<div class="dlm-avatar-slot-ph">' + esc(T.avatarBildLaeuft) + '</div>'
        : (eintrag && eintrag.url
          ? '<button type="button" class="dlm-avatar-slot-img" data-action="choose-avatar-bild" data-stil="' + esc(stil) + '"><img src="' + esc(eintrag.url) + '" alt=""></button>'
          : '<div class="dlm-avatar-slot-ph">' + esc(label) + '</div>')) +
      '<div class="dlm-avatar-slot-foot"><span class="dlm-small">' + esc(label) + (chosen ? ' · gewählt' : '') + '</span>' +
      (!running ? '<button type="button" class="dlm-text-btn" data-action="gen-avatar-bild" data-stil="' + esc(stil) + '">' + esc(T.avatarBildErzeugen) + '</button>' : '') +
      '</div></div>';
  }

  /* Linke Spalte des Tabs Avatar: grosses gewaehltes Bild plus die drei Stil-Slots. */
  function renderAvatarBildSpalte(p) {
    var a = avatarOf(p);
    var html = '<div class="dlm-avatar-bildspalte">' +
      '<div class="dlm-avatar-big-pic">' + avatarPicHtml(p, 260) + '</div>';
    var hatGrundlage = a.bild_prompt || a.alter || a.beruf || a.aussehen;
    if (!hatGrundlage) {
      html += '<p class="dlm-muted dlm-small">' + esc(T.avatarBildHinweisLeer) + '</p>';
    } else {
      html += '<div class="dlm-avatar-slots">' + AVATAR_STILE.map(function (s) { return avatarSlotHtml(p, a, s[0], s[1]); }).join('') + '</div>' +
        '<div class="dlm-toolbar"><button type="button" class="dlp-btn dlp-ghost" data-action="gen-avatar-bild-all">' + esc(T.avatarBilderAlle) + '</button></div>';
    }
    html += '</div>';
    return html;
  }

  /* Kuerzt einen Punkt-Text auf hoechstens n Woerter (fuer Werte-Vorschlaege aus der Analyse). */
  function truncateWords(str, n) {
    var words = String(str || '').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, n).join(' ');
  }

  function werteChipsHtml(werte) {
    return werte.map(function (w, i) {
      return '<span class="dlm-chip dlm-chip-removable">' + esc(w) +
        '<button type="button" class="dlm-chip-x" data-werte-remove="' + i + '" aria-label="Entfernen">&times;</button></span>';
    }).join('');
  }

  /* Avatar-Visitenkarte (SPEC-Wunsch Schritt 4): Vorschau-Karte am Ende des Tabs, wird nach
     jedem Autosave neu gerendert (refreshAvatarVisitenkarte), ohne das Formular neu aufzubauen. */
  function renderAvatarVisitenkarte(p) {
    var a = avatarOf(p);
    var berufZeile = [a.alter ? (a.alter + ' Jahre') : '', a.beruf || ''].filter(Boolean).join(' · ');
    return '<div class="dlm-avatar-visitenkarte" id="dlm-avatar-visitenkarte">' +
      '<h3 class="dlm-subtitle" style="margin-top:0;">' + esc(T.avatarVisitenkarteTitel) + '</h3>' +
      '<div class="dlm-avatar-visitenkarte-head">' + avatarPicHtml(p, 72) +
      '<div><h3 class="dlm-title" style="margin:0;">' + esc(a.name || p.name) + '</h3>' +
      (berufZeile ? '<p class="dlm-muted">' + esc(berufZeile) + '</p>' : '') +
      (a.motto ? '<p class="dlm-avatar-motto">&raquo;' + esc(a.motto) + '&laquo;</p>' : '') +
      '</div></div>' +
      (arr(a.werte).length ? '<div class="dlm-chips">' + arr(a.werte).map(function (w) { return '<span class="dlm-chip">' + esc(w) + '</span>'; }).join('') + '</div>' : '') +
      (a.kurzbeschreibung ? '<p class="dlm-avatar-kurz">' + esc(a.kurzbeschreibung) + '</p>' : '') +
      '<div class="dlm-toolbar dlm-avatar-visitenkarte-actions">' + kampagneBauenBtn(p) + '</div>' +
      '</div>';
  }
  function refreshAvatarVisitenkarte(p) {
    var el = $('dlm-avatar-visitenkarte');
    if (el) el.outerHTML = renderAvatarVisitenkarte(p);
  }

  /* Liest die aktuellen Formularwerte plus das lokale Werte-Array. */
  function avatarFormValues(form, werte) {
    return {
      name: form.elements.name.value.trim(),
      alter: form.elements.alter.value ? Number(form.elements.alter.value) : null,
      beruf: form.elements.beruf.value.trim(),
      kurzbeschreibung: form.elements.kurzbeschreibung.value,
      werte: werte.slice(),
      ziele: form.elements.ziele.value,
      sorge: form.elements.sorge.value,
      aussehen: form.elements.aussehen.value,
      motto: form.elements.motto.value.trim()
    };
  }

  /* Autosave des Profil-Formulars (SPEC-Wunsch Schritt 4): Avatar-Objekt vorher frisch aus der
     DB laden und mergen, damit gerade erzeugte Bilder (bilder/gewaehlt/bild_prompt) nicht durch
     ein PATCH aus einem aelteren Formularstand ueberschrieben werden. */
  function saveAvatarForm(p, form, werte, hintEl) {
    var fields = avatarFormValues(form, werte);
    DB.get('me_projects?select=id,avatar&id=eq.' + p.id).then(function (rows) {
      var fresh = rows && rows[0];
      var freshAvatar = fresh ? avatarOf(fresh) : avatarOf(p);
      var merged = Object.assign({}, freshAvatar, fields);
      return DB.patch('me_projects?id=eq.' + p.id, { avatar: merged }).then(function () {
        p.avatar = merged;
        if (STATE.project && STATE.project.id === p.id) STATE.project.avatar = merged;
        if (hintEl) hintEl.textContent = T.avatarGespeichert + ' ' + new Date().toLocaleTimeString('de-DE');
        refreshAvatarVisitenkarte(p);
      });
    }).catch(function () { toast(T.genericError); });
  }

  function wireAvatarForm(body, p) {
    var form = $('dlm-avatar-form');
    if (!form) return;
    var werte = arr(avatarOf(p).werte).slice();
    var hint = $('dlm-avatar-savehint');
    var debouncedSave = debounce(function () { saveAvatarForm(p, form, werte, hint); }, 800);

    function rerenderChips() {
      var box = $('dlm-avatar-werte-chips');
      if (box) box.innerHTML = werteChipsHtml(werte);
    }
    function chipExists(val) {
      return werte.map(function (w) { return w.toLowerCase(); }).indexOf(val.toLowerCase()) !== -1;
    }

    form.addEventListener('input', debouncedSave);
    form.addEventListener('change', debouncedSave);
    /* Verhindert ein Absenden des Formulars, wenn im Werte-Chip-Feld Enter gedrueckt wird. */
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    var werteInput = $('dlm-avatar-werte-input');
    if (werteInput) {
      werteInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          var val = werteInput.value.replace(/,$/, '').trim();
          werteInput.value = '';
          if (val && !chipExists(val)) { werte.push(val); rerenderChips(); debouncedSave(); }
        }
      });
    }
    var chipsBox = $('dlm-avatar-werte-chips');
    if (chipsBox) {
      chipsBox.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-werte-remove]');
        if (!btn) return;
        werte.splice(Number(btn.getAttribute('data-werte-remove')), 1);
        rerenderChips();
        debouncedSave();
      });
    }
    qsa('[data-werte-vorschlag]', body).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var val = btn.getAttribute('data-werte-vorschlag');
        if (!chipExists(val)) { werte.push(val); rerenderChips(); debouncedSave(); }
      });
    });

    var uebBtn = $('dlm-avatar-uebernehmen');
    if (uebBtn) {
      uebBtn.addEventListener('click', function () {
        var analyse = p.analyse || {};
        var hinZuPunkte = arr(analyse.hin_zu && analyse.hin_zu.punkte);
        var wegVonPunkte = arr(analyse.weg_von && analyse.weg_von.punkte);
        var lf8Punkte = arr(analyse.life_force_8 && analyse.life_force_8.punkte);
        lf8Punkte.slice(0, 4).map(function (t) { return truncateWords(t, 4); }).filter(Boolean).forEach(function (w) {
          if (!chipExists(w)) werte.push(w);
        });
        rerenderChips();
        if (!form.elements.ziele.value.trim() && hinZuPunkte.length) form.elements.ziele.value = hinZuPunkte.slice(0, 3).join('. ');
        if (!form.elements.sorge.value.trim() && wegVonPunkte[0]) form.elements.sorge.value = wegVonPunkte[0];
        uebBtn.hidden = true;
        debouncedSave();
      });
    }
  }

  /* Tab Avatar (SPEC-Wunsch Schritt 4): links Bild-Bereich, rechts Profil-Formular,
     unten die Avatar-Visitenkarte. Zweispaltig auf Desktop, per CSS untereinander auf Mobil. */
  function renderAvatarTab(body, p) {
    var a = avatarOf(p);
    var werte = arr(a.werte);

    var html = '<div class="dlm-avatar-tab-grid">' +
      renderAvatarBildSpalte(p) +
      '<div class="dlm-avatar-profilspalte">';
    if (!werte.length && p.analyse) {
      html += '<div class="dlm-toolbar"><button type="button" class="dlp-btn dlp-ghost" id="dlm-avatar-uebernehmen">' + esc(T.avatarUebernehmen) + '</button></div>';
    }
    html += '<form id="dlm-avatar-form" class="dlm-form dlm-avatar-form">' +
      '<label class="dlm-field"><span>' + esc(T.avatarLabelName) + '</span><input type="text" name="name" value="' + esc(a.name || '') + '" maxlength="120"></label>' +
      '<label class="dlm-field"><span>' + esc(T.avatarLabelAlter) + '</span><input type="number" name="alter" min="0" max="120" value="' + esc(a.alter || '') + '"></label>' +
      '<label class="dlm-field"><span>' + esc(T.avatarLabelBeruf) + '</span><input type="text" name="beruf" value="' + esc(a.beruf || '') + '" maxlength="160"></label>' +
      '<label class="dlm-field dlm-field-wide"><span>' + esc(T.avatarLabelKurz) + '</span><textarea name="kurzbeschreibung" rows="3" maxlength="600">' + esc(a.kurzbeschreibung || '') + '</textarea></label>' +
      /* Bewusst ein <div> statt <label>: ein <label> mit mehreren verschachtelten
         Buttons (Chips entfernen, Vorschlaege) wuerde bei jedem Klick zusaetzlich
         einen synthetischen Klick an sein erstes labelfaehiges Kind weiterreichen
         (Browser-Label-Aktivierungsverhalten) und so versehentlich einen zweiten
         Chip entfernen. */
      '<div class="dlm-field dlm-field-wide"><span>' + esc(T.avatarLabelWerte) + '</span>' +
      '<div class="dlm-chip-input">' +
      '<div class="dlm-chips" id="dlm-avatar-werte-chips">' + werteChipsHtml(werte) + '</div>' +
      '<input type="text" id="dlm-avatar-werte-input" placeholder="' + esc(T.avatarWertePh) + '" maxlength="40">' +
      '</div>' +
      '<div class="dlm-chips dlm-chips-vorschlaege">' + AVATAR_WERTE_VORSCHLAEGE.map(function (w) {
        return '<button type="button" class="dlm-chip dlm-filter-chip" data-werte-vorschlag="' + esc(w) + '">' + esc(w) + '</button>';
      }).join('') + '</div></div>' +
      '<label class="dlm-field dlm-field-wide"><span>' + esc(T.avatarLabelZiele) + '</span><textarea name="ziele" rows="3" maxlength="1000" placeholder="' + esc(T.avatarZielePh) + '">' + esc(a.ziele || '') + '</textarea></label>' +
      '<label class="dlm-field dlm-field-wide"><span>' + esc(T.avatarLabelSorge) + '</span><textarea name="sorge" rows="3" maxlength="1000">' + esc(a.sorge || '') + '</textarea></label>' +
      '<label class="dlm-field dlm-field-wide"><span>' + esc(T.avatarLabelAussehen) + '</span><textarea name="aussehen" rows="3" maxlength="1000" placeholder="' + esc(T.avatarAussehenPh) + '">' + esc(a.aussehen || '') + '</textarea></label>' +
      '<label class="dlm-field"><span>' + esc(T.avatarLabelMotto) + '</span><input type="text" name="motto" value="' + esc(a.motto || '') + '" maxlength="200"></label>' +
      '<p class="dlm-save-hint dlm-field-wide" id="dlm-avatar-savehint">&nbsp;</p>' +
      '</form></div></div>';

    html += renderAvatarVisitenkarte(p);
    body.innerHTML = html;
    wireAvatarForm(body, p);
  }

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
    var html = renderAvatarZeile(p);
    html += '<div class="dlm-toolbar">' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="refine-analyse" data-id="' + esc(p.id) + '">' + esc(T.zielgruppeRefine) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="redo-analyse" data-id="' + esc(p.id) + '">' + esc(T.zielgruppeRedo) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="export-analyse" data-id="' + esc(p.id) + '">' + esc(T.zielgruppeExport) + '</button>' +
      '</div>';
    html += '<nav class="dlm-jumpbar" id="dlm-jumpbar">' + ANALYSE_AREAS.map(function (area) {
      return '<a class="dlm-chip dlm-jump-chip" href="#dlm-area-' + area.key + '">' + esc(area.label) + '</a>';
    }).join('') + '</nav>';

    var catIndex = 0;
    ANALYSE_AREAS.forEach(function (area) {
      html += '<h2 class="dlm-subtitle dlm-area-heading" id="dlm-area-' + area.key + '">' + esc(area.label) + '</h2>';
      html += '<div class="dlm-accordion">';
      area.cats.forEach(function (key) {
        var fallbackTitle = (ANALYSE_CATS.filter(function (c) { return c[0] === key; })[0] || [key, key])[1];
        var cat = analyse[key] || {};
        var katTitel = (cat.titel && String(cat.titel).replace(/_/g, ' ').toLowerCase() !== key.replace(/_/g, ' ') && String(cat.titel).length > 3) ? cat.titel : fallbackTitle;
        var open = catIndex < 2;
        catIndex++;
        var num = String(catIndex); if (num.length < 2) num = '0' + num;
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
    });
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
    if (kind === 'decode') return T.vorlagenDecoding;
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
    if (job.task === 'decode') return 'decode';
    if (job.task === 'asset') return 'asset-' + job.typ;
    return job.task;
  }
  function runningKeyFromJob(job) {
    var kind = progressKindFromJob(job);
    if (kind === 'analyse') return 'analyse-' + job.project_id;
    if (kind === 'winkel') return 'winkel-' + job.project_id;
    if (kind === 'konsistenz') return 'konsistenz-' + job.campaign_id;
    if (kind === 'decode') return 'decode-' + job.template_id;
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
        var was = job.task === 'winkel' ? 'Winkel' : job.task === 'konsistenz' ? 'Konsistenz-Check' : job.task === 'asset' ? assetLabel(job.typ) : job.task === 'decode' ? 'Creative-Decoder' : 'Zielgruppenanalyse';
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
  function winkelHasOldFields(w) {
    return !!(w.hook_beispiel || w.warum_wirkt || w.bezug || w.risiko || w.treiber || (Array.isArray(w.formate) && w.formate.length));
  }
  function winkelCardHtml(w, checked) {
    var kurz = w.kurz || w.kernbotschaft || '';
    var hasOld = winkelHasOldFields(w);
    return '<div class="dlm-winkel-card' + (checked ? ' dlm-winkel-checked' : '') + '" data-winkel-id="' + esc(w.id) + '">' +
      '<label class="dlm-winkel-check"><input type="checkbox" data-action="toggle-winkel" data-id="' + esc(w.id) + '"' + (checked ? ' checked' : '') + '>' +
      '<span></span></label>' +
      '<div class="dlm-winkel-main">' +
      '<h4>' + esc(w.titel || 'Ohne Titel') + '</h4>' +
      '<p class="dlm-muted">' + esc(kurz) + '</p>' +
      '<div class="dlm-chips">' +
      (w.typ ? '<span class="dlm-chip">' + esc(TYP_LABEL[w.typ] || w.typ) + '</span>' : '') +
      (w.treiber ? '<span class="dlm-chip">' + esc(w.treiber) + '</span>' : '') +
      (Array.isArray(w.formate) ? w.formate.map(function (f) { return '<span class="dlm-chip">' + esc(f) + '</span>'; }).join('') : '') +
      '</div>' +
      (hasOld ? (
        '<button type="button" class="dlm-text-btn" data-action="toggle-winkel-detail" data-id="' + esc(w.id) + '">Details</button>' +
        '<div class="dlm-winkel-detail" hidden>' +
        (w.hook_beispiel ? '<p><strong>Hook-Beispiel:</strong> ' + esc(w.hook_beispiel) + '</p>' : '') +
        (w.warum_wirkt ? '<p><strong>Warum wirkt:</strong> ' + esc(w.warum_wirkt) + '</p>' : '') +
        (w.bezug ? '<p><strong>Bezug:</strong> ' + esc(w.bezug) + '</p>' : '') +
        (w.risiko ? '<p><strong>Risiko:</strong> ' + esc(w.risiko) + '</p>' : '') +
        '</div>'
      ) : '') +
      '</div></div>';
  }

  /* Winkel-Ansicht gruppiert nach 5 Awareness-Stufen (SPEC §11.5). */
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

    var byAwareness = {};
    winkel.forEach(function (w) {
      var key = w.awareness || 'unbewusst';
      (byAwareness[key] = byAwareness[key] || []).push(w);
    });

    var html = '<div class="dlm-sticky-counter ' + countCls + '">' + count + ' von 5 bis 10 ' + esc(countText) + '</div>';
    AWARENESS.forEach(function (a) {
      var key = a[0], label = a[1];
      var list = byAwareness[key] || [];
      if (!list.length) return;
      var stageRunning = !!STATE.running['winkel-' + p.id + '-' + key];
      html += '<section class="dlm-awareness-group">' +
        '<h3 class="dlm-awareness-heading">' + esc(label) + '</h3>' +
        '<p class="dlm-muted dlm-awareness-info">' + esc(AWARENESS_INFO[key] || '') + '</p>' +
        '<div class="dlm-winkel-list">' + list.map(function (w) { return winkelCardHtml(w, auswahl.indexOf(w.id) !== -1); }).join('') + '</div>' +
        (stageRunning ? progressCardHtml('winkel') : '<div class="dlm-toolbar"><button type="button" class="dlp-btn dlp-ghost dlm-small-btn" data-action="run-winkel-more" data-id="' + esc(p.id) + '" data-awareness="' + esc(key) + '">' + esc(T.winkelMoreStufe) + '</button></div>') +
        '</section>';
    });
    body.innerHTML = html;
  }

  function runWinkel(id, mehr, awareness) {
    var key = mehr ? ('winkel-' + id + '-' + awareness) : ('winkel-' + id);
    STATE.running[key] = { pending: true };
    renderProjectRoute(parseHash());
    var payload = { uid: STATE.profile.uid, task: 'winkel', project_id: id, mehr: !!mehr };
    if (mehr) payload.awareness = awareness;
    var run = AI.run(payload, {
      onProgress: function (job) { updateProgressChars('winkel', job.chars || 0); }
    });
    STATE.running[key] = { cancel: run.cancel };
    startProgressRotation('winkel');
    run.promise.then(function () {
      delete STATE.running[key];
      stopProgressRotation('winkel');
      renderProjectRoute(parseHash());
    }).catch(function (err) {
      delete STATE.running[key];
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
      var openedAsset = assets.filter(function (a) { return a.id === STATE.openAssetId; })[0];
      if (openedAsset && openedAsset.template_id) {
        DB.get('me_templates?select=id,name&id=eq.' + openedAsset.template_id).then(function (rows) {
          var tpl = rows && rows[0];
          var chip = $('dlm-asset-vorlage-chip');
          if (chip && tpl) chip.textContent = 'Nach Vorlage: ' + (tpl.name || 'Vorlage');
        }).catch(function () {});
      }
      if (openedAsset && openedAsset.typ === 'leadmagnet' && openedAsset.status === 'fertig' && openedAsset.content) {
        wireFreebieDesigner(openedAsset, p, c);
      }
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
      '<label class="dlm-field"><span>' + esc(T.assetFocusWinkel) + '</span><select id="dlm-gen-winkel"><option value="">Über alle Winkel verteilen</option>' + winkelOpts + '</select></label>' +
      (typ === 'creative'
        ? '<div class="dlm-vorlage-field"><label class="dlm-field"><span>' + esc(T.assetVorlage) + '</span>' +
          '<select id="dlm-gen-vorlage"><option value="">' + esc(T.assetVorlageNone) + '</option></select></label>' +
          '<div class="dlm-vorlage-preview" id="dlm-gen-vorlage-preview" hidden></div></div>'
        : '') +
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
            var vorlageSel = qs('#dlm-gen-vorlage', wrap);
            startAssetGeneration(typ, winkelId, hint, vorlageSel ? vorlageSel.value : '');
          }
        }
      ]
    });
    if (typ === 'creative') {
      DB.get('me_templates?select=id,name,bild_url,status&status=eq.fertig&order=updated_at.desc').then(function (rows) {
        var sel = qs('#dlm-gen-vorlage', body);
        if (!sel) return;
        arr(rows).forEach(function (t) {
          var opt = document.createElement('option');
          opt.value = t.id; opt.textContent = t.name || 'Vorlage';
          sel.appendChild(opt);
        });
        sel.addEventListener('change', function () {
          var t = arr(rows).filter(function (x) { return x.id === sel.value; })[0];
          var prev = qs('#dlm-gen-vorlage-preview', body);
          if (!prev) return;
          if (t) { prev.hidden = false; prev.innerHTML = '<img src="' + esc(t.bild_url) + '" alt="">' + '<span>' + esc(t.name || 'Vorlage') + '</span>'; }
          else { prev.hidden = true; prev.innerHTML = ''; }
        });
      }).catch(function () {});
    }
  }

  function startAssetGeneration(typ, winkelId, hint, templateId) {
    var c = STATE.campaign, p = STATE.project;
    var assetBody = { project_id: p.id, campaign_id: c.id, typ: typ, status: 'laeuft', winkel_id: winkelId || null };
    if (templateId) assetBody.template_id = templateId;
    DB.post('me_assets', assetBody, 'return=representation').then(function (rows) {
      var asset = rows && rows[0];
      STATE.running['asset-' + c.id + '-' + typ] = { assetId: asset ? asset.id : null };
      renderCampaignRoute(parseHash());
      var payload = { uid: STATE.profile.uid, task: 'asset', project_id: p.id, campaign_id: c.id, asset_id: asset ? asset.id : undefined, typ: typ, winkel_id: winkelId || undefined, hinweis: hint || undefined };
      if (templateId) payload.template_id = templateId;
      var run = AI.run(payload, {
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
    var vorlageChip = asset.template_id
      ? '<a class="dlm-vorlage-chip" id="dlm-asset-vorlage-chip" href="#/vorlagen/' + esc(asset.template_id) + '">Nach Vorlage: ...</a>'
      : '';
    var head = vorlageChip + '<div class="dlm-asset-panel-head">' +
      '<h3>' + esc(asset.titel || assetLabel(asset.typ)) + '</h3>' +
      '<div class="dlm-panel-actions">' +
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
        case 'leadmagnet': body = renderLeadmagnet(asset, p, c); break;
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

  /* --- Freebie-Designer (SPEC §11.7) ----------------------------------- */
  function freebieCurrentDesign(asset) {
    var stored = STATE.freebieDesign[asset.id];
    if (stored) return stored;
    var saved = (asset.content && asset.content.design) || {};
    var themeKey = (saved.theme && window.FREEBIE && FREEBIE.THEMES[saved.theme]) ? saved.theme : 'klar';
    var akzent = saved.akzent || (window.FREEBIE ? FREEBIE.THEMES[themeKey].akzent : '#1E5AFF');
    var design = { theme: themeKey, akzent: akzent };
    STATE.freebieDesign[asset.id] = design;
    return design;
  }
  function freebieBuildHtml(asset, p, c) {
    if (!window.FREEBIE) return '<!doctype html><html><body>Vorschau nicht verfügbar.</body></html>';
    var design = freebieCurrentDesign(asset);
    return FREEBIE.build(asset.content || {}, {
      theme: design.theme,
      akzent: design.akzent,
      firma: (p && p.brief && p.brief.firma) || '',
      link: (c && c.angebot && c.angebot.link) || ''
    });
  }
  function leadmagnetPlainText(c) {
    c = c || {};
    var kapitel = arr(c.kapitel).map(function (k) { return (k && typeof k === 'object') ? k : { ueberschrift: '', text: String(k || '') }; });
    var lines = [c.titel || '', c.untertitel || '', c.versprechen || '', '', c.einleitung || ''];
    kapitel.forEach(function (k, i) {
      lines.push('', (i + 1) + '. ' + (k.ueberschrift || ''), k.text || '');
      arr(k.punkte).forEach(function (pt) { lines.push('- ' + pt); });
    });
    if (arr(c.checkliste).length) { lines.push('', 'Checkliste:'); arr(c.checkliste).forEach(function (pt) { lines.push('- ' + pt); }); }
    if (c.abschluss_cta) lines.push('', c.abschluss_cta);
    if (c.autor_box) lines.push('', c.autor_box);
    return lines.filter(function (l) { return l !== undefined && l !== null; }).join('\n');
  }
  function slugify(s) {
    return String(s || 'leitfaden').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'leitfaden';
  }
  function renderLeadmagnet(asset, p, c) {
    var design = freebieCurrentDesign(asset);
    var themes = window.FREEBIE ? FREEBIE.THEMES : {};
    var themeKeys = Object.keys(themes).length ? Object.keys(themes) : ['klar', 'dunkel', 'warm'];
    var html = '<div class="dlm-freebie">' +
      '<div class="dlm-freebie-toolbar">' +
      '<div class="dlm-freebie-themes" id="dlm-freebie-themes">' + themeKeys.map(function (key) {
        var th = themes[key] || { name: key, akzent: '#1E5AFF' };
        return '<button type="button" class="dlm-freebie-theme-tile' + (design.theme === key ? ' dlm-freebie-theme-active' : '') + '" data-freebie-theme="' + esc(key) + '">' +
          '<span class="dlm-freebie-swatch" style="background:' + esc(th.akzent) + '"></span><span>' + esc(th.name || key) + '</span></button>';
      }).join('') + '</div>' +
      '<label class="dlm-freebie-akzent-field"><span class="dlm-small">' + esc(T.freebieAkzent) + '</span>' +
      '<input type="color" id="dlm-freebie-akzent" value="' + esc(design.akzent) + '"></label>' +
      '<div class="dlm-freebie-actions">' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="freebie-print" data-id="' + esc(asset.id) + '">' + esc(T.freebiePrint) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="freebie-download" data-id="' + esc(asset.id) + '">' + esc(T.freebieDownload) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="freebie-copy-text" data-id="' + esc(asset.id) + '">' + esc(T.freebieCopyText) + '</button>' +
      '</div></div>' +
      '<iframe class="dlm-freebie-frame" id="dlm-freebie-frame-' + esc(asset.id) + '" data-freebie-frame="' + esc(asset.id) + '" sandbox="allow-same-origin" title="Leadmagnet-Vorschau"></iframe>' +
      '</div>';
    return html;
  }
  /* Setzt die iframe-Vorschau (srcdoc per JS, nicht als Attribut im HTML-String,
     wegen Anfuehrungszeichen/Groesse) und verdrahtet Theme-Kacheln + Farbfeld. */
  function wireFreebieDesigner(asset, p, c) {
    var frame = $('dlm-freebie-frame-' + asset.id);
    if (!frame) return;
    frame.srcdoc = freebieBuildHtml(asset, p, c);
    function persist() {
      var design = freebieCurrentDesign(asset);
      var content = Object.assign({}, asset.content, { design: { theme: design.theme, akzent: design.akzent } });
      asset.content = content;
      DB.patch('me_assets?id=eq.' + asset.id, { content: content }).catch(function () {});
    }
    function rerender() {
      frame.srcdoc = freebieBuildHtml(asset, p, c);
      qsa('#dlm-freebie-themes .dlm-freebie-theme-tile').forEach(function (btn) {
        btn.classList.toggle('dlm-freebie-theme-active', btn.getAttribute('data-freebie-theme') === STATE.freebieDesign[asset.id].theme);
      });
      persist();
    }
    qsa('#dlm-freebie-themes [data-freebie-theme]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-freebie-theme');
        var akzent = (window.FREEBIE && FREEBIE.THEMES[key]) ? FREEBIE.THEMES[key].akzent : freebieCurrentDesign(asset).akzent;
        STATE.freebieDesign[asset.id] = { theme: key, akzent: akzent };
        var colorInput = $('dlm-freebie-akzent');
        if (colorInput) colorInput.value = akzent;
        rerender();
      });
    });
    var colorInput = $('dlm-freebie-akzent');
    if (colorInput) {
      colorInput.addEventListener('input', function () {
        var design = freebieCurrentDesign(asset);
        STATE.freebieDesign[asset.id] = { theme: design.theme, akzent: colorInput.value };
        rerender();
      });
    }
  }
  function freebiePrint(asset, p, c) {
    var win = window.open('', '_blank');
    if (!win) { toast('Bitte Pop-ups erlauben.'); return; }
    var html = freebieBuildHtml(asset, p, c);
    win.document.open(); win.document.write(html); win.document.close();
    setTimeout(function () { try { win.focus(); win.print(); } catch (e) {} }, 300);
  }
  function freebieDownload(asset, p, c) {
    var html = freebieBuildHtml(asset, p, c);
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = slugify((asset.content && asset.content.titel) || 'leitfaden') + '.html';
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
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

  /* --- Avatar-Bilder (SPEC §11.3) -------------------------------------- */
  function generateAvatarBild(projectId, stil) {
    STATE.running['avatar-' + projectId + '-' + stil] = { pending: true };
    renderProjectRoute(parseHash());
    IMG.stream({ uid: STATE.profile.uid, task: 'avatar', project_id: projectId, stil: stil }, { onDelta: function () {} })
      .then(function () {
        delete STATE.running['avatar-' + projectId + '-' + stil];
        renderProjectRoute(parseHash());
      }).catch(function (err) {
        delete STATE.running['avatar-' + projectId + '-' + stil];
        toast(err && err.message ? err.message : T.genericError);
        renderProjectRoute(parseHash());
      });
  }
  function generateAllAvatarBilder(projectId) {
    AVATAR_STILE.forEach(function (s) { generateAvatarBild(projectId, s[0]); });
  }
  /* Setzt ein Bild als gewaehlt: Avatar-Objekt vorher frisch laden, dann komplett
     zurueckschreiben (SPEC §11.3). */
  function chooseAvatarBild(projectId, stil) {
    DB.get('me_projects?select=id,avatar&id=eq.' + projectId).then(function (rows) {
      var fresh = rows && rows[0];
      if (!fresh) return;
      var avatar = Object.assign({}, avatarOf(fresh), { gewaehlt: stil });
      return DB.patch('me_projects?id=eq.' + projectId, { avatar: avatar }).then(function () {
        if (STATE.project && STATE.project.id === projectId) STATE.project.avatar = avatar;
        renderProjectRoute(parseHash());
      });
    }).catch(function () { toast(T.genericError); });
  }

  /* ------------------------------------------------------------------
     15b) Ansicht: Creative-Vorlagen (Creative-Decoder, SPEC §10)
     ------------------------------------------------------------------ */
  var NEUE_VORLAGE_NAME = 'Neue Vorlage';

  function templateStatusLabel(s) {
    return s === 'fertig' ? T.statusFertig : (s === 'laeuft' ? T.statusLaeuft : (s === 'fehler' ? T.statusFehler : T.statusLeer));
  }

  /* Verkleinert eine Bilddatei im Browser auf max. 1600 px lange Kante und kodiert sie
     als JPEG (Qualitaet 0.88), damit der Upload sicher unter dem Gateway-Limit bleibt.
     Liefert die reinen Base64-Daten (ohne data:-Praefix). */
  function resizeImageFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth || 1, h = img.naturalHeight || 1;
        var maxEdge = 1600;
        var scale = Math.min(1, maxEdge / Math.max(w, h));
        var tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = tw; canvas.height = th;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, tw, th);
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error('Bild konnte nicht verarbeitet werden.')); return; }
          var reader = new FileReader();
          reader.onload = function () {
            var res = String(reader.result || '');
            resolve(res.split(',')[1] || '');
          };
          reader.onerror = function () { reject(new Error('Bild konnte nicht gelesen werden.')); };
          reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.88);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht geladen werden.')); };
      img.src = url;
    });
  }

  function decodeProgressCardHtml(id) {
    return '<div class="dlm-progress-card">' +
      '<h3 class="dlm-progress-title">' + esc(T.vorlagenDecoding) + '</h3>' +
      '<p class="dlm-progress-hint">' + esc(T.vorlagenDecodingHint) + '</p>' +
      '<div class="dlm-progress-bar dlm-progress-indeterminate"><div class="dlm-progress-fill" id="dlm-decode-fill-' + esc(id) + '"></div></div>' +
      '<p class="dlm-progress-status" id="dlm-decode-status-' + esc(id) + '">' + esc(STATUS_TEXTS.decode[0]) + '</p>' +
      '<p class="dlm-progress-chars" id="dlm-decode-chars-' + esc(id) + '">0 Zeichen</p>' +
      '</div>';
  }
  function updateDecodeChars(id, n) {
    var el = $('dlm-decode-chars-' + id);
    if (el) el.textContent = n + ' Zeichen';
    var fill = $('dlm-decode-fill-' + id);
    if (fill) fill.style.width = Math.min(96, 8 + n / 80) + '%';
  }
  function startDecodeStatusRotation(id) {
    var idx = 0;
    var timer = setInterval(function () {
      idx = (idx + 1) % STATUS_TEXTS.decode.length;
      var e = $('dlm-decode-status-' + id);
      if (e) e.textContent = STATUS_TEXTS.decode[idx]; else clearInterval(timer);
    }, 6000);
    STATE.running['decode-rot-' + id] = timer;
  }
  function stopDecodeStatusRotation(id) {
    if (STATE.running['decode-rot-' + id]) { clearInterval(STATE.running['decode-rot-' + id]); delete STATE.running['decode-rot-' + id]; }
  }

  function rerenderVorlagenCurrent() {
    var r = parseHash();
    if (r.name === 'vorlagen') renderVorlagenView();
    else if (r.name === 'vorlage-detail') renderVorlagenDetailRoute(r);
  }

  function startDecode(templateId) {
    STATE.running['decode-' + templateId] = { pending: true };
    rerenderVorlagenCurrent();
    startDecodeStatusRotation(templateId);
    var run = AI.run({ uid: STATE.profile.uid, task: 'decode', template_id: templateId }, {
      onProgress: function (job) { updateDecodeChars(templateId, job.chars || 0); }
    });
    STATE.running['decode-' + templateId] = { cancel: run.cancel };
    run.promise.then(function () {
      delete STATE.running['decode-' + templateId];
      stopDecodeStatusRotation(templateId);
      rerenderVorlagenCurrent();
    }).catch(function (err) {
      delete STATE.running['decode-' + templateId];
      stopDecodeStatusRotation(templateId);
      toast(err && err.message ? err.message : T.genericError);
      rerenderVorlagenCurrent();
    });
  }

  function startTemplateUpload(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast(T.vorlagenBadType); return; }
    resizeImageFile(file).then(function (b64) {
      return DB.op('upload_reference', { b64: b64 });
    }).then(function (res) {
      var url = res && res.url;
      if (!url) throw new Error(T.genericError);
      return DB.post('me_templates', { name: NEUE_VORLAGE_NAME, bild_url: url, status: 'leer' }, 'return=representation');
    }).then(function (rows) {
      var tpl = rows && rows[0];
      if (!tpl) throw new Error(T.genericError);
      renderVorlagenView();
      startDecode(tpl.id);
    }).catch(function (err) {
      toast(err && err.message ? err.message : T.genericError);
    });
  }

  function wireDropzone() {
    var zone = $('dlm-dropzone');
    var input = $('dlm-template-file');
    if (!zone || !input) return;
    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.value = '';
      if (f) startTemplateUpload(f);
    });
    ['dragover', 'dragenter'].forEach(function (evt) {
      zone.addEventListener(evt, function (e) { e.preventDefault(); zone.classList.add('dlm-dropzone-over'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      zone.addEventListener(evt, function (e) { e.preventDefault(); zone.classList.remove('dlm-dropzone-over'); });
    });
    zone.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) startTemplateUpload(f);
    });
  }

  /* Haengt sich an laufende decode-Jobs wieder an (Neuladen der Seite waehrend ein
     Hintergrund-Lauf noch geht) und meldet fehlgeschlagene Laeufe der letzten 30 Minuten
     einmal pro Sitzung, analog resumeRunningJobs fuer Projekte/Kampagnen. */
  function resumeTemplateJobs(rerender) {
    DB.get('me_jobs?select=*&status=in.(wartet,laeuft)&order=created_at.desc&limit=20').then(function (jobs) {
      arr(jobs).forEach(function (job) {
        if (job.task !== 'decode' || !job.template_id) return;
        var key = 'decode-' + job.template_id;
        if (STATE.running[key]) return;
        startDecodeStatusRotation(job.template_id);
        var poll = pollJob(job.id, function (j) { updateDecodeChars(job.template_id, j.chars || 0); });
        STATE.running[key] = { cancel: poll.cancel };
        poll.promise.then(function () {
          delete STATE.running[key];
          stopDecodeStatusRotation(job.template_id);
          rerender();
        }).catch(function (err) {
          delete STATE.running[key];
          stopDecodeStatusRotation(job.template_id);
          toast(err && err.message ? err.message : T.genericError);
          rerender();
        });
      });
    }).catch(function () {});
    var seit = new Date(Date.now() - 30 * 60000).toISOString();
    DB.get('me_jobs?select=id,task,template_id,fehler,updated_at&status=eq.fehler&task=eq.decode&updated_at=gt.' + encodeURIComponent(seit) + '&order=updated_at.desc&limit=5').then(function (jobs) {
      STATE.seenFailed = STATE.seenFailed || {};
      arr(jobs).forEach(function (job) {
        if (STATE.seenFailed[job.id]) return;
        STATE.seenFailed[job.id] = true;
        toast('Creative-Decoder ist fehlgeschlagen: ' + (job.fehler || T.genericError));
      });
    }).catch(function () {});
  }

  function templateCardHtml(t) {
    var running = !!STATE.running['decode-' + t.id];
    var status = running ? 'laeuft' : t.status;
    return '<div class="dlp-card dlm-template-card" data-open-template="' + esc(t.id) + '">' +
      '<div class="dlm-card-menu"><button type="button" class="dlm-icon-btn" data-action="template-menu" data-id="' + esc(t.id) + '" aria-label="Menü">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle></svg></button></div>' +
      '<div class="dlm-template-thumb">' + (t.bild_url ? '<img src="' + esc(t.bild_url) + '" alt="">' : '') + '</div>' +
      '<h4>' + esc(t.name || NEUE_VORLAGE_NAME) + '</h4>' +
      '<div class="dlm-chips"><span class="dlm-chip ' + statusChipCls(status) + '">' + esc(templateStatusLabel(status)) + '</span></div>' +
      (status === 'laeuft' ? decodeProgressCardHtml(t.id) : '') +
      '<p class="dlm-small">' + esc(fmtDate(t.updated_at)) + '</p>' +
      '</div>';
  }

  function renderVorlagenView() {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap">' +
      '<h1 class="dlm-title">' + esc(T.vorlagenTitle) + '</h1>' +
      '<p class="dlm-vorlagen-intro">' + esc(T.vorlagenIntro) + '</p>' +
      '<div class="dlm-dropzone" id="dlm-dropzone" tabindex="0" role="button" aria-label="Bild hochladen">' +
      ICONS.bild.replace('width="20" height="20"', 'width="30" height="30" class="dlm-dropzone-icon"') +
      '<p><strong>' + esc(T.vorlagenDropText) + '</strong></p>' +
      '<p class="dlm-small">' + esc(T.vorlagenDropHint) + '</p>' +
      '<input type="file" id="dlm-template-file" accept="image/jpeg,image/png,image/webp">' +
      '</div>' +
      '<div id="dlm-templates-grid" class="dlm-grid"><div class="dlm-loading">Lädt...</div></div>' +
      '</div>';

    wireDropzone();

    DB.get('me_templates?select=*&order=updated_at.desc').then(function (rows) {
      STATE.templates = rows || [];
      var grid = $('dlm-templates-grid');
      if (!grid) return;
      if (!STATE.templates.length) {
        grid.innerHTML = '<div class="dlm-empty-block"><h3>' + esc(T.vorlagenEmptyTitle) + '</h3><p>' + esc(T.vorlagenEmptyText) + '</p></div>';
        return;
      }
      grid.innerHTML = STATE.templates.map(templateCardHtml).join('');
    }).catch(function () {
      var grid = $('dlm-templates-grid');
      if (grid) grid.innerHTML = '<div class="dlm-empty">' + esc(T.genericError) + '</div>';
    });

    resumeTemplateJobs(function () { renderVorlagenView(); });
  }

  function openTemplateMenu(id) {
    var t = arr(STATE.templates).filter(function (x) { return x.id === id; })[0];
    dialog({
      title: t ? t.name : 'Vorlage',
      body: '<label class="dlm-field"><span>' + esc(T.rename) + '</span><input type="text" id="dlm-template-rename-input" value="' + esc(t ? t.name : '') + '"></label>',
      actions: [
        { label: T.cancel },
        {
          label: T.delete, onClick: function () {
            confirmDialog(T.vorlagenConfirmDelete, function () {
              DB.del('me_templates?id=eq.' + id).then(function () { renderVorlagenView(); });
            });
            return false;
          }
        },
        {
          label: T.save, primary: true, onClick: function () {
            var name = qs('#dlm-template-rename-input').value.trim();
            if (!name) return false;
            DB.patch('me_templates?id=eq.' + id, { name: name }).then(function () { renderVorlagenView(); });
          }
        }
      ]
    });
  }

  function renderVorlagenDetailRoute(r) {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-loading">Lädt...</div></div>';
    DB.get('me_templates?select=*&id=eq.' + r.templateId).then(function (rows) {
      var t = rows && rows[0];
      if (!t) { app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">' + esc(T.vorlagenNotFound) + '</div></div>'; return; }
      STATE.template = t;
      renderCrumbs(r);
      renderTemplateDetailBody(t);
      resumeTemplateJobs(function () { renderVorlagenDetailRoute(parseHash()); });
    }).catch(function () {
      app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">' + esc(T.genericError) + '</div></div>';
    });
  }

  /* Rendert eine decode-Kategorie als lesbaren Block (kein JSON), robust gegen
     fehlende Felder ("Nicht vorhanden"), analog zu renderAssetPanel je Typ. */
  function renderTemplateDecode(d) {
    d = d || {};
    var aufbau = d.aufbau || {};
    var headline = d.headline || {};
    var subline = d.subline || {};
    var cta = d.cta || {};
    var typografie = d.typografie || {};
    var bildstil = d.bildstil || {};
    var psychologie = d.psychologie || {};
    var copyFormeln = d.copy_formeln || {};

    var html = '';
    html += '<div><h3 class="dlm-subtitle-sm">Format</h3><p>' + esc(d.format || 'Nicht vorhanden') + '</p></div>';

    html += '<div><h3 class="dlm-subtitle-sm">Aufbau</h3>' + mdMini(aufbau.beschreibung) +
      (aufbau.blickfuehrung ? '<p class="dlm-muted"><strong>Blickführung:</strong> ' + esc(aufbau.blickfuehrung) + '</p>' : '') +
      '<div class="dlm-zone-list">' + arr(aufbau.zonen).map(function (z) {
        z = z || {};
        var pct = Math.max(0, Math.min(100, Number(z.flaeche_prozent) || 0));
        return '<div class="dlm-zone-row"><span>' + esc(z.element || 'Element') + '</span>' +
          '<span class="dlm-zone-bar"><span class="dlm-zone-bar-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="dlm-small">' + pct + '% · ' + esc(z.position || '') + (z.ausrichtung ? ' · ' + esc(z.ausrichtung) : '') + '</span></div>';
      }).join('') + '</div></div>';

    html += '<div><h3 class="dlm-subtitle-sm">Headline</h3><p class="dlm-headline">' + esc(headline.text || 'Nicht vorhanden') + '</p>' +
      '<div class="dlm-chips">' + (headline.typ ? '<span class="dlm-chip">' + esc(headline.typ) + '</span>' : '') +
      (headline.hebel ? '<span class="dlm-chip">' + esc(headline.hebel) + '</span>' : '') +
      (headline.woerter ? '<span class="dlm-chip">' + esc(headline.woerter) + ' Wörter</span>' : '') + '</div>' +
      (headline.formel ? '<div class="dlm-formel-box">' + esc(headline.formel) + '</div>' + copyBtn(headline.formel) : '') + '</div>';

    html += '<div><h3 class="dlm-subtitle-sm">Subline</h3><p>' + esc(subline.text || 'Nicht vorhanden') + '</p>' +
      (subline.formel ? '<div class="dlm-formel-box">' + esc(subline.formel) + '</div>' + copyBtn(subline.formel) : '') + '</div>';

    html += '<div><h3 class="dlm-subtitle-sm">CTA</h3><p>' + esc(cta.text || 'Nicht vorhanden') + '</p>' +
      '<div class="dlm-chips">' + (cta.form ? '<span class="dlm-chip">' + esc(cta.form) + '</span>' : '') + (cta.position ? '<span class="dlm-chip">' + esc(cta.position) + '</span>' : '') + '</div>' +
      (cta.formel ? '<div class="dlm-formel-box">' + esc(cta.formel) + '</div>' + copyBtn(cta.formel) : '') + '</div>';

    if (arr(d.weitere_texte).length) {
      html += '<div><h3 class="dlm-subtitle-sm">Weitere Texte</h3><ul class="dlm-punkte">' +
        arr(d.weitere_texte).map(function (w) { w = w || {}; return '<li><strong>' + esc(w.rolle || '') + ':</strong> ' + esc(w.text || '') + '</li>'; }).join('') +
        '</ul></div>';
    }

    var typoLines = ['stil', 'gewicht', 'schreibweise', 'groessenverhaeltnis', 'hervorhebung', 'farbe_kontrast']
      .filter(function (k) { return typografie[k]; })
      .map(function (k) { return '<li>' + esc(k.replace(/_/g, ' ')) + ': ' + esc(typografie[k]) + '</li>'; }).join('');
    html += '<div><h3 class="dlm-subtitle-sm">Typografie</h3><ul class="dlm-punkte">' + (typoLines || '<li>Nicht vorhanden.</li>') + '</ul></div>';

    html += '<div><h3 class="dlm-subtitle-sm">Farben</h3><div class="dlm-swatch-row">' + arr(d.farben).map(function (f) {
      f = f || {};
      var hex = f.hex || '#000000';
      return '<button type="button" class="dlm-swatch" data-copy="' + encodeURIComponent(hex) + '">' +
        '<span class="dlm-swatch-dot" style="background:' + esc(hex) + '"></span>' +
        '<span class="dlm-swatch-hex">' + esc(hex) + '</span><span class="dlm-small">' + esc(f.rolle || '') + '</span></button>';
    }).join('') + '</div></div>';

    var stilLines = ['art', 'szene', 'person', 'licht', 'perspektive', 'stimmung', 'look']
      .filter(function (k) { return bildstil[k]; })
      .map(function (k) { return '<li>' + esc(k) + ': ' + esc(bildstil[k]) + '</li>'; }).join('');
    html += '<div><h3 class="dlm-subtitle-sm">Bildstil</h3><ul class="dlm-punkte">' + (stilLines || '<li>Nicht vorhanden.</li>') + '</ul></div>';

    html += '<div><h3 class="dlm-subtitle-sm">Psychologie</h3><div class="dlm-chips">' +
      [psychologie.emotion, psychologie.awareness, psychologie.treiber, psychologie.scroll_stopper]
        .filter(Boolean).map(function (v) { return '<span class="dlm-chip">' + esc(v) + '</span>'; }).join('') + '</div></div>';

    html += '<div><h3 class="dlm-subtitle-sm">Warum es wirkt</h3>' + mdMini(d.warum_wirkt) + '</div>';

    html += '<div><h3 class="dlm-subtitle-sm">Regeln</h3><ul class="dlm-checklist">' +
      (arr(d.regeln).map(function (rg) { return '<li>' + esc(rg) + '</li>'; }).join('') || '<li>Nicht vorhanden.</li>') + '</ul></div>';

    html += '<div><h3 class="dlm-subtitle-sm">Stil-Prompt</h3><div class="dlm-formel-box dlm-mono">' + esc(d.stil_prompt || 'Nicht vorhanden') + '</div>' + copyBtn(d.stil_prompt) + '</div>';

    html += '<div><h3 class="dlm-subtitle-sm">Copy-Formeln</h3>' +
      '<p><strong>Headline:</strong> ' + esc(copyFormeln.headline || 'Nicht vorhanden') + '</p>' +
      '<p><strong>Subline:</strong> ' + esc(copyFormeln.subline || 'Nicht vorhanden') + '</p>' +
      '<p><strong>CTA:</strong> ' + esc(copyFormeln.cta || 'Nicht vorhanden') + '</p>' +
      (copyFormeln.anleitung ? '<p>' + esc(copyFormeln.anleitung) + '</p>' : '') +
      copyBtn([copyFormeln.headline, copyFormeln.subline, copyFormeln.cta, copyFormeln.anleitung].filter(Boolean).join('\n\n')) + '</div>';

    return html;
  }

  function renderTemplateDetailBody(t) {
    var app = $('app');
    var running = !!STATE.running['decode-' + t.id];
    var status = running ? 'laeuft' : t.status;
    var body;
    if (status === 'laeuft') {
      body = decodeProgressCardHtml(t.id);
    } else if (status === 'fehler') {
      body = '<div class="dlm-empty dlm-chip-danger-bg">Fehler: ' + esc(t.fehler || T.genericError) + '</div>' +
        '<button type="button" class="dlp-btn dlp-primary" data-action="redo-decode" data-id="' + esc(t.id) + '">' + esc(T.vorlagenRetry) + '</button>';
    } else if (status === 'fertig' && t.decode) {
      body = renderTemplateDecode(t.decode);
    } else {
      body = '<div class="dlm-empty">Nicht vorhanden.</div>';
    }

    var html = '<div class="dlm-wrap">' +
      '<div class="dlm-head-row"><div style="flex:1 1 auto;min-width:200px;">' +
      '<input type="text" id="dlm-template-name" class="dlm-title" maxlength="120" ' +
      'style="background:transparent;border:0;color:inherit;font:inherit;width:100%;padding:0;" value="' + esc(t.name || '') + '">' +
      '</div><div class="dlm-panel-actions">' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="redo-decode" data-id="' + esc(t.id) + '">' + esc(T.vorlagenRedo) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="delete-template" data-id="' + esc(t.id) + '">' + esc(T.delete) + '</button>' +
      '</div></div>' +
      '<div class="dlm-template-detail">' +
      '<div class="dlm-template-detail-img">' + (t.bild_url ? '<img src="' + esc(t.bild_url) + '" alt="">' : '') + '</div>' +
      '<div class="dlm-template-detail-body">' + body + '</div>' +
      '</div></div>';
    app.innerHTML = html;

    var nameInput = $('dlm-template-name');
    if (nameInput) {
      nameInput.addEventListener('change', function () {
        var name = nameInput.value.trim() || NEUE_VORLAGE_NAME;
        DB.patch('me_templates?id=eq.' + t.id, { name: name }).then(function () { t.name = name; STATE.template.name = name; });
      });
    }
  }

  function deleteTemplate(id) {
    DB.del('me_templates?id=eq.' + id).then(function () { location.hash = '#/vorlagen'; });
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
      if (moreWinkelBtn) { runWinkel(moreWinkelBtn.getAttribute('data-id'), true, moreWinkelBtn.getAttribute('data-awareness')); return; }

      var goKampagnenBtn = t.closest('[data-action="go-kampagnen"]');
      if (goKampagnenBtn) {
        if (goKampagnenBtn.disabled) return;
        location.hash = '#/p/' + goKampagnenBtn.getAttribute('data-id') + '/kampagnen';
        return;
      }

      var restartInterviewBtn = t.closest('[data-action="restart-interview"]');
      if (restartInterviewBtn) {
        var riId = restartInterviewBtn.getAttribute('data-id');
        confirmDialog(T.briefRestartInterviewConfirm, function () {
          var interview = { frage: 1, uebersprungen: [], fertig: false };
          DB.patch('me_projects?id=eq.' + riId, { interview: interview }).then(function () {
            if (STATE.project && STATE.project.id === riId) STATE.project.interview = interview;
            interviewSetIdx(STATE.project, 1);
            renderProjectRoute(parseHash());
          });
        });
        return;
      }

      var jumpInterviewBtn = t.closest('[data-action="jump-interview"]');
      if (jumpInterviewBtn) {
        var jiId = jumpInterviewBtn.getAttribute('data-id');
        var feld = jumpInterviewBtn.getAttribute('data-feld');
        var qIdx = INTERVIEW_QUESTIONS.map(function (q) { return q.feld; }).indexOf(feld);
        var interview2 = Object.assign({ frage: 1, uebersprungen: [] }, STATE.project.interview, { fertig: false, frage: qIdx === -1 ? 1 : qIdx + 1 });
        DB.patch('me_projects?id=eq.' + jiId, { interview: interview2 }).then(function () {
          STATE.project.interview = interview2;
          interviewSetIdx(STATE.project, interview2.frage);
          renderProjectRoute(parseHash());
        });
        return;
      }

      var interviewStartAnalyseBtn = t.closest('[data-action="interview-start-analyse"]');
      if (interviewStartAnalyseBtn) {
        setTab('zielgruppe');
        setTimeout(function () { runAnalyse(interviewStartAnalyseBtn.getAttribute('data-id')); }, 30);
        return;
      }

      var genAvatarBtn = t.closest('[data-action="gen-avatar-bild"]');
      if (genAvatarBtn) { generateAvatarBild(STATE.project.id, genAvatarBtn.getAttribute('data-stil')); return; }
      var genAvatarAllBtn = t.closest('[data-action="gen-avatar-bild-all"]');
      if (genAvatarAllBtn) { generateAllAvatarBilder(STATE.project.id); return; }
      var chooseAvatarBtn = t.closest('[data-action="choose-avatar-bild"]');
      if (chooseAvatarBtn) { chooseAvatarBild(STATE.project.id, chooseAvatarBtn.getAttribute('data-stil')); return; }

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
      var freebiePrintBtn = t.closest('[data-action="freebie-print"]');
      if (freebiePrintBtn) {
        var fa1 = arr(STATE.assets).filter(function (a) { return a.id === freebiePrintBtn.getAttribute('data-id'); })[0];
        if (fa1) freebiePrint(fa1, STATE.project, STATE.campaign);
        return;
      }
      var freebieDownloadBtn = t.closest('[data-action="freebie-download"]');
      if (freebieDownloadBtn) {
        var fa2 = arr(STATE.assets).filter(function (a) { return a.id === freebieDownloadBtn.getAttribute('data-id'); })[0];
        if (fa2) freebieDownload(fa2, STATE.project, STATE.campaign);
        return;
      }
      var freebieCopyBtn = t.closest('[data-action="freebie-copy-text"]');
      if (freebieCopyBtn) {
        var fa3 = arr(STATE.assets).filter(function (a) { return a.id === freebieCopyBtn.getAttribute('data-id'); })[0];
        if (fa3) copyText(leadmagnetPlainText(fa3.content));
        return;
      }

      var copyBtnEl = t.closest('[data-copy]');
      if (copyBtnEl) { copyText(decodeURIComponent(copyBtnEl.getAttribute('data-copy'))); return; }

      var genImgBtn = t.closest('[data-action="gen-image"]');
      if (genImgBtn) {
        generateImage(genImgBtn.getAttribute('data-asset'), genImgBtn.getAttribute('data-variant'), genImgBtn.getAttribute('data-format'));
        return;
      }

      var openTemplate = t.closest('[data-open-template]');
      if (openTemplate) { location.hash = '#/vorlagen/' + openTemplate.getAttribute('data-open-template'); return; }

      var templateMenuBtn = t.closest('[data-action="template-menu"]');
      if (templateMenuBtn) { e.stopPropagation(); openTemplateMenu(templateMenuBtn.getAttribute('data-id')); return; }

      var redoDecodeBtn = t.closest('[data-action="redo-decode"]');
      if (redoDecodeBtn) {
        var rdId = redoDecodeBtn.getAttribute('data-id');
        confirmDialog(T.vorlagenConfirmRedo, function () { startDecode(rdId); });
        return;
      }

      var delTemplateBtn = t.closest('[data-action="delete-template"]');
      if (delTemplateBtn) {
        var dtId = delTemplateBtn.getAttribute('data-id');
        confirmDialog(T.vorlagenConfirmDelete, function () { deleteTemplate(dtId); });
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
    $('dlm-tabbar-hilfe') && $('dlm-tabbar-hilfe').addEventListener('click', function () { openIntro(); });

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
