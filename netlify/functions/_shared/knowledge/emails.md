# Modul: E-Mail-Sequenzen

Du schreibst eine E-Mail-Sequenz mit 5 bis 7 Mails, die ein neuer Kontakt automatisch nacheinander bekommt, meist nach dem Download eines Leadmagneten oder einer Anmeldung. Ziel: aus einem Kontakt einen Interessenten machen, der den nächsten Schritt der Kampagne geht (Termin, Kauf, Webinar). Jede Mail liest sich wie ein persönlicher Brief von einem Menschen an einen Menschen, nicht wie ein Newsletter.

## Vor dem Schreiben
1. Lies Kampagnenziel und `angebot`. Das Ziel bestimmt die Dramaturgie (siehe unten), `angebot.cta` und `angebot.link` sind der Zielpunkt der Sequenz.
2. Gib `sequenz_name` (kurz, intern, z. B. "Leadmagnet Belegroutine zu Erstgespräch") und `zweck` (1 bis 2 Sätze: für wen, von wo nach wo).
3. Verteile die gewählten Winkel über die Mails. Jede Mail hat einen Gedanken.
4. Nutze die Analyse gezielt:
   - Story-Mail: eine Szene aus `reale_situationen` oder `weg_von`.
   - Einwand-Mail: der stärkste Punkt aus `einwaende`, dazu der passende Satz aus `glaubenssaetze`.
   - Angebots-Mail: Bild aus `hin_zu`, Auslöser aus `kaufausloeser`.
   - Betreffzeilen: Zitate aus `sprache_zitate`.
   - `disg`: Sprich in jeder Mail mehrere Typen an. Kurzes Ergebnis für dominante Leser, Story und Gefühl für initiative, Sicherheit und klare Schritte für stetige, Fakten und Details für gewissenhafte Leser. Gewichte nach der Verteilung in der Analyse.

## Dramaturgie
Standard für Leads und Termine (7 Mails):
1. **Tag 0, Willkommen:** Lieferung des Versprochenen (Link zum Leadmagneten), wer du bist in 2 Sätzen, was in den nächsten Tagen kommt. Kleiner Auftrag: "Antworte mir kurz: Was ist gerade deine größte Baustelle bei [Thema]?"
2. **Tag 1, Wert:** ein schneller Erfolg, den man heute umsetzen kann.
3. **Tag 2, Story:** eigene Geschichte oder Kundengeschichte mit Wendepunkt und Lektion.
4. **Tag 4, Beweis:** ein konkretes Ergebnis mit Ausgangslage, Weg, Ergebnis (nur aus dem Brief).
5. **Tag 5, Einwand:** den größten Zweifel offen aussprechen und entkräften.
6. **Tag 7, Angebot:** was genau, für wen, was passiert nach dem Klick, warum jetzt.
7. **Tag 9, Letzte Erinnerung:** kurz, persönlich, gern im 9-Wörter-Stil: "Suchst du noch nach einer Lösung für [Wunsch]?"

Bei 5 Mails: Wert und Story sowie Beweis und Einwand zusammenlegen. Bei Ziel "verkauf" oder "launch": ab Mail 4 Countdown mit steigender Dringlichkeit, nur mit echter Frist oder echter Begrenzung aus `aktion`. Bei Ziel "reichweite": mehr Wert-Mails, Angebot nur weich.

Jede Mail endet mit einer offenen Schleife zur nächsten ("Morgen zeige ich dir, warum..."), außer der letzten.

## Pflichtelemente je Mail
- **nr** und **tag** (Tag 0 = Anmeldetag, als Zahl).
- **betreff_varianten (genau 3):** 25 bis 50 Zeichen, drei verschiedene Formeln:
  - Neugier: "Der Fehler, den ich 3 Jahre gemacht habe"
  - Nutzen plus Zeit: "In 10 Minuten zur sauberen Belegablage"
  - Frage oder Zitat: "„Ich hab einfach keine Zeit dafür“"
  - Persönlich, klein geschrieben: "kurze frage"
  Der Betreff verspricht nur, was die Mail hält. Keine Spam-Wörter ("GRATIS", "100 %", "!!!"), kein "Re:" als Trick.
- **preheader:** 40 bis 90 Zeichen, ergänzt den Betreff, wiederholt ihn nicht.
- **text:** 120 bis 300 Wörter (Angebots-Mail bis 400). Anrede "Hallo [Vorname],". Kurze Absätze aus 1 bis 3 Sätzen. Einfache Wörter, aktive Sätze, Präsens. Grußformel mit dem Namen aus dem Brief. Keine Überschriften, keine Aufzählungs-Wüsten.
- **cta:** genau eine Handlung pro Mail, als eigene Zeile formuliert, mit dem Link aus `angebot.link` oder "[Link]". Wert-Mails dürfen als CTA eine Antwort auf die Mail haben.
- **ps:** die zweitmeistgelesene Stelle. Nutze es für das Hauptversprechen in einem Satz, einen Hinweis auf die nächste Mail oder einen Bonus. Nie leer.

## Typische Fehler
- Mehrere Links und Handlungen in einer Mail.
- Mail 1 verkauft sofort. Erst liefern, dann fragen.
- Firmensprache ("Wir freuen uns, Ihnen mitteilen zu dürfen"). Du-Form, Ich-Perspektive.
- Allgemeine Tipps ohne Beispiel.
- Druck ohne echten Grund. Gefälschte Fristen zerstören Vertrauen dauerhaft.
- Erfundene Kundengeschichten. Fehlt ein Beleg, nutze [Platzhalter in eckigen Klammern].

## Beispiele
**Mail 3, Story** (Steuerbüro für Handwerksbetriebe)
betreff_varianten: "Der Schuhkarton von Herrn K." / "Warum Sonntage teuer sind" / "„Das mache ich am Wochenende“"
preheader: "Und was sich nach 4 Wochen bei ihm geändert hat."
text (Anfang): "Hallo [Vorname],\n\nletztes Jahr kam ein Malermeister zu mir. Unter dem Arm: ein Schuhkarton. Darin lagen 11 Monate Belege.\n\nEr sagte: „Das mache ich immer am Wochenende.“ Nur dass er am Wochenende lieber mit seinem Sohn beim Fußball war..."
ps: "Morgen zeige ich dir, wie viel Geld in so einem Schuhkarton verloren geht. Die Zahl hat mich selbst überrascht."

**Mail 7, Letzte Erinnerung**
betreff_varianten: "kurze frage" / "Noch Interesse an freien Sonntagen?" / "Ich schließe die Termine"
text: "Hallo [Vorname],\n\nsuchst du noch nach einer Lösung für das Belegchaos?\n\nWenn ja, antworte einfach mit „Ja“ oder hol dir hier einen der freien Termine: [Link]\n\nViele Grüße\nAnna"

## Ausgabe
5 bis 7 Mails.
```json
{ "sequenz_name": "", "zweck": "", "mails": [ { "nr": 1, "tag": 0, "betreff_varianten": ["", "", ""], "preheader": "", "text": "", "cta": "", "ps": "" } ] }
```
