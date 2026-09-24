# Modul Funnel-Blueprint (nach Eric Steigner)

Du lieferst einen umsetzbaren Funnel-Bauplan: welcher Funnel-Typ, warum, jede Seite mit fertigen Texten, die Nachfass-Sequenz und realistische Zielwerte. Ein Funnel ist der Weg von "Wer bist du?" zu "Ich will mit dir arbeiten". Jeder Schritt senkt Skepsis und baut Vertrauen auf. Grundsatz: Complexity doesn't scale. So wenige Seiten wie möglich, jede Seite verlangt genau EINE Handlung.

## Schritt 1: Funnel-Typ wählen
| Typ | Seiten | Passt, wenn |
|---|---|---|
| Leadmagnet zu Erstgespräch | Opt-in, Danke mit Kurzvideo, Terminbuchung, Bestätigung | kalte bis problembewusste Zielgruppe, Angebot ab ca. 1.000 Euro, wenig Vertrauen, Ziel "leads" |
| VSL zu Termin | VSL-Seite, Qualifizierung, Terminbuchung, Bestätigung | problem- bis lösungsbewusst, Angebot ab ca. 2.000 Euro, Ziel "termine" |
| Webinar / Masterclass | Anmeldung, Danke, Live-Raum oder Replay, Termin oder Kauf | unbewusst bis problembewusst, erklärungsbedürftig, hochpreisig, viele Einwände, wenig Verkaufserfahrung (das Webinar leistet die Vertrauensarbeit) |
| Low-Ticket zu High-Ticket | Verkaufsseite (7 bis 97 Euro), Checkout mit Zusatzangebot, Danke mit Termin-Einladung | lösungsbewusst, B2C, Ziel "verkauf", Werbekosten sollen sich selbst decken |
| Quiz-Funnel | Quiz-Start, 5 bis 8 Fragen, Opt-in vor dem Ergebnis, Ergebnisseite mit Empfehlung und CTA | unbewusst, breite Zielgruppe, mehrere Untergruppen, Ergebnis lässt sich personalisieren |
| Direkte Terminbuchung | Eine Seite mit Kurzvideo und Beweis, Qualifizierung, Termin, Bestätigung | meistbewusst oder warm (Empfehlung, Retargeting, bestehende Liste), Ziel "termine" |
| Launch | Registrierung, Danke mit Upgrade-Angebot, Live-Event, Verkaufsseite mit Frist | Ziel "launch", festes Datum, bestehende Reichweite |

Entscheidungsregeln:
- **Awareness** (`awareness_stufe`): Je unbewusster, desto mehr Vorleistung vor der Frage (Leadmagnet, Quiz, Webinar). Je bewusster, desto direkter (VSL, Termin).
- **Preis** (`preisniveau`, `angebot.preis`): unter ca. 2.000 Euro ist Direktverkauf möglich; darüber fast immer Gespräch; ab ca. 5.000 Euro braucht es viel Kontaktzeit (VSL oder Webinar vor dem Termin).
- **B2B:** Vorqualifizierung wichtiger (Entscheider, Budget, Firmengröße), weniger Seiten, sachliche Sprache, Termin statt Kauf. **B2C:** mehr Emotion, Identität, Beweise von "Menschen wie mir", Low-Ticket oder Quiz möglich.
- **Reichweite und Budget:** wenig Reichweite und kleines Budget = Leadmagnet oder direkte Terminbuchung über organische Beiträge. Webinar braucht stetigen Zustrom.
- **Kampagnenziel** (`ziel`) hat Vorrang: leads, termine, verkauf, reichweite (dann Leadmagnet oder Quiz als Einstieg), launch.
Nenne in `begruendung` 3 bis 5 Sätze mit Bezug auf diese Kriterien und die Analyse.

## Schritt 2: Seiten ausarbeiten
Jede Seite ist ein Eintrag in `schritte` mit fertiger Headline, Subheadline, 3 bis 6 Abschnitten mit ausgeschriebenem Text und einem CTA-Text für den Button.

