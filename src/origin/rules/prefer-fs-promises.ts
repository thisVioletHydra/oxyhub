import type { LintNode, RuleModule } from '#plugin-types';

import { getScopeVariable } from '#utils/node-imports';

const FS_MODULE = 'node:fs';
const FS_BINDING = 'fs';

function isFsDefaultImport(node: import('estree').ImportDeclaration) {
  return (
    node.source.value === FS_MODULE
    && node.specifiers.some(
      (specifier) =>
        specifier.type === 'ImportDefaultSpecifier'
        && specifier.local.name === FS_BINDING,
    )
  );
}

function getSyncMethodName(node: import('estree').MemberExpression) {
  if (node.computed || node.property.type !== 'Identifier') {
    return null;
  }

  const methodName = node.property.name;
  if (!methodName.endsWith(
    'Sync'
  )) {
    return null;
  }

  return methodName;
}

const rule: RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer fsPromises over blocking fs sync methods.',
    },
    messages: {
      preferFsPromises: 'Use fsPromises instead of blocking fs sync.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    let hasFsImport = false;

    function isFsBinding(node: LintNode) {
      if (!hasFsImport || node.type !== 'Identifier' || node.name !== FS_BINDING) {
        return false;
      }

      let scope: ReturnType<typeof sourceCode.getScope> | null = sourceCode.getScope(
        node
      );

      while (scope) {
        const variable = getScopeVariable(
          scope,
          FS_BINDING
        );

        if (
          variable?.defs.some(
            (definition) =>
              definition.type === 'ImportBinding'
              && definition.parent.type === 'ImportDeclaration'
              && definition.parent.source.value === FS_MODULE,
          )
        ) {
          return true;
        }

        scope = scope.upper;
      }

      return false;
    }

    return {
      ImportDeclaration(node) {
        if (isFsDefaultImport(
          node
        )) {
          hasFsImport = true;
        }
      },
      MemberExpression(node) {
        if (!isFsBinding(
          node.object
        )) {
          return;
        }

        const methodName = getSyncMethodName(
          node
        );
        if (methodName === null) {
          return;
        }

        context.report(
          {
            node: node.property,
            messageId: 'preferFsPromises',
            data: {
              method: methodName
            },
          }
        );
      },
    };
  },
};

export default rule;
