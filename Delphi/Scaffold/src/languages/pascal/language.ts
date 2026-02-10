/**
 * Pascal / Delphi language registration scaffold for CodeGraph.
 *
 * NOTE: This is intentionally pseudo-code / a template.
 * You must adapt it to the actual CodeGraph codebase structure.
 */

export const pascalLanguage = {
  id: 'pascal',
  displayName: 'Pascal / Delphi',

  // MVP extensions
  extensions: ['.pas', '.dpr', '.dpk', '.lpr'],

  // Suggested tree-sitter grammar package name (verify in your fork)
  // parser: require('tree-sitter-pascal'),

  // Queries used by the extractor
  queries: {
    nodes: __dirname + '/queries/nodes.scm',
    edges: __dirname + '/queries/edges.scm',
    // comments: __dirname + '/queries/comments.scm',
  },

  // Optional language-specific settings
  options: {
    // includeFiles: ['**/*.inc'] // only if you decide to support includes
  }
};
