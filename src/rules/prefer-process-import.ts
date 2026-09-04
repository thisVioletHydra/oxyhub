/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require `import process from "node:process"` instead of the global.',
    },
    fixable: 'code',
    messages: {
      preferImport: 'Import process from node:process instead of using the global.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    let hasProcessImport = false;
    let reported = false;

    function usesProcessImport(node) {
      return (
        node.type === 'ImportDeclaration'
        && node.source.value === 'node:process'
        && node.specifiers.some(
          (specifier) =>
            specifier.type === 'ImportDefaultSpecifier'
            && specifier.local.name === 'process',
        )
      );
    }

    function isGlobalProcess(node) {
      if (node.name !== 'process') {
        return false;
      }

      const parent = node.parent;

      if (
        parent?.type === 'MemberExpression'
        && parent.object === node
        && parent.computed === false
      ) {
        // process.exit, process.env, …
      }
      else if (parent?.type === 'CallExpression' && parent.callee === node) {
        // process()
      }
      else {
        return false;
      }

      const scope = sourceCode.getScope(node);
      const variable = scope.set.get('process');

      if (!variable) {
        return true;
      }

      return !variable.defs.some((def) => def.type === 'ImportBinding' || def.type === 'Variable');
    }

    function buildImportFix(fixer) {
      const text = 'import process from \'node:process\';\n\n';
      const firstImport = sourceCode.ast.body.find(
        (node) => node.type === 'ImportDeclaration',
      );

      if (firstImport) {
        return fixer.insertTextBefore(firstImport, text);
      }

      const insertAt = typeof sourceCode.getIndexAfterComments === 'function'
        ? sourceCode.getIndexAfterComments()
        : 0;
      return fixer.insertTextBeforeRange([insertAt, insertAt], text);
    }

    return {
      ImportDeclaration(node) {
        if (usesProcessImport(node)) {
          hasProcessImport = true;
        }
      },

      Identifier(node) {
        if (hasProcessImport || reported || !isGlobalProcess(node)) {
          return;
        }

        reported = true;
        context.report({
          node,
          messageId: 'preferImport',
          fix: buildImportFix,
        });
      },
    };
  },
};
