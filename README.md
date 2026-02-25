# Arbeitszeitstatus

Ein Tampermonkey/Greasemonkey-Userscript für die Zeiterfassungsseite von **psteam.summit-services.de**.

Das Script zeigt unterhalb des „Erfassen"-Buttons automatisch die verbleibende Arbeitszeit sowie anfallende Überstunden an.

---

## Funktionen

- **Verbleibende Arbeitszeit** – Zeigt an, wie viele Stunden und Minuten noch bis zum Arbeitsende fehlen
- **Feierabendzeit** – Zeigt die voraussichtliche Uhrzeit des Arbeitsendes an
- **Überstundenanzeige** – Sobald die Sollarbeitszeit erfüllt ist, wird die Überstundenzeit angezeigt
- **Pausenberücksichtigung** – Pause-Beginn und Pause-Ende werden korrekt eingerechnet
- **Automatische Pausenpflicht** – Wenn nach 13:00 Uhr keine Pause gebucht wurde, werden automatisch 30 Minuten zur Sollarbeitszeit addiert
- **Minutengenaue Aktualisierung** – Die Anzeige aktualisiert sich jede Minute ohne erneuten API-Abruf

---

## Voraussetzungen

- Browser-Erweiterung [Tampermonkey](https://www.tampermonkey.net/) (empfohlen) oder [Greasemonkey](https://www.greasespot.net/)

---

## Installation

1. Tampermonkey im Browser installieren
2. Auf den folgenden Button klicken:

[![Installieren](https://img.shields.io/badge/Tampermonkey-Installieren-00485B?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/jonas-halbeisen-psteam/Arbeitszeitstatus/refs/heads/main/Zeiterfassung.user.js)

---

## Verwendung

Nach der Installation öffne die Seite:

```
https://psteam.summit-services.de/horizon/
```

Unterhalb des „Erfassen"-Buttons erscheint automatisch die Arbeitszeitstatus-Anzeige.

---

## Anzeige-Zustände

| Zustand | Anzeige |
|---|---|
| Arbeitszeit läuft | Verbleibend: Xh Xm · Feierabend um: HH:MM |
| Sollarbeitszeit erfüllt | Sollarbeitszeit erfüllt! · Überstunden: +Xh Xm |
| Keine Daten vorhanden | Keine Daten für heute verfügbar |

---