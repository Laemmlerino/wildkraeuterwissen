# Wildkräuterwissen – Herbarium für Neo

Deutschsprachiges Lernatelier mit originalen Bildern aus den eigenen Unterlagen.

- Schnelllernen: lateinische Namen aufdecken, Deutsch optional anzeigen und Karten einstufen.
- Pflanzen erkennen: ähnliche lateinische Namen vergleichen.
- Namen schreiben: den vollständigen Namen, die Gattung oder das Art-Epitheton prüfen.
- Karteikasten: Pflanzen mit Quellen und Bildstatus, Lernstufen pro Browser.
- Lerntutor: Fragen zu Skripten oder Abfrage mit PDF-Fundstellen.
- Bibliothek: Original-PDFs in Ausbildung, Fachliteratur und Ergänzungen.

## Lokal starten

```sh
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python tools/import_sources.py '/pfad/zu/Wildkräuterschule' data
.venv/bin/python app/server.py
```

Dann http://127.0.0.1:8787 öffnen. Eigene Unterlagen müssen vor dem ersten Start importiert werden.

Die ergänzende Datei `Pflanzenliste.pdf` wird beim Import als Kursliste
erkannt. Die Karten behalten ihre stabilen IDs. Bildnachweise liegen mit den
Fotos unter `data/` und erscheinen bei der Lösung und im Karteikasten.

```sh
.venv/bin/python tools/fetch_plant_photos.py data
```

Der Fotolauf ist wiederholbar und ergänzt Karten, für die eine eindeutig
zugeordnete, nachnutzbare Aufnahme bei iNaturalist oder Wikimedia Commons verfügbar ist.

## Lokalen Lerntutor starten

Ollama auf demselben Rechner starten und ein lokales Modell laden. Die App
verwendet Ollama unter `127.0.0.1:11434` und verlinkt zitierte PDF-Seiten.

```sh
ollama pull qwen3:4b-instruct-2507-q4_K_M
WILDKRAEUTER_LOCAL_MODEL=qwen3:4b-instruct-2507-q4_K_M .venv/bin/python app/server.py
```

Auf Neo zuerst Ollama auf dem Server bereitstellen und das Modell dort laden.
Dann beim Herbarium `localTutorModel = "qwen3:4b-instruct-2507-q4_K_M"` setzen. Der lokale Modus
hat Vorrang vor Hermes und verwendet keine Codex-Anmeldung.

## Auf Neo installieren

Für die Übernahme der lokalen Bibliothek in der lokalen App unter **Bibliothek**
das ZIP-Paket herunterladen. Auf der angemeldeten Neo-Instanz unter **Bibliothek**
**Bibliothek auf Neo hochladen** wählen und das ZIP auswählen. Für diesen Weg
`sourceDirectory` leer lassen. Das Paket enthält die PDFs, Fotos, botanischen
Tafeln, Quellenangaben und Namens- und Bildentscheide. Der Lernfortschritt wird im
jeweiligen Browser gespeichert. Der Upload steht zur Ersteinrichtung einer leeren
Bibliothek zur Verfügung und übernimmt ZIP-Dateien bis 1 GiB.

Das Plugin-Verzeichnis auf den Neo-Server kopieren oder in einem eigenen Git-Repository bereitstellen. Die Unterlagen sind absichtlich nicht im Git-Repository enthalten. Den Unterlagenordner separat auf den Server kopieren, für `homeserver` lesbar. In Neo unter **Einstellungen → System → Plugins** die URL eintragen (z.B. `git+file:/srv/plugins/wildkraeuter-neo` oder die eigene Repository-URL). Konfiguration:

```toml
[core.plugins.wildkraeuter]
url = "github:Laemmlerino/wildkraeuterwissen"

[services.wildkraeuter]
enabled = true
sourceDirectory = "/srv/unterlagen/Wildkräuterschule"
tutorEnabled = false
```

Aktivieren. Die Karte **Wildkräuterschule** öffnet die App hinter SWAG und tinyauth. Alle Daten liegen im Neo-Appdata-Verzeichnis. Der erste Start importiert die PDFs; bei 1'879 Seiten dauert er etwas. Ein leerer Unterlagenpfad verwendet den vorhandenen Import. Erneuter Start mit gesetztem Pfad importiert erneut. Weitere geprüfte Tafeln lassen sich in `tools/import_sources.py` mit Band und PDF-Seite zuordnen. Die vier Bände bleiben vollständig in der Bibliothek.

