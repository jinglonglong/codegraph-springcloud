; Pascal/Delphi node extraction queries (SCAFFOLD)
; -------------------------------------------------
; IMPORTANT: Replace capture names with the exact ones CodeGraph expects.
; Use existing languages as reference.

; === Unit / Program / Library / Package ===

; (unit_header name: (identifier) @cg.name) @cg.node
; (#set! cg.kind "unit")

; (program_header name: (identifier) @cg.name) @cg.node
; (#set! cg.kind "program")

; (library_header name: (identifier) @cg.name) @cg.node
; (#set! cg.kind "library")

; (package_header name: (identifier) @cg.name) @cg.node
; (#set! cg.kind "package")


; === Types: class / interface / record ===

; (type_definition
;   name: (identifier) @cg.name
;   value: (class_type)
; ) @cg.node
; (#set! cg.kind "class")

; (type_definition
;   name: (identifier) @cg.name
;   value: (interface_type)
; ) @cg.node
; (#set! cg.kind "interface")

; (type_definition
;   name: (identifier) @cg.name
;   value: (record_type)
; ) @cg.node
; (#set! cg.kind "record")


; === Top-level procedures/functions ===

; (procedure_declaration name: (identifier) @cg.name) @cg.node
; (#set! cg.kind "procedure")

; (function_declaration name: (identifier) @cg.name) @cg.node
; (#set! cg.kind "function")


; === Methods (depending on grammar) ===

; (method_declaration name: (identifier) @cg.name) @cg.node
; (#set! cg.kind "method")

; Constructors / Destructors (optional)
; (constructor_declaration name: (identifier) @cg.name) @cg.node
; (#set! cg.kind "constructor")
;
; (destructor_declaration name: (identifier) @cg.name) @cg.node
; (#set! cg.kind "destructor")
