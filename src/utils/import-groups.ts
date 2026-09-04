export const ImportGroup = {
  TYPE: 0,
  NAMED: 1,
  DEFAULT: 2,
  SIDE_EFFECT: 3,
};

/** @param {import('estree').ImportDeclaration} node */
export function getImportGroup(node) {
  const specifiers = node.specifiers;

  if (specifiers.length === 0) {
    return ImportGroup.SIDE_EFFECT;
  }

  if (node.importKind === 'type') {
    return ImportGroup.TYPE;
  }

  if (
    specifiers.some(
      (specifier) =>
        specifier.type === 'ImportSpecifier' && specifier.importKind !== 'type',
    )
  ) {
    return ImportGroup.NAMED;
  }

  if (specifiers.some((specifier) => specifier.type === 'ImportDefaultSpecifier')) {
    return ImportGroup.DEFAULT;
  }

  return ImportGroup.TYPE;
}

/** @param {import('estree').Program} program */
export function getTopImportBlock(program) {
  const { body } = program;
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

  const imports = body.slice(0, blockEnd);

  for (let index = blockEnd; index < body.length; index += 1) {
    if (body[index].type === 'ImportDeclaration') {
      return { imports, detached: body[index] };
    }
  }

  return { imports, detached: null };
}
