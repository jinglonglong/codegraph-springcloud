# Implementation Plan: Pascal/Delphi in CodeGraph

## 0) Prämissen

- CodeGraph extrahiert **Nodes** und **Edges** über **tree-sitter** und language-spezifische **Queries (`.scm`)**.
- Danach folgt **Reference Resolution** (Calls → Definitionen, imports → Dateien, inheritance, framework patterns).

## 1) Parser / Grammar

Empfohlen: `tree-sitter-pascal` (unterstützt Delphi + FreePascal).

**Tasks:**
- Dependency hinzufügen (wie bei bestehenden Sprachen).
- Language-Loader/Registry erweitern: `languageId = "pascal"` (oder `"delphi"`, aber konsistent).

## 2) File-Erkennung

Extensions (MVP):
- `.pas` (Units)
- `.dpr` (Program)
- `.dpk` (Package)
- `.lpr` (Lazarus Program)

Optional:
- `.inc` (Include-Fragmente) – erst später oder nur, wenn Parser tolerant genug ist.

## 3) Queries (MVP)

### 3.1 Nodes
Extrahiere mindestens:
- Unit/Program/Package Name
- Klassen / Interfaces / Records
- Procedures/Functions
- Methoden (class/instance)

### 3.2 Edges
Extrahiere mindestens:
- `uses` (import/dependency)
- `extends` (Basisklasse)
- `implements` (Interface-Implementierungen)
- `calls` (Identifier + optional Qualifier)

## 4) Reference Resolution (MVP)

### 4.1 Unit-Auflösung (`uses`)
- Index-Phase: Map `UnitName -> fileId` (aus Units/Programs/Packages)
- Resolution: Bei `uses Foo, Bar;` Edges auf Ziel-Units setzen.
- Spezialfälle (später): `Foo in 'path\Foo.pas'` (DPR/DPK), Namespaces (`System.SysUtils`).

### 4.2 Call-Auflösung (best effort)
- Extraktion: `callName`, optional `qualifier` (`Obj.DoIt`, `TMyClass.DoIt`)
- Heuristik-Reihenfolge:
  1. lokale Procs/Funcs in der gleichen Unit
  2. Methoden in der gleichen Klasse
  3. Units aus `uses`
  4. globaler Fallback nach Name

## 5) Tests

- Fixtures aus `fixtures/` in die Test-Suite aufnehmen
- Assertions:
  - Node-Anzahl + zentrale Namen
  - `uses`-Edges
  - `extends`/`implements`-Edges
  - einfache Call-Edges

## 6) Definition of Done

- `codegraph index` indexiert Delphi/ Pascal-Dateien ohne Crash
- `codegraph_search` findet Klassen/Methoden
- `codegraph_callers/callees` liefert sinnvolle Ergebnisse für einfache Fälle
- `uses`-Graph stimmt (Unit-Abhängigkeiten)
