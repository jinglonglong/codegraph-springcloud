# CodeGraph Pascal/Delphi Support (Fork-Konzept)

Dieses ZIP ist **kein fertiger CodeGraph-Fork**, sondern ein **umsetzbarer Bauplan** inklusive Query-Skizzen, Scaffold-Dateistruktur, Test-Fixtures und einer Checkliste.

Ziel: CodeGraph soll **Pascal/Delphi**-Dateien indexieren und daraus **Nodes** (Units, Klassen, Methoden, …) sowie **Edges** (uses/imports, calls, extends, implements, …) extrahieren.

## Inhalt

- `Docs/` – Konzept, Capture-Konventionen, Implementations-Schritte
- `Scaffold/` – vorgeschlagene Ordner/Dateien für `src/languages/pascal/` inkl. `.scm` Queries
- `fixtures/` – kleine Delphi-Beispieldateien zum Testen der Extraktion
- `resolution/` – Resolver-Heuristiken (Unit-Mapping, Call-Resolution)

## Wie du damit arbeitest

1. **Im CodeGraph-Repo** die bestehende Struktur für eine Sprache ansehen (z.B. `src/languages/go` oder `src/languages/java`).
2. Dieses ZIP als Vorlage nehmen und **1:1** in deinen Fork übertragen:
   - `src/languages/pascal/**`
   - Extension-Mapping (`.pas`, `.dpr`, `.dpk`, `.lpr`, optional `.inc`)
   - Language-Registry erweitern
3. Queries (`.scm`) auf die **Capture-Namen** mappen, die CodeGraph intern erwartet.
4. Resolver erweitern (mindestens `uses` → Unit-File, einfache Call-Auflösung).
5. Fixtures in die Tests aufnehmen.

> Hinweis: Tree-sitter ist die Grundlage. Für Pascal/Delphi bietet sich `tree-sitter-pascal` an (Delphi + FreePascal). 
