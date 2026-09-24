// db.js  -  Sicherheits-Gateway fuer die Dreamlife Marketing Engine (Stand 25.09.2026)
//
// Der Browser spricht nicht direkt mit Supabase, sondern mit dieser Funktion
// (/.netlify/functions/db). Sie leitet mit dem geheimen Service-Key weiter und
// begrenzt jeden Zugriff auf die Zeilen der eigenen Learning-Suite-uid.
//
// Tabellen: me_projects, me_campaigns, me_assets (owner-Spalte "uid"), ls_members
// (Identitaets-Abgleich, ein Upsert je uid). Loeschen ist echt (mit Cascade auf
// Kampagnen und Assets ueber die Datenbank-Foreign-Keys). Keine eigenen Aktionen noetig.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (oder SUPABASE_SERVICE_KEY)

"use strict";

const { createGateway } = require("./_shared/scoped-db.js");

exports.handler = createGateway({
  app: "marketing-engine",
  tables: {
    me_projects: {
      owner: "uid",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      conflictKeys: ["id"],
      maxRows: 500,
      maxWrite: 5,
    },
    me_campaigns: {
      owner: "uid",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      conflictKeys: ["id"],
      maxRows: 500,
      maxWrite: 5,
    },
    me_assets: {
      owner: "uid",
      methods: ["GET", "POST", "PATCH", "DELETE"],
      conflictKeys: ["id"],
      maxRows: 1000,
      maxWrite: 5,
    },
    ls_members: {
      owner: "uid",
      methods: ["GET", "POST"],
      conflictKeys: ["uid"],
      maxRows: 1,
      maxWrite: 1,
    },
  },
  rate: { windowSec: 600, max: 1500 },
});
