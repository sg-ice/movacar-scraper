# Movacar 1-Euro-Finder – automatischer Suchlauf

Dieses Repository sucht alle 3 Stunden per GitHub Actions nach Movacar-Überführungen
ab Deutschland ins Ausland und speichert das Ergebnis in `movacar_daten.json`.
Die Netlify-Seite liest diese Datei direkt von GitHub – Netlify muss dafür nicht neu deployen.

## Einrichtung (einmalig)

1. Auf github.com ein **öffentliches** Repository anlegen, z. B. `movacar-finder`.
   (Öffentlich, weil GitHub Actions dort kostenlos sind und die Netlify-Seite die Datei ohne Anmeldung lesen kann.)
2. Alle Dateien aus diesem Ordner hochladen („Add file“ → „Upload files“).
   Wichtig: der Ordner `.github/workflows` muss mit hoch. Falls der Browser versteckte Ordner
   nicht mitnimmt: im Repository „Add file“ → „Create new file“, als Namen
   `.github/workflows/suchlauf.yml` eintippen und den Inhalt der Datei einfügen.
3. Reiter **Actions** → „Movacar-Suchlauf“ → **Run workflow**. Der erste Lauf dauert am längsten
   (alle Orte und Länder werden ermittelt), danach geht es schneller.
4. Nach dem ersten erfolgreichen Lauf liegt `movacar_daten.json` im Repository.
   Ihre Rohdaten-Adresse lautet:
   `https://raw.githubusercontent.com/<BENUTZERNAME>/<REPO>/main/movacar_daten.json`
5. Diese Adresse in der Netlify-`index.html` bei `const REMOTE_DATA_URL = "";` eintragen
   und die Seite einmal neu auf Netlify hochladen.

**Netlify nicht mit diesem Repository verbinden** – sonst löst jeder Datenstand einen
Deploy aus (Free-Plan: 15 von 300 Credits pro Deploy).

## Betrieb

- Zeitplan: `.github/workflows/suchlauf.yml`, Zeile `cron` (UTC). Standard: alle 3 Stunden.
- Manuell starten: Actions → Movacar-Suchlauf → Run workflow.
- Schlägt ein Lauf fehl oder liefert er 0 Angebote, bleibt der letzte Datenstand erhalten
  und der Lauf wird in Actions rot markiert.
- GitHub deaktiviert Zeitpläne in öffentlichen Repositories nach 60 Tagen ohne Aktivität.
  Die Daten-Commits des Bots sollten als Aktivität zählen; falls der Zeitplan doch stoppt,
  unter Actions wieder aktivieren.

## Dateien

- `index.html` – dieselbe Seite wie auf Netlify; der Bot öffnet sie unsichtbar und klickt „Jetzt aktualisieren“.
- `crawl.mjs` – Steuerung des Suchlaufs (Playwright/Chromium).
- `.github/workflows/suchlauf.yml` – Zeitplan und Ablauf.

Wenn sich die Seite ändert, auch hier `index.html` ersetzen, damit der Bot dieselbe Logik nutzt.
