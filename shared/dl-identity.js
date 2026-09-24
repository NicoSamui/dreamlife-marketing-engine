/* ============================================================================
   dl-identity.js  --  Gemeinsamer Identitaets-Baustein fuer alle Dreamlife-Apps
   ----------------------------------------------------------------------------
   ES5-kompatibles Vanilla-JS, KEINE Abhaengigkeiten, KEIN Modul-System.
   Setzt window.DL_IDENTITY (im Browser). Unter Node/jsdom (Tests) zusaetzlich
   ueber module.exports verfuegbar, falls vorhanden.

   Diese Datei muss in JEDER App byte-identisch sein (siehe md5sum im
   README.md). Aenderungen bitte NUR zentral hier vornehmen und dann in
   alle App-Repos kopieren.

   Siehe SPEC.md ("LearningSuite-Variablen in allen Teilnehmer-Apps") fuer die
   vollstaendige Spezifikation von Feldern, Aliasen und Verhalten.
   ============================================================================ */
(function (root) {
  'use strict';

  /* --------------------------------------------------------------------
     0) Kleine Helfer (ES5, kein trim()-Polyfill noetig, aber sicherheitshalber
        eigene Implementierung statt String.prototype.trim, falls uralter
        Browser/Runtime ohne trim laeuft).
     -------------------------------------------------------------------- */
  function trimStr(s) {
    return String(s).replace(/^[\s﻿\xA0]+|[\s﻿\xA0]+$/g, '');
  }

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  /* Parst einen Query-String (mit oder ohne fuehrendes "?") in ein flaches
     Objekt { key: value }. Kein URLSearchParams noetig -> funktioniert
     ueberall gleich (Browser, Node, jsdom). */
  function parseQuery(search) {
    var out = {};
    if (!search) return out;
    var s = String(search);
    if (s.charAt(0) === '?') s = s.slice(1);
    if (!s) return out;
    var pairs = s.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      if (!pair) continue;
      var eq = pair.indexOf('=');
      var rawKey, rawVal;
      if (eq === -1) { rawKey = pair; rawVal = ''; }
      else { rawKey = pair.slice(0, eq); rawVal = pair.slice(eq + 1); }
      var key = safeDecode(rawKey.replace(/\+/g, ' '));
      var val = safeDecode(rawVal.replace(/\+/g, ' '));
      if (key === '') continue;
      out[key] = val;
    }
    return out;
  }

  /* Erkennt unersetzte LearningSuite-Platzhalter {{...}} / [[...]] sowie
     Muell-Werte wie "null"/"undefined" (defensiv, falls ein Template kaputt
     ersetzt wurde) und behandelt sie als leer. Trimmt und kuerzt auf maxLen. */
  function cleanValue(v, maxLen) {
    if (v === null || v === undefined) return '';
    var s = trimStr(String(v));
    if (!s) return '';
    if (s === 'null' || s === 'undefined') return '';
    if (/^\{\{[\s\S]*\}\}$/.test(s) || /^\[\[[\s\S]*\]\]$/.test(s)) return '';
    if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
    return s;
  }

  /* --------------------------------------------------------------------
     1) Feld-Tabelle (siehe SPEC.md Abschnitt 1)
        canon    = kanonischer URL-Parametername
        aliases  = weiter akzeptierte Parameternamen (bestehende Apps)
        lsKey    = customFields.getFieldValue()-Schluessel (aus dem
                   {{...}}-Platzhalter der SPEC-Tabelle ohne die Klammern)
        out      = Feldname im DL_IDENTITY-Profilobjekt
        max      = Laengenlimit
     -------------------------------------------------------------------- */
  var FIELD_DEFS = [
    { canon: 'uid', aliases: ['id', 'user_id', 'pid'], lsKey: 'system.user.id', out: 'uid', max: 500 },
    { canon: 'cid', aliases: ['client_id', 'client-id', 'clientid'], lsKey: 'system.client.id', out: 'cid', max: 500 },
    { canon: 'vorname', aliases: ['name', 'first', 'first_name', 'firstname'], lsKey: 'system.user.firstName', out: 'firstName', max: 500 },
    { canon: 'nachname', aliases: ['last', 'lastname', 'last_name'], lsKey: 'system.user.lastName', out: 'lastName', max: 500 },
    { canon: 'fullname', aliases: ['full', 'full_name'], lsKey: 'system.user.fullName', out: 'fullName', max: 500 },
    { canon: 'email', aliases: ['mail'], lsKey: 'system.user.email', out: 'email', max: 500 },
    { canon: 'telefon', aliases: ['phone', 'tel'], lsKey: 'system.user.phone', out: 'phone', max: 500 },
    { canon: 'sprache', aliases: ['locale', 'lang'], lsKey: 'system.user.locale', out: 'locale', max: 500 },
    { canon: 'about', aliases: ['ueber', 'bio'], lsKey: 'system.user.about', out: 'about', max: 2000 },
    { canon: 'avatar', aliases: ['avatar_url', 'bild'], lsKey: 'system.user.avatar', out: 'avatarUrl', max: 500 },
    { canon: 'start', aliases: ['mentoring-start', 'mentoring_start', 'startdatum', 'member_since'], lsKey: 'mentoring-start', out: 'mentoringStart', max: 500 },
    { canon: 'dienstleistung', aliases: ['service'], lsKey: 'dienstleistung', out: 'dienstleistung', max: 500 },
    { canon: 'methode', aliases: ['method'], lsKey: 'methode', out: 'methode', max: 500 },
    { canon: 'zielgruppe-branche', aliases: ['zielgruppe', 'branche', 'zielgruppe_branche'], lsKey: 'zielgruppe-branche', out: 'zielgruppeBranche', max: 500 },
    { canon: 'angebotssatz', aliases: ['angebot', 'offer'], lsKey: 'angebotssatz', out: 'angebotssatz', max: 500 }
  ];

  /* Alle bekannten Query-Schluessel (kanonisch + Alias), damit unbekannte
     Parameter zuverlaessig erkannt werden koennen. */
  var KNOWN_KEYS = {};
  (function buildKnownKeys() {
    for (var i = 0; i < FIELD_DEFS.length; i++) {
      var def = FIELD_DEFS[i];
      KNOWN_KEYS[def.canon] = true;
      for (var j = 0; j < def.aliases.length; j++) KNOWN_KEYS[def.aliases[j]] = true;
    }
  })();

  /* Technische Parameter, die NIE in profile.extra landen, auch wenn sie
     nicht in der Feld-Tabelle stehen (siehe SPEC.md Abschnitt 1). */
  var RESERVED_KEYS = { embedded: true, beta: true, f: true, s: true, slug: true, v: true, t: true, debug: true, app: true };

  function isReserved(key) {
    if (RESERVED_KEYS[key]) return true;
    if (KNOWN_KEYS[key]) return true;
    if (/^utm_/.test(key)) return true;
    return false;
  }

  /* --------------------------------------------------------------------
     2) customFields (LearningSuite JS-API), tolerant.
     -------------------------------------------------------------------- */
  function readCustomField(customFields, key) {
    try {
      if (customFields && typeof customFields.getFieldValue === 'function') {
        var v = customFields.getFieldValue(key);
        if (v !== null && v !== undefined) return String(v);
      }
    } catch (e) { /* ignore, LS-API kann in fremden Kontexten fehlen */ }
    return '';
  }

  /* --------------------------------------------------------------------
     3) Storage-Helfer (localStorage, tolerant wenn nicht verfuegbar:
        Private-Mode, SSR, Node-Tests ohne Mock, etc.)
     -------------------------------------------------------------------- */
  function defaultStorage() {
    try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage; } catch (e) {}
    try { if (typeof window !== 'undefined' && window.localStorage) return window.localStorage; } catch (e) {}
    return null;
  }

  function storageGet(storage, key) {
    if (!storage) return null;
    try { var v = storage.getItem(key); return (v === undefined) ? null : v; } catch (e) { return null; }
  }

  function storageSet(storage, key, val) {
    if (!storage) return;
    try { storage.setItem(key, val); } catch (e) { /* voll, blockiert, etc. -> ignorieren */ }
  }

  var CACHE_PREFIX = 'dl_identity:';
  var LAST_UID_KEY = 'dl_identity:last_uid';

  function cacheKeyForUid(uid) { return CACHE_PREFIX + uid; }

  /* --------------------------------------------------------------------
     4) read(opts) -- liest die Identitaet gemaess der Prioritaet:
        1) URL-Query (kanonisch, dann Alias)
        2) customFields.getFieldValue() (falls same-origin verfuegbar)
        3) localStorage-Cache (nur Felder, die noch leer sind; nur wenn die
           gecachte uid zur aktuellen uid passt -- oder es noch gar keine
           aktuelle uid gibt, dann wird die zuletzt bekannte uid genutzt,
           z. B. bei einem Reload/Deep-Link ohne Query-String)
        4) leer
        Danach wird das Ergebnis wieder gecacht (persist).
        Macht KEINE Netzwerk-Aufrufe.
     -------------------------------------------------------------------- */
  function read(opts) {
    opts = opts || {};
    var searchStr = (opts.search !== undefined)
      ? opts.search
      : (typeof location !== 'undefined' ? location.search : '');
    var storage = (opts.storage !== undefined) ? opts.storage : defaultStorage();
    var customFields = (opts.customFields !== undefined)
      ? opts.customFields
      : (typeof window !== 'undefined' ? window.customFields : undefined);

    var raw = parseQuery(searchStr);

    var profile = {
      uid: '', cid: '', firstName: '', lastName: '', fullName: '', email: '',
      phone: '', locale: '', about: '', avatarUrl: '', mentoringStart: '',
      dienstleistung: '', methode: '', zielgruppeBranche: '', angebotssatz: '',
      extra: {}, raw: raw
    };

    /* 1) + 2): pro Feld Query (kanonisch, dann Alias), dann customFields */
    for (var i = 0; i < FIELD_DEFS.length; i++) {
      var def = FIELD_DEFS[i];
      var val = '';
      var keys = [def.canon].concat(def.aliases);
      for (var k = 0; k < keys.length && !val; k++) {
        if (Object.prototype.hasOwnProperty.call(raw, keys[k])) {
          val = cleanValue(raw[keys[k]], def.max);
        }
      }
      if (!val && def.lsKey) {
        val = cleanValue(readCustomField(customFields, def.lsKey), def.max);
      }
      profile[def.out] = val;
    }

    /* Unbekannte Parameter -> extra (Ausnahmen: technische Parameter,
       alle bekannten kanonischen/Alias-Namen, utm_*). */
    for (var key in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
      if (isReserved(key)) continue;
      var ev = cleanValue(raw[key], 500);
      if (ev) profile.extra[key] = ev;
    }

    /* 3) Aus Cache auffuellen, was noch leer ist. Wenn keine aktuelle uid
       bekannt ist (z. B. Reload/Deep-Link ohne Query), wird die zuletzt
       bekannte uid als Cache-Schluessel benutzt. */
    var lookupUid = profile.uid || storageGet(storage, LAST_UID_KEY) || '';
    if (lookupUid) {
      var cachedRaw = storageGet(storage, cacheKeyForUid(lookupUid));
      var cached = null;
      if (cachedRaw) { try { cached = JSON.parse(cachedRaw); } catch (e) { cached = null; } }
      if (cached && cached.uid === lookupUid && (!profile.uid || profile.uid === lookupUid)) {
        if (!profile.uid) profile.uid = cached.uid || lookupUid;
        for (var i2 = 0; i2 < FIELD_DEFS.length; i2++) {
          var outKey = FIELD_DEFS[i2].out;
          if (!profile[outKey] && cached[outKey]) profile[outKey] = cached[outKey];
        }
        if (cached.extra) {
          for (var ek in cached.extra) {
            if (Object.prototype.hasOwnProperty.call(cached.extra, ek) && !(ek in profile.extra)) {
              profile.extra[ek] = cached.extra[ek];
            }
          }
        }
      }
    }

    /* 4) Cache aktualisieren, damit ein spaeterer Reload ohne Query das
       Profil wiederfindet. */
    if (profile.uid) {
      storageSet(storage, cacheKeyForUid(profile.uid), safeJSON(profile));
      storageSet(storage, LAST_UID_KEY, profile.uid);
    }

    return profile;
  }

  function safeJSON(obj) {
    try { return JSON.stringify(obj); } catch (e) { return '{}'; }
  }

  /* --------------------------------------------------------------------
     5) greetingName(p) -- Vorname, sonst aus fullName abgeleitet, sonst "".
     -------------------------------------------------------------------- */
  function greetingName(p) {
    p = p || {};
    if (p.firstName) return p.firstName;
    if (p.fullName) {
      var parts = trimStr(String(p.fullName)).split(/\s+/);
      if (parts[0]) return parts[0];
    }
    return '';
  }

  function combinedName(p) {
    if (p.fullName) return p.fullName;
    var both = trimStr([p.firstName || '', p.lastName || ''].join(' '));
    return both;
  }

  /* --------------------------------------------------------------------
     6) aiProfileBlock(p) -- deutscher Textblock fuer System-Prompts.
        NUR gefuellte Felder. NIE uid/email/telefon/cid (Datenschutz: diese
        Felder duerfen nicht an ein KI-Modell/-Prompt gegeben werden).
        extra-Felder als eigene "Weitere Angaben: schluessel: wert"-Eintraege.
     -------------------------------------------------------------------- */
  function aiProfileBlock(p) {
    p = p || {};
    var parts = [];
    var name = combinedName(p);
    if (name) parts.push('Name: ' + name);
    if (p.mentoringStart) parts.push('Dabei seit: ' + p.mentoringStart);
    if (p.dienstleistung) parts.push('Dienstleistung: ' + p.dienstleistung);
    if (p.methode) parts.push('Methode: ' + p.methode);
    if (p.zielgruppeBranche) parts.push('Zielgruppe/Branche: ' + p.zielgruppeBranche);
    if (p.angebotssatz) parts.push('Angebotssatz: ' + p.angebotssatz);
    if (p.locale) parts.push('Sprache: ' + p.locale);
    if (p.about) parts.push('Über sich: ' + p.about);
    if (p.extra) {
      for (var k in p.extra) {
        if (Object.prototype.hasOwnProperty.call(p.extra, k) && p.extra[k]) {
          parts.push('Weitere Angaben: ' + k + ': ' + p.extra[k]);
        }
      }
    }
    if (!parts.length) return '';
    return 'Profil des Teilnehmers: ' + parts.join(', ');
  }

  /* --------------------------------------------------------------------
     7) toRow(p, app) -- Zeile fuer Supabase ls_members (snake_case).
     -------------------------------------------------------------------- */
  function toRow(p, app) {
    p = p || {};
    return {
      uid: p.uid || '',
      cid: p.cid || '',
      first_name: p.firstName || '',
      last_name: p.lastName || '',
      full_name: p.fullName || '',
      email: p.email || '',
      phone: p.phone || '',
      locale: p.locale || '',
      about: p.about || '',
      avatar_url: p.avatarUrl || '',
      mentoring_start: p.mentoringStart || '',
      dienstleistung: p.dienstleistung || '',
      methode: p.methode || '',
      zielgruppe_branche: p.zielgruppeBranche || '',
      angebotssatz: p.angebotssatz || '',
      extra: p.extra || {},
      last_app: app || ''
    };
  }

  /* --------------------------------------------------------------------
     8) djb2 -- einfacher, schneller String-Hash (kein Crypto noetig, dient
        nur der Sync-Drossel).
     -------------------------------------------------------------------- */
  function djb2(str) {
    var hash = 5381;
    str = String(str || '');
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & 0xFFFFFFFF;
    }
    return (hash >>> 0).toString(16);
  }

  function resolvedPromise() {
    if (typeof Promise !== 'undefined') return Promise.resolve();
    return { then: function (cb) { if (cb) cb(); return this; } };
  }

  /* --------------------------------------------------------------------
     9) sync(p, app, postFn) -- Upsert nach ls_members, gedrosselt auf
        hoechstens 1x pro 6h pro App+Profil-Hash. Fehlertolerant: sync()
        wirft NIE, blockiert NIE die App.

        postFn(pathMitQuery, bodyArray, preferString) -> Promise
        wird von der App bereitgestellt (i. d. R. ein duenner Wrapper um den
        vorhandenen DLDB-Shim, siehe README.md).
     -------------------------------------------------------------------- */
  function sync(p, app, postFn) {
    try {
      p = p || {};
      app = app || 'app';
      if (!p.uid || typeof postFn !== 'function') return resolvedPromise();

      var storage = defaultStorage();
      var row = toRow(p, app);
      var rowForHash = {};
      for (var k in row) {
        if (Object.prototype.hasOwnProperty.call(row, k) && k !== 'last_app') rowForHash[k] = row[k];
      }
      var hash = djb2(safeJSON(rowForHash));
      var storeKey = 'dl_identity_sync:' + app;
      var prev = storageGet(storage, storeKey);
      var now = Date.now();
      var SIX_HOURS = 6 * 60 * 60 * 1000;

      if (prev) {
        var idx = prev.indexOf(':');
        if (idx > 0) {
          var prevHash = prev.slice(0, idx);
          var prevTime = parseInt(prev.slice(idx + 1), 10) || 0;
          if (prevHash === hash && (now - prevTime) < SIX_HOURS) {
            return resolvedPromise();
          }
        }
      }

      var result;
      try {
        result = postFn('ls_members?on_conflict=uid', [row], 'resolution=merge-duplicates,return=minimal');
      } catch (e) {
        try { console.warn('DL_IDENTITY.sync: postFn warf einen Fehler', e); } catch (e2) {}
        return resolvedPromise();
      }

      if (!result || typeof result.then !== 'function') {
        storageSet(storage, storeKey, hash + ':' + now);
        return resolvedPromise();
      }

      return result.then(function () {
        storageSet(storage, storeKey, hash + ':' + now);
      }, function (err) {
        try { console.warn('DL_IDENTITY.sync: Upsert fehlgeschlagen', err); } catch (e2) {}
      });
    } catch (e) {
      try { console.warn('DL_IDENTITY.sync: unerwarteter Fehler', e); } catch (e2) {}
      return resolvedPromise();
    }
  }

  /* --------------------------------------------------------------------
     10) persist(p) / restore(uid?) -- Cache in localStorage, damit bei
         Reload ohne Query (z. B. Deep-Link) das Profil erhalten bleibt.
     -------------------------------------------------------------------- */
  function persist(p) {
    p = p || {};
    if (!p.uid) return;
    var storage = defaultStorage();
    storageSet(storage, cacheKeyForUid(p.uid), safeJSON(p));
    storageSet(storage, LAST_UID_KEY, p.uid);
  }

  function restore(uid) {
    var storage = defaultStorage();
    var lookupUid = uid || storageGet(storage, LAST_UID_KEY);
    if (!lookupUid) return null;
    var cachedRaw = storageGet(storage, cacheKeyForUid(lookupUid));
    if (!cachedRaw) return null;
    try { return JSON.parse(cachedRaw); } catch (e) { return null; }
  }

  /* --------------------------------------------------------------------
     11) buildQuery(p) -- baut aus einem Profil wieder den kanonischen
         Query-String (fuer Deep-Links innerhalb einer App, z. B.
         Hub -> Modul-iframe in Dreamlife Pages). extra-Felder werden mit
         ihrem eigenen Schluessel angehaengt.
     -------------------------------------------------------------------- */
  function buildQuery(p) {
    p = p || {};
    var parts = [];
    function add(key, val) {
      if (val === undefined || val === null) return;
      var s = String(val);
      if (!s) return;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(s));
    }
    add('uid', p.uid);
    add('cid', p.cid);
    add('vorname', p.firstName);
    add('nachname', p.lastName);
    add('fullname', p.fullName);
    add('email', p.email);
    add('telefon', p.phone);
    add('sprache', p.locale);
    add('about', p.about);
    add('avatar', p.avatarUrl);
    add('start', p.mentoringStart);
    add('dienstleistung', p.dienstleistung);
    add('methode', p.methode);
    add('zielgruppe-branche', p.zielgruppeBranche);
    add('angebotssatz', p.angebotssatz);
    if (p.extra) {
      for (var k in p.extra) {
        if (Object.prototype.hasOwnProperty.call(p.extra, k)) add(k, p.extra[k]);
      }
    }
    return parts.join('&');
  }

  /* --------------------------------------------------------------------
     12) Oeffentliches API
     -------------------------------------------------------------------- */
  var DL_IDENTITY = {
    read: read,
    greetingName: greetingName,
    aiProfileBlock: aiProfileBlock,
    toRow: toRow,
    sync: sync,
    persist: persist,
    restore: restore,
    buildQuery: buildQuery,
    /* intern, aber fuer Tests/Debugging exportiert */
    _fieldDefs: FIELD_DEFS,
    _parseQuery: parseQuery,
    _cleanValue: cleanValue,
    _djb2: djb2
  };

  root.DL_IDENTITY = DL_IDENTITY;
  if (typeof module !== 'undefined' && module.exports) { module.exports = DL_IDENTITY; }

})(typeof window !== 'undefined' ? window : this);
