import type { LintNode, LintScope } from '#plugin-types';

export function isNodeValueImport(
  node: import('estree').ImportDeclaration & { importKind?: 'type' | 'value' }
) {
  return (
    typeof node.source.value === 'string'
    && node.source.value.startsWith(
      'node:'
    )
    && node.importKind !== 'type'
  );
}

export function hasNamedValueImport(node: import('estree').ImportDeclaration) {
  return node.specifiers.some(
    (specifier: LintNode) =>
      specifier.type === 'ImportSpecifier' && specifier.importKind !== 'type',
  );
}

export function hasNodeNamedValueImport(program: import('estree').Program) {
  return program.body.some(
    (node) =>
      node.type === 'ImportDeclaration'
      && isNodeValueImport(
        node
      )
      && hasNamedValueImport(
        node
      ),
  );
}

export function getScopeVariable(
  scope: LintScope,
  name: string
) {
  if (scope.set instanceof Map) {
    return scope.set.get(
      name
    );
  }

  return scope.variables.find(
    (variable) => variable.name === name
  );
}
