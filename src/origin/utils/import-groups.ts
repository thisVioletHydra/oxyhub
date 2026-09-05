import type { LintNode } from '#plugin-types';

export const ImportGroup = {
  TYPE: 0,
  NAMED: 1,
  DEFAULT: 2,
  SIDE_EFFECT: 3,
} as const;

type ImportGroupId = (typeof ImportGroup)[keyof typeof ImportGroup];

export function getImportGroup(
  node: import('estree').ImportDeclaration & { importKind?: 'type' | 'value' }
): ImportGroupId {
  const specifiers = node.specifiers;

  if (specifiers.length === 0) {
    return ImportGroup.SIDE_EFFECT;
  }

  if (node.importKind === 'type') {
    return ImportGroup.TYPE;
  }

  if (
    specifiers.some(
      (specifier: LintNode) =>
        specifier.type === 'ImportSpecifier' && specifier.importKind !== 'type',
    )
  ) {
    return ImportGroup.NAMED;
  }

  if (specifiers.some(
    (specifier) => specifier.type === 'ImportDefaultSpecifier'
  )) {
    return ImportGroup.DEFAULT;
  }

  return ImportGroup.TYPE;
}

export function getTopImportBlock(program: import('estree').Program) {
  const {
    body
  } = program;
  if (body.length === 0) {
    return null;
  }

  if (body[0].type !== 'ImportDeclaration') {
    return null;
  }

  let blockEnd = 0;
  while (blockEnd < body.length && body[blockEnd].type === 'ImportDeclaration') {
    blockEnd += 1;
  }

  const imports = body.slice(
    0,
    blockEnd
  ) as import('estree').ImportDeclaration[];

  for (let index = blockEnd; index < body.length; index += 1) {
    const statement = body[index];
    if (statement.type === 'ImportDeclaration') {
      return {
        imports,
        detached: statement
      };
    }
  }

  return {
    imports,
    detached: null
  };
}
