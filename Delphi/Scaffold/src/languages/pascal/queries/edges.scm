; Pascal/Delphi edge extraction queries (SCAFFOLD)
; -----------------------------------------------
; IMPORTANT: Replace capture names with the exact ones CodeGraph expects.

; === uses (imports) ===

; (uses_clause (qualified_identifier) @cg.target) @cg.edge
; (#set! cg.kind "imports")


; === class inheritance ===

; (class_type
;   base_class: (qualified_identifier) @cg.target
; ) @cg.edge
; (#set! cg.kind "extends")


; === implements interfaces ===

; (class_type
;   implements: (interface_list (qualified_identifier) @cg.target)
; ) @cg.edge
; (#set! cg.kind "implements")


; === call graph (best-effort) ===

; (call_expression function: (identifier) @cg.target) @cg.edge
; (#set! cg.kind "calls")

; Qualified calls: Obj.Foo(), TMyClass.Bar()
; (call_expression
;   function: (qualified_identifier
;              qualifier: (identifier) @cg.qualifier
;              name: (identifier) @cg.target)
; ) @cg.edge
; (#set! cg.kind "calls")
