import type { FunctionNode, LintNode, RuleContext, Token } from '#plugin-types';

import {
  getCoveredEndToken,
  getFunctionParameterParens,
  getParameterStartToken,
  isParameterNode,
  isTokenOnSameLine,
} from '#layout/tokens';

import { createParameterFixes } from './fix.ts';

export function createParameterLayout(context: RuleContext) {
  const sourceCode = context.sourceCode;
  const {
    reportCollapse,
    normalizeMultilineParameters,
    normalizeInlineParameterSpacing,
  } = createParameterFixes(
    context
  );

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
}
