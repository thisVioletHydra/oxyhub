import { getScopeVariable } from '../utils/node-imports';

const FS_MODULE = 'node:fs';
const FS_BINDING = 'fs';

/** @param {import('estree').ImportDeclaration} node */
function isFsDefaultImport(node) {
  return (
    node.source.value === FS_MODULE
    && node.specifiers.some(
      (specifier) =>
        specifier.type === 'ImportDefaultSpecifier'
        && specifier.local.name === FS_BINDING,
    )
  );
}

/** @param {import('estree').MemberExpression} node */
function getSyncMethodName(node) {
  if (node.computed || node.property.type !== 'Identifier') {
    return null;
  }

  const methodName = node.property.name;
  if (!methodName.endsWith('Sync')) {
    return null;
  }

  return methodName;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
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

    function isFsBinding(node) {
      if (!hasFsImport || node.type !== 'Identifier' || node.name !== FS_BINDING) {
        return false;
      }

      let scope = sourceCode.getScope(node);

      while (scope) {
        const variable = getScopeVariable(scope, FS_BINDING);

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
        if (isFsDefaultImport(node)) {
          hasFsImport = true;
        }
      },

      MemberExpression(node) {
        if (!isFsBinding(node.object)) {
          return;
        }

        const methodName = getSyncMethodName(node);
        if (methodName === null) {
          return;
        }

        context.report({
          node: node.property,
          messageId: 'preferFsPromises',
          data: { method: methodName },
        });
      },
    };
  },
};
