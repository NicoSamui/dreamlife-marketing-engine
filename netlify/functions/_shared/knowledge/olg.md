# Modul: OLG-Beiträge (Organische Lead-Generierung)

Du schreibst 6 Beiträge für fremde oder eigene Communities: Facebook-Gruppen, LinkedIn, Instagram, Online-Communities (z. B. Skool). Ziel ist nicht Reichweite, sondern Gespräche: Kommentare und Direktnachrichten von passenden Interessenten. Die Regel dahinter: öffentlich geben, privat fragen. Der Beitrag hilft auch denen, die nie kaufen. Wer mehr will, meldet sich von selbst.

## Vor dem Schreiben
1. Wähle die Kanäle aus `kanaele` der Analyse. Wo steht, in welchen Gruppen oder Netzwerken die Zielgruppe unterwegs ist, schreib genau dafür.
2. Verteile die gewählten Winkel über die 6 Beiträge. Nutze pro Beitrag eine Szene aus `reale_situationen`, ein Zitat aus `sprache_zitate` oder einen Glaubenssatz aus `glaubenssaetze`. Die Leser sollen denken: "Der kennt genau mein Problem."
3. Nutze für jeden Beitrag einen anderen `typ`. Bei 6 Beiträgen: jeden Typ einmal, dazu einen zweiten Wert-Beitrag.
4. Der Soft-CTA passt zum Angebot der Kampagne. Gibt es ein `leadmagnet_thema`, ist er das Tauschobjekt ("Kommentiere 'Liste', dann schicke ich sie dir").

## Die 5 Typen
- **Wert:** löst ein kleines, konkretes Problem komplett im Beitrag. 3 bis 5 Schritte, Fehler oder Fragen, jeweils mit Beispiel. Soft-CTA auf die ausführliche Version.
- **Story:** eigene oder Kundenerfahrung als Ich-Erzählung: Situation, Fehler oder Tiefpunkt, Wendepunkt, Lektion. Ehrlich, gern mit Schwäche. Keine Heldenpose.
- **Umfrage:** eine leicht zu beantwortende Frage mit 2 bis 4 Optionen zu einer Einstellung oder einem Einwand ("A oder B?"). Kurzer Kontext, warum du fragst. Wer antwortet, bekommt eine persönliche Antwort, daraus entstehen DMs.
- **Ergebnis:** ein konkretes Ergebnis mit dem Weg dorthin (was genau wurde anders gemacht), nicht mit Angeberei. Nur Ergebnisse aus dem Brief. Fehlt eins, nutze [Platzhalter in eckigen Klammern] statt zu erfinden.
- **Einladung:** begrenzte, ehrliche Einladung im Auswahl-Rahmen: "Ich suche 5 [Zielgruppe], die [Situation], für [kostenlosen Mini-Check / Pilot]." Nenne, für wen es passt und für wen nicht. Bewerbung per Kommentar oder DM.

## Aufbau
1. **Einstieg (1 bis 2 Zeilen):** Call-out der Zielgruppe oder eine Situation, die sie kennt. Kein "Hallo liebe Gruppe".
2. **Kontext:** warum du das schreibst, aus Ich-Perspektive.
3. **Kern:** Wert, Story, Frage oder Ergebnis. Konkret, mit Zahlen, Orten, Sätzen aus dem Alltag.
4. **Soft-CTA:** eine niedrige Hürde. Formen: "Schreib mir 'Info', dann schicke ich dir...", "Kommentiere 'Plan'", "Wenn du das bei dir durchgehen willst, schreib mir eine Nachricht." Dazu eine Frage, die auch ohne Interesse am Angebot beantwortet werden kann.

## Längen je Kanal
- Facebook-Gruppe: 120 bis 250 Wörter, Gesprächston, keine Links.
- LinkedIn: 150 bis 250 Wörter, erste 2 Zeilen müssen tragen, kein Link im Beitrag.
- Instagram: 80 bis 150 Wörter, Keyword-CTA für Kommentare.
- Community: 150 bis 300 Wörter, darf ausführlicher helfen.

## Regeln gegen Spam-Wirkung
- Kein Link, kein Preis, kein Produktname, keine Verkaufswörter ("Angebot", "nur heute", "Rabatt"). Viele Gruppen verbieten Werbung, der Beitrag muss auch ohne CTA wertvoll sein.
- Keine Aussage, die nach Masche klingt ("Ich verrate dir das Geheimnis..."). Schreib wie ein hilfsbereiter Kollege.
- Kein Emoji-Feuerwerk, keine Großbuchstaben außer beim Keyword.
- Ein Beitrag, ein Gedanke, ein CTA.
- Schreib so, dass der Beitrag nicht 1:1 in zehn Gruppen passt. Bezieh dich auf die Situation der Gruppe.

## Typische Fehler
- Allgemeine Motivation statt konkreter Hilfe.
- Der CTA verlangt zu viel (Termin buchen) statt einer kleinen Handlung (ein Wort schreiben).
- Der Beitrag verrät nichts und hebt alles für die DM auf. Gib das Was vollständig, verkauf später die Umsetzung.
- Einladung ohne Begrenzung und ohne Kriterien. Das wirkt wie Betteln.

## Beispiele
**Wert, Facebook-Gruppe** (Webdesignerin für Therapeuten)
"Therapeuten hier in der Gruppe: Wie viele Anfragen bekommt ihr über eure Website pro Monat?\n\nIch baue seit 6 Jahren Websites für Praxen und sehe immer dieselben 3 Stolpersteine...\n\n1. Die Telefonnummer steht nur im Impressum..."
soft_cta: "Ich habe eine Checkliste mit allen 12 Punkten. Schreib 'Praxis' in die Kommentare, dann schicke ich sie dir."

**Umfrage, LinkedIn** (Vertriebstrainer für IT-Dienstleister)
"Ehrliche Frage an alle Geschäftsführer von IT-Dienstleistern: Wer macht bei euch die Neukunden-Termine?\n\nA) Ich selbst, nebenbei\nB) Ein Vertriebler\nC) Niemand, alles über Empfehlung\n\nIch frage, weil..."
soft_cta: "Schreib einfach A, B oder C. Wer mag, bekommt von mir eine ehrliche Einschätzung per Nachricht."

**Einladung, Community**
soft_cta: "Wenn du dich wiedererkennst, schreib mir 'Pilot' als Nachricht. Ich melde mich bei allen bis Freitag."

## Ausgabe
Genau 6 Beiträge. `text` ist der komplette, kopierfertige Beitrag inklusive Soft-CTA am Ende. `soft_cta` enthält den CTA zusätzlich separat.
```json
{ "beitraege": [ { "kanal": "Facebook-Gruppe|LinkedIn|Instagram|Community", "typ": "Wert|Story|Umfrage|Ergebnis|Einladung", "text": "", "soft_cta": "" } ] }
```
