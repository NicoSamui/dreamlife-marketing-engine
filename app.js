/* ============================================================================
   Dreamlife Marketing Engine - app.js
   Eine IIFE, kein Modul-System, ES2018. Siehe docs/FRONTEND.md fuer die
   Landkarte (Funktionen, Routen, Zustaende).
   Version 1.3 (SPEC §12): Hierarchie Firma > Zielgruppe > Avatare, Content-
   Produktion als eigener Bereich, Kurzprofil + gestufte Detailanalyse.
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

  /* Minimaler Markdown-Renderer: Absaetze, Zeilenumbrueche, **fett**, "- " Listen,
     "### " Zwischenueberschriften (SPEC §12.3, erweitert gegenueber 1.2). */
  function mdMini(raw) {
    if (!raw) return '<p class="dlm-empty-txt">Nicht vorhanden.</p>';
    var text = String(raw).replace(/\\r\\n|\\n/g, '\n').replace(/\r\n/g, '\n');
    var blocks = text.split(/\n{2,}/);
    var out = blocks.map(function (block) {
      var lines = block.split('\n').filter(function (l) { return l.length; });
      if (!lines.length) return '';
      var h = lines[0].match(/^###\s+(.+)$/);
      if (h && lines.length === 1) return '<h4 class="dlm-md-h4">' + inlineMd(h[1]) + '</h4>';
      if (h) {
        var rest = lines.slice(1);
        return '<h4 class="dlm-md-h4">' + inlineMd(h[1]) + '</h4>' + mdMini(rest.join('\n'));
      }
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

  /* Schema-Angleichung: hashtags koennen Array ODER String sein, Nachfass/Schritte
     koennen Objekte ODER Strings sein. arr() macht aus allem ein sicheres Array. */
  function arr(v) { if (Array.isArray(v)) return v; if (v === null || v === undefined || v === '') return []; return [v]; }
  function hashtagsArr(h) {
    if (Array.isArray(h)) return h;
    return String(h || '').split(/\s+/).filter(Boolean);
  }
  function truncateWords(str, n) {
    var words = String(str || '').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, n).join(' ');
  }

  /* ------------------------------------------------------------------
     1) Texte (T)
     ------------------------------------------------------------------ */
  var T = {
    lockTitle: 'Anmeldung erforderlich',
    lockText: 'Die Dreamlife Marketing Engine öffnet sich nur über deinen Mitgliederbereich in LearningSuite.',
    hello: 'Hallo',
    footerVersion: 'Version',
    newVersion: 'Neue Version, bitte neu laden.',
    reload: 'Neu laden',
    create: 'Anlegen',
    cancel: 'Abbrechen',
    save: 'Speichern',
    rename: 'Umbenennen',
    archive: 'Archivieren',
    delete: 'Löschen',
    genericError: 'Da ist etwas schiefgelaufen.',
    cancelRun: 'Abbrechen',
    statusLaeuft: 'Läuft',
    statusFertig: 'Fertig',
    statusFehler: 'Fehler',
    statusLeer: 'Leer',
    navFirmen: 'Firmen',
    navContent: 'Content',
    navVorlagen: 'Vorlagen',
    navHilfe: 'Hilfe',
    /* Firmen (SPEC §12.2) */
    firmenTitle: 'Firmen',
    firmenEmptyTitle: 'Noch keine Firma angelegt',
    firmenEmptyText: 'Leg deine erste Firma an, um danach Zielgruppen und Kampagnen zu bauen.',
    firmaNew: 'Neue Firma',
    firmaNewTitle: 'Neue Firma anlegen',
    firmaName: 'Name der Firma',
    firmaNamePh: 'z. B. Zahnarztpraxis Dr. Berger',
    firmaWebsite: 'Website',
    firmaBranche: 'Branche',
    firmaDienstleistungen: 'Dienstleistungen',
    firmaBeschreibung: 'Beschreibung (2 Sätze)',
    firmaUsp: 'USP (Alleinstellungsmerkmal)',
    firmaWettbewerber: 'Wettbewerber',
    firmaTonalitaet: 'Tonalität',
    firmaRegion: 'Region',
    firmaB2b: 'B2B oder B2C',
    firmaNotizen: 'Notizen',
    firmaSaved: 'Gespeichert.',
    firmaZielgruppen: 'Zielgruppen',
    firmaAvatare: 'Avatare',
    firmaOeffnen: 'Öffnen',
    firmaArchiveConfirm: 'Diese Firma wirklich archivieren?',
    zielgruppenEmptyTitle: 'Noch keine Zielgruppe',
    zielgruppenEmptyText: 'Leg deine erste Zielgruppe an, um eine Analyse und Winkel zu erzeugen.',
    zielgruppeNew: 'Neue Zielgruppe',
    zielgruppeNewTitle: 'Neue Zielgruppe anlegen',
    zielgruppeProdukt: 'Für welches Produkt oder Angebot?',
    zielgruppeName: 'Name der Zielgruppe',
    zielgruppeNamePh: 'optional, sonst automatisch benannt',
    zielgruppeRenameTitle: 'Zielgruppe umbenennen',
    zielgruppeArchiveConfirm: 'Diese Zielgruppe wirklich archivieren?',
    /* Stepper Zielgruppe */
    tabInterview: 'Interview',
    tabZielgruppe: 'Zielgruppe',
    tabWinkel: 'Winkel',
    tabAvatare: 'Avatare',
    tabWinkelHint: 'Erst Kurzprofil erstellen',
    tabAvatareHint: 'Erst Kurzprofil erstellen',
    briefHelp: 'Je konkreter, desto besser wird die Analyse.',
    briefSaved: 'Gespeichert.',
    briefEditAll: 'Alle Felder bearbeiten',
    briefRestartInterview: 'Interview neu starten',
    briefRestartInterviewConfirm: 'Das Interview wird von vorn gestartet, deine bisherigen Antworten bleiben im Formular erhalten. Fortfahren?',
    laterAnswered: 'Später beantworten',
    /* Kurzprofil (SPEC §12.3) */
    kurzprofilEmptyTitle: 'Noch kein Kurzprofil',
    kurzprofilEmptyText: 'Erst kommt in unter einer Minute das Kurzprofil, die Detailanalyse baut sich danach Schritt für Schritt auf.',
    kurzprofilCreate: 'Kurzprofil erstellen',
    kurzprofilRunningTitle: 'Kurzprofil wird erstellt',
    kurzprofilRunningHint: 'Das dauert meist unter einer Minute.',
    detailanalyseTitle: 'Detailanalyse',
    modusEinfach: 'Einfach',
    modusDetailliert: 'Detailliert',
    zielgruppeRefine: 'Verfeinern mit Hinweis',
    zielgruppeRedo: 'Komplett neu erzeugen',
    zielgruppeExport: 'Als Text exportieren',
    zielgruppeRedoConfirm: 'Die bestehende Analyse wird ersetzt. Fortfahren?',
    teilWirdErstellt: 'wird erstellt…',
    teilFehler: 'Dieser Teil ist fehlgeschlagen.',
    teilRetry: 'Nochmal versuchen',
    einwaendeAntwortIdee: 'Antwort-Idee',
    wegVonSpalte: 'WEG VON',
    hinZuSpalte: 'HIN ZU',
    winkelEmptyTitle: 'Noch keine Marketing-Winkel',
    winkelEmptyText: 'Lass aus deiner Analyse 25 Marketing-Winkel erzeugen (5 je Awareness-Stufe) und wähle davon 5 bis 10 aus.',
    winkelCreate: 'Marketing-Winkel erzeugen',
    winkelMoreStufe: '5 weitere für diese Stufe',
    winkelCountUnder: 'gewählt (mindestens 5 nötig)',
    winkelCountOk: 'gewählt',
    winkelCountOver: 'zu viele gewählt (maximal 10)',
    needAnalyse: 'Erzeuge zuerst ein Kurzprofil.',
    needFiveWinkel: 'Wähle zuerst mindestens 5 Winkel aus, bevor du eine Kampagne anlegst.',
    /* Avatare (Tab, SPEC §12.2/§12.4) */
    avatareEmptyTitle: 'Noch kein Avatar',
    avatareEmptyText: 'Leg einen Avatar von Hand an oder lass drei Vorschläge aus der Analyse erzeugen.',
    avatarNewCard: 'Neuer Avatar',
    avatarNewTitle: 'Neuen Avatar anlegen',
    avatarVorschlagen: 'Avatar aus der Analyse vorschlagen',
    avatarVorschlagenRunning: 'Avatare werden vorgeschlagen',
    avatarVorschlagenNeedAnalyse: 'Für Vorschläge braucht es erst ein Kurzprofil oder eine Analyse.',
    avatarRenameTitle: 'Avatar umbenennen',
    avatarDeleteConfirm: 'Diesen Avatar wirklich löschen?',
    consistencyCheck: 'Konsistenz prüfen',
    consistencyRunning: 'Prüft Konsistenz...',
    assetsTitle: 'Asset-Werkstatt',
    assetGenerate: 'Erzeugen',
    assetFocusWinkel: 'Winkel-Fokus (optional)',
    assetHint: 'Hinweis (optional)',
    assetListTitle: 'Alle Assets',
    assetFilterAll: 'Alle',
    assetsEmptyText: 'Für diese Auswahl gibt es noch keine Assets. Erzeuge oben in der Asset-Werkstatt dein erstes Asset.',
    assetCopyAll: 'Alles kopieren',
    assetRegenerate: 'Neu erzeugen',
    assetDelete: 'Löschen',
    assetExport: 'Als Text exportieren',
    assetPrint: 'Als PDF drucken',
    formatImg: 'Bild erzeugen',
    imgLoading: 'Bild wird erzeugt...',
    imgDownload: 'Herunterladen',
    confirmDeleteAsset: 'Dieses Asset wirklich löschen?',
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
    interviewStartAnalyse: 'Kurzprofil erstellen',
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
    avatarBilderHint: 'Für Bilder braucht die KI zuerst einen Bild-Prompt, Alter, Beruf oder Aussehen. Fülle rechts das Profil aus.',
    avatarBildErzeugen: 'Erzeugen',
    avatarBilderAlle: 'Alle drei erzeugen',
    avatarBildLaeuft: 'Wird erzeugt...',
    /* Content (SPEC §12.2) */
    contentTitle: 'Content',
    contentFirma: 'Firma',
    contentZielgruppe: 'Zielgruppe',
    contentAvatar: 'Avatar (optional)',
    contentAvatarOhne: 'Ohne Avatar',
    contentWaehleFirma: 'Bitte zuerst eine Firma wählen.',
    contentWaehleZielgruppe: 'Bitte eine Zielgruppe mit fertiger Analyse wählen.',
    contentKeineZielgruppeFertig: 'Für diese Firma gibt es noch keine Zielgruppe mit fertiger Analyse.',
    kampagnenEmptyTitle: 'Noch keine Kampagne angelegt',
    kampagnenEmpty: 'Leg deine erste Kampagne an, um daraus fertige Marketing-Assets zu erzeugen.',
    kampagneNew: 'Neue Kampagne',
    kampagneNewTitle: 'Neue Kampagne anlegen',
    kampagneName: 'Name der Kampagne',
    kampagneZiel: 'Ziel',
    kampagneWinkel: 'Winkel (mindestens einer)',
    kampagneAvatar: 'Avatar (optional)',
    kampagneAngebot: 'Angebot',
    introTitle1: '1. Firma anlegen',
    introText1: 'Leg deine Firma oder die deines Kunden an: Branche, Dienstleistungen und eine kurze Beschreibung reichen zum Start.',
    introTitle2: '2. Zielgruppe verstehen',
    introText2: 'Beantworte 8 kurze Fragen zum Produkt. Daraus entsteht erst ein Kurzprofil, dann eine ausführliche Detailanalyse und Marketing-Winkel.',
    introTitle3: '3. Content produzieren',
    introText3: 'Wähle Firma, Zielgruppe und optional einen Avatar und erzeuge fertige Marketing-Assets: Bild-Creatives, Reels, Captions, E-Mails, VSL, Leadmagnet und Funnel.',
    introNext: 'Weiter',
    introBack: 'Zurück',
    introDone: 'Los geht\'s',
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
    kurzprofil: ['Liest das Interview', 'Baut den Steckbrief', 'Formuliert Schmerzen und Wünsche', 'Sammelt Zitate', 'Fasst zusammen'],
    analyse: [
      'Lese Kurzprofil und Interview', 'Baue das Basisprofil', 'Suche die echten Schmerzpunkte (WEG VON)',
      'Formuliere den Wunschzustand (HIN ZU)', 'Schreibe reale Alltagssituationen', 'Ordne die DISG-Typen ein',
      'Bewerte die Life Force 8', 'Sammle Einwände und Glaubenssätze', 'Notiere wörtliche Sätze deiner Zielgruppe',
      'Fasse zusammen'
    ],
    winkel: ['Lese die Analyse', 'Sammle Ansatzpunkte', 'Formuliere Winkel', 'Prüfe auf Vielfalt', 'Ordne die Liste'],
    avatar_vorschlag: ['Lese Kurzprofil und Analyse', 'Bildet Untergruppen', 'Formuliert Profile', 'Ordnet die Liste'],
    asset: ['Lese Analyse und Winkel', 'Baue die Struktur', 'Schreibe die Texte', 'Prüft Sprache und Länge', 'Speichert Ergebnis'],
    konsistenz: ['Lese alle Assets der Kampagne', 'Vergleicht Tonalität', 'Prüft Widersprüche', 'Fasst zusammen'],
    decode: ['Analysiert Aufbau und Blickführung', 'Liest Headline, Subline und CTA', 'Bestimmt Farben und Typografie', 'Fasst Psychologie und Wirkung zusammen']
  };

  /* Feste Reihenfolge und Anzeige-Labels nach SPEC §3/§12.3. */
  var ANALYSE_CATS = [
    ['basisprofil', 'Basisprofil'], ['wissensstand', 'Wissensstand'], ['marktwissen', 'Marktwissen'],
    ['weg_von', 'WEG VON: der Ist-Zustand'], ['hin_zu', 'HIN ZU: der Wunschzustand'],
    ['reale_situationen', 'Reale Situationen aus dem Alltag'], ['disg', 'DISG-Modell'],
    ['life_force_8', 'Life Force 8'], ['sekundaere_wuensche_9', '9 sekundäre Wünsche'],
    ['einwaende', 'Einwände'], ['awareness_stufe', 'Awareness-Stufe'], ['glaubenssaetze', 'Glaubenssätze'],
    ['sprache_zitate', 'Sprache und wörtliche Zitate'], ['kaufausloeser', 'Kaufauslöser'],
    ['kanaele', 'Kanäle'], ['entscheidungsprozess', 'Entscheidungsprozess'], ['zusammenfassung', 'Zusammenfassung']
  ];
  var ANALYSE_AREAS = [
    { key: 'wer', label: 'Wer', cats: ['basisprofil', 'wissensstand', 'marktwissen'] },
    { key: 'schmerz', label: 'Schmerz und Wunsch', cats: ['weg_von', 'hin_zu', 'reale_situationen'] },
    { key: 'psychologie', label: 'Psychologie', cats: ['disg', 'life_force_8', 'sekundaere_wuensche_9', 'einwaende', 'awareness_stufe', 'glaubenssaetze', 'sprache_zitate'] },
    { key: 'kaufen', label: 'Kaufen', cats: ['kaufausloeser', 'kanaele', 'entscheidungsprozess', 'zusammenfassung'] }
  ];
  /* Kategorie -> Analyse-Teil (SPEC §12.3: A bis F, aus me_projects.analyse_teile). */
  var CAT_TEIL = {
    basisprofil: 'A', wissensstand: 'A', marktwissen: 'A',
    weg_von: 'B', hin_zu: 'B',
    reale_situationen: 'C', disg: 'C',
    life_force_8: 'D', sekundaere_wuensche_9: 'D', einwaende: 'D',
    awareness_stufe: 'E', glaubenssaetze: 'E', sprache_zitate: 'E',
    kaufausloeser: 'F', kanaele: 'F', entscheidungsprozess: 'F', zusammenfassung: 'F'
  };

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

  /* Interview-Fragen der Zielgruppe nach SPEC §12.1: nur noch 8 Fragen, produktbezogen.
     Firmenfelder werden nicht mehr im Zielgruppen-Interview abgefragt (siehe Firma-Formular). */
  var INTERVIEW_QUESTIONS = [
    { feld: 'produkt', frage: 'Für welches Produkt oder Angebot willst du die Zielgruppe verstehen?', optional: false, type: 'text' },
    { feld: 'angebot_kurz', frage: 'Erkläre dieses Angebot in einem Satz.', optional: false, type: 'textarea' },
    { feld: 'zielkunde_vermutung', frage: 'Wer ist deiner Meinung nach dein idealer Kunde? Beschreib die Person, so gut du kannst.', optional: true, type: 'textarea' },
    { feld: 'preisniveau', frage: 'Auf welchem Preisniveau bewegst du dich?', optional: true, type: 'chips', options: PREISNIVEAU },
    { feld: 'kunden_beispiele', frage: 'Erzähl von zwei oder drei echten Kunden: Wer waren sie, was war ihr Problem?', optional: true, type: 'textarea' },
    { feld: 'wunsch_ergebnis', frage: 'Was soll der Kunde nach dem Kauf erreicht haben?', optional: true, type: 'textarea' },
    { feld: 'haeufigste_einwaende', frage: 'Was hörst du am häufigsten, wenn Leute NICHT kaufen?', optional: true, type: 'textarea' },
    { feld: 'notizen', frage: 'Gibt es noch etwas, das die KI wissen sollte?', optional: true, type: 'textarea' }
  ];
  var BRIEF_FIELDS = [
    ['produkt', 'Produkt/Angebot', 'text', false],
    ['angebot_kurz', 'Angebot in einem Satz', 'textarea', false],
    ['zielkunde_vermutung', 'Vermutete Zielkunde', 'textarea', true],
    ['preisniveau', 'Preisniveau', 'select', true, PREISNIVEAU],
    ['kunden_beispiele', 'Kundenbeispiele', 'textarea', true],
    ['wunsch_ergebnis', 'Wunsch-Ergebnis nach dem Kauf', 'textarea', true],
    ['haeufigste_einwaende', 'Häufigste Einwände', 'textarea', true],
    ['notizen', 'Notizen', 'textarea', true]
  ];
  function briefFieldLabel(key) {
    var f = BRIEF_FIELDS.filter(function (x) { return x[0] === key; })[0];
    return f ? f[1] : key;
  }

  var FIRMA_FIELDS = [
    ['website', 'Website', 'text', true],
    ['branche', 'Branche', 'text', false],
    ['dienstleistungen', 'Dienstleistungen', 'textarea', false],
    ['beschreibung', 'Beschreibung', 'textarea', false],
    ['usp', 'USP (Alleinstellungsmerkmal)', 'textarea', true],
    ['wettbewerber', 'Wettbewerber', 'textarea', true],
    ['tonalitaet', 'Tonalität', 'select', true, TONALITAET],
    ['region', 'Region', 'text', true],
    ['b2b_b2c', 'B2B oder B2C', 'select', true, B2B_B2C],
    ['notizen', 'Notizen', 'textarea', true]
  ];

  var AVATAR_STILE = [['foto', 'Foto'], ['illustration', 'Illustration'], ['karikatur', 'Karikatur']];
  var AVATAR_WERTE_VORSCHLAEGE = ['Sicherheit', 'Freiheit', 'Familie', 'Anerkennung', 'Wachstum', 'Gesundheit', 'Kontrolle', 'Ehrlichkeit', 'Erfolg', 'Ruhe'];

  /* ------------------------------------------------------------------
     2) Zustand
     ------------------------------------------------------------------ */
  var STATE = {
    profile: null,
    firmen: null,
    firma: null,          /* aktuell geoeffnete Firma */
    projects: null,       /* Zielgruppen-Liste einer Firma */
    project: null,        /* aktuell geoeffnete Zielgruppe (Tabelle me_projects) */
    avatare: null,        /* Avatar-Liste der aktuellen Zielgruppe (me_avatare) */
    avatar: null,         /* aktuell geoeffneter Avatar (Avatar-Profil-Route) */
    campaigns: null,
    campaign: null,
    assets: null,
    openAssetId: null,
    assetFilter: 'alle',
    templates: null,
    template: null,
    running: {},
    interviewIdx: {},
    recording: null,
    freebieDesign: {},
    analyseModus: 'einfach', /* dlm-analyse-modus, Standard Einfach (SPEC §12.3) */
    contentSel: { firmaId: null, projectId: null, avatarId: null }
  };
  try {
    var savedModus = localStorage.getItem('dlm-analyse-modus');
    if (savedModus === 'einfach' || savedModus === 'detailliert') STATE.analyseModus = savedModus;
  } catch (e) {}
  try {
    var savedSel = JSON.parse(localStorage.getItem('dlm-content-auswahl') || 'null');
    if (savedSel && typeof savedSel === 'object') STATE.contentSel = Object.assign(STATE.contentSel, savedSel);
  } catch (e) {}
  function saveContentSel() {
    try { localStorage.setItem('dlm-content-auswahl', JSON.stringify(STATE.contentSel)); } catch (e) {}
  }

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
      });
    },
    get: function (path) { return DB.request('GET', path); },
    post: function (path, body, prefer) { return DB.request('POST', path, body, prefer || 'return=representation'); },
    patch: function (path, body) { return DB.request('PATCH', path, body); },
    del: function (path) { return DB.request('DELETE', path); },
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
          if (evt.type === 'done') { settled = true; resolve(evt.result !== undefined ? evt.result : evt); }
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
     ------------------------------------------------------------------ */
  var JOB_POLL_MS = 2500;

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
    var parts = [];
    if (route.name === 'firma' || route.name === 'zielgruppe' || route.name === 'avatar') {
      var fname = STATE.firma ? STATE.firma.name : '...';
      parts.push({ label: T.navFirmen, href: '#/' });
      parts.push({ label: fname, href: '#/f/' + (STATE.firma ? STATE.firma.id : '') });
    }
    if (route.name === 'zielgruppe' || route.name === 'avatar') {
      var zname = STATE.project ? (STATE.project.name || STATE.project.produkt) : '...';
      parts.push({ label: zname, href: route.name === 'avatar' ? '#/z/' + route.projectId : null });
    }
    if (route.name === 'avatar') {
      var avname = STATE.avatar ? STATE.avatar.name : '...';
      parts.push({ label: avname, href: null });
    }
    if (route.name === 'content' || route.name === 'campaign') {
      parts.push({ label: T.navContent, href: route.name === 'campaign' ? '#/content' : null });
    }
    if (route.name === 'campaign') {
      var cname = STATE.campaign ? STATE.campaign.name : '...';
      parts.push({ label: cname, href: null });
    }
    if (route.name === 'vorlagen' || route.name === 'vorlage-detail') {
      parts.push({ label: T.vorlagenNav, href: route.name === 'vorlagen' ? null : '#/vorlagen' });
    }
    if (route.name === 'vorlage-detail') {
      var tname = STATE.template ? STATE.template.name : '...';
      parts.push({ label: tname, href: null });
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
    var route = { name: 'firmen', params: params };
    if (parts[0] === 'f' && parts[1]) { route.name = 'firma'; route.firmaId = parts[1]; }
    else if (parts[0] === 'z' && parts[1]) {
      route.projectId = parts[1];
      if (parts[2] === 'a' && parts[3]) { route.name = 'avatar'; route.avatarId = parts[3]; }
      else route.name = 'zielgruppe';
    } else if (parts[0] === 'content') {
      if (parts[1] === 'k' && parts[2]) { route.name = 'campaign'; route.campaignId = parts[2]; }
      else route.name = 'content';
    } else if (parts[0] === 'vorlagen') {
      if (parts[1]) { route.name = 'vorlage-detail'; route.templateId = parts[1]; }
      else route.name = 'vorlagen';
    } else if (parts[0] === 'p' && parts[1]) {
      /* Altbestand-Route SPEC §12.1: #/p/<id> -> #/z/<id>; #/p/<id>/k/<kid> -> #/content/k/<kid> */
      if (parts[2] === 'k' && parts[3]) { route.name = 'redirect'; route.to = '#/content/k/' + parts[3]; }
      else { route.name = 'redirect'; route.to = '#/z/' + parts[1] + (query ? ('?' + query) : ''); }
    }
    return route;
  }

  function setTab(tab) {
    var route = parseHash();
    location.hash = '#/z/' + route.projectId + (tab ? ('?tab=' + tab) : '');
  }

  function route() {
    var r = parseHash();
    if (r.name === 'redirect') { location.hash = r.to; return; }
    updateNavActive(r);
    if (r.name === 'firmen') { STATE.firma = null; STATE.project = null; STATE.campaign = null; renderCrumbs(r); renderFirmenView(); return; }
    if (r.name === 'firma') { renderFirmaRoute(r); return; }
    if (r.name === 'zielgruppe') { renderZielgruppeRoute(r); return; }
    if (r.name === 'avatar') { renderAvatarRoute(r); return; }
    if (r.name === 'content') { STATE.campaign = null; renderCrumbs(r); renderContentView(); return; }
    if (r.name === 'campaign') { renderCampaignRoute(r); return; }
    if (r.name === 'vorlagen') { STATE.firma = null; STATE.project = null; STATE.campaign = null; STATE.template = null; renderCrumbs(r); renderVorlagenView(); return; }
    if (r.name === 'vorlage-detail') { renderVorlagenDetailRoute(r); return; }
  }

  function updateNavActive(r) {
    var active = 'firmen';
    if (r.name === 'firma' || r.name === 'zielgruppe' || r.name === 'avatar') active = 'firmen';
    if (r.name === 'content' || r.name === 'campaign') active = 'content';
    if (r.name === 'vorlagen' || r.name === 'vorlage-detail') active = 'vorlagen';
    qsa('[data-nav]').forEach(function (el) {
      el.classList.toggle('dlm-nav-active', el.getAttribute('data-nav') === active);
    });
  }

  /* ------------------------------------------------------------------
     12) Ansicht: Firmen (SPEC §12.2)
     ------------------------------------------------------------------ */
  function firmaInfo(f) { return (f && f.info && typeof f.info === 'object') ? f.info : {}; }

  function renderFirmenView() {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-head-row"><h1>' + esc(T.firmenTitle) + '</h1>' +
      '<button type="button" class="dlp-btn dlp-primary" data-action="new-firma">' + esc(T.firmaNew) + '</button>' +
      '</div><div id="dlm-firmen-grid" class="dlm-grid"><div class="dlm-loading">Lädt...</div></div></div>';

    DB.get('me_firmen?select=*&archiviert=eq.false&order=updated_at.desc').then(function (rows) {
      STATE.firmen = rows || [];
      var grid = $('dlm-firmen-grid');
      if (!grid) return;
      var newTile = '<div class="dlp-card dlm-project-card-new" data-action="new-firma">' +
        '<span class="dlm-new-plus" aria-hidden="true">+</span><span>' + esc(T.firmaNew) + '</span></div>';
      if (!STATE.firmen.length) {
        grid.innerHTML = '<div class="dlm-empty-block"><h3>' + esc(T.firmenEmptyTitle) + '</h3><p>' + esc(T.firmenEmptyText) + '</p>' +
          '<button type="button" class="dlp-btn dlp-primary" data-action="new-firma">' + esc(T.firmaNew) + '</button></div>';
        return;
      }
      grid.innerHTML = STATE.firmen.map(function (f) {
        var info = firmaInfo(f);
        return '<div class="dlp-card dlm-firma-card" data-open-firma="' + esc(f.id) + '">' +
          '<h3 class="dlm-project-title">' + esc(f.name) + '</h3>' +
          '<p class="dlm-muted dlm-small">' + esc(info.branche || 'Ohne Branche') + '</p>' +
          '<div class="dlm-chips"><span class="dlm-chip">Zielgruppen&nbsp;<span data-fz-count="' + esc(f.id) + '">...</span></span>' +
          '<span class="dlm-chip">Avatare&nbsp;<span data-fa-count="' + esc(f.id) + '">...</span></span></div>' +
          '<a class="dlp-btn dlp-ghost" href="#/f/' + esc(f.id) + '">' + esc(T.firmaOeffnen) + '</a>' +
          '</div>';
      }).join('') + newTile;
      STATE.firmen.forEach(function (f) {
        DB.get('me_projects?select=id&archiviert=eq.false&firma_id=eq.' + f.id).then(function (projRows) {
          var el = qs('[data-fz-count="' + f.id + '"]', grid);
          if (el) el.textContent = String(arr(projRows).length);
          var ids = arr(projRows).map(function (p) { return p.id; });
          var aEl = qs('[data-fa-count="' + f.id + '"]', grid);
          if (!ids.length) { if (aEl) aEl.textContent = '0'; return; }
          DB.get('me_avatare?select=id&project_id=in.(' + ids.join(',') + ')').then(function (avRows) {
            if (aEl) aEl.textContent = String(arr(avRows).length);
          }).catch(function () { if (aEl) aEl.textContent = '0'; });
        }).catch(function () {});
      });
    }).catch(function () {
      var grid = $('dlm-firmen-grid');
      if (grid) grid.innerHTML = '<div class="dlm-empty">' + esc(T.genericError) + '</div>';
    });
  }

  function firmaDialogBody(f) {
    var info = firmaInfo(f);
    var body = document.createElement('div');
    body.innerHTML =
      '<label class="dlm-field"><span>' + esc(T.firmaName) + '</span><input type="text" id="dlm-firma-name" placeholder="' + esc(T.firmaNamePh) + '" maxlength="160" value="' + esc(f ? f.name : '') + '"></label>' +
      '<label class="dlm-field"><span>' + esc(T.firmaWebsite) + ' <em>(optional)</em></span><input type="text" id="dlm-firma-website" value="' + esc(info.website || '') + '" maxlength="200"></label>' +
      '<label class="dlm-field"><span>' + esc(T.firmaBranche) + '</span><input type="text" id="dlm-firma-branche" value="' + esc(info.branche || '') + '" maxlength="160"></label>' +
      '<label class="dlm-field"><span>' + esc(T.firmaDienstleistungen) + '</span><textarea id="dlm-firma-dienstleistungen" rows="3" maxlength="2000">' + esc(info.dienstleistungen || '') + '</textarea></label>' +
      '<label class="dlm-field"><span>' + esc(T.firmaBeschreibung) + '</span><textarea id="dlm-firma-beschreibung" rows="2" maxlength="600">' + esc(info.beschreibung || '') + '</textarea></label>';
    return body;
  }

  function openNewFirmaDialog() {
    var body = firmaDialogBody(null);
    dialog({
      title: T.firmaNewTitle,
      body: body,
      actions: [
        { label: T.cancel },
        {
          label: T.create, primary: true, onClick: function (wrap) {
            var name = qs('#dlm-firma-name', wrap).value.trim();
            if (!name) { toast('Bitte einen Namen eingeben.'); return false; }
            var info = {
              website: qs('#dlm-firma-website', wrap).value.trim(),
              branche: qs('#dlm-firma-branche', wrap).value.trim(),
              dienstleistungen: qs('#dlm-firma-dienstleistungen', wrap).value,
              beschreibung: qs('#dlm-firma-beschreibung', wrap).value
            };
            DB.post('me_firmen', { name: name, info: info, archiviert: false }, 'return=representation').then(function (rows) {
              var f = rows && rows[0];
              if (f) location.hash = '#/f/' + f.id;
            });
          }
        }
      ]
    });
    setTimeout(function () { var el = qs('#dlm-firma-name'); if (el) el.focus(); }, 30);
  }

  /* ------------------------------------------------------------------
     13) Ansicht: Firma (Info-Formular, Zielgruppen-Liste)
     ------------------------------------------------------------------ */
  function zielgruppeStatusChips(p) {
    var kp = p.kurzprofil_status === 'fertig' ? 'Kurzprofil fertig' : (p.kurzprofil_status === 'laeuft' ? 'Kurzprofil läuft' : 'Kurzprofil offen');
    var kpCls = p.kurzprofil_status === 'fertig' ? 'dlm-chip-ok' : (p.kurzprofil_status === 'laeuft' ? 'dlm-chip-warn' : '');
    var an = p.analyse_status === 'fertig' ? 'Analyse fertig' : (p.analyse_status === 'laeuft' ? 'Analyse läuft' : 'Analyse offen');
    var anCls = p.analyse_status === 'fertig' ? 'dlm-chip-ok' : (p.analyse_status === 'laeuft' ? 'dlm-chip-warn' : '');
    var wn = arr(p.winkel_auswahl).length;
    return '<span class="dlm-chip ' + kpCls + '">' + esc(kp) + '</span>' +
      '<span class="dlm-chip ' + anCls + '">' + esc(an) + '</span>' +
      '<span class="dlm-chip">Winkel ' + wn + '/10</span>';
  }
  function zielgruppeName(p) { return p.name || ('Zielgruppe für ' + (p.produkt || '?')); }

  function renderFirmaRoute(r) {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-loading">Lädt...</div></div>';
    DB.get('me_firmen?select=*&id=eq.' + r.firmaId).then(function (rows) {
      var f = rows && rows[0];
      if (!f) { app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">Firma nicht gefunden.</div></div>'; return; }
      STATE.firma = f;
      renderCrumbs(r);
      var info = firmaInfo(f);
      var html = '<div class="dlm-wrap">' +
        '<div class="dlm-head-row"><h1 class="dlm-title">' + esc(f.name) + '</h1>' +
        '<button type="button" class="dlm-text-btn" data-action="archive-firma" data-id="' + esc(f.id) + '">' + esc(T.archive) + '</button>' +
        '</div>' +
        '<form id="dlm-firma-form" class="dlm-form">' +
        '<label class="dlm-field"><span>' + esc(T.firmaName) + '</span><input type="text" name="__name" value="' + esc(f.name) + '" maxlength="160"></label>';
      FIRMA_FIELDS.forEach(function (fld) {
        var key = fld[0], label = fld[1], type = fld[2], optional = fld[3], opts = fld[4];
        var val = info[key] || '';
        html += '<label class="dlm-field"><span>' + esc(label) + (optional ? ' <em>(optional)</em>' : '') + '</span>';
        if (type === 'textarea') html += '<textarea name="' + key + '" rows="3" maxlength="2000">' + esc(val) + '</textarea>';
        else if (type === 'select') {
          html += '<select name="' + key + '"><option value="">Bitte wählen</option>' +
            opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
        } else html += '<input type="text" name="' + key + '" value="' + esc(val) + '" maxlength="200">';
        html += '</label>';
      });
      html += '<p class="dlm-save-hint" id="dlm-firma-savehint">&nbsp;</p></form>';

      html += '<div class="dlm-head-row" style="margin-top:34px;"><h2 class="dlm-subtitle" style="margin:0;">' + esc(T.firmaZielgruppen) + '</h2>' +
        '<button type="button" class="dlp-btn dlp-primary" data-action="new-zielgruppe" data-id="' + esc(f.id) + '">' + esc(T.zielgruppeNew) + '</button></div>' +
        '<div id="dlm-zielgruppen-grid" class="dlm-grid"><div class="dlm-loading">Lädt...</div></div></div>';
      app.innerHTML = html;

      var form = $('dlm-firma-form');
      var save = debounce(function () {
        var name = form.elements.__name.value.trim() || f.name;
        var info2 = {};
        FIRMA_FIELDS.forEach(function (fld) { var el = form.elements[fld[0]]; if (el) info2[fld[0]] = el.value; });
        DB.patch('me_firmen?id=eq.' + f.id, { name: name, info: info2 }).then(function () {
          f.name = name; f.info = info2; STATE.firma = f;
          var hint = $('dlm-firma-savehint');
          if (hint) hint.textContent = T.firmaSaved + ' ' + new Date().toLocaleTimeString('de-DE');
          var titleEl = qs('.dlm-title', app);
          if (titleEl) titleEl.textContent = name;
        });
      }, 800);
      form.addEventListener('input', save);
      form.addEventListener('change', save);

      renderZielgruppenGrid(f.id);
    }).catch(function () {
      app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">' + esc(T.genericError) + '</div></div>';
    });
  }

  function renderZielgruppenGrid(firmaId) {
    DB.get('me_projects?select=*&archiviert=eq.false&firma_id=eq.' + firmaId + '&order=updated_at.desc').then(function (rows) {
      STATE.projects = rows || [];
      var grid = $('dlm-zielgruppen-grid');
      if (!grid) return;
      var newTile = '<div class="dlp-card dlm-project-card-new" data-action="new-zielgruppe" data-id="' + esc(firmaId) + '">' +
        '<span class="dlm-new-plus" aria-hidden="true">+</span><span>' + esc(T.zielgruppeNew) + '</span></div>';
      if (!STATE.projects.length) {
        grid.innerHTML = '<div class="dlm-empty-block"><h3>' + esc(T.zielgruppenEmptyTitle) + '</h3><p>' + esc(T.zielgruppenEmptyText) + '</p>' +
          '<button type="button" class="dlp-btn dlp-primary" data-action="new-zielgruppe" data-id="' + esc(firmaId) + '">' + esc(T.zielgruppeNew) + '</button></div>';
        return;
      }
      grid.innerHTML = STATE.projects.map(function (p) {
        return '<div class="dlp-card dlm-project-card" data-open-zielgruppe="' + esc(p.id) + '">' +
          '<div class="dlm-card-menu"><button type="button" class="dlm-icon-btn" data-action="zielgruppe-menu" data-id="' + esc(p.id) + '" aria-label="Menü">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle></svg></button></div>' +
          '<h3 class="dlm-project-title"><span>' + esc(zielgruppeName(p)) + '</span></h3>' +
          '<p class="dlm-muted dlm-small">' + esc(p.produkt || '') + '</p>' +
          '<div class="dlm-chips">' + zielgruppeStatusChips(p) + '</div>' +
          '<div class="dlm-avatar-row-mini" data-z-avatare="' + esc(p.id) + '"></div>' +
          '<p class="dlm-muted dlm-small">Zuletzt bearbeitet ' + esc(fmtDate(p.updated_at)) + '</p>' +
          '</div>';
      }).join('') + newTile;
      STATE.projects.forEach(function (p) {
        DB.get('me_avatare?select=id,name,bilder,gewaehlt&project_id=eq.' + p.id + '&limit=5').then(function (avRows) {
          var el = qs('[data-z-avatare="' + p.id + '"]', grid);
          if (!el) return;
          el.innerHTML = arr(avRows).map(function (a) { return avRowPicHtml(a, 26); }).join('');
        }).catch(function () {});
      });
    }).catch(function () {
      var grid = $('dlm-zielgruppen-grid');
      if (grid) grid.innerHTML = '<div class="dlm-empty">' + esc(T.genericError) + '</div>';
    });
  }

  function openNewZielgruppeDialog(firmaId) {
    var body = document.createElement('div');
    body.innerHTML =
      '<label class="dlm-field"><span>' + esc(T.zielgruppeProdukt) + '</span><input type="text" id="dlm-zg-produkt" maxlength="200"></label>' +
      '<label class="dlm-field"><span>' + esc(T.zielgruppeName) + ' <em>(optional)</em></span><input type="text" id="dlm-zg-name" placeholder="' + esc(T.zielgruppeNamePh) + '" maxlength="160"></label>';
    dialog({
      title: T.zielgruppeNewTitle,
      body: body,
      actions: [
        { label: T.cancel },
        {
          label: T.create, primary: true, onClick: function (wrap) {
            var produkt = qs('#dlm-zg-produkt', wrap).value.trim();
            var name = qs('#dlm-zg-name', wrap).value.trim();
            if (!produkt) { toast('Bitte ein Produkt eingeben.'); return false; }
            var row = {
              firma_id: firmaId, produkt: produkt, name: name || ('Zielgruppe für ' + produkt),
              brief: { produkt: produkt }, kurzprofil_status: 'leer', analyse_status: 'leer',
              interview: { frage: 1, uebersprungen: [], fertig: false }
            };
            DB.post('me_projects', row, 'return=representation').then(function (rows) {
              var p = rows && rows[0];
              if (p) location.hash = '#/z/' + p.id + '?tab=interview';
            });
          }
        }
      ]
    });
    setTimeout(function () { var el = qs('#dlm-zg-produkt'); if (el) el.focus(); }, 30);
  }

  function openZielgruppeMenu(id) {
    var p = arr(STATE.projects).filter(function (x) { return x.id === id; })[0];
    dialog({
      title: p ? zielgruppeName(p) : 'Zielgruppe',
      body: '<label class="dlm-field"><span>' + esc(T.rename) + '</span><input type="text" id="dlm-zg-rename-input" value="' + esc(p ? zielgruppeName(p) : '') + '"></label>',
      actions: [
        { label: T.cancel },
        {
          label: T.archive, onClick: function () {
            confirmDialog(T.zielgruppeArchiveConfirm, function () {
              DB.patch('me_projects?id=eq.' + id, { archiviert: true }).then(function () { renderZielgruppenGrid(STATE.firma.id); });
            });
            return false;
          }
        },
        {
          label: T.save, primary: true, onClick: function () {
            var name = qs('#dlm-zg-rename-input').value.trim();
            if (!name) return false;
            DB.patch('me_projects?id=eq.' + id, { name: name }).then(function () { renderZielgruppenGrid(STATE.firma.id); });
          }
        }
      ]
    });
  }

  function openFirmaMenu() {
    confirmDialog(T.firmaArchiveConfirm, function () {
      DB.patch('me_firmen?id=eq.' + STATE.firma.id, { archiviert: true }).then(function () { location.hash = '#/'; });
    });
  }

  /* ------------------------------------------------------------------
     14) Avatar-Zeilen-Helfer (me_avatare, SPEC §12.1)
     ------------------------------------------------------------------ */
  function avRowInitials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function avRowChosenImageUrl(a) {
    var bilder = Array.isArray(a.bilder) ? a.bilder : [];
    var chosen = a.gewaehlt ? bilder.filter(function (b) { return b && b.stil === a.gewaehlt; })[0] : bilder[0];
    return chosen ? chosen.url : null;
  }
  function avRowPicHtml(a, size) {
    var url = avRowChosenImageUrl(a);
    var name = a.name || '';
    if (url) return '<img class="dlm-avatar-pic" style="width:' + size + 'px;height:' + size + 'px;" src="' + esc(url) + '" alt="">';
    return '<span class="dlm-avatar-pic dlm-avatar-initials" style="width:' + size + 'px;height:' + size + 'px;">' + esc(avRowInitials(name)) + '</span>';
  }
  function avRowProfil(a) { return (a && a.profil && typeof a.profil === 'object') ? a.profil : {}; }

  /* ------------------------------------------------------------------
     15) Ansicht: Zielgruppe (Stepper: Interview / Zielgruppe / Winkel / Avatare)
     ------------------------------------------------------------------ */
  function tabStatus(project) {
    var winkelCount = arr(project.winkel_auswahl).length;
    return {
      interview: true,
      zielgruppe: true,
      zielgruppeDone: project.kurzprofil_status === 'fertig',
      winkel: project.kurzprofil_status === 'fertig' || project.analyse_status === 'fertig',
      winkelDone: winkelCount >= 5,
      avatare: project.kurzprofil_status === 'fertig' || project.analyse_status === 'fertig'
    };
  }

  function loadFirmaForProject(p) {
    if (STATE.firma && STATE.firma.id === p.firma_id) return Promise.resolve(STATE.firma);
    return DB.get('me_firmen?select=*&id=eq.' + p.firma_id).then(function (rows) {
      STATE.firma = rows && rows[0];
      return STATE.firma;
    });
  }

  function renderZielgruppeRoute(r) {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-loading">Lädt...</div></div>';
    DB.get('me_projects?select=*&id=eq.' + r.projectId).then(function (rows) {
      var p = rows && rows[0];
      if (!p) { app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">Zielgruppe nicht gefunden.</div></div>'; return; }
      STATE.project = p;
      return loadFirmaForProject(p).then(function () {
        resumeRunningJobs(p.id, null, function () { renderZielgruppeRoute(parseHash()); });
        renderCrumbs(r);
        var tab = r.params.tab || (p.interview && p.interview.fertig ? 'zielgruppe' : 'interview');
        var st = tabStatus(p);
        if (tab === 'winkel' && !st.winkel) tab = 'interview';
        if (tab === 'avatare' && !st.avatare) tab = 'interview';

        app.innerHTML =
          '<div class="dlm-wrap">' +
          '<div class="dlm-head-row"><div><h1 class="dlm-title">' + esc(zielgruppeName(p)) + '</h1>' +
          '<p class="dlm-muted dlm-small">' + esc(p.produkt || '') + '</p></div></div>' +
          '<nav class="dlm-stepper" id="dlm-stepper">' +
          stepperTab(1, 'interview', T.tabInterview, true, !!(p.interview && p.interview.fertig), tab, '') +
          stepperTab(2, 'zielgruppe', T.tabZielgruppe, true, st.zielgruppeDone, tab, '') +
          stepperTab(3, 'winkel', T.tabWinkel, st.winkel, st.winkelDone, tab, T.tabWinkelHint) +
          stepperTab(4, 'avatare', T.tabAvatare, st.avatare, arr(STATE.avatare).length > 0, tab, T.tabAvatareHint) +
          '</nav>' +
          '<div id="dlm-tab-body"></div>' +
          '</div>';

        qsa('.dlm-tab', $('dlm-stepper')).forEach(function (btn) {
          if (btn.classList.contains('dlm-tab-disabled')) return;
          btn.addEventListener('click', function () { setTab(btn.getAttribute('data-tab')); });
        });

        var body = $('dlm-tab-body');
        if (tab === 'zielgruppe') renderZielgruppeTab(body, p);
        else if (tab === 'winkel') renderWinkelTab(body, p);
        else if (tab === 'avatare') renderAvatareTab(body, p);
        else renderBriefTab(body, p);
      });
    }).catch(function () {
      app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">' + esc(T.genericError) + '</div></div>';
    });
  }

  var ICON_CHECK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"></path></svg>';

  function stepperTab(num, key, label, enabled, done, current, disabledHint) {
    var cls = 'dlm-tab' + (key === current ? ' dlm-tab-active' : '') + (enabled ? '' : ' dlm-tab-disabled');
    var circle = '<span class="dlm-tab-num' + (done ? ' dlm-tab-num-done' : '') + '">' + (done ? ICON_CHECK : num) + '</span>';
    var title = !enabled && disabledHint ? ' title="' + esc(disabledHint) + '"' : '';
    return '<button type="button" class="' + cls + '" data-tab="' + key + '"' + title + (enabled ? '' : ' aria-disabled="true"') + '>' + circle + '<span>' + esc(label) + '</span></button>';
  }

  /* --- Tab 1: Interview --------------------------------------------- */
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
      var patch = { brief: brief2 };
      if (brief2.produkt) patch.produkt = brief2.produkt;
      DB.patch('me_projects?id=eq.' + p.id, patch).then(function () {
        var hint = $('dlm-brief-savehint');
        if (hint) hint.textContent = T.briefSaved + ' ' + new Date().toLocaleTimeString('de-DE');
        p.brief = brief2;
        if (patch.produkt) p.produkt = patch.produkt;
      });
    }, 800);
    form.addEventListener('input', save);
    form.addEventListener('change', save);
  }

  /* --- Interview-Onboarding (Sprachmemo, Skip) ------------------------ */
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
      var patch = { brief: brief2, interview: interview };
      if (q.feld === 'produkt') patch.produkt = value;
      DB.patch('me_projects?id=eq.' + p.id, patch).then(function () {
        p.brief = brief2;
        p.interview = interview;
        if (q.feld === 'produkt') p.produkt = value;
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
      var patch = { brief: brief2 };
      if (brief2.produkt) patch.produkt = brief2.produkt;
      DB.patch('me_projects?id=eq.' + p.id, patch).then(function () { p.brief = brief2; if (patch.produkt) p.produkt = patch.produkt; });
    }, 800);
    form.addEventListener('input', save);
    form.addEventListener('change', save);
  }

  /* ------------------------------------------------------------------
     16) Tab 2: Zielgruppe (Kurzprofil-Übersicht + Detailanalyse, SPEC §12.3)
     ------------------------------------------------------------------ */
  function progressBaseKind(kind) {
    if (STATUS_TEXTS[kind]) return kind;
    if (kind.indexOf('asset-') === 0) return 'asset';
    return 'analyse';
  }
  function progressTitle(kind) {
    if (kind === 'kurzprofil') return T.kurzprofilRunningTitle;
    if (kind === 'analyse') return 'Detailanalyse wird erstellt';
    if (kind === 'winkel') return 'Marketing-Winkel werden erzeugt';
    if (kind === 'avatar_vorschlag') return T.avatarVorschlagenRunning;
    if (kind === 'konsistenz') return 'Konsistenz wird geprüft';
    if (kind === 'decode') return T.vorlagenDecoding;
    if (kind.indexOf('asset-') === 0) return assetLabel(kind.slice(6)) + ' werden erzeugt';
    return 'Wird erzeugt';
  }
  function progressCardHtml(kind) {
    var base = progressBaseKind(kind);
    return '<div class="dlm-progress-card">' +
      '<h3 class="dlm-progress-title">' + esc(progressTitle(kind)) + '</h3>' +
      '<p class="dlm-progress-hint">' + (kind === 'kurzprofil' ? esc(T.kurzprofilRunningHint) : 'Das dauert 1 bis 4 Minuten, du kannst währenddessen den Tab wechseln.') + '</p>' +
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
  function cancelRunning(key) {
    var r = STATE.running[key];
    if (r && r.cancel) r.cancel();
    delete STATE.running[key];
  }
  function progressKindFromJob(job) {
    if (job.task === 'kurzprofil') return 'kurzprofil';
    if (job.task === 'analyse' || job.task === 'verfeinern') return 'analyse';
    if (job.task === 'winkel') return 'winkel';
    if (job.task === 'avatar_vorschlag') return 'avatar_vorschlag';
    if (job.task === 'konsistenz') return 'konsistenz';
    if (job.task === 'decode') return 'decode';
    if (job.task === 'asset') return 'asset-' + job.typ;
    return job.task;
  }
  function runningKeyFromJob(job) {
    var kind = progressKindFromJob(job);
    if (kind === 'kurzprofil' || kind === 'analyse' || kind === 'winkel' || kind === 'avatar_vorschlag') return kind + '-' + job.project_id;
    if (kind === 'konsistenz') return 'konsistenz-' + job.campaign_id;
    if (kind === 'decode') return 'decode-' + job.template_id;
    if (kind.indexOf('asset-') === 0) return 'asset-' + job.campaign_id + '-' + job.typ;
    return kind + '-' + job.id;
  }
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
        var was = job.task === 'kurzprofil' ? 'Kurzprofil' : job.task === 'winkel' ? 'Winkel' : job.task === 'avatar_vorschlag' ? 'Avatar-Vorschlag' :
          job.task === 'konsistenz' ? 'Konsistenz-Check' : job.task === 'asset' ? assetLabel(job.typ) : job.task === 'decode' ? 'Creative-Decoder' : 'Detailanalyse';
        if (namen.indexOf(was) < 0) namen.push(was);
      });
      toast((neu.length === 1 ? namen[0] + ' ist fehlgeschlagen: ' + (neu[0].fehler || T.genericError) : 'Einige Läufe sind fehlgeschlagen (' + namen.join(', ') + '): ' + (neu[0].fehler || T.genericError)) + ' Bitte starte sie noch einmal.');
    }).catch(function () {});
  }

  function runKurzprofil(id) {
    STATE.running['kurzprofil-' + id] = { pending: true };
    renderZielgruppeRoute(parseHash());
    var run = AI.run({ uid: STATE.profile.uid, task: 'kurzprofil', project_id: id }, {
      onProgress: function (job) { updateProgressChars('kurzprofil', job.chars || 0); }
    });
    STATE.running['kurzprofil-' + id] = { cancel: run.cancel };
    startProgressRotation('kurzprofil');
    run.promise.then(function () {
      delete STATE.running['kurzprofil-' + id];
      stopProgressRotation('kurzprofil');
      /* Das Backend startet danach automatisch die Detailanalyse (eigener Job);
         ein kurzer Aufschub gibt ihr Zeit, angelegt zu werden, bevor resumeRunningJobs
         beim naechsten Rendern danach sucht. */
      setTimeout(function () { renderZielgruppeRoute(parseHash()); }, 1200);
    }).catch(function (err) {
      delete STATE.running['kurzprofil-' + id];
      stopProgressRotation('kurzprofil');
      toast(err && err.message ? err.message : T.genericError);
      renderZielgruppeRoute(parseHash());
    });
  }

  function runAnalyseTask(id, task, hinweis) {
    STATE.running['analyse-' + id] = { pending: true };
    renderZielgruppeRoute(parseHash());
    var run = AI.run({ uid: STATE.profile.uid, task: task, project_id: id, hinweis: hinweis || undefined }, {
      onProgress: function (job) {
        updateProgressChars('analyse', job.chars || 0);
        updateProgressTeil('analyse', job.teil_fertig, job.teile);
      }
    });
    STATE.running['analyse-' + id] = { cancel: run.cancel };
    startProgressRotation('analyse');
    run.promise.then(function () {
      delete STATE.running['analyse-' + id];
      stopProgressRotation('analyse');
      renderZielgruppeRoute(parseHash());
    }).catch(function (err) {
      delete STATE.running['analyse-' + id];
      stopProgressRotation('analyse');
      toast(err && err.message ? err.message : T.genericError);
      renderZielgruppeRoute(parseHash());
    });
  }

  /* --- Kurzprofil-Übersicht ------------------------------------------ */
  function renderKurzprofilUebersicht(kp) {
    kp = kp || {};
    var steckbrief = kp.steckbrief || {};
    var html = '<div class="dlm-kurzprofil">';
    html += '<div class="dlm-steckbrief-card">' +
      '<div class="dlm-steckbrief-row"><strong>' + esc(steckbrief.wer || 'Nicht vorhanden') + '</strong></div>' +
      '<div class="dlm-chips">' +
      (steckbrief.alter ? '<span class="dlm-chip">' + esc(steckbrief.alter) + '</span>' : '') +
      (steckbrief.situation ? '<span class="dlm-chip">' + esc(steckbrief.situation) + '</span>' : '') +
      (steckbrief.einkommen_niveau ? '<span class="dlm-chip">' + esc(steckbrief.einkommen_niveau) + '</span>' : '') +
      (steckbrief.entscheidet ? '<span class="dlm-chip">Entscheidet: ' + esc(steckbrief.entscheidet) + '</span>' : '') +
      '</div></div>';

    function triCol(title, items, satzKey, titelKey) {
      return '<div class="dlm-tri-col"><h4>' + esc(title) + '</h4>' + arr(items).map(function (it) {
        it = it || {};
        return '<div class="dlm-tri-card"><strong>' + esc(it[titelKey] || '') + '</strong><p>' + esc(it[satzKey] || '') + '</p></div>';
      }).join('') + '</div>';
    }
    html += '<div class="dlm-tri-grid">' +
      triCol('Schmerzen', kp.schmerzen, 'satz', 'titel') +
      triCol('Wünsche', kp.wuensche, 'satz', 'titel') +
      (function () {
        return '<div class="dlm-tri-col"><h4>Situationen</h4>' + arr(kp.situationen).map(function (it) {
          it = it || {};
          return '<div class="dlm-tri-card"><strong>' + esc(it.wann_wo || '') + '</strong><p>' + esc(it.was_passiert || '') + '</p></div>';
        }).join('') + '</div>';
      })() +
      '</div>';

    var awareness = kp.awareness || {}, markt = kp.markt || {};
    html += '<div class="dlm-badge-row">' +
      (awareness.stufe ? '<span class="dlm-badge">Awareness: ' + esc(awareness.stufe) + (awareness.begruendung ? ' · ' + esc(awareness.begruendung) : '') + '</span>' : '') +
      (markt.saettigung ? '<span class="dlm-badge">Markt: ' + esc(markt.saettigung) + (markt.satz ? ' · ' + esc(markt.satz) : '') + '</span>' : '') +
      '</div>';

    if (arr(kp.zitate).length) {
      html += '<h4 class="dlm-subtitle-sm">Zitate</h4><div class="dlm-zitate-row">' +
        arr(kp.zitate).map(function (z) { return '<div class="dlm-sprechblase">' + esc(z) + '</div>'; }).join('') + '</div>';
    }

    if (arr(kp.einwaende).length) {
      html += '<h4 class="dlm-subtitle-sm">Einwände</h4><div class="dlm-accordion">' +
        arr(kp.einwaende).map(function (e, i) {
          e = e || {};
          return '<div class="dlm-acc-item' + (i === 0 ? ' dlm-acc-open' : '') + '">' +
            '<button type="button" class="dlm-acc-head" data-action="toggle-acc"><span>' + esc(e.einwand || '') + '</span>' +
            '<svg class="dlm-acc-caret" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg></button>' +
            '<div class="dlm-acc-body"><div class="dlm-acc-view"><p><strong>' + esc(T.einwaendeAntwortIdee) + ':</strong> ' + esc(e.antwort_idee || '') + '</p></div></div></div>';
        }).join('') + '</div>';
    }

    html += '<div class="dlm-chips-row2">' +
      (arr(kp.kaufausloeser).length ? '<div><h4 class="dlm-subtitle-sm">Kaufauslöser</h4><div class="dlm-chips">' + arr(kp.kaufausloeser).map(function (k) { return '<span class="dlm-chip">' + esc(k) + '</span>'; }).join('') + '</div></div>' : '') +
      (arr(kp.kanaele).length ? '<div><h4 class="dlm-subtitle-sm">Kanäle</h4><div class="dlm-chips">' + arr(kp.kanaele).map(function (k) { return '<span class="dlm-chip">' + esc(k) + '</span>'; }).join('') + '</div></div>' : '') +
      '</div>';

    if (kp.ein_satz) html += '<div class="dlm-ein-satz">' + esc(kp.ein_satz) + '</div>';
    html += '</div>';
    return html;
  }

  /* --- Detailanalyse: Kategorie-Karten (SPEC §12.3) -------------------- */
  function catSkeletonHtml() {
    return '<div class="dlm-skeleton-card"><div class="dlm-skeleton-line dlm-skeleton-w60"></div>' +
      '<div class="dlm-skeleton-line dlm-skeleton-w90"></div><div class="dlm-skeleton-line dlm-skeleton-w75"></div>' +
      '<p class="dlm-muted dlm-small">' + esc(T.teilWirdErstellt) + '</p></div>';
  }
  function catFehlerHtml(key) {
    return '<div class="dlm-cat-fehler"><p class="dlm-muted">' + esc(T.teilFehler) + '</p>' +
      '<button type="button" class="dlp-btn dlp-ghost dlm-small-btn" data-action="retry-teil" data-cat="' + esc(key) + '">' + esc(T.teilRetry) + '</button></div>';
  }
  function paareTableHtml(paare) {
    if (!arr(paare).length) return '';
    return '<table class="dlm-table dlm-paare-table"><thead><tr><th>' + esc(T.wegVonSpalte) + '</th><th>' + esc(T.hinZuSpalte) + '</th></tr></thead><tbody>' +
      arr(paare).map(function (pr) {
        pr = pr || {};
        return '<tr><td>' + esc(pr.weg_von || '') + '</td><td>' + esc(pr.hin_zu || '') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function zahlTileHtml(zahl) {
    if (!zahl || (!zahl.wert && zahl.wert !== 0)) return '';
    return '<div class="dlm-zahl-tile"><span class="dlm-zahl-wert">' + esc(zahl.wert) + (zahl.einheit ? ' ' + esc(zahl.einheit) : '') + '</span>' +
      (zahl.label ? '<span class="dlm-zahl-label">' + esc(zahl.label) + '</span>' : '') + '</div>';
  }

  /* Rendert eine Kategorie-Karte. teilStatus: 'fertig' | 'fehler' | undefined (noch nicht dran). */
  function renderCategoryCard(key, fallbackTitle, cat, teilStatus, detailliert, catIndex) {
    if (!cat && teilStatus === 'fehler') return '<div class="dlm-cat-card" data-cat="' + key + '">' + catFehlerHtml(key) + '</div>';
    if (!cat && teilStatus !== 'fertig') return '<div class="dlm-cat-card">' + catSkeletonHtml() + '</div>';
    cat = cat || {};
    var titel = (cat.titel && String(cat.titel).replace(/_/g, ' ').toLowerCase() !== key.replace(/_/g, ' ') && String(cat.titel).length > 3) ? cat.titel : fallbackTitle;
    var kern = arr(cat.kern);
    var num = String(catIndex); if (num.length < 2) num = '0' + num;
    var html = '<div class="dlm-cat-card" data-cat="' + key + '">' +
      '<div class="dlm-cat-head"><span class="dlm-acc-num">' + num + '</span><h4>' + esc(titel) + '</h4></div>' +
      zahlTileHtml(cat.zahl);
    html += '<div class="dlm-cat-view">';
    if (kern.length) {
      html += '<ul class="dlm-kern-list">' + kern.map(function (k) { return '<li>' + inlineMd(k) + '</li>'; }).join('') + '</ul>';
    }
    var showInhalt = detailliert || !kern.length;
    if (showInhalt) html += mdMini(cat.inhalt);
    if (arr(cat.punkte).length) html += '<ul class="dlm-punkte">' + arr(cat.punkte).map(function (pt) { return '<li>' + esc(pt) + '</li>'; }).join('') + '</ul>';
    if (key === 'hin_zu' && arr(cat.paare).length) html += paareTableHtml(cat.paare);
    html += '</div>';
    html += '<div class="dlm-acc-edit" hidden><textarea class="dlm-cat-edit-kern" rows="4" placeholder="Ein Stichpunkt je Zeile">' + esc(kern.join('\n')) + '</textarea>' +
      '<textarea class="dlm-cat-edit-inhalt" rows="6">' + esc(cat.inhalt || '') + '</textarea>' +
      '<div class="dlm-acc-edit-actions"><button type="button" class="dlp-btn dlp-primary" data-action="save-cat" data-cat="' + key + '">' + esc(T.save) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="cancel-cat">' + esc(T.cancel) + '</button></div></div>';
    html += '<div class="dlm-acc-actions">' +
      '<button type="button" class="dlm-text-btn" data-action="edit-cat" data-cat="' + key + '">Bearbeiten</button>' +
      '<button type="button" class="dlm-text-btn" data-action="copy-cat" data-cat="' + key + '">Kopieren</button>' +
      '</div></div>';
    return html;
  }

  function renderDetailanalyse(p) {
    var analyse = p.analyse || {};
    var teile = p.analyse_teile || {};
    var modus = STATE.analyseModus;
    var html = '<h2 class="dlm-subtitle" id="dlm-detailanalyse">' + esc(T.detailanalyseTitle) + '</h2>';
    html += '<div class="dlm-modus-toggle" role="group" aria-label="Ansicht">' +
      '<button type="button" class="dlm-modus-btn' + (modus === 'einfach' ? ' dlm-modus-active' : '') + '" data-modus="einfach">' + esc(T.modusEinfach) + '</button>' +
      '<button type="button" class="dlm-modus-btn' + (modus === 'detailliert' ? ' dlm-modus-active' : '') + '" data-modus="detailliert">' + esc(T.modusDetailliert) + '</button>' +
      '</div>';
    html += '<nav class="dlm-jumpbar" id="dlm-jumpbar">' + ANALYSE_AREAS.map(function (area) {
      return '<a class="dlm-chip dlm-jump-chip" href="#dlm-area-' + area.key + '">' + esc(area.label) + '</a>';
    }).join('') + '</nav>';

    var catIndex = 0;
    ANALYSE_AREAS.forEach(function (area) {
      html += '<h3 class="dlm-subtitle dlm-area-heading" id="dlm-area-' + area.key + '">' + esc(area.label) + '</h3>';
      html += '<div class="dlm-cat-grid">';
      area.cats.forEach(function (key) {
        var fallbackTitle = (ANALYSE_CATS.filter(function (c) { return c[0] === key; })[0] || [key, key])[1];
        var teilKey = CAT_TEIL[key];
        var teilStatus = teile[teilKey];
        var hasCat = analyse[key] && typeof analyse[key] === 'object';
        catIndex++;
        html += renderCategoryCard(key, fallbackTitle, hasCat ? analyse[key] : null, hasCat ? 'fertig' : teilStatus, modus === 'detailliert', catIndex);
      });
      html += '</div>';
    });
    return html;
  }

  function renderZielgruppeTab(body, p) {
    var html = '';
    if (p.kurzprofil_status === 'laeuft') {
      body.innerHTML = progressCardHtml('kurzprofil');
      startProgressRotation('kurzprofil');
      return;
    }
    if (p.kurzprofil_status !== 'fertig' || !p.kurzprofil) {
      body.innerHTML = '<div class="dlm-empty-block">' +
        '<h3>' + esc(T.kurzprofilEmptyTitle) + '</h3><p>' + esc(T.kurzprofilEmptyText) + '</p>' +
        '<button type="button" class="dlp-btn dlp-primary" data-action="run-kurzprofil" data-id="' + esc(p.id) + '">' + esc(T.kurzprofilCreate) + '</button>' +
        '</div>';
      return;
    }
    html += renderKurzprofilUebersicht(p.kurzprofil);
    html += '<div class="dlm-toolbar">' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="refine-analyse" data-id="' + esc(p.id) + '">' + esc(T.zielgruppeRefine) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="redo-analyse" data-id="' + esc(p.id) + '">' + esc(T.zielgruppeRedo) + '</button>' +
      '<button type="button" class="dlp-btn dlp-ghost" data-action="export-analyse" data-id="' + esc(p.id) + '">' + esc(T.zielgruppeExport) + '</button>' +
      '</div>';
    if (STATE.running['analyse-' + p.id]) {
      html += progressCardHtml('analyse');
    }
    html += renderDetailanalyse(p);
    body.innerHTML = html;
    if (STATE.running['analyse-' + p.id]) startProgressRotation('analyse');
  }

  /* --- Tab 3: Winkel (unveraendert gegenueber 1.2, SPEC §11.5) --------- */
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

  function renderWinkelTab(body, p) {
    var st = tabStatus(p);
    if (!st.winkel) {
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
    renderZielgruppeRoute(parseHash());
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
      renderZielgruppeRoute(parseHash());
    }).catch(function (err) {
      delete STATE.running[key];
      stopProgressRotation('winkel');
      toast(err && err.message ? err.message : T.genericError);
      renderZielgruppeRoute(parseHash());
    });
  }

  function toggleWinkelAuswahl(projectId, winkelId, checked) {
    var p = STATE.project;
    var auswahl = arr(p.winkel_auswahl).slice();
    var idx = auswahl.indexOf(winkelId);
    if (checked && idx === -1) {
      if (auswahl.length >= 10) { toast(T.winkelCountOver); renderZielgruppeRoute(parseHash()); return; }
      auswahl.push(winkelId);
    } else if (!checked && idx !== -1) {
      auswahl.splice(idx, 1);
    }
    p.winkel_auswahl = auswahl;
    DB.patch('me_projects?id=eq.' + projectId, { winkel_auswahl: auswahl }).then(function () {
      renderZielgruppeRoute(parseHash());
    });
  }

  /* ------------------------------------------------------------------
     17) Tab 4: Avatare (me_avatare, SPEC §12.2/§12.4)
     ------------------------------------------------------------------ */
  function avatarCardHtml(a) {
    var profil = avRowProfil(a);
    var berufZeile = [profil.alter ? (profil.alter + ' Jahre') : '', profil.beruf || ''].filter(Boolean).join(' · ');
    return '<div class="dlp-card dlm-avatar-card" data-open-avatar="' + esc(a.id) + '">' +
      '<div class="dlm-card-menu"><button type="button" class="dlm-icon-btn" data-action="avatar-menu" data-id="' + esc(a.id) + '" aria-label="Menü">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle></svg></button></div>' +
      '<div class="dlm-avatar-card-head">' + avRowPicHtml(a, 56) +
      '<div><h3 class="dlm-project-title"><span>' + esc(a.name || 'Ohne Namen') + '</span></h3>' +
      (berufZeile ? '<p class="dlm-muted dlm-small">' + esc(berufZeile) + '</p>' : '') +
      (profil.motto ? '<p class="dlm-avatar-motto-mini">&raquo;' + esc(profil.motto) + '&laquo;</p>' : '') + '</div></div>' +
      '</div>';
  }

  function renderAvatareTab(body, p) {
    var st = tabStatus(p);
    if (!st.avatare) {
      body.innerHTML = '<div class="dlm-empty-block"><p>' + esc(T.needAnalyse) + '</p></div>';
      return;
    }
    var running = !!STATE.running['avatar_vorschlag-' + p.id];
    body.innerHTML = '<div class="dlm-toolbar">' +
      '<button type="button" class="dlp-btn dlp-primary" data-action="new-avatar" data-id="' + esc(p.id) + '">' + esc(T.avatarNewCard) + '</button>' +
      (running ? '' : '<button type="button" class="dlp-btn dlp-ghost" data-action="run-avatar-vorschlag" data-id="' + esc(p.id) + '">' + esc(T.avatarVorschlagen) + '</button>') +
      '</div>' +
      (running ? progressCardHtml('avatar_vorschlag') : '') +
      '<div id="dlm-avatare-grid" class="dlm-grid"><div class="dlm-loading">Lädt...</div></div>';
    if (running) startProgressRotation('avatar_vorschlag');

    DB.get('me_avatare?select=*&project_id=eq.' + p.id + '&order=created_at.desc').then(function (rows) {
      STATE.avatare = rows || [];
      var grid = $('dlm-avatare-grid');
      if (!grid) return;
      if (!STATE.avatare.length) {
        grid.innerHTML = '<div class="dlm-empty-block"><h3>' + esc(T.avatareEmptyTitle) + '</h3><p>' + esc(T.avatareEmptyText) + '</p></div>';
        return;
      }
      grid.innerHTML = STATE.avatare.map(avatarCardHtml).join('');
      qsa('[data-open-avatar]', grid).forEach(function (el) {
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-action="avatar-menu"]')) return;
          location.hash = '#/z/' + p.id + '/a/' + el.getAttribute('data-open-avatar');
        });
      });
    }).catch(function () {
      var grid = $('dlm-avatare-grid');
      if (grid) grid.innerHTML = '<div class="dlm-empty">' + esc(T.genericError) + '</div>';
    });
  }

  function openNewAvatarDialog(projectId) {
    dialog({
      title: T.avatarNewTitle,
      body: '<label class="dlm-field"><span>' + esc(T.avatarLabelName) + '</span><input type="text" id="dlm-new-avatar-name" maxlength="120"></label>',
      actions: [
        { label: T.cancel },
        {
          label: T.create, primary: true, onClick: function () {
            var name = qs('#dlm-new-avatar-name').value.trim();
            if (!name) { toast('Bitte einen Namen eingeben.'); return false; }
            DB.post('me_avatare', { project_id: projectId, name: name, profil: {} }, 'return=representation').then(function (rows) {
              var a = rows && rows[0];
              if (a) location.hash = '#/z/' + projectId + '/a/' + a.id;
            });
          }
        }
      ]
    });
  }

  function openAvatarMenu(id) {
    var a = arr(STATE.avatare).filter(function (x) { return x.id === id; })[0];
    dialog({
      title: a ? (a.name || 'Avatar') : 'Avatar',
      body: '<label class="dlm-field"><span>' + esc(T.rename) + '</span><input type="text" id="dlm-avatar-rename-input" value="' + esc(a ? a.name : '') + '"></label>',
      actions: [
        { label: T.cancel },
        {
          label: T.delete, onClick: function () {
            confirmDialog(T.avatarDeleteConfirm, function () {
              DB.del('me_avatare?id=eq.' + id).then(function () { renderAvatareTab($('dlm-tab-body'), STATE.project); });
            });
            return false;
          }
        },
        {
          label: T.save, primary: true, onClick: function () {
            var name = qs('#dlm-avatar-rename-input').value.trim();
            if (!name) return false;
            DB.patch('me_avatare?id=eq.' + id, { name: name }).then(function () { renderAvatareTab($('dlm-tab-body'), STATE.project); });
          }
        }
      ]
    });
  }

  function runAvatarVorschlag(projectId) {
    STATE.running['avatar_vorschlag-' + projectId] = { pending: true };
    renderZielgruppeRoute(parseHash());
    var run = AI.run({ uid: STATE.profile.uid, task: 'avatar_vorschlag', project_id: projectId }, {
      onProgress: function (job) { updateProgressChars('avatar_vorschlag', job.chars || 0); }
    });
    STATE.running['avatar_vorschlag-' + projectId] = { cancel: run.cancel };
    startProgressRotation('avatar_vorschlag');
    run.promise.then(function () {
      delete STATE.running['avatar_vorschlag-' + projectId];
      stopProgressRotation('avatar_vorschlag');
      renderZielgruppeRoute(parseHash());
    }).catch(function (err) {
      delete STATE.running['avatar_vorschlag-' + projectId];
      stopProgressRotation('avatar_vorschlag');
      toast(err && err.message ? err.message : T.genericError);
      renderZielgruppeRoute(parseHash());
    });
  }

  /* ------------------------------------------------------------------
     18) Route: Avatar-Profil (#/z/<id>/a/<aid>)
     ------------------------------------------------------------------ */
  function avatarSlotHtml(a, stil, label) {
    var bilder = Array.isArray(a.bilder) ? a.bilder : [];
    var eintrag = bilder.filter(function (b) { return b && b.stil === stil; })[0];
    var running = !!STATE.running['avatarbild-' + a.id + '-' + stil];
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
  function renderAvatarBildSpalte(a) {
    var html = '<div class="dlm-avatar-bildspalte"><div class="dlm-avatar-big-pic">' + avRowPicHtml(a, 260) + '</div>';
    var profil = avRowProfil(a);
    var hatGrundlage = profil.bild_prompt || profil.alter || profil.beruf || profil.aussehen;
    if (!hatGrundlage) {
      html += '<p class="dlm-muted dlm-small">' + esc(T.avatarBilderHint) + '</p>';
    } else {
      html += '<div class="dlm-avatar-slots">' + AVATAR_STILE.map(function (s) { return avatarSlotHtml(a, s[0], s[1]); }).join('') + '</div>' +
        '<div class="dlm-toolbar"><button type="button" class="dlp-btn dlp-ghost" data-action="gen-avatar-bild-all">' + esc(T.avatarBilderAlle) + '</button></div>';
    }
    html += '</div>';
    return html;
  }

  function werteChipsHtml(werte) {
    return werte.map(function (w, i) {
      return '<span class="dlm-chip dlm-chip-removable">' + esc(w) +
        '<button type="button" class="dlm-chip-x" data-werte-remove="' + i + '" aria-label="Entfernen">&times;</button></span>';
    }).join('');
  }

  function renderAvatarVisitenkarte(a) {
    var profil = avRowProfil(a);
    var berufZeile = [profil.alter ? (profil.alter + ' Jahre') : '', profil.beruf || ''].filter(Boolean).join(' · ');
    return '<div class="dlm-avatar-visitenkarte" id="dlm-avatar-visitenkarte">' +
      '<h3 class="dlm-subtitle" style="margin-top:0;">' + esc(T.avatarVisitenkarteTitel) + '</h3>' +
      '<div class="dlm-avatar-visitenkarte-head">' + avRowPicHtml(a, 72) +
      '<div><h3 class="dlm-title" style="margin:0;">' + esc(a.name || '') + '</h3>' +
      (berufZeile ? '<p class="dlm-muted">' + esc(berufZeile) + '</p>' : '') +
      (profil.motto ? '<p class="dlm-avatar-motto">&raquo;' + esc(profil.motto) + '&laquo;</p>' : '') +
      '</div></div>' +
      (arr(profil.werte).length ? '<div class="dlm-chips">' + arr(profil.werte).map(function (w) { return '<span class="dlm-chip">' + esc(w) + '</span>'; }).join('') + '</div>' : '') +
      (profil.kurzbeschreibung ? '<p class="dlm-avatar-kurz">' + esc(profil.kurzbeschreibung) + '</p>' : '') +
      '</div>';
  }
  function refreshAvatarVisitenkarte(a) {
    var el = $('dlm-avatar-visitenkarte');
    if (el) el.outerHTML = renderAvatarVisitenkarte(a);
  }

  function avatarFormValues(form, werte) {
    return {
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

  function saveAvatarForm(a, form, werte, hintEl) {
    var name = form.elements.name.value.trim();
    var fields = avatarFormValues(form, werte);
    DB.get('me_avatare?select=id,profil&id=eq.' + a.id).then(function (rows) {
      var fresh = rows && rows[0];
      var freshProfil = fresh ? avRowProfil(fresh) : avRowProfil(a);
      var merged = Object.assign({}, freshProfil, fields);
      return DB.patch('me_avatare?id=eq.' + a.id, { name: name || a.name, profil: merged }).then(function () {
        a.name = name || a.name;
        a.profil = merged;
        if (STATE.avatar && STATE.avatar.id === a.id) { STATE.avatar.name = a.name; STATE.avatar.profil = merged; }
        if (hintEl) hintEl.textContent = T.avatarGespeichert + ' ' + new Date().toLocaleTimeString('de-DE');
        refreshAvatarVisitenkarte(a);
      });
    }).catch(function () { toast(T.genericError); });
  }

  function wireAvatarForm(body, a, p) {
    var form = $('dlm-avatar-form');
    if (!form) return;
    var werte = arr(avRowProfil(a).werte).slice();
    var hint = $('dlm-avatar-savehint');
    var debouncedSave = debounce(function () { saveAvatarForm(a, form, werte, hint); }, 800);

    function rerenderChips() {
      var box = $('dlm-avatar-werte-chips');
      if (box) box.innerHTML = werteChipsHtml(werte);
    }
    function chipExists(val) {
      return werte.map(function (w) { return w.toLowerCase(); }).indexOf(val.toLowerCase()) !== -1;
    }

    form.addEventListener('input', debouncedSave);
    form.addEventListener('change', debouncedSave);
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
        var kp = p.kurzprofil || {};
        var analyse = p.analyse || {};
        var wunschPunkte = arr(kp.wuensche).map(function (w) { return w && w.satz; }).filter(Boolean);
        var schmerzPunkte = arr(kp.schmerzen).map(function (w) { return w && w.satz; }).filter(Boolean);
        var lf8Punkte = arr(analyse.life_force_8 && analyse.life_force_8.kern).length ? arr(analyse.life_force_8.kern) : arr(analyse.life_force_8 && analyse.life_force_8.punkte);
        lf8Punkte.slice(0, 4).map(function (t) { return truncateWords(t, 4); }).filter(Boolean).forEach(function (w) {
          if (!chipExists(w)) werte.push(w);
        });
        rerenderChips();
        if (!form.elements.ziele.value.trim() && wunschPunkte.length) form.elements.ziele.value = wunschPunkte.slice(0, 3).join('. ');
        if (!form.elements.sorge.value.trim() && schmerzPunkte[0]) form.elements.sorge.value = schmerzPunkte[0];
        uebBtn.hidden = true;
        debouncedSave();
      });
    }
  }

  function renderAvatarRoute(r) {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-loading">Lädt...</div></div>';
    Promise.all([
      DB.get('me_projects?select=*&id=eq.' + r.projectId),
      DB.get('me_avatare?select=*&id=eq.' + r.avatarId)
    ]).then(function (res) {
      var p = res[0] && res[0][0];
      var a = res[1] && res[1][0];
      if (!p || !a) { app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">Avatar nicht gefunden.</div></div>'; return; }
      STATE.project = p; STATE.avatar = a;
      return loadFirmaForProject(p).then(function () {
        renderCrumbs(r);
        var profil = avRowProfil(a);
        var werte = arr(profil.werte);
        var html = '<div class="dlm-wrap">' +
          '<div class="dlm-head-row"><h1 class="dlm-title">' + esc(a.name || 'Avatar') + '</h1>' +
          '<a class="dlp-btn dlp-ghost" href="#/z/' + esc(p.id) + '?tab=avatare">Zur Avatar-Liste</a></div>' +
          '<div class="dlm-avatar-tab-grid">' + renderAvatarBildSpalte(a) + '<div class="dlm-avatar-profilspalte">';
        if (!werte.length && (p.kurzprofil || p.analyse)) {
          html += '<div class="dlm-toolbar"><button type="button" class="dlp-btn dlp-ghost" id="dlm-avatar-uebernehmen">' + esc(T.avatarUebernehmen) + '</button></div>';
        }
        html += '<form id="dlm-avatar-form" class="dlm-form dlm-avatar-form">' +
          '<label class="dlm-field"><span>' + esc(T.avatarLabelName) + '</span><input type="text" name="name" value="' + esc(a.name || '') + '" maxlength="120"></label>' +
          '<label class="dlm-field"><span>' + esc(T.avatarLabelAlter) + '</span><input type="number" name="alter" min="0" max="120" value="' + esc(profil.alter || '') + '"></label>' +
          '<label class="dlm-field"><span>' + esc(T.avatarLabelBeruf) + '</span><input type="text" name="beruf" value="' + esc(profil.beruf || '') + '" maxlength="160"></label>' +
          '<label class="dlm-field dlm-field-wide"><span>' + esc(T.avatarLabelKurz) + '</span><textarea name="kurzbeschreibung" rows="3" maxlength="600">' + esc(profil.kurzbeschreibung || '') + '</textarea></label>' +
          '<div class="dlm-field dlm-field-wide"><span>' + esc(T.avatarLabelWerte) + '</span>' +
          '<div class="dlm-chip-input"><div class="dlm-chips" id="dlm-avatar-werte-chips">' + werteChipsHtml(werte) + '</div>' +
          '<input type="text" id="dlm-avatar-werte-input" placeholder="' + esc(T.avatarWertePh) + '" maxlength="40"></div>' +
          '<div class="dlm-chips dlm-chips-vorschlaege">' + AVATAR_WERTE_VORSCHLAEGE.map(function (w) {
            return '<button type="button" class="dlm-chip dlm-filter-chip" data-werte-vorschlag="' + esc(w) + '">' + esc(w) + '</button>';
          }).join('') + '</div></div>' +
          '<label class="dlm-field dlm-field-wide"><span>' + esc(T.avatarLabelZiele) + '</span><textarea name="ziele" rows="3" maxlength="1000" placeholder="' + esc(T.avatarZielePh) + '">' + esc(profil.ziele || '') + '</textarea></label>' +
          '<label class="dlm-field dlm-field-wide"><span>' + esc(T.avatarLabelSorge) + '</span><textarea name="sorge" rows="3" maxlength="1000">' + esc(profil.sorge || '') + '</textarea></label>' +
          '<label class="dlm-field dlm-field-wide"><span>' + esc(T.avatarLabelAussehen) + '</span><textarea name="aussehen" rows="3" maxlength="1000" placeholder="' + esc(T.avatarAussehenPh) + '">' + esc(profil.aussehen || '') + '</textarea></label>' +
          '<label class="dlm-field"><span>' + esc(T.avatarLabelMotto) + '</span><input type="text" name="motto" value="' + esc(profil.motto || '') + '" maxlength="200"></label>' +
          '<p class="dlm-save-hint dlm-field-wide" id="dlm-avatar-savehint">&nbsp;</p></form></div></div>';
        html += renderAvatarVisitenkarte(a);
        html += '</div>';
        app.innerHTML = html;
        wireAvatarForm($('app'), a, p);
      });
    }).catch(function () {
      app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">' + esc(T.genericError) + '</div></div>';
    });
  }

  function generateAvatarBild(avatarId, stil) {
    STATE.running['avatarbild-' + avatarId + '-' + stil] = { pending: true };
    renderAvatarRoute(parseHash());
    IMG.stream({ uid: STATE.profile.uid, task: 'avatar', avatar_id: avatarId, stil: stil }, { onDelta: function () {} })
      .then(function () {
        delete STATE.running['avatarbild-' + avatarId + '-' + stil];
        renderAvatarRoute(parseHash());
      }).catch(function (err) {
        delete STATE.running['avatarbild-' + avatarId + '-' + stil];
        toast(err && err.message ? err.message : T.genericError);
        renderAvatarRoute(parseHash());
      });
  }
  function generateAllAvatarBilder(avatarId) {
    AVATAR_STILE.forEach(function (s) { generateAvatarBild(avatarId, s[0]); });
  }
  function chooseAvatarBild(avatarId, stil) {
    DB.get('me_avatare?select=id,bilder&id=eq.' + avatarId).then(function (rows) {
      var fresh = rows && rows[0];
      if (!fresh) return;
      return DB.patch('me_avatare?id=eq.' + avatarId, { gewaehlt: stil }).then(function () {
        if (STATE.avatar && STATE.avatar.id === avatarId) STATE.avatar.gewaehlt = stil;
        renderAvatarRoute(parseHash());
      });
    }).catch(function () { toast(T.genericError); });
  }

  /* ------------------------------------------------------------------
     19) Ansicht: Content (SPEC §12.2)
     ------------------------------------------------------------------ */
  function zielLabel(z) { var f = ZIELE.filter(function (x) { return x[0] === z; })[0]; return f ? f[1] : z; }

  function renderContentView() {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><h1 class="dlm-title">' + esc(T.contentTitle) + '</h1>' +
      '<div id="dlm-content-auswahl" class="dlm-content-auswahl"><div class="dlm-loading">Lädt...</div></div>' +
      '<div id="dlm-content-body"></div></div>';
    DB.get('me_firmen?select=*&archiviert=eq.false&order=name.asc').then(function (firmen) {
      STATE.firmen = firmen || [];
      renderContentAuswahl();
    }).catch(function () {
      var el = $('dlm-content-auswahl');
      if (el) el.innerHTML = '<div class="dlm-empty">' + esc(T.genericError) + '</div>';
    });
  }

  function renderContentAuswahl() {
    var el = $('dlm-content-auswahl');
    if (!el) return;
    var sel = STATE.contentSel;
    if (sel.firmaId && !arr(STATE.firmen).some(function (f) { return f.id === sel.firmaId; })) sel.firmaId = null;
    var firma = arr(STATE.firmen).filter(function (f) { return f.id === sel.firmaId; })[0];

    var html = '<div class="dlm-content-select-row">';
    html += '<label class="dlm-field"><span>' + esc(T.contentFirma) + '</span><select id="dlm-content-firma"><option value="">Bitte wählen</option>' +
      arr(STATE.firmen).map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === sel.firmaId ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('') +
      '</select></label>';
    html += '<label class="dlm-field"><span>' + esc(T.contentZielgruppe) + '</span><select id="dlm-content-zielgruppe" ' + (firma ? '' : 'disabled') + '><option value="">Bitte wählen</option></select></label>';
    html += '<label class="dlm-field"><span>' + esc(T.contentAvatar) + '</span><select id="dlm-content-avatar" disabled><option value="">' + esc(T.contentAvatarOhne) + '</option></select></label>';
    html += '</div><div id="dlm-content-preview" class="dlm-content-preview"></div>';
    el.innerHTML = html;

    var firmaSel = $('dlm-content-firma'), zgSel = $('dlm-content-zielgruppe'), avSel = $('dlm-content-avatar');

    function loadZielgruppen(firmaId, preselect) {
      zgSel.disabled = true; zgSel.innerHTML = '<option value="">Lädt...</option>';
      DB.get('me_projects?select=*&archiviert=eq.false&analyse_status=eq.fertig&firma_id=eq.' + firmaId + '&order=updated_at.desc').then(function (rows) {
        STATE.projects = rows || [];
        zgSel.disabled = false;
        if (!STATE.projects.length) {
          zgSel.innerHTML = '<option value="">' + esc(T.contentKeineZielgruppeFertig) + '</option>';
          avSel.innerHTML = '<option value="">' + esc(T.contentAvatarOhne) + '</option>'; avSel.disabled = true;
          renderContentPreview(); renderContentCampaigns();
          return;
        }
        zgSel.innerHTML = '<option value="">Bitte wählen</option>' + STATE.projects.map(function (p) {
          return '<option value="' + esc(p.id) + '"' + (p.id === preselect ? ' selected' : '') + '>' + esc(zielgruppeName(p)) + '</option>';
        }).join('');
        if (preselect && STATE.projects.some(function (p) { return p.id === preselect; })) loadAvatare(preselect, sel.avatarId);
        else { sel.projectId = null; sel.avatarId = null; avSel.innerHTML = '<option value="">' + esc(T.contentAvatarOhne) + '</option>'; avSel.disabled = true; }
        renderContentPreview(); renderContentCampaigns();
      }).catch(function () { zgSel.innerHTML = '<option value="">' + esc(T.genericError) + '</option>'; });
    }
    function loadAvatare(projectId, preselect) {
      avSel.disabled = true; avSel.innerHTML = '<option value="">Lädt...</option>';
      DB.get('me_avatare?select=*&project_id=eq.' + projectId + '&order=created_at.desc').then(function (rows) {
        STATE.avatare = rows || [];
        avSel.disabled = false;
        avSel.innerHTML = '<option value="">' + esc(T.contentAvatarOhne) + '</option>' + STATE.avatare.map(function (a) {
          return '<option value="' + esc(a.id) + '"' + (a.id === preselect ? ' selected' : '') + '>' + esc(a.name || 'Avatar') + '</option>';
        }).join('');
        renderContentPreview(); renderContentCampaigns();
      }).catch(function () { avSel.innerHTML = '<option value="">' + esc(T.genericError) + '</option>'; });
    }

    if (firma) loadZielgruppen(firma.id, sel.projectId);

    firmaSel.addEventListener('change', function () {
      sel.firmaId = firmaSel.value || null;
      sel.projectId = null; sel.avatarId = null;
      saveContentSel();
      if (!sel.firmaId) {
        zgSel.disabled = true; zgSel.innerHTML = '<option value="">Bitte wählen</option>';
        avSel.disabled = true; avSel.innerHTML = '<option value="">' + esc(T.contentAvatarOhne) + '</option>';
        renderContentPreview(); renderContentCampaigns();
        return;
      }
      loadZielgruppen(sel.firmaId, null);
    });
    zgSel.addEventListener('change', function () {
      sel.projectId = zgSel.value || null;
      sel.avatarId = null;
      saveContentSel();
      if (!sel.projectId) { avSel.disabled = true; avSel.innerHTML = '<option value="">' + esc(T.contentAvatarOhne) + '</option>'; renderContentPreview(); renderContentCampaigns(); return; }
      loadAvatare(sel.projectId, null);
    });
    avSel.addEventListener('change', function () {
      sel.avatarId = avSel.value || null;
      saveContentSel();
      renderContentPreview();
      renderContentCampaigns();
    });
  }

  function renderContentPreview() {
    var el = $('dlm-content-preview');
    if (!el) return;
    var sel = STATE.contentSel;
    var firma = arr(STATE.firmen).filter(function (f) { return f.id === sel.firmaId; })[0];
    var project = arr(STATE.projects).filter(function (p) { return p.id === sel.projectId; })[0];
    var avatar = arr(STATE.avatare).filter(function (a) { return a.id === sel.avatarId; })[0];
    var html = '';
    if (firma) html += '<div class="dlm-preview-card"><strong>' + esc(firma.name) + '</strong></div>';
    if (project) html += '<div class="dlm-preview-card"><strong>' + esc(zielgruppeName(project)) + '</strong>' +
      (project.kurzprofil && project.kurzprofil.ein_satz ? '<p class="dlm-muted dlm-small">' + esc(project.kurzprofil.ein_satz) + '</p>' : '') + '</div>';
    if (avatar) html += '<div class="dlm-preview-card dlm-preview-avatar">' + avRowPicHtml(avatar, 36) + '<strong>' + esc(avatar.name || '') + '</strong></div>';
    el.innerHTML = html;
  }

  function renderContentCampaigns() {
    var body = $('dlm-content-body');
    if (!body) return;
    var sel = STATE.contentSel;
    if (!sel.firmaId) { body.innerHTML = '<div class="dlm-empty-block"><p>' + esc(T.contentWaehleFirma) + '</p></div>'; return; }
    if (!sel.projectId) { body.innerHTML = '<div class="dlm-empty-block"><p>' + esc(T.contentWaehleZielgruppe) + '</p></div>'; return; }
    body.innerHTML = '<div class="dlm-toolbar"><button type="button" class="dlp-btn dlp-primary" data-action="new-campaign">' + esc(T.kampagneNew) + '</button></div>' +
      '<div id="dlm-campaigns-list" class="dlm-grid"><div class="dlm-loading">Lädt...</div></div>';
    var path = 'me_campaigns?select=*&project_id=eq.' + sel.projectId + (sel.avatarId ? ('&avatar_id=eq.' + sel.avatarId) : '') + '&order=created_at.desc';
    DB.get(path).then(function (rows) {
      STATE.campaigns = rows || [];
      var list = $('dlm-campaigns-list');
      if (!list) return;
      if (!STATE.campaigns.length) {
        list.innerHTML = '<div class="dlm-empty-block"><h3>' + esc(T.kampagnenEmptyTitle) + '</h3><p>' + esc(T.kampagnenEmpty) + '</p>' +
          '<button type="button" class="dlp-btn dlp-primary" data-action="new-campaign">' + esc(T.kampagneNew) + '</button></div>';
        return;
      }
      list.innerHTML = STATE.campaigns.map(function (c) {
        return '<div class="dlp-card dlm-campaign-card" data-open-campaign="' + esc(c.id) + '">' +
          '<h3>' + esc(c.name) + '</h3>' +
          '<p class="dlm-muted">Ziel: ' + esc(zielLabel(c.ziel)) + '</p>' +
          '<div class="dlm-asset-icons" data-camp-assets="' + esc(c.id) + '"></div>' +
          '</div>';
      }).join('');
      qsa('[data-open-campaign]', list).forEach(function (elc) {
        elc.addEventListener('click', function () { location.hash = '#/content/k/' + elc.getAttribute('data-open-campaign'); });
      });
      STATE.campaigns.forEach(function (c) {
        DB.get('me_assets?select=typ,status&campaign_id=eq.' + c.id).then(function (assetRows) {
          var elc = qs('[data-camp-assets="' + c.id + '"]', list);
          if (!elc) return;
          var counts = {};
          arr(assetRows).forEach(function (a) { counts[a.typ] = (counts[a.typ] || 0) + 1; });
          elc.innerHTML = ASSET_TYPES.map(function (t) {
            var n = counts[t.typ] || 0;
            return '<span class="dlm-asset-icon' + (n ? ' dlm-asset-icon-on' : '') + '" title="' + esc(t.label) + '">' + n + '</span>';
          }).join('');
        }).catch(function () {});
      });
    });
  }

  function openNewCampaignDialog() {
    var sel = STATE.contentSel;
    var p = arr(STATE.projects).filter(function (x) { return x.id === sel.projectId; })[0];
    if (!p) { toast(T.contentWaehleZielgruppe); return; }
    var auswahl = p.winkel_auswahl || [];
    if (auswahl.length < 5) { toast(T.needFiveWinkel); return; }
    var winkelMap = {};
    arr(p.winkel).forEach(function (w) { winkelMap[w.id] = w; });
    var body = document.createElement('div');
    body.innerHTML =
      '<label class="dlm-field"><span>' + esc(T.kampagneName) + '</span><input type="text" id="dlm-camp-name" maxlength="120"></label>' +
      '<label class="dlm-field"><span>' + esc(T.kampagneZiel) + '</span><select id="dlm-camp-ziel">' +
      ZIELE.map(function (z) { return '<option value="' + esc(z[0]) + '">' + esc(z[1]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="dlm-field"><span>' + esc(T.kampagneAvatar) + '</span><select id="dlm-camp-avatar"><option value="">' + esc(T.contentAvatarOhne) + '</option>' +
      arr(STATE.avatare).map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === sel.avatarId ? ' selected' : '') + '>' + esc(a.name || 'Avatar') + '</option>'; }).join('') + '</select></label>' +
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
            var avatarId = qs('#dlm-camp-avatar', wrap).value || null;
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
            DB.post('me_campaigns', { project_id: p.id, avatar_id: avatarId, name: name, ziel: ziel, winkel_ids: winkelIds, angebot: angebot }, 'return=representation').then(function (rows) {
              var c = rows && rows[0];
              if (c) location.hash = '#/content/k/' + c.id;
            });
          }
        }
      ]
    });
  }

  /* ------------------------------------------------------------------
     20) Ansicht: Kampagne (#/content/k/<kid>)
     ------------------------------------------------------------------ */
  function winkelById(p, id) {
    return arr(p.winkel).filter(function (w) { return w.id === id; })[0];
  }

  function renderCampaignRoute(r) {
    var app = $('app');
    app.innerHTML = '<div class="dlm-wrap"><div class="dlm-loading">Lädt...</div></div>';
    DB.get('me_campaigns?select=*&id=eq.' + r.campaignId).then(function (rows) {
      var c = rows && rows[0];
      if (!c) { app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">Kampagne nicht gefunden.</div></div>'; return; }
      return Promise.all([
        DB.get('me_projects?select=*&id=eq.' + c.project_id),
        DB.get('me_assets?select=*&campaign_id=eq.' + r.campaignId + '&order=created_at.desc'),
        c.avatar_id ? DB.get('me_avatare?select=*&id=eq.' + c.avatar_id) : Promise.resolve([])
      ]).then(function (res) {
        var p = res[0] && res[0][0];
        var assets = res[1] || [];
        var avatar = res[2] && res[2][0];
        if (!p) { app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">Zielgruppe nicht gefunden.</div></div>'; return; }
        STATE.project = p; STATE.campaign = c; STATE.assets = assets; STATE.campaignAvatar = avatar || null;
        return loadFirmaForProject(p).then(function () {
          resumeRunningJobs(p.id, c.id, function () { renderCampaignRoute(parseHash()); });
          renderCrumbs(r);
          renderCampaignBody(r, p, c, assets, avatar);
        });
      });
    }).catch(function () {
      app.innerHTML = '<div class="dlm-wrap"><div class="dlm-empty">' + esc(T.genericError) + '</div></div>';
    });
  }

  function renderCampaignBody(r, p, c, assets, avatar) {
    var app = $('app');
    var winkelChips = arr(c.winkel_ids).map(function (wid) {
      var w = winkelById(p, wid);
      return '<span class="dlm-chip">' + esc(w ? w.titel : wid) + '</span>';
    }).join('');

    var counts = {};
    assets.forEach(function (a) { counts[a.typ] = (counts[a.typ] || 0) + 1; });

    var headChips = '<div class="dlm-chips dlm-campaign-head-chips">' +
      '<span class="dlm-chip">' + esc(STATE.firma ? STATE.firma.name : '') + '</span>' +
      '<span class="dlm-chip">' + esc(zielgruppeName(p)) + '</span>' +
      (avatar ? '<span class="dlm-chip">' + esc(avatar.name || 'Avatar') + '</span>' : '') +
      '</div>';

    var html = '<div class="dlm-wrap">' +
      '<div class="dlm-head-row"><div><h1 class="dlm-title">' + esc(c.name) + '</h1>' +
      headChips +
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
     21) Asset-Panel: Rendering je Typ (unveraendert gegenueber 1.2)
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

  /* --- Freebie-Designer (SPEC §11.7, unveraendert) ---------------------- */
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
      firma: STATE.firma ? STATE.firma.name : '',
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

  /* --- Bild-Erzeugung (Asset-Creatives) -------------------------------- */
  function generateImage(assetId, variant, format) {
    var slot = qs('[data-img-slot="' + assetId + ':' + variant + ':' + format + '"]');
    if (slot) slot.innerHTML = '<span>' + esc(T.imgLoading) + '</span>';
    IMG.stream({ uid: STATE.profile.uid, asset_id: assetId, variante: Number(variant), format: format }, {
      onDelta: function () {}
    }).then(function () {
      renderCampaignRoute(parseHash());
    }).catch(function (err) {
      toast(err && err.message ? err.message : T.genericError);
      renderCampaignRoute(parseHash());
    });
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
     22) Event-Delegation
     ------------------------------------------------------------------ */
  function wireGlobalEvents() {
    document.body.addEventListener('click', function (e) {
      var t = e.target;

      /* --- Firmen ---------------------------------------------------- */
      if (t.closest('[data-action="new-firma"]')) { openNewFirmaDialog(); return; }
      if (t.closest('[data-open-firma]')) { location.hash = '#/f/' + t.closest('[data-open-firma]').getAttribute('data-open-firma'); return; }
      if (t.closest('[data-action="archive-firma"]')) { openFirmaMenu(); return; }

      var newZgBtn = t.closest('[data-action="new-zielgruppe"]');
      if (newZgBtn) { openNewZielgruppeDialog(newZgBtn.getAttribute('data-id')); return; }
      var zgMenuBtn = t.closest('[data-action="zielgruppe-menu"]');
      if (zgMenuBtn) { e.stopPropagation(); openZielgruppeMenu(zgMenuBtn.getAttribute('data-id')); return; }
      var openZg = t.closest('[data-open-zielgruppe]');
      if (openZg) { location.hash = '#/z/' + openZg.getAttribute('data-open-zielgruppe'); return; }

      /* --- Interview / Kurzprofil / Analyse --------------------------- */
      var runKpBtn = t.closest('[data-action="run-kurzprofil"]');
      if (runKpBtn) { runKurzprofil(runKpBtn.getAttribute('data-id')); return; }

      var refineBtn = t.closest('[data-action="refine-analyse"]');
      if (refineBtn) {
        var pid = refineBtn.getAttribute('data-id');
        var rbody = document.createElement('div');
        rbody.innerHTML = '<label class="dlm-field"><span>Was soll sich ändern?</span><textarea id="dlm-refine-text" rows="4"></textarea></label>';
        dialog({
          title: T.zielgruppeRefine, body: rbody,
          actions: [{ label: T.cancel }, {
            label: 'Verfeinern', primary: true, onClick: function (wrap) {
              runAnalyseTask(pid, 'verfeinern', qs('#dlm-refine-text', wrap).value);
            }
          }]
        });
        return;
      }
      var redoBtn = t.closest('[data-action="redo-analyse"]');
      if (redoBtn) {
        var pid2 = redoBtn.getAttribute('data-id');
        confirmDialog(T.zielgruppeRedoConfirm, function () { runAnalyseTask(pid2, 'analyse'); });
        return;
      }
      var retryTeilBtn = t.closest('[data-action="retry-teil"]');
      if (retryTeilBtn) { runAnalyseTask(STATE.project.id, 'verfeinern'); return; }

      var exportBtn = t.closest('[data-action="export-analyse"]');
      if (exportBtn) {
        var p = STATE.project;
        var lines = ['# Zielgruppenanalyse - ' + zielgruppeName(p), ''];
        if (p.kurzprofil && p.kurzprofil.ein_satz) lines.push('## Kurzprofil', '', p.kurzprofil.ein_satz, '');
        ANALYSE_CATS.forEach(function (c) {
          var cat = (p.analyse || {})[c[0]] || {};
          lines.push('## ' + (cat.titel || c[1]), '');
          if (arr(cat.kern).length) { arr(cat.kern).forEach(function (k) { lines.push('- ' + k); }); lines.push(''); }
          lines.push(cat.inhalt || 'Nicht vorhanden', '');
        });
        download('zielgruppenanalyse-' + p.id + '.md', lines.join('\n'));
        return;
      }

      var modusBtn = t.closest('[data-modus]');
      if (modusBtn) {
        STATE.analyseModus = modusBtn.getAttribute('data-modus');
        try { localStorage.setItem('dlm-analyse-modus', STATE.analyseModus); } catch (e2) {}
        renderZielgruppeTab($('dlm-tab-body'), STATE.project);
        return;
      }

      var runWinkelBtn = t.closest('[data-action="run-winkel"]');
      if (runWinkelBtn) { runWinkel(runWinkelBtn.getAttribute('data-id'), false); return; }
      var moreWinkelBtn = t.closest('[data-action="run-winkel-more"]');
      if (moreWinkelBtn) { runWinkel(moreWinkelBtn.getAttribute('data-id'), true, moreWinkelBtn.getAttribute('data-awareness')); return; }

      var restartInterviewBtn = t.closest('[data-action="restart-interview"]');
      if (restartInterviewBtn) {
        var riId = restartInterviewBtn.getAttribute('data-id');
        confirmDialog(T.briefRestartInterviewConfirm, function () {
          var interview = { frage: 1, uebersprungen: [], fertig: false };
          DB.patch('me_projects?id=eq.' + riId, { interview: interview }).then(function () {
            if (STATE.project && STATE.project.id === riId) STATE.project.interview = interview;
            interviewSetIdx(STATE.project, 1);
            renderZielgruppeRoute(parseHash());
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
          renderZielgruppeRoute(parseHash());
        });
        return;
      }
      var interviewStartAnalyseBtn = t.closest('[data-action="interview-start-analyse"]');
      if (interviewStartAnalyseBtn) {
        var startId = interviewStartAnalyseBtn.getAttribute('data-id');
        setTab('zielgruppe');
        setTimeout(function () { runKurzprofil(startId); }, 30);
        return;
      }

      /* --- Avatare ----------------------------------------------------- */
      var newAvatarBtn = t.closest('[data-action="new-avatar"]');
      if (newAvatarBtn) { openNewAvatarDialog(newAvatarBtn.getAttribute('data-id')); return; }
      var avatarMenuBtn = t.closest('[data-action="avatar-menu"]');
      if (avatarMenuBtn) { e.stopPropagation(); openAvatarMenu(avatarMenuBtn.getAttribute('data-id')); return; }
      var runAvVorschlagBtn = t.closest('[data-action="run-avatar-vorschlag"]');
      if (runAvVorschlagBtn) { runAvatarVorschlag(runAvVorschlagBtn.getAttribute('data-id')); return; }
      var genAvatarBtn = t.closest('[data-action="gen-avatar-bild"]');
      if (genAvatarBtn) { generateAvatarBild(STATE.avatar.id, genAvatarBtn.getAttribute('data-stil')); return; }
      var genAvatarAllBtn = t.closest('[data-action="gen-avatar-bild-all"]');
      if (genAvatarAllBtn) { generateAllAvatarBilder(STATE.avatar.id); return; }
      var chooseAvatarBtn = t.closest('[data-action="choose-avatar-bild"]');
      if (chooseAvatarBtn) { chooseAvatarBild(STATE.avatar.id, chooseAvatarBtn.getAttribute('data-stil')); return; }

      var toggleDetail = t.closest('[data-action="toggle-winkel-detail"]');
      if (toggleDetail) {
        var card = toggleDetail.closest('.dlm-winkel-card');
        var det = qs('.dlm-winkel-detail', card);
        det.hidden = !det.hidden;
        return;
      }

      var afilterChip = t.closest('#dlm-asset-filters [data-afilter]');
      if (afilterChip) { STATE.assetFilter = afilterChip.getAttribute('data-afilter'); renderCampaignRoute(parseHash()); return; }

      var accHead = t.closest('[data-action="toggle-acc"]');
      if (accHead) { accHead.closest('.dlm-acc-item').classList.toggle('dlm-acc-open'); return; }

      var editCat = t.closest('[data-action="edit-cat"]');
      if (editCat) {
        var item = editCat.closest('.dlm-cat-card');
        qs('.dlm-cat-view', item).hidden = true;
        qs('.dlm-acc-edit', item).hidden = false;
        return;
      }
      var cancelCat = t.closest('[data-action="cancel-cat"]');
      if (cancelCat) {
        var item2 = cancelCat.closest('.dlm-cat-card');
        qs('.dlm-cat-view', item2).hidden = false;
        qs('.dlm-acc-edit', item2).hidden = true;
        return;
      }
      var saveCat = t.closest('[data-action="save-cat"]');
      if (saveCat) {
        var key = saveCat.getAttribute('data-cat');
        var item3 = saveCat.closest('.dlm-cat-card');
        var kernText = qs('.dlm-cat-edit-kern', item3).value;
        var inhaltText = qs('.dlm-cat-edit-inhalt', item3).value;
        var kernLines = kernText.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        var p2 = STATE.project;
        var analyse = Object.assign({}, p2.analyse);
        analyse[key] = Object.assign({}, analyse[key], { inhalt: inhaltText, kern: kernLines });
        DB.patch('me_projects?id=eq.' + p2.id, { analyse: analyse }).then(function () {
          p2.analyse = analyse;
          renderZielgruppeRoute(parseHash());
        });
        return;
      }
      var copyCat = t.closest('[data-action="copy-cat"]');
      if (copyCat) {
        var key2 = copyCat.getAttribute('data-cat');
        var cat = (STATE.project.analyse || {})[key2] || {};
        copyText((arr(cat.kern).length ? arr(cat.kern).join('\n') + '\n\n' : '') + (cat.inhalt || ''));
        return;
      }

      /* --- Content / Kampagnen ------------------------------------------ */
      if (t.closest('[data-action="new-campaign"]')) { openNewCampaignDialog(); return; }

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
        if (kind === 'kurzprofil') { cancelRunning('kurzprofil-' + STATE.project.id); stopProgressRotation('kurzprofil'); renderZielgruppeRoute(parseHash()); return; }
        if (kind === 'analyse') { cancelRunning('analyse-' + STATE.project.id); stopProgressRotation('analyse'); renderZielgruppeRoute(parseHash()); return; }
        if (kind === 'winkel') { cancelRunning('winkel-' + STATE.project.id); stopProgressRotation('winkel'); renderZielgruppeRoute(parseHash()); return; }
        if (kind === 'avatar_vorschlag') { cancelRunning('avatar_vorschlag-' + STATE.project.id); stopProgressRotation('avatar_vorschlag'); renderZielgruppeRoute(parseHash()); return; }
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

      /* --- Vorlagen (Creative-Decoder, unveraendert) -------------------- */
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
     23) Boot
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
