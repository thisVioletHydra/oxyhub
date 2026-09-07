import type { LintNode } from '#plugin-types';

export type IdLengthOptions = {
  min: number;
  exceptions: Set<string>;
  exceptionPatterns: RegExp[];
  properties: 'always' | 'never';
};

export function isTooShort(
  name: string,
  options: IdLengthOptions
) {
  if (name.length >= options.min) {
    return false;
  }

  if (options.exceptions.has(
    name
  )) {
    return false;
  }

  return !options.exceptionPatterns.some(
    (pattern) => pattern.test(
      name
    )
  );
}

export function isLetOrConstDeclarator(node: LintNode | null | undefined) {
  return (
    node?.type === 'VariableDeclarator'
    && ((node.parent as { kind?: string } | undefined)?.kind === 'let'
      || (node.parent as { kind?: string } | undefined)?.kind === 'const')
  );
}

export function isInsideLetOrConstBinding(node: LintNode) {
  let current = node.parent;

  while (current) {
    if (isLetOrConstDeclarator(
      current
    )) {
      return true;
    }

    if (
      current.type === 'FunctionDeclaration'
      || current.type === 'FunctionExpression'
      || current.type === 'ArrowFunctionExpression'
      || current.type === 'ClassDeclaration'
      || current.type === 'ClassExpression'
      || current.type === 'CatchClause'
      || current.type === 'ImportDeclaration'
      || current.type === 'ExportNamedDeclaration'
      || current.type === 'Program'
    ) {
      return false;
    }

    current = current.parent;
  }

  return false;
}

export function checkBindingPattern(
  pattern: LintNode,
  reportIfTooShort: (node: LintNode) => void
) {
  if (pattern.type === 'Identifier') {
    reportIfTooShort(
      pattern
    );
    return;
  }

  if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) {
      if (element) {
        checkBindingPattern(
          element,
          reportIfTooShort
        );
      }
    }
    return;
  }

  if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        checkBindingPattern(
          property.argument,
          reportIfTooShort
        );
        continue;
      }

      if (property.value) {
        checkBindingPattern(
          property.value,
          reportIfTooShort
        );
      }
    }
    return;
  }

  if (pattern.type === 'AssignmentPattern') {
    checkBindingPattern(
      pattern.left,
      reportIfTooShort
    );
    return;
  }

  if (pattern.type === 'RestElement') {
    checkBindingPattern(
      pattern.argument,
      reportIfTooShort
    );
  }
}
