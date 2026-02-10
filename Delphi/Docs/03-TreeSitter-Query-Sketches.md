# Tree-sitter Query Skizzen (Pascal/Delphi)

Diese Skizzen sind bewusst so geschrieben, dass du sie schnell an die **konkreten Node-Namen** von `tree-sitter-pascal` und die **Capture-Konvention** von CodeGraph anpassen kannst.

> Praxis-Tipp: Nutze `tree-sitter parse` bzw. Editor-Tools (z.B. Neovim `:InspectTree`) um die exakten Node-Typen im AST zu sehen.

## A) Nodes

### 1) Unit / Program / Package

- Match: `unit`/`program`/`library`/`package` header
- Extrahiere Name

Skizze:

```scm
; (unit_header name: (identifier) @NAME) @NODE
; (#set! "kind" "unit")

; (program_header name: (identifier) @NAME) @NODE
; (#set! "kind" "program")
```

### 2) Klassen / Interfaces / Records

Skizze:

```scm
; (type_declaration
;   (type_definition
;     name: (identifier) @TYPE_NAME
;     value: (class_type) @CLASS
;   )
; )

; (type_definition name: (identifier) @TYPE_NAME value: (interface_type) @IFACE)
; (type_definition name: (identifier) @TYPE_NAME value: (record_type) @REC)
```

### 3) Procs/Funcs (top-level)

```scm
; (procedure_declaration name: (identifier) @NAME) @NODE
; (#set! "kind" "procedure")

; (function_declaration name: (identifier) @NAME) @NODE
; (#set! "kind" "function")
```

### 4) Methoden

Je nach Grammar sind Methoden oft als procedure/function nodes innerhalb eines `class_body` oder `visibility_section` enthalten.

```scm
; (method_declaration name: (identifier) @NAME) @NODE
; (#set! "kind" "method")
; optional: capture class name via ancestor match (wenn CodeGraph das unterstützt)
```

## B) Edges

### 1) uses (imports/dependencies)

```scm
; (uses_clause (qualified_identifier) @UNIT_NAME) @EDGE
; (#set! "kind" "imports")
```

### 2) extends (Basisklasse)

```scm
; (class_type
;   base_class: (qualified_identifier) @BASE
; ) @EDGE
; (#set! "kind" "extends")
```

### 3) implements (Interfaces)

```scm
; (class_type
;   implements: (interface_list (qualified_identifier) @IFACE)
; ) @EDGE
; (#set! "kind" "implements")
```

### 4) calls (Call-Graph)

Du willst in Delphi mindestens folgende Formen sehen:
- `Foo()`
- `Obj.Foo()`
- `TMyClass.Foo()`

Skizze:

```scm
; (call_expression
;   function: (identifier) @CALLEE
; ) @EDGE
; (#set! "kind" "calls")

; (call_expression
;   function: (qualified_identifier
;              qualifier: (identifier) @QUAL
;              name: (identifier) @CALLEE)
; ) @EDGE
; (#set! "kind" "calls")
```

## C) MVP: „Contains“-Edges

Optional, aber oft sehr nützlich: Datei/Unit enthält Klassen/Procs.

```scm
; (type_definition name: (identifier) @CHILD) @EDGE
; (#set! "kind" "contains")
```

Das ist abhängig davon, wie CodeGraph containment modelliert.