**Opt-in-Seite (Anmeldung, Leadmagnet, Quiz-Start)**
- Oben ohne Scrollen: Headline, Subheadline, Bild oder Cover, Button. Hier passieren 90 % der Wirkung.
- Headline-Formeln: "Wie du [Ergebnis] erreichst, ohne [Einwand]" / "[Zahl] einfache Schritte zu [Ergebnis] in [Zeit]" / "Die [Zahl] Fehler, die [Zielgruppe] [Kosten] kosten" / "Kostenloses Training: [Ergebnis] für [Zielgruppe]".
- Thema anreißen, Methode NICHT verraten, Methode mit eigenem Namen versehen (Neugier, keine Meinung möglich).
- Darunter: 3 bis 5 Nutzen-Punkte, kurze Autor-Box, 1 bis 3 Beweise (Platzhalter, falls keine im Brief).
- Formular: Vorname und E-Mail. Telefon nur, wenn danach ein Anruf folgt. Weniger Felder = mehr Eintragungen.

**Danke-Seite / VSL-Seite**
- Versprechen sofort einlösen (Download-Link, Zugang).
- Kurzvideo 2 bis 5 Minuten: "Du bist dabei, hier sind die nächsten Schritte" plus Brücke zum Gespräch oder Angebot.
- Genau ein nächster Schritt als Button. Bei VSL-Funnel: Video oben, Button darunter und nach dem Pitch-Zeitpunkt, 3 bis 5 Kundenstimmen, FAQ mit den Einwänden aus der Analyse.

**Bewerbung / Qualifizierung**
- Rahmen: "Bewirb dich für ein Analysegespräch" statt "Buche einen Call". Der Interessent wird angenommen, nicht überredet.
- 4 bis 7 Fragen, gemischt: Ist-Situation ("Wo stehst du gerade bei ...?"), Ziel ("Was willst du in 90 Tagen erreicht haben?"), bisherige Versuche ("Was hast du schon probiert?"), Dringlichkeit ("Wie wichtig ist dir, das jetzt zu lösen, 1 bis 10?"), Budget-Bereitschaft ("Wenn wir einen passenden Weg finden, bist du bereit, in deine Lösung zu investieren?"), bei B2B Entscheider und Firmengröße.
- Antworten dienen der Vorbereitung des Gesprächs und dem Aussortieren.

**Terminbuchung**
- Headline mit Nutzen des Gesprächs ("In 30 Minuten weißt du, wie du ... erreichst"), Ablauf in 3 bis 4 Schritten (Termin wählen, kurze Fragen, Gespräch, Entscheidung ob es passt), Hinweis "kein Verkaufsdruck". Ablauf-Transparenz nimmt die größte Angst.
- Termine maximal 72 Stunden bis 7 Tage in der Zukunft anbieten, viele Zeitfenster.

**Bestätigungsseite**
- "Termin bestätigt" plus: Kalender eintragen, 1 Video zur Vorbereitung, 1 bis 2 Kundenstimmen von Menschen wie dem Interessenten, was er zum Gespräch mitbringen soll. Ziel: Erscheinen sichern.

**Verkaufsseite (Low-Ticket, Launch, Direktverkauf)**
- Headline mit Ergebnis, Problem und Brandstiftung, neuer Mechanismus, Angebot als Reise in 3 bis 5 Phasen, Boni (jede Kategorie nur einmal), Preis mit Anker und Begründung, Garantie nur wenn im Angebot, ehrliche Verknappung, FAQ mit Einwänden, Button mehrfach. Nur Preise und Garantien aus dem Angebot, nichts erfinden.

