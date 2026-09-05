import type { ImportSpecifier, Literal } from '#plugin-types';

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

  return source.slice(
    'node:'.length
  ).split(
    '/'
  )[0];
}

export function getImportQuote(sourceNode: Literal) {
  if (typeof sourceNode.raw === 'string' && sourceNode.raw.startsWith(
    '"'
  )) {
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
