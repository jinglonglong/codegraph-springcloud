# Pascal / Delphi Language Module (Scaffold)

Diese Dateien sind als **Startpunkt** für einen CodeGraph-Fork gedacht.

## Strukturvorschlag

- `language.ts` – registriert Parser, Extensions, Query-Files
- `queries/nodes.scm` – Node-Extraktion
- `queries/edges.scm` – Edge-Extraktion
- `queries/comments.scm` (optional) – Docstrings/Kommentare

## Wichtig

Die Capture-Namen in den `.scm` Dateien sind **Platzhalter**.
Passe sie so an, dass sie zum internen Schema von CodeGraph passen (siehe `Docs/02-Capture-Convention.md`).
