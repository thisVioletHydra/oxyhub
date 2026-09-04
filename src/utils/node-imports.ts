/** @param {import('estree').ImportDeclaration} node */
export function isNodeValueImport(node) {
  return (
    typeof node.source.value === 'string'
    && node.source.value.startsWith('node:')
    && node.importKind !== 'type'
  );
}

/** @param {import('estree').ImportDeclaration} node */
export function hasNamedValueImport(node) {
  return node.specifiers.some(
    (specifier) =>
      specifier.type === 'ImportSpecifier' && specifier.importKind !== 'type',
  );
}

/** @param {import('estree').Program} program */
export function hasNodeNamedValueImport(program) {
  return program.body.some(
    (node) =>
      node.type === 'ImportDeclaration'
      && isNodeValueImport(node)
      && hasNamedValueImport(node),
  );
}

/** @param {import('eslint').Scope.Scope} scope @param {string} name */
export function getScopeVariable(scope, name) {
  if (scope.set instanceof Map) {
    return scope.set.get(name);
  }

  return scope.variables.find((variable) => variable.name === name);
}