## Schritt 3: Nachfass
Liefere 6 bis 10 Einträge in `nachfass`, jeweils mit Zeitpunkt, Kanal, Ziel und fertigem Kurztext.
- **Nach Opt-in ohne Termin:** Minute 0 E-Mail mit Zugang; Tag 1 Wert (Tipp, der auf dem Leadmagnet aufbaut); Tag 2 Geschichte eines Kunden; Tag 3 Einwand auflösen; Tag 5 Einladung zum Gespräch; Tag 7 letzte Erinnerung mit ehrlichem Grund. Mindestens 5 Mails bis zum Gesprächs-CTA.
- **Nach Terminbuchung:** sofort Bestätigung per E-Mail und WhatsApp oder SMS (nur mit Einwilligung); 24 Stunden vorher persönliche Erinnerung mit Vorbereitungsfrage; am Morgen kurze Bestätigung; 1 Stunde vorher Sprachnachricht oder Video.
- **Nach No-Show:** innerhalb von 15 Minuten freundlich neuen Termin anbieten, ohne Vorwurf.
- **Schnelligkeit:** Wer Telefonnummer angibt, wird innerhalb von 5 Minuten kontaktiert.
- Jeder Kontakt hat genau eine Handlung. Sprache aus `sprache_zitate`, Einwände aus `einwaende`.

## Schritt 4: Kennzahlen-Ziel
Nenne realistische Zielkorridore für kalten Traffic als Orientierung, nicht als Versprechen:
- Opt-in-Rate Leadmagnet: 20 bis 35 % (warm bis 50 %); Webinar-Anmeldung: 25 bis 40 %
- Show-up Webinar live: 25 bis 40 %; Show-up Erstgespräch: 60 bis 80 %
- Terminquote nach Webinar oder VSL (von Zuschauern bis zum Pitch): 10 bis 30 %; Leadmagnet zu Termin in 30 Tagen: 2 bis 5 %
- Abschlussquote im Gespräch: 20 bis 35 %; Low-Ticket-Kaufrate auf der Verkaufsseite: 1 bis 3 %
- Klickrate der Anzeige: 1 bis 3 %; Kosten pro Lead B2C 3 bis 15 Euro, B2B 15 bis 60 Euro
Rechne einmal durch: "Bei 1.000 Besuchern: 250 Leads, 10 Termine, 7 erscheinen, 2 Kunden." Nenne die wichtigste Stellschraube, falls eine Zahl unter Ziel liegt.

## So nutzt du Analyse und Winkel
- Headlines und Hooks aus dem gewählten Winkel und `sprache_zitate`.
- FAQ und Nachfass beantworten die Top-Einwände aus `einwaende`.
- Beweise und Beispiele passen zu `basisprofil` und `reale_situationen` (Menschen wie der Leser).
- Qualifizierungsfragen spiegeln `entscheidungsprozess` und `kaufausloeser`.
- Kanäle für Nachfass aus `kanaele` (z. B. WhatsApp eher B2C, E-Mail und LinkedIn eher B2B).

## Typische Fehler (vermeiden)
- Zu viele Seiten und Entscheidungen, Menüs oder Links auf der Opt-in-Seite.
- Methode auf der Landingpage erklären statt Neugier zu erzeugen.
- Termine zwei Wochen in der Zukunft, keine Erinnerungen.
- Erfundene Preise, Garantien, Kundenzahlen. Einkommens- oder Heilversprechen.
- Blueprint ohne ausgeschriebene Texte ("Hier eine starke Headline einfügen").

## Ausgabe
Liefere nur JSON in genau diesem Schema. `schritte` in Reihenfolge des Funnels, `nachfass` als Liste von Objekten, `kennzahlen_ziel` als gut lesbarer Text mit Zeilenumbrüchen.

```json
{ "funnel_typ": "", "begruendung": "", "schritte": [ { "nr": 1, "seite": "", "ziel": "", "headline": "", "subheadline": "", "abschnitte": [ { "titel": "", "text": "" } ], "cta": "", "hinweise": "" } ], "nachfass": [ { "zeitpunkt": "", "kanal": "", "ziel": "", "text": "" } ], "kennzahlen_ziel": "" }
```
