import type { Identifier, LintScope, LintVariable, RuleContext } from '#plugin-types';

function getScopeVariable(scope: LintScope, name: string) {
  if (scope.set instanceof Map) {
    return scope.set.get(name);
  }

  return scope.variables.find(variable => variable.name === name);
}

export function findVariable(context: RuleContext, node: Identifier, name: string) {
  let scope: LintScope | null = context.sourceCode.getScope(node);

  while (scope) {
    const variable = getScopeVariable(scope, name);
    if (variable !== undefined) {
      return variable;
    }

    scope = scope.upper;
  }

  return undefined;
}

export function nameTaken(scope: LintScope | undefined, name: string) {
  if (scope === undefined) {
    return false;
  }

  return getScopeVariable(scope, name) !== undefined;
}

export function bindingNodes(variable: LintVariable, fallback: Identifier) {
  const nodes: Identifier[] = [];
  const seen = new Set<Identifier>();

  const add = (node: Identifier | null | undefined) => {
    if (node === undefined || node === null || seen.has(node)) {
      return;
    }

    seen.add(node);
    nodes.push(node);
  };

  add(fallback);

  if ('identifiers' in variable && Array.isArray(variable.identifiers)) {
    for (const identifier of variable.identifiers) {
      if (identifier?.type === 'Identifier') {
        add(identifier);
      }
    }
  }

  for (const reference of variable.references) {
    if (reference.identifier.type === 'Identifier') {
      add(reference.identifier);
    }
  }

  for (const definition of variable.defs) {
    if (definition.name?.type === 'Identifier') {
      add(definition.name);
    }
  }

  return nodes;
}
