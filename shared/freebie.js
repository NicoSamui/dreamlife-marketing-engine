/* ============================================================================
   Dreamlife Marketing Engine - shared/freebie.js
   "Freebie-Designer" (SPEC §11.7): rendert den Leadmagnet-Content als
   gestaltetes, druckfertiges HTML-Dokument statt als Word-Optik.

   Vanilla JS, IIFE, ES2018, keine Abhaengigkeiten, keine externen CDNs.
   window.FREEBIE = { THEMES, build(content, opts) }
   In Node zusaetzlich per module.exports nutzbar (fuer Tests/Tools).
   ============================================================================ */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------
     0) Kleine Helfer (robust, werfen nie)
     ------------------------------------------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Inline-Markdown: nur **fett**, alles andere wird escaped. */
  function inlineMd(s) {
    var e = esc(s);
    e = e.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return e;
  }

  /* Minimaler Markdown-Renderer: Absaetze, Zeilenumbrueche, **fett**, "- " Listen.
     Gleiche Regeln wie app.js#mdMini, hier eigenstaendig implementiert, damit
     freebie.js ohne Abhaengigkeit auf app.js funktioniert. */
  function mdLite(raw) {
    if (!raw) return '';
    var text = String(raw).replace(/\r\n/g, '\n');
    var blocks = text.split(/\n{2,}/);
    var out = blocks.map(function (block) {
      var lines = block.split('\n').filter(function (l) { return l.length; });
      if (!lines.length) return '';
      var listLines = lines.filter(function (l) { return /^\s*-\s+/.test(l); });
      if (listLines.length === lines.length) {
        return '<ul class="fb-md-list">' + lines.map(function (l) {
          return '<li>' + inlineMd(l.replace(/^\s*-\s+/, '')) + '</li>';
        }).join('') + '</ul>';
      }
      return '<p>' + lines.map(inlineMd).join('<br>') + '</p>';
    });
    return out.join('');
  }

  /* Wandelt beliebigen Input robust in ein Array von Strings um.
     Array bleibt Array (leere/nullige Eintraege raus), ein String wird
     zeilenweise aufgeteilt, alles andere wird zu einem Ein-Element-Array. */
  function coerceList(v) {
    if (Array.isArray(v)) {
      return v.map(function (x) { return x == null ? '' : String(x); }).filter(function (x) { return x.length; });
    }
    if (v == null) return [];
    if (typeof v === 'string') {
      return v.split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x.length; });
    }
    return [String(v)];
  }

  /* Kapitel robust normalisieren: Objekt bleibt Objekt, ein String wird zu
     einem Kapitel ohne Ueberschrift (analog app.js#renderLeadmagnet). */
  function coerceKapitel(v) {
    var list = Array.isArray(v) ? v : (v == null ? [] : (typeof v === 'string' ? [v] : [v]));
    return list.map(function (k) {
      if (k && typeof k === 'object') {
        return {
          ueberschrift: k.ueberschrift == null ? '' : String(k.ueberschrift),
          text: k.text == null ? '' : String(k.text),
          punkte: coerceList(k.punkte)
        };
      }
      return { ueberschrift: '', text: k == null ? '' : String(k), punkte: [] };
    });
  }

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgba(hex, alpha) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  /* ------------------------------------------------------------------
     1) Themes (SPEC §11.7): klar, dunkel, warm - je mit eigener Palette
     und eigenem Schriftpaar. Akzentfarbe ist je Theme per opts.akzent
     ueberschreibbar (Farbfeld im Asset-Panel).
     ------------------------------------------------------------------ */
  var THEMES = {
    klar: {
      name: 'Klar',
      beschreibung: 'Weiss, viel Luft, eine Akzentfarbe.',
      akzent: '#1E5AFF',
      bg: '#E7EAF0',
      papier: '#FFFFFF',
      text: '#12151C',
      textMuted: '#5B6270',
      linie: 'rgba(18,21,28,0.12)',
      onAccent: '#FFFFFF',
      fontHead: "'Space Grotesk','Manrope',sans-serif",
      fontBody: "'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    },
    dunkel: {
      name: 'Dunkel',
      beschreibung: 'Dunkler Hintergrund, helle Schrift, Platin-Akzent.',
      akzent: '#CFE0E8',
      bg: '#05070A',
      papier: '#0E1319',
      text: '#EAF2F5',
      textMuted: '#8FA0AA',
      linie: 'rgba(207,224,232,0.18)',
      onAccent: '#0A0D12',
      fontHead: "'Space Grotesk','Manrope',sans-serif",
      fontBody: "'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    },
    warm: {
      name: 'Warm',
      beschreibung: 'Creme, Serif-Ueberschrift, Terrakotta-Akzent.',
      akzent: '#C46A45',
      bg: '#EFE6D8',
      papier: '#FBF5EA',
      text: '#2B2018',
      textMuted: '#7A6C5C',
      linie: 'rgba(43,32,24,0.16)',
      onAccent: '#FFF8F0',
      fontHead: "Georgia,'Times New Roman',serif",
      fontBody: "'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    }
  };

  var CHECK_SVG = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<path d="M4 10.5l3.6 3.6L16 5.4" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ------------------------------------------------------------------
     2) Aufbau der einzelnen Seiten
     ------------------------------------------------------------------ */
  function pageTitel(c, opts) {
    var firma = esc(opts.firma || '');
    return '' +
      '<section class="fb-seite fb-seite-titel">' +
        '<div class="fb-titel-inner">' +
          '<div class="fb-titel-akzentbalken" aria-hidden="true"></div>' +
          '<div class="fb-label">Kostenloser Leitfaden</div>' +
          '<h1 class="fb-titel-h1">' + esc(c.titel || 'Ohne Titel') + '</h1>' +
          (c.untertitel ? '<p class="fb-titel-sub">' + inlineMd(c.untertitel) + '</p>' : '') +
          (c.versprechen ? '<div class="fb-zitat"><div class="fb-zitat-linie"></div><p>' + inlineMd(c.versprechen) + '</p></div>' : '') +
        '</div>' +
        (firma ? '<div class="fb-titel-firma">' + firma + '</div>' : '') +
      '</section>';
  }

  function pageUebersicht(kapitel) {
    if (!kapitel.length) return '';
    var items = kapitel.map(function (k, i) {
      return '<li class="fb-uebersicht-item">' +
        '<span class="fb-uebersicht-nr">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="fb-uebersicht-titel">' + esc(k.ueberschrift || 'Kapitel ' + (i + 1)) + '</span>' +
      '</li>';
    }).join('');
    return '<section class="fb-seite fb-seite-uebersicht">' +
      '<h2 class="fb-h2">Was dich erwartet</h2>' +
      '<ol class="fb-uebersicht-liste">' + items + '</ol>' +
    '</section>';
  }

  function pageKapitel(k, i) {
    var nr = i + 1;
    var punkteHtml = k.punkte.length ? (
      '<ul class="fb-punkte">' + k.punkte.map(function (pt) {
        return '<li class="fb-punkt"><span class="fb-punkt-icon">' + CHECK_SVG + '</span>' +
          '<span class="fb-punkt-text">' + inlineMd(pt) + '</span></li>';
      }).join('') + '</ul>'
    ) : '';
    return '<section class="fb-seite fb-seite-kapitel">' +
      '<div class="fb-kapitel-kopf">' +
        '<span class="fb-kapitel-nr" aria-hidden="true">' + String(nr).padStart(2, '0') + '</span>' +
        '<h2 class="fb-h2 fb-kapitel-h2">' + esc(k.ueberschrift || 'Kapitel ' + nr) + '</h2>' +
      '</div>' +
      '<div class="fb-kapitel-text">' + (mdLite(k.text) || '') + '</div>' +
      punkteHtml +
    '</section>';
  }

  function pageChecklist(items) {
    if (!items.length) return '';
    return '<section class="fb-seite fb-seite-checkliste">' +
      '<h2 class="fb-h2">Deine Checkliste</h2>' +
      '<ul class="fb-checklist">' + items.map(function (pt) {
        return '<li class="fb-check-item"><span class="fb-checkbox" aria-hidden="true"></span>' +
          '<span class="fb-check-text">' + inlineMd(pt) + '</span></li>';
      }).join('') + '</ul>' +
    '</section>';
  }

  function pageCta(c, opts) {
    if (!c.abschluss_cta) return '';
    var linkAttr = opts.link ? (' href="' + esc(opts.link) + '"') : '';
    var tag = opts.link ? 'a' : 'div';
    return '<section class="fb-seite fb-seite-cta">' +
      '<div class="fb-mitte">' +
        '<div class="fb-cta-box">' +
          (mdLite(c.abschluss_cta) || '') +
          '<' + tag + ' class="fb-cta-button"' + linkAttr + '>Jetzt starten</' + tag + '>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function pageAutor(c) {
    if (!c.autor_box) return '';
    return '<section class="fb-seite fb-seite-autor">' +
      '<div class="fb-mitte">' +
        '<div class="fb-autor-box">' + (mdLite(c.autor_box) || '') + '</div>' +
      '</div>' +
    '</section>';
  }

  function footerHtml(firma, seite, gesamt) {
    return '<div class="fb-footer"><span>' + esc(firma) + '</span><span>Seite ' + seite + ' von ' + gesamt + '</span></div>';
  }

  /* ------------------------------------------------------------------
     3) CSS (inline, theme-abhaengig)
     ------------------------------------------------------------------ */
  function buildCss(theme, akzent, fontBase) {
    var accent = akzent || theme.akzent;
    var accentSoft = rgba(accent, 0.12);
    var accentSofter = rgba(accent, 0.06);
    var base = String(fontBase || 'https://dreamlife-marketing.netlify.app/fonts/').replace(/\/+$/, '') + '/';
    return '' +
    '@font-face{font-family:\'Manrope\';src:url(\'' + base + 'manrope.woff2\') format(\'woff2\');font-weight:200 800;font-style:normal;font-display:swap;}\n' +
    '@font-face{font-family:\'Space Grotesk\';src:url(\'' + base + 'space-grotesk.woff2\') format(\'woff2\');font-weight:300 700;font-style:normal;font-display:swap;}\n' +
    ':root{\n' +
      '--fb-bg:' + theme.bg + ';\n' +
      '--fb-paper:' + theme.papier + ';\n' +
      '--fb-text:' + theme.text + ';\n' +
      '--fb-muted:' + theme.textMuted + ';\n' +
      '--fb-line:' + theme.linie + ';\n' +
      '--fb-accent:' + accent + ';\n' +
      '--fb-accent-soft:' + accentSoft + ';\n' +
      '--fb-accent-softer:' + accentSofter + ';\n' +
      '--fb-on-accent:' + theme.onAccent + ';\n' +
      '--fb-font-head:' + theme.fontHead + ';\n' +
      '--fb-font-body:' + theme.fontBody + ';\n' +
    '}\n' +
    '*{box-sizing:border-box;}\n' +
    'html,body{margin:0;padding:0;background:var(--fb-bg);}\n' +
    'body{font-family:var(--fb-font-body);color:var(--fb-text);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;}\n' +
    'h1,h2,h3{font-family:var(--fb-font-head);margin:0;}\n' +
    'p{margin:0 0 14px;}\n' +
    'p:last-child{margin-bottom:0;}\n' +
    'ul{margin:0;padding:0;list-style:none;}\n' +
    'a{color:inherit;}\n' +
    '.fb-stage{background:var(--fb-bg);min-height:100vh;padding:48px 16px;display:flex;flex-direction:column;align-items:center;}\n' +
    '.fb-doc{width:100%;max-width:820px;display:flex;flex-direction:column;gap:30px;}\n' +
    '.fb-seite{background:var(--fb-paper);color:var(--fb-text);box-shadow:0 24px 60px -20px rgba(0,0,0,0.35);border-radius:8px;padding:64px 58px 44px;position:relative;min-height:640px;display:flex;flex-direction:column;overflow:hidden;}\n' +
    '@media (max-width:480px){.fb-seite{padding:34px 20px 26px;min-height:0;}.fb-doc{gap:18px;}.fb-stage{padding:20px 10px;}}\n' +
    '.fb-footer{display:flex;justify-content:space-between;gap:12px;margin-top:auto;padding-top:20px;border-top:1px solid var(--fb-line);font-size:11px;letter-spacing:.02em;color:var(--fb-muted);}\n' +
    /* Titelseite */
    '.fb-seite-titel{align-items:flex-start;justify-content:center;background:var(--fb-paper);min-height:640px;}\n' +
    '.fb-titel-inner{max-width:75ch;}\n' +
    '.fb-titel-akzentbalken{width:72px;height:6px;border-radius:3px;background:var(--fb-accent);margin-bottom:18px;}\n' +
    '.fb-label{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--fb-accent);background:var(--fb-accent-soft);padding:7px 14px;border-radius:999px;margin-bottom:28px;}\n' +
    '.fb-titel-h1{font-size:44px;line-height:1.12;font-weight:700;margin-bottom:18px;letter-spacing:-.01em;}\n' +
    '.fb-titel-sub{font-size:19px;color:var(--fb-muted);margin-bottom:26px;max-width:60ch;}\n' +
    '.fb-zitat{position:relative;padding-left:22px;margin-top:8px;}\n' +
    '.fb-zitat-linie{position:absolute;left:0;top:2px;bottom:2px;width:3px;background:var(--fb-accent);border-radius:3px;}\n' +
    '.fb-zitat p{font-size:20px;font-style:italic;color:var(--fb-text);max-width:58ch;}\n' +
    '.fb-titel-firma{margin-top:40px;font-size:13px;font-weight:700;letter-spacing:.08em;color:var(--fb-muted);font-variant:small-caps;text-transform:lowercase;}\n' +
    /* Ueberblick */
    '.fb-h2{font-size:28px;font-weight:700;margin-bottom:30px;letter-spacing:-.01em;}\n' +
    '.fb-uebersicht-liste{display:flex;flex-direction:column;gap:0;}\n' +
    '.fb-uebersicht-item{display:flex;align-items:baseline;gap:22px;padding:16px 0;border-bottom:1px solid var(--fb-line);}\n' +
    '.fb-uebersicht-item:last-child{border-bottom:none;}\n' +
    '.fb-uebersicht-nr{font-family:var(--fb-font-head);font-size:22px;font-weight:700;color:var(--fb-accent);min-width:2.2ch;}\n' +
    '.fb-uebersicht-titel{font-size:18px;font-weight:600;}\n' +
    /* Kapitel */
    '.fb-kapitel-kopf{position:relative;margin-bottom:24px;}\n' +
    '.fb-kapitel-nr{display:block;font-family:var(--fb-font-head);font-size:96px;font-weight:700;line-height:1;color:var(--fb-accent-soft);margin-bottom:-20px;user-select:none;pointer-events:none;}\n' +
    '.fb-kapitel-h2{position:relative;z-index:1;max-width:26ch;font-size:30px;}\n' +
    '@media (max-width:480px){.fb-kapitel-nr{font-size:64px;margin-bottom:-12px;}.fb-kapitel-h2{font-size:25px;}}\n' +
    '.fb-kapitel-text{font-size:16.5px;max-width:74ch;color:var(--fb-text);}\n' +
    '.fb-kapitel-text p{margin-bottom:14px;}\n' +
    '.fb-kapitel-text ul.fb-md-list{margin:14px 0;padding-left:0;}\n' +
    '.fb-kapitel-text ul.fb-md-list li{position:relative;padding-left:20px;margin-bottom:8px;}\n' +
    '.fb-kapitel-text ul.fb-md-list li::before{content:"";position:absolute;left:2px;top:9px;width:6px;height:6px;border-radius:50%;background:var(--fb-accent);}\n' +
    '.fb-punkte{margin-top:22px;display:flex;flex-direction:column;gap:10px;}\n' +
    '.fb-punkt{display:flex;align-items:flex-start;gap:12px;background:var(--fb-accent-softer);border:1px solid var(--fb-accent-soft);border-radius:10px;padding:13px 16px;}\n' +
    '.fb-punkt-icon{flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:var(--fb-accent);color:var(--fb-on-accent);display:flex;align-items:center;justify-content:center;margin-top:1px;}\n' +
    '.fb-punkt-text{font-size:15.5px;line-height:1.5;}\n' +
    /* Checkliste */
    '.fb-checklist{display:flex;flex-direction:column;}\n' +
    '.fb-check-item{display:flex;align-items:flex-start;gap:14px;padding:13px 0;border-bottom:1px dashed var(--fb-line);}\n' +
    '.fb-check-item:last-child{border-bottom:none;}\n' +
    '.fb-checkbox{flex:0 0 20px;width:20px;height:20px;border:2px solid var(--fb-accent);border-radius:5px;margin-top:2px;}\n' +
    '.fb-check-text{font-size:16px;line-height:1.5;}\n' +
    /* CTA */
    '.fb-mitte{flex:1;display:flex;flex-direction:column;justify-content:center;}\n' +
    '.fb-seite-cta{align-items:stretch;}\n' +
    '.fb-cta-box{background:var(--fb-accent);color:var(--fb-on-accent);border-radius:14px;padding:52px 46px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:24px;}\n' +
    '.fb-cta-box p{color:var(--fb-on-accent);font-size:20px;max-width:52ch;}\n' +
    '.fb-cta-box strong{color:var(--fb-on-accent);}\n' +
    '.fb-cta-button{display:inline-block;background:var(--fb-on-accent);color:var(--fb-accent);font-weight:700;font-size:16px;padding:16px 38px;border-radius:999px;text-decoration:none;cursor:pointer;}\n' +
    /* Autor */
    '.fb-autor-box{background:var(--fb-accent-softer);border:1px solid var(--fb-line);border-radius:12px;padding:30px 32px;font-size:15px;color:var(--fb-muted);max-width:70ch;}\n' +
    '.fb-autor-box p{color:var(--fb-muted);}\n' +
    /* Druck */
    '@media print{\n' +
      'html,body{background:#fff;}\n' +
      '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}\n' +
      '.fb-stage{background:none;padding:0;min-height:0;}\n' +
      '.fb-doc{max-width:none;gap:0;}\n' +
      '.fb-seite{box-shadow:none;border-radius:0;page-break-after:always;break-after:page;min-height:calc(297mm - 36mm);padding:0;}\n' +
      '.fb-seite:last-child{page-break-after:auto;break-after:auto;}\n' +
      '.fb-seite-titel{min-height:calc(297mm - 36mm);}\n' +
      '.fb-titel-h1{font-size:30pt;}\n' +
    '}\n' +
    '@page{size:A4;margin:18mm 16mm;}\n' +
    '@media (max-width:900px){body{font-size:16px;}}\n';
  }

  /* ------------------------------------------------------------------
     4) FREEBIE.build
     ------------------------------------------------------------------ */
  function build(content, opts) {
    var c = content && typeof content === 'object' ? content : {};
    var o = opts && typeof opts === 'object' ? opts : {};
    var themeKey = (o.theme && THEMES[o.theme]) ? o.theme : 'klar';
    var theme = THEMES[themeKey];
    var akzent = (typeof o.akzent === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(o.akzent)) ? o.akzent : theme.akzent;
    var firma = o.firma == null ? '' : String(o.firma);

    var kapitel = coerceKapitel(c.kapitel);
    var checkliste = coerceList(c.checkliste);

    /* Alle Seiten NACH der Titelseite, in Reihenfolge gemaess §11.7. */
    var seiten = [];
    if (c.einleitung) {
      seiten.push('<section class="fb-seite fb-seite-einleitung"><div class="fb-kapitel-text">' +
        (mdLite(c.einleitung) || '') + '</div></section>');
    }
    if (kapitel.length) seiten.push(pageUebersicht(kapitel));
    kapitel.forEach(function (k, i) { seiten.push(pageKapitel(k, i)); });
    if (checkliste.length) seiten.push(pageChecklist(checkliste));
    var ctaSeite = pageCta(c, o);
    if (ctaSeite) seiten.push(ctaSeite);
    var autorSeite = pageAutor(c);
    if (autorSeite) seiten.push(autorSeite);
    seiten = seiten.filter(Boolean);

    var gesamt = seiten.length + 1; /* +1 fuer die Titelseite (Seite 1, ohne Fusszeile) */
    var seitenMitFooter = seiten.map(function (html, idx) {
      var nr = idx + 2;
      return html.replace('</section>', footerHtml(firma, nr, gesamt) + '</section>');
    });

    var body = pageTitel(c, { firma: firma }) + seitenMitFooter.join('');

    var css = buildCss(theme, akzent, o.fontBase);
    var titleTxt = esc(c.titel || 'Leitfaden');

    return '<!doctype html>\n' +
      '<html lang="de" data-theme="' + themeKey + '">\n' +
      '<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + titleTxt + '</title>\n' +
      '<style>' + css + '</style>\n' +
      '</head>\n' +
      '<body class="fb-body">\n' +
      '<div class="fb-stage"><div class="fb-doc">' + body + '</div></div>\n' +
      '</body>\n' +
      '</html>\n';
  }

  var FREEBIE = { THEMES: THEMES, build: build };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FREEBIE;
  }
  if (root) {
    root.FREEBIE = FREEBIE;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
