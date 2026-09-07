import type { ImportDeclaration, ImportSpecifier, LintNode, LintScope, Literal, Program } from '#plugin-types';

export function isNodeValueImport(
  node: ImportDeclaration & { importKind?: 'type' | 'value' },
) {
  return (
    typeof node.source.value === 'string'
    && node.source.value.startsWith('node:')
    && node.importKind !== 'type'
  );
}

export function hasNamedValueImport(node: ImportDeclaration) {
  return node.specifiers.some(
    (specifier: LintNode) =>
      specifier.type === 'ImportSpecifier' && specifier.importKind !== 'type',
  );
}

export function hasNodeNamedValueImport(program: Program) {
  return program.body.some(
    node =>
      node.type === 'ImportDeclaration'
      && isNodeValueImport(node)
      && hasNamedValueImport(node),
  );
}

export function getScopeVariable(scope: LintScope, name: string) {
  if (scope.set instanceof Map) {
    return scope.set.get(name);
  }

  return scope.variables.find(variable => variable.name === name);
}

export const KNOWN_NODE_DEFAULT_NAMES: Record<string, string> = {
  'node:process': 'process',
  'node:path': 'path',
  'node:fs': 'fs',
  'node:fs/promises': 'fsPromises',
};

export function getNodeDefaultImportName(source: string) {
  const known = KNOWN_NODE_DEFAULT_NAMES[source];
  if (known !== undefined) {
    return known;
  }

  return source.slice('node:'.length).split('/')[0];
}

export function getImportQuote(sourceNode: Literal) {
  if (typeof sourceNode.raw === 'string' && sourceNode.raw.startsWith('"')) {
    return '"';
  }

  return '\'';
}

export function getImportedBindingName(specifier: ImportSpecifier) {
  if (specifier.imported.type === 'Identifier') {
    return specifier.imported.name;
  }

  return specifier.imported.value as string;
}
