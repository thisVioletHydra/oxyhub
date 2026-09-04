import {
  getFunctionParameterParens,
  getLineIndent,
  getParameterStartToken,
  isParameterNode,
  isTokenOnSameLine,
} from '../utils/function-params';

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Preserve multiline parameter layout only when a parameter starts on its own line after `(`.',
    },
    fixable: 'whitespace',
    messages: {
      collapseSingleParameter:
        'Split parameter must be collapsed because it is still a single parameter.',
      expandMultipleParameters:
        'Multiline parameter list must place each parameter on its own line.',
      collapseMultipleParameters:
        'Multiple parameters should stay on one line when the list is not multiline.',
      normalizeParameterSpacing:
        'Remove extra blank lines inside the parameter list.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function reportCollapse(node, leftParen, rightParen, messageId) {
      const parameter = node.params[0] ?? node.params.at(-1);
      const parameterStart = getParameterStartToken(sourceCode, parameter);
      const parameterEnd = sourceCode.getLastToken(parameter);
      if (!parameterStart || !parameterEnd) {
        return;
      }

      const parameterText = sourceCode.text.slice(
        parameterStart.range[0],
        parameterEnd.range[1],
      );

      context.report({
        node,
        messageId,
        fix(fixer) {
          return fixer.replaceTextRange(
            [leftParen.range[0], rightParen.range[1]],
            `(${parameterText.replace(/\s+/g, ' ').trim()})`,
          );
        },
      });
    }

    function normalizeGap(node, rangeStart, rangeEnd, expectedText, messageId) {
      const actualText = sourceCode.text.slice(rangeStart, rangeEnd);
      if (actualText === expectedText) {
        return;
      }

      context.report({
        node,
        messageId,
        fix(fixer) {
          return fixer.replaceTextRange([rangeStart, rangeEnd], expectedText);
        },
      });
    }

    function normalizeClosingParen(leftParen, rightParen, lastParameter) {
      const baseIndent = getLineIndent(sourceCode, leftParen.loc.start.line);
      const lastParameterToken = sourceCode.getLastToken(lastParameter);
      if (!lastParameterToken) {
        return;
      }

      normalizeGap(
        lastParameter,
        lastParameterToken.range[1],
        rightParen.range[0],
        `\n${baseIndent}`,
        'normalizeParameterSpacing',
      );
    }

    function normalizeInlineParameterSpacing(node, leftParen, rightParen, parameter) {
      const parameterStart = getParameterStartToken(sourceCode, parameter);
      const parameterEnd = sourceCode.getLastToken(parameter);
      if (!parameterStart || !parameterEnd) {
        return;
      }

      const inner = sourceCode.text.slice(leftParen.range[1], rightParen.range[0]);
      if (/\n/.test(inner)) {
        return;
      }

      const parameterText = sourceCode.text
        .slice(parameterStart.range[0], parameterEnd.range[1])
        .replace(/\s+/g, ' ')
        .trim();
      const expected = `(${parameterText})`;
      const actual = sourceCode.text.slice(leftParen.range[0], rightParen.range[1]);
      if (actual === expected) {
        return;
      }

      context.report({
        node,
        messageId: 'normalizeParameterSpacing',
        fix(fixer) {
          return fixer.replaceTextRange(
            [leftParen.range[0], rightParen.range[1]],
            expected,
          );
        },
      });
    }

    function normalizeMultilineSpacing(node, leftParen, rightParen) {
      const baseIndent = getLineIndent(sourceCode, leftParen.loc.start.line);
      const parameterIndent = `${baseIndent}  `;

      for (let index = 0; index < node.params.length; index += 1) {
        const parameter = node.params[index];
        const parameterToken = getParameterStartToken(sourceCode, parameter);
        if (!parameterToken) {
          continue;
        }

        if (index === 0) {
          normalizeGap(
            parameter,
            leftParen.range[1],
            parameterToken.range[0],
            `\n${parameterIndent}`,
            'normalizeParameterSpacing',
          );
          continue;
        }

        const previousParameter = node.params[index - 1];
        const commaToken = sourceCode.getTokenAfter(previousParameter);
        if (!commaToken || commaToken.value !== ',') {
          continue;
        }

        normalizeGap(
          parameter,
          commaToken.range[1],
          parameterToken.range[0],
          `\n${parameterIndent}`,
          'normalizeParameterSpacing',
        );
      }
    }

    function checkParameters(node) {
      if (node.params.length === 0) {
        return;
      }

      const parens = getFunctionParameterParens(sourceCode, node);
      if (!parens) {
        return;
      }

      const { leftParen, rightParen } = parens;
      const firstParameter = node.params[0];
      const firstParameterToken = getParameterStartToken(sourceCode, firstParameter);
      if (!firstParameterToken) {
        return;
      }

      const multilineIntent = !isTokenOnSameLine(
        sourceCode,
        leftParen,
        firstParameterToken,
      );

      if (node.params.length === 1) {
        const parameter = node.params[0];

        if (multilineIntent) {
          normalizeMultilineSpacing(node, leftParen, rightParen);
          normalizeClosingParen(leftParen, rightParen, parameter);
          return;
        }

        const parameterOnOneLine = parameter.loc.start.line === parameter.loc.end.line;
        const lastParameterToken = sourceCode.getLastToken(parameter);
        const closingParenOnSameLine = isTokenOnSameLine(
          sourceCode,
          lastParameterToken,
          rightParen,
        );

        if (!parameterOnOneLine || !closingParenOnSameLine) {
          reportCollapse(parameter, leftParen, rightParen, 'collapseSingleParameter');
          return;
        }

        normalizeInlineParameterSpacing(node, leftParen, rightParen, parameter);
        return;
      }

      const parametersAreMultiline = node.params.some((parameter, index) => {
        if (index === 0) {
          return multilineIntent;
        }

        const previousParameter = node.params[index - 1];
        return !isTokenOnSameLine(
          sourceCode,
          sourceCode.getLastToken(previousParameter),
          getParameterStartToken(sourceCode, parameter),
        );
      });

      if (!parametersAreMultiline) {
        const hasInternalLineBreak = node.params.some(
          (parameter) => parameter.loc.start.line !== parameter.loc.end.line,
        );
        if (hasInternalLineBreak) {
          reportCollapse(firstParameter, leftParen, rightParen, 'collapseMultipleParameters');
        }
        return;
      }

      for (const parameter of node.params) {
        if (parameter.loc.start.line !== parameter.loc.end.line) {
          reportCollapse(parameter, leftParen, rightParen, 'collapseMultipleParameters');
        }
      }

      for (let index = 1; index < node.params.length; index += 1) {
        const previousParameter = node.params[index - 1];
        const parameter = node.params[index];
        if (
          isTokenOnSameLine(
            sourceCode,
            sourceCode.getLastToken(previousParameter),
            getParameterStartToken(sourceCode, parameter),
          )
        ) {
          context.report({
            node: parameter,
            messageId: 'expandMultipleParameters',
            fix(fixer) {
              const baseIndent = getLineIndent(sourceCode, leftParen.loc.start.line);
              return fixer.insertTextBefore(
                getParameterStartToken(sourceCode, parameter),
                `\n${baseIndent}  `,
              );
            },
          });
        }
      }

      normalizeMultilineSpacing(node, leftParen, rightParen);
      normalizeClosingParen(leftParen, rightParen, node.params.at(-1));
    }

    return {
      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(
        node,
      ) {
        if (!node.params.every((parameter) => isParameterNode(parameter))) {
          return;
        }

        checkParameters(node);
      },
    };
  },
};
