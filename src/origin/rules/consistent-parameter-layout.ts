import type { FunctionNode, LintNode, RuleFixer, RuleModule, Token } from '#plugin-types';

import {
  getCoveredEndToken,
  getFunctionParameterParens,
  getLineIndent,
  getParameterStartToken,
  isParameterNode,
  isTokenOnSameLine,
} from '#utils/function-params';

const rule: RuleModule = {
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

    function reportCollapse(
      node: FunctionNode,
      leftParen: Token,
      rightParen: Token,
      messageId: string
    ) {
      const inner = sourceCode.text.slice(
        leftParen.range[1],
        rightParen.range[0]
      );
      const collapsed = `(${inner.replace(
        /\s+/g,
        ' '
      ).trim()})`;

      context.report(
        {
          node,
          messageId,
          fix(fixer: RuleFixer) {
            return fixer.replaceTextRange(
              [
                leftParen.range[0],
                rightParen.range[1]
              ],
              collapsed
            );
          },
        }
      );
    }

    function normalizeGap(
      node: LintNode,
      rangeStart: number,
      rangeEnd: number,
      expectedText: string
    ) {
      const actualText = sourceCode.text.slice(
        rangeStart,
        rangeEnd
      );
      if (actualText === expectedText) {
        return;
      }
      if (/[^\s]/.test(
        actualText
      )) {
        return;
      }

      context.report(
        {
          node,
          messageId: 'normalizeParameterSpacing',
          fix(fixer: RuleFixer) {
            return fixer.replaceTextRange(
              [
                rangeStart,
                rangeEnd
              ],
              expectedText
            );
          },
        }
      );
    }

    function normalizeMultilineParameters(
      node: FunctionNode,
      leftParen: Token,
      rightParen: Token
    ) {
      const baseIndent = getLineIndent(
        sourceCode,
        leftParen.loc.start.line
      );
      const parameterIndent = `${baseIndent}  `;

      for (let index = 0; index < node.params.length; index += 1) {
        const parameter = node.params[index];
        const parameterToken = getParameterStartToken(
          sourceCode,
          parameter
        );
        if (parameterToken === null || parameterToken === undefined) {
          continue;
        }

        if (index === 0) {
          normalizeGap(
            parameter,
            leftParen.range[1],
            parameterToken.range[0],
            `\n${parameterIndent}`
          );
          continue;
        }

        const previousEnd = getCoveredEndToken(
          sourceCode,
          node.params[index - 1]
        );
        const commaToken = previousEnd
          ? sourceCode.getTokenAfter(
            previousEnd,
            (token: Token) => token.value === ',',
          )
          : null;
        if (commaToken === null || commaToken === undefined) {
          continue;
        }

        normalizeGap(
          parameter,
          commaToken.range[1],
          parameterToken.range[0],
          `\n${parameterIndent}`
        );
      }

      const lastParameter = node.params.at(
        -1
      );
      if (lastParameter === null || lastParameter === undefined) {
        return;
      }

      const lastToken = getCoveredEndToken(
        sourceCode,
        lastParameter
      );
      if (lastToken === null || lastToken === undefined) {
        return;
      }

      normalizeGap(
        lastParameter,
        lastToken.range[1],
        rightParen.range[0],
        `\n${baseIndent}`
      );
    }

    function normalizeInlineParameterSpacing(
      node: FunctionNode,
      leftParen: Token,
      rightParen: Token,
      parameter: LintNode
    ) {
      const parameterStart = getParameterStartToken(
        sourceCode,
        parameter
      );
      const parameterEnd = sourceCode.getLastToken(
        parameter
      );
      if (!parameterStart || !parameterEnd) {
        return;
      }

      const inner = sourceCode.text.slice(
        leftParen.range[1],
        rightParen.range[0]
      );
      if (/\n/.test(
        inner
      )) {
        return;
      }

      const parameterText = sourceCode.text
        .slice(
          parameterStart.range[0],
          parameterEnd.range[1]
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim();
      const expected = `(${parameterText})`;
      const actual = sourceCode.text.slice(
        leftParen.range[0],
        rightParen.range[1]
      );
      if (actual === expected) {
        return;
      }

      context.report(
        {
          node,
          messageId: 'normalizeParameterSpacing',
          fix(fixer: RuleFixer) {
            return fixer.replaceTextRange(
              [
                leftParen.range[0],
                rightParen.range[1]
              ],
              expected,
          );
          },
        }
      );
    }

    function checkParameters(node: FunctionNode) {
      if (node.params.length === 0) {
        return;
      }

      const parens = getFunctionParameterParens(
        sourceCode,
        node
      );
      if (parens === null || parens === undefined) {
        return;
      }

      const {
        leftParen,
        rightParen
      } = parens;
      const firstParameter = node.params[0];
      const firstParameterToken = getParameterStartToken(
        sourceCode,
        firstParameter
      );
      if (firstParameterToken === null || firstParameterToken === undefined) {
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
          normalizeMultilineParameters(
            node,
            leftParen,
            rightParen
          );
          return;
        }

        const parameterOnOneLine = parameter.loc!.start.line === parameter.loc!.end.line;
        const lastParameterToken = sourceCode.getLastToken(
          parameter
        );
        const closingParenOnSameLine = isTokenOnSameLine(
          sourceCode,
          lastParameterToken as Token,
          rightParen,
        );

        if (!parameterOnOneLine || !closingParenOnSameLine) {
          reportCollapse(
            node,
            leftParen,
            rightParen,
            'collapseSingleParameter'
          );
          return;
        }

        normalizeInlineParameterSpacing(
          node,
          leftParen,
          rightParen,
          parameter
        );
        return;
      }

      const parametersAreMultiline = node.params.some(
        (
          parameter,
          index
        ) => {
          if (index === 0) {
            return multilineIntent;
          }

          const previousParameter = node.params[index - 1];
          const previousEnd = getCoveredEndToken(
            sourceCode,
            previousParameter
          );
          const nextStart = getParameterStartToken(
            sourceCode,
            parameter
          );
          if (previousEnd === null || previousEnd === undefined || nextStart === null || nextStart === undefined) {
            return false;
          }
          return !isTokenOnSameLine(
            sourceCode,
            previousEnd,
            nextStart
          );
        }
      );

      if (parametersAreMultiline === false) {
        const hasInternalLineBreak = node.params.some(
          (parameter) => parameter.loc!.start.line !== parameter.loc!.end.line,
        );
        if (hasInternalLineBreak) {
          reportCollapse(
            node,
            leftParen,
            rightParen,
            'collapseMultipleParameters'
          );
        }
        return;
      }

      normalizeMultilineParameters(
        node,
        leftParen,
        rightParen
      );
    }

    return {
      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(
        node: FunctionNode
      ) {
        if (!node.params.every(
          (parameter: LintNode) => isParameterNode(
            parameter
          )
        )) {

          return
        }

        checkParameters(
          node
        );
      },
    };
  },
};

export default rule;
