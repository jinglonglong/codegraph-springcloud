# Capture Convention (wie die `.scm` Queries an CodeGraph andocken)

Da wir hier nur ein ZIP-Konzept liefern (ohne den CodeGraph-Source lokal auszulesen), ist das wichtigste: **du musst die Captures so benennen, wie CodeGraph sie in den bestehenden Sprachen bereits erwartet**.

## Vorgehen

1. Öffne im CodeGraph-Repo eine bestehende Sprache (z.B. Go/Rust/Java).
2. Suche nach `.scm` Dateien und schaue:
   - welche Capture-Namen verwendet werden
   - wie Node-Kind/Edge-Kind gesetzt werden (oft via `#set!`)
3. Übertrage exakt dieses Schema auf Pascal.

## Empfohlene semantische Einteilung

Unabhängig von den konkreten Capture-Namen sollte jedes Query-Match folgende Informationen liefern:

### Für Nodes
- **kind**: `unit | program | package | class | interface | record | function | procedure | method | property | field | type | enum | variable`
- **name**: Symbolname
- **container** (optional): z.B. Klassenname für Methoden
- **signature** (optional): Parameter/Returntype, falls leicht verfügbar
- **range**: Start/Ende im File (Line/Column)

### Für Edges
- **kind**: `imports | calls | extends | implements | contains | returns_type`
- **from**: Node-ID der Quelle (oder "current scope")
- **to**: Zielsymbol (Name) oder Ziel-Node-ID, wenn schon auflösbar
- **raw**: Originaltext (hilft Resolvern)

## Minimaler Capture-Satz (Pseudo)

> **Wichtig:** Diese Namen sind **Platzhalter**. Bitte auf das CodeGraph-interne Schema mappen.

- `@cg.node` mit Properties:
  - `(#set! cg.kind "class")`
  - `(#set! cg.name @nameCapture)` oder per separate captures

- `@cg.edge` mit Properties:
  - `(#set! cg.kind "calls")`
  - Zielsymbol als Capture: `@cg.target`

Wenn CodeGraph statt `#set!` eine feste Capture-Nomenklatur nutzt (z.B. `@definition.function`), dann übernimm exakt diese.

## Delphi-spezifische Stolperfallen

- `procedure Foo;` vs `function Foo: Integer;`
- `class procedure` / `class function`
- `constructor` / `destructor`
- `property` (kann wie Feld wirken, ist aber call-ähnlich)
- `with`-Statements (Call-Qualifier wird verschleiert)
- Namespaces: `System.SysUtils`

Für MVP: **nicht perfekt auflösen**, aber **zuverlässig extrahieren**.