## Codex über Neo verbinden

1. Neo und Hermes aktivieren. In Hermes einen Gateway-Token erzeugen, falls noch nicht vorhanden.
2. In Neo unter **Hermes → KI-Anbieter** `OpenAI Codex` wählen und **Anmelden** verwenden. Den dort angezeigten Anmeldevorgang im Browser abschliessen.
3. In der Wildkräuterschule **Lerntutor aktivieren** einschalten und aktivieren.
4. In der App den Lerntutor öffnen. Der Link **Codex in Neo verbinden** führt zur Neo-Oberfläche.

Das Plugin verwendet die in Neo vorhandene Anmeldung und den lokalen Hermes-Gateway. Es implementiert keinen zweiten OAuth-Fluss und bekommt keine Codex-Tokens im Browser. Der Gateway-Schlüssel wird über Neo-Secrets und systemd-Credentials übergeben. Der Tutor verwendet den tatsächlich in Hermes gewählten Anbieter; für Codex muss dieser dort ausgewählt sein.

Der Tutor nutzt den gemeinsamen Hermes-Assistenten. Anweisungen untersagen Werkzeuge und die App erteilt keine Werkzeugfreigaben; das ist keine technische Isolation von Hermes' administrativen Rechten. Für mehrere nicht vertrauenswürdige Nutzer ist vor produktivem Einsatz ein eigener, technisch werkzeugloser Tutor-Gateway erforderlich. Nachrichten und passende Skriptauszüge werden an den gewählten KI-Anbieter gesendet. Neue Gespräche löschen nur den Verlauf im Lern-App-Prozess; Hermes kann eigene Sitzungsprotokolle behalten.

## Quellen und Grenzen

Alle Inhalte und Bilder werden ausschliesslich aus dem angegebenen lokalen Unterlagenordner importiert. Keine Webbilder, keine generierten Pflanzenbilder. Die Tafelausschnitte blenden gedruckte Namen aus. Textsuche verwendet die vorhandene PDF-Textebene; kein zusätzliches OCR. Der Tutor zieht nur die neueren Skripte heran, nicht historische medizinische Angaben aus Köhler. Quellenbindung wird dem Modell vorgegeben; Antworten müssen anhand der verlinkten Originalseiten prüfbar bleiben.

Der lokale Import enthält 27 PDFs und 1'879 textführende Seiten. Die Kartenauswahl bündelt die Wildfrüchteliste, die Pflanzenporträts des Wurzelskripts, ausgewählte Forschungsaufträge und die ursprünglichen Bildkarten. Der Karteikasten zeigt unter **Ohne zugeordnete Tafel**, welche Pflanzen noch ein Lernbild brauchen. Die Kursunterlagen bleiben unversioniert unter `data/`; nicht öffentlich hochladen. Der App-Code steht unter MIT, die mitgebrachten Unterlagen behalten ihre eigenen Rechte.

## Prüfen

Lokal bestanden: zehn automatisierte Tests, JavaScript-Syntaxprüfung und Chromium-Durchlauf der Lernmodi, Bibliothek und nicht verbundenen Tutoransicht. Desktop und 390-Pixel-Handyansicht ohne horizontales Überlaufen. Der Tutor-Datenfluss wurde mit einer simulierten Hermes-Antwort geprüft; keine echte Codex-Anmeldung durchgeführt.

```sh
.venv/bin/python -m unittest discover -s tests -v
nix fmt
nix flake check
```

Neo-Referenz für die Implementierung: `madebydamo/neo` Revision `8b23e1cccb0fc6004183f222f2decad7d0e148da`. Ausgangspunkt ist dessen unveränderte Plugin-Flake-Vorlage. Nix ist auf dieser Arbeitsmaschine nicht installiert; `flake.lock`, Nix-Auswertung und der Neo-VM-Smoke-Test müssen auf einem Nix-Rechner nachgeholt werden. Vor produktiver Installation dort `nix flake lock`, `nix fmt` und `nix flake check` ausführen. Danach Dienst, `/health`, tinyauth-Weiterleitung und den angemeldeten Tutor auf Neo testen. Die tatsächliche Codex-Anmeldung kann nur vom Benutzer abgeschlossen werden.
