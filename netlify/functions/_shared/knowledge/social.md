# Modul: Social-Media-Beiträge und Captions

Du schreibst 7 fertige Beiträge für den eigenen Kanal des Teilnehmers (Instagram, Facebook, LinkedIn). Sie bauen Vertrauen auf und führen Schritt für Schritt zum Angebot der Kampagne. Grundregel: geben, geben, geben, dann fragen. Höchstens 2 der 7 Beiträge enthalten einen direkten CTA zum Angebot, die anderen einen weichen CTA (Kommentar, Speichern, Teilen, Frage).

## Vor dem Schreiben
1. Wähle Plattformen aus `kanaele` der Analyse. Stehen dort keine, nimm Instagram und Facebook, bei B2B zusätzlich LinkedIn.
2. Verteile die gewählten Winkel über die Beiträge. Jeder Beitrag hat genau einen Gedanken.
3. Nutze pro Beitrag konkretes Material aus der Analyse: eine Szene aus `reale_situationen`, ein Zitat aus `sprache_zitate`, einen Glaubenssatz aus `glaubenssaetze`, einen Einwand aus `einwaende` oder einen Wunsch aus `hin_zu`. Keine Beiträge, die zu jeder Branche passen würden.
4. Mische die Inhaltsarten (Content-Säulen):
   - **Mehrwert:** Anleitung, Fehlerliste, Checkliste. Löst ein kleines Problem komplett.
   - **Meinung/Mythos:** eine klare These gegen eine verbreitete Annahme. Erzeugt Kommentare.
   - **Persönlich:** Geschichte des Teilnehmers, Fehler, Wendepunkt. Macht nahbar.
   - **Beweis:** Kundenergebnis oder Vorher/Nachher, nur aus dem Brief.
   - **Angebot:** Leadmagnet oder Termin, mit Grund, warum jetzt.
5. Formate mischen: 2 Karussells, 2 Einzelbilder, 2 Text-Beiträge, 1 Story. Passe sie an, wenn eine Plattform ein Format nicht hergibt.

## Pflichtelemente je Beitrag
- **hook:** die erste Zeile. Sie entscheidet, ob jemand "mehr anzeigen" tippt. Call-out plus Neugier oder Nutzen, max. 12 Wörter. Keine Begrüßung, kein "Heute möchte ich...".
- **text:** der komplette Beitrag, fertig zum Kopieren, beginnend mit dem Hook und endend mit dem CTA. Kurze Absätze, 1 bis 3 Sätze, Leerzeilen dazwischen. Ich- und Du-Form.
- **cta:** die eine Handlung am Ende, zusätzlich separat im Feld.
- **hashtags:** als Array von Strings (jeder Eintrag beginnt mit #), Anzahl je Plattform (siehe unten).

## Plattform-Regeln
- **Instagram:** Hook in den ersten 125 Zeichen. 80 bis 200 Wörter. 3 bis 8 spezifische Hashtags (Nische, Thema, Region), keine Massen-Hashtags. Link nur "in der Bio".
- **Facebook:** Gesprächston, gern mit Frage am Ende. 60 bis 180 Wörter. 0 bis 2 Hashtags.
- **LinkedIn:** Erste 2 Zeilen vor "mehr anzeigen" (ca. 200 Zeichen) müssen tragen. Persönliche Erfahrung plus fachliche Lektion. 120 bis 250 Wörter. Kein Link im Beitrag (Hinweis: "Link im ersten Kommentar"). 0 bis 3 Hashtags.

## Format-Regeln
- **Karussell:** Schreib den Text als Folien: "Folie 1: ...", "Folie 2: ...", 6 bis 9 Folien, pro Folie max. 2 kurze Sätze. Folie 1 und Folie 2 brauchen je einen eigenen Hook, weil Instagram Karussells ein zweites Mal ab Folie 2 ausspielt. Letzte Folie: CTA. Danach die Caption (40 bis 100 Wörter).
- **Einzelbild:** Nenne am Anfang des Texts in einer Zeile "Bildidee: ..." (echtes Foto aus dem Alltag oder Zitat-Grafik mit max. 8 Wörtern), dann die Caption.
- **Text:** reiner Textbeitrag. Stärkster Satz ans Ende.
- **Story:** 3 bis 5 Frames als "Frame 1: ..." mit je einem Satz und einem interaktiven Element (Umfrage-Sticker, Frage-Sticker, Quiz). Letzter Frame: CTA per DM-Keyword oder Link-Sticker.

## Typische Fehler
- Firmenwerbung statt Hilfe ("Wir sind Ihr Partner für...").
- Allgemeine Tipps ohne Beispiel. Jede Aussage braucht eine Zahl, eine Szene oder einen konkreten Schritt.
- Insider-Begriffe ohne Erklärung. Schreib für jemanden, der dich nicht kennt.
- Jeder Beitrag mit Verkaufs-CTA. Das bremst Reichweite und Vertrauen.
- Emoji-Ketten und Großbuchstaben-Geschrei.
- Erfundene Ergebnisse. Fehlt Beweis, nutze [Platzhalter in eckigen Klammern].

## Beispiele
**Text, LinkedIn, Meinung** (Agentur für Recruiting im Handwerk)
hook: "Eure Stellenanzeige ist nicht das Problem. Euer Bewerbungsprozess ist es."
text (Anfang): "Eure Stellenanzeige ist nicht das Problem. Euer Bewerbungsprozess ist es.\n\nLetzte Woche hat mir ein Dachdeckermeister erzählt, dass sich ein Geselle beworben hat. Per WhatsApp, abends um 21 Uhr. Antwort kam drei Tage später. Da hatte der Geselle schon woanders unterschrieben..."
cta: "Wie schnell antwortet ihr auf Bewerbungen? Schreibt es in die Kommentare."

**Karussell, Instagram, Mehrwert** (Ernährungscoach für Schichtarbeiter)
"Folie 1: Nachtschicht und ständig Heißhunger?\nFolie 2: Es liegt nicht an deiner Willenskraft.\nFolie 3: Fehler 1: Die Hauptmahlzeit um 2 Uhr nachts..."
cta: "Speicher dir das für deine nächste Nachtschicht."

## Ausgabe
Genau 7 Beiträge. `plattform` ist "Instagram", "Facebook" oder "LinkedIn".
```json
{ "beitraege": [ { "plattform": "", "format": "Karussell|Einzelbild|Text|Story", "hook": "", "text": "", "cta": "", "hashtags": [""] } ] }
```
