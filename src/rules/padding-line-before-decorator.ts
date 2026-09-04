/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'layout',
    docs: {
      description: 'Require a blank line before a decorator when it is not stacked on another decorator.',
    },
    fixable: 'whitespace',
    messages: {
      missingBlankLine: 'Expected blank line before this decorator.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function isParameterDecorator(node) {
      const parent = node.parent;
      if (!parent) {
        return false;
      }

      if (parent.type === 'TSParameterProperty') {
        return true;
      }

      const parameterParent = parent.parent;
      if (
        parameterParent?.type === 'FunctionExpression'
        || parameterParent?.type === 'FunctionDeclaration'
        || parameterParent?.type === 'ArrowFunctionExpression'
        || parameterParent?.type === 'TSDeclareFunction'
        || parameterParent?.type === 'TSEmptyBodyFunctionExpression'
      ) {
        return true;
      }

      return false;
    }

    function allowsDecoratorWithoutBlankLine(previousLine) {
      const trimmedPreviousLine = previousLine.trim();

      if (trimmedPreviousLine === '') {
        return true;
      }

      if (trimmedPreviousLine.startsWith('@')) {
        return true;
      }

      // constructor(, method(, class { — valid context before a nested decorator
      if (trimmedPreviousLine.endsWith('(') || trimmedPreviousLine.endsWith('{')) {
        return true;
      }

      return false;
    }

    return {
      Decorator(node) {
        const decorators = node.parent?.decorators;
        if (!decorators || decorators[0] !== node) {
          return;
        }

        if (isParameterDecorator(node)) {
          return;
        }

        const decoratorLine = node.loc.start.line;
        if (decoratorLine <= 1) {
          return;
        }

        const previousLine = sourceCode.lines[decoratorLine - 2] ?? '';
        if (allowsDecoratorWithoutBlankLine(previousLine)) {
          return;
        }

        context.report({
          node,
          messageId: 'missingBlankLine',
          fix(fixer) {
            const previousLineIndex = decoratorLine - 2;
            const previousLineStart = sourceCode.getIndexFromLoc({
              line: previousLineIndex + 1,
              column: 0,
            });
            const previousLineEnd = previousLineStart + previousLine.length;

            return fixer.insertTextAfterRange(
              [previousLineStart, previousLineEnd],
              '\n',
            );
          },
        });
      },
    };
  },
};
