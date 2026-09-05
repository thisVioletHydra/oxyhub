import type { LintNode, RuleFixer, RuleModule, SourceCode } from '#plugin-types';

import {
  getImportGroup,
  getTopImportBlock,
  ImportGroup,
} from '#utils/import-groups';
import {
  getImportQuote,
  getImportedBindingName,
  getNodeDefaultImportName,
} from '#utils/node-default-import-name';
import {
  getScopeVariable,
  hasNamedValueImport,
  isNodeValueImport,
} from '#utils/node-imports';

const GROUP_ORDER = [
  ImportGroup.TYPE,
  ImportGroup.NAMED,
  ImportGroup.DEFAULT,
  ImportGroup.SIDE_EFFECT,
];

type NamedValueImport = {
  importNode: import('estree').ImportDeclaration;
  specifier: import('estree').ImportSpecifier;
};

function collectImportParts(importNodes: import('estree').ImportDeclaration[]) {
  let defaultSpecifier: import('estree').ImportDefaultSpecifier | null = null;
  const typeSpecifiers: import('estree').ImportSpecifier[] = [];
  const namedValueImports: NamedValueImport[] = [];

  for (const importNode of importNodes) {
    for (const specifier of importNode.specifiers) {
      if (specifier.type === 'ImportDefaultSpecifier') {
        defaultSpecifier = specifier;
      }
      else if (specifier.type === 'ImportSpecifier') {
        if ((specifier as LintNode).importKind === 'type') {
          typeSpecifiers.push(
            specifier
          );
        }
        else {
          namedValueImports.push(
            {
              importNode,
              specifier
            }
          );
        }
      }
    }
  }

  return {
    defaultSpecifier,
    typeSpecifiers,
    namedValueImports,
  };
}

function renderTypeImport(
  source: string,
  typeSpecifiers: import('estree').ImportSpecifier[],
  quote: string
) {
  const names = typeSpecifiers.map(
    (specifier) => {
      const imported = getImportedBindingName(
        specifier
      );
      if (specifier.local.name === imported) {
        return imported;
      }

      return `${imported} as ${specifier.local.name}`;
    }
  );

  return `import type { ${names.join(
    ', '
  )} } from ${quote}${source}${quote};`;
}

function getImportGroupFromText(text: string) {
  if (/^import\s+type\s/u.test(
    text
  )) {
    return ImportGroup.TYPE;
  }

  if (/^import\s*\{/u.test(
    text
  )) {
    return ImportGroup.NAMED;
  }

  if (/^import\s+['"]/u.test(
    text
  )) {
    return ImportGroup.SIDE_EFFECT;
  }

  return ImportGroup.DEFAULT;
}

function renderImportBlock(importLines: string[]) {
  const chunks: string[] = [];

  for (const group of GROUP_ORDER) {
    const groupLines = importLines.filter(
      (line) => getImportGroupFromText(
        line
      ) === group
    );
    if (groupLines.length === 0) {
      continue;
    }

    chunks.push(
      groupLines.join(
        '\n'
      )
    );
  }

  return chunks.join(
    '\n\n'
  );
}

function buildFixes(
  sourceCode: SourceCode,
  fixer: RuleFixer,
  program: import('estree').Program
) {
  const block = getTopImportBlock(
    program
  );
  if (!block || block.imports.length === 0) {
    return null;
  }

  const fixes: Array<ReturnType<RuleFixer['replaceText']>> = [];
  const nodeImportsBySource = new Map<string, import('estree').ImportDeclaration[]>();
  const retainedImports: import('estree').ImportDeclaration[] = [];

  for (const importNode of block.imports) {
    if (isNodeValueImport(
      importNode
    ) && hasNamedValueImport(
      importNode
    )) {
      const source = importNode.source.value as string;
      const bucket = nodeImportsBySource.get(
        source
      ) ?? [];
      bucket.push(
        importNode
      );
      nodeImportsBySource.set(
        source,
        bucket
      );
      continue;
    }

    retainedImports.push(
      importNode
    );
  }

  const scopeNode = block.imports[0];
  const moduleScope = sourceCode.getScope(
    scopeNode
  );
  const importLines: string[] = retainedImports.map(
    (importNode) => sourceCode.getText(
      importNode
    )
  );

  for (const [
    source,
    importNodes
  ] of nodeImportsBySource) {
    const defaultName = getNodeDefaultImportName(
      source
    );
    const quote = getImportQuote(
      importNodes[0].source
    );
    const {
      defaultSpecifier,
      typeSpecifiers,
      namedValueImports,
    } = collectImportParts(
      importNodes
    );

    for (const {
      specifier
    } of namedValueImports) {
      const localName = specifier.local.name;
      const memberName = getImportedBindingName(
        specifier
      );
      const variable = getScopeVariable(
        moduleScope,
        localName
      );

      if (variable === null || variable === undefined) {
        continue;
      }

      for (const reference of variable.references) {
        fixes.push(
          fixer.replaceText(
            reference.identifier as import('estree').Identifier,
            `${defaultName}.${memberName}`
          ),
        );
      }
    }

    if (defaultSpecifier && defaultSpecifier.local.name !== defaultName) {
      const variable = getScopeVariable(
        moduleScope,
        defaultSpecifier.local.name
      );

      if (variable) {
        for (const reference of variable.references) {
          if (reference.identifier === defaultSpecifier.local) {
            continue;
          }

          fixes.push(
            fixer.replaceText(
              reference.identifier as import('estree').Identifier,
              defaultName
            ),
          );
        }
      }
    }

    if (typeSpecifiers.length > 0) {
      importLines.push(
        renderTypeImport(
          source,
          typeSpecifiers,
          quote
        )
      );
    }

    importLines.push(
      `import ${defaultName} from ${quote}${source}${quote};`
    );
  }

  fixes.push(
    fixer.replaceTextRange(
      [
        block.imports[0].range![0],
        block.imports.at(
          -1
        )!.range![1]
      ],
      renderImportBlock(
        importLines
      ),
    ),
  );

  return fixes;
}

const rule: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow named value imports from node: built-ins.',
    },
    fixable: 'code',
    messages: {
      noNamedNodeImport:
        'Use a default import for node: modules (e.g. `import fs from "node:fs"`), not destructuring.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    let fixed = false;

    return {
      ImportDeclaration(node) {
        if (!isNodeValueImport(
          node
        ) || !hasNamedValueImport(
          node
        )) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.type !== 'ImportSpecifier'
            || (specifier as LintNode).importKind === 'type'
          ) {
            continue;
          }

          context.report(
            {
              node: specifier,
              messageId: 'noNamedNodeImport',
              fix(fixer: RuleFixer) {
                if (fixed) {
                  return null;
                }

                fixed = true;
                return buildFixes(
                  sourceCode,
                  fixer,
                  sourceCode.ast
                );
              },
            }
          );
        }
      },
    };
  },
};

export default rule;
