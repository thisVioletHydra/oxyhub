/** @type {Record<string, string>} */
export const KNOWN_NODE_DEFAULT_NAMES = {
  'node:process': 'process',
  'node:path': 'path',
  'node:fs': 'fs',
  'node:fs/promises': 'fsPromises',
};

/** @param {string} source */
export function getNodeDefaultImportName(source) {
  const known = KNOWN_NODE_DEFAULT_NAMES[source];
  if (known !== undefined) {
    return known;
  }

  return source.slice('node:'.length).split('/')[0];
}

/** @param {import('estree').Literal} sourceNode */
export function getImportQuote(sourceNode) {
  if (typeof sourceNode.raw === 'string' && sourceNode.raw.startsWith('"')) {
    return '"';
  }

  return '\'';
}

/** @param {import('estree').ImportSpecifier} specifier */
export function getImportedBindingName(specifier) {
  if (specifier.imported.type === 'Identifier') {
    return specifier.imported.name;
  }

  return specifier.imported.value;
}
