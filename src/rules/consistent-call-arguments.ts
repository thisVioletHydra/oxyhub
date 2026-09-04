import {
  getLineIndent,
  isOpeningParenToken,
  isClosingParenToken,
  isTokenOnSameLine,
} from '../utils/function-params';

/**
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').CallExpression} node
 */
function getCallParens(sourceCode, node) {
  const calleeEnd = sourceCode.getLastToken(node.callee);
  if (!calleeEnd) {
    return null;
  }

  let leftParen = sourceCode.getTokenAfter(calleeEnd, isOpeningParenToken);
  if (!leftParen && node.typeArguments) {
    const typeEnd = sourceCode.getLastToken(node.typeArguments);
    leftParen = typeEnd
      ? sourceCode.getTokenAfter(typeEnd, isOpeningParenToken)
      : null;
  }

  if (!leftParen) {
    let token = sourceCode.getTokenAfter(calleeEnd);
    while (token && token.value !== '(' && token.range[0] < node.range[1]) {
      token = sourceCode.getTokenAfter(token);
    }
    leftParen = token?.value === '(' ? token : null;
  }

  const rightParen = sourceCode.getLastToken(node, isClosingParenToken);
  if (!leftParen || !rightParen) {
    return null;
  }

  return { leftParen, rightParen };
}

/** @param {import('estree').Node} node */
function isSingleLineExpression(node) {
  if (node.loc.start.line !== node.loc.end.line) {
    return false;
  }

  if (node.type === 'ArrowFunctionExpression' && node.body.type === 'BlockStatement') {
    return false;
  }

  if (node.type === 'ObjectExpression' || node.type === 'ArrayExpression') {
    return node.loc.start.line === node.loc.end.line;
  }

  return true;
}

/**
 * Multiline call layout starts only when the first argument begins on its own line
 * after `(`, or when later args / `)` follow column layout — not when a single
 * argument merely contains a multiline arrow body.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').CallExpression} node
 * @param {import('eslint').AST.Token} leftParen
 * @param {import('eslint').AST.Token} rightParen
 */
function hasMultilineIntent(sourceCode, node, leftParen) {
  const firstArg = node.arguments[0];
  const firstArgToken = sourceCode.getFirstToken(firstArg);
  if (!firstArgToken) {
    return false;
  }

  // Only the first argument starting on its own line after `(` counts as
  // column intent. A single multiline callback (`.map((item) => …)`) with
  // `)` on the next line is normal — do not expand that into a column call.
  if (!isTokenOnSameLine(sourceCode, leftParen, firstArgToken)) {
    return true;
  }

  for (let index = 1; index < node.arguments.length; index += 1) {
    const previous = node.arguments[index - 1];
    const commaToken = sourceCode.getTokenAfter(
      previous,
      (token) => token.value === ',',
    );
    const argumentToken = sourceCode.getFirstToken(node.arguments[index]);
    if (
      commaToken
      && argumentToken
      && !isTokenOnSameLine(sourceCode, commaToken, argumentToken)
    ) {
      return true;
    }
  }

  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Keep call arguments inline, or multiline when the first arg starts after `(` on its own line.',
    },
    fixable: 'whitespace',
    messages: {
      collapseArguments: 'Call arguments should stay on one line.',
      expandArguments: 'Multiline call must place each argument on its own line.',
      normalizeArgumentSpacing: 'Normalize spacing inside this argument list.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function normalizeGap(node, rangeStart, rangeEnd, expectedText, messageId) {
      const actualText = sourceCode.text.slice(rangeStart, rangeEnd);
      if (actualText === expectedText) {
        return;
      }

      if (/[^\s]/.test(actualText)) {
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

    function collapseInlineCall(node, leftParen, rightParen) {
      if (!node.arguments.every((argument) => isSingleLineExpression(argument))) {
        return;
      }

      const innerStart = leftParen.range[1];
      const innerEnd = rightParen.range[0];
      const inner = sourceCode.text.slice(innerStart, innerEnd);
      if (!/\n/.test(inner)) {
        return;
      }

      const collapsed = inner.replace(/\s+/g, ' ').trim();
      const actual = sourceCode.text.slice(innerStart, innerEnd);
      if (actual === collapsed) {
        return;
      }

      context.report({
        node,
        messageId: 'collapseArguments',
        fix(fixer) {
          return fixer.replaceTextRange(
            [leftParen.range[0], rightParen.range[1]],
            `(${collapsed})`,
          );
        },
      });
    }

    function checkCall(node) {
      if (node.arguments.length === 0) {
        return;
      }

      const parens = getCallParens(sourceCode, node);
      if (!parens) {
        return;
      }

      const { leftParen, rightParen } = parens;
      const multilineIntent = hasMultilineIntent(sourceCode, node, leftParen);

      if (!multilineIntent) {
        collapseInlineCall(node, leftParen, rightParen);
        return;
      }

      const baseIndent = getLineIndent(sourceCode, leftParen.loc.start.line);
      const argIndent = `${baseIndent}  `;

      for (let index = 0; index < node.arguments.length; index += 1) {
        const argument = node.arguments[index];
        const argumentToken = sourceCode.getFirstToken(argument);
        if (!argumentToken) {
          continue;
        }

        if (index === 0) {
          normalizeGap(
            argument,
            leftParen.range[1],
            argumentToken.range[0],
            `\n${argIndent}`,
            'normalizeArgumentSpacing',
          );
          continue;
        }

        const previous = node.arguments[index - 1];
        const commaToken = sourceCode.getTokenAfter(
          previous,
          (token) => token.value === ',',
        );
        if (!commaToken) {
          continue;
        }

        if (isTokenOnSameLine(sourceCode, commaToken, argumentToken)) {
          context.report({
            node: argument,
            messageId: 'expandArguments',
            fix(fixer) {
              return fixer.insertTextBefore(argumentToken, `\n${argIndent}`);
            },
          });
          continue;
        }

        normalizeGap(
          argument,
          commaToken.range[1],
          argumentToken.range[0],
          `\n${argIndent}`,
          'normalizeArgumentSpacing',
        );
      }

      const lastArgument = node.arguments.at(-1);
      const lastToken = sourceCode.getLastToken(lastArgument);
      if (!lastToken) {
        return;
      }

      normalizeGap(
        lastArgument,
        lastToken.range[1],
        rightParen.range[0],
        `\n${baseIndent}`,
        'normalizeArgumentSpacing',
      );
    }

    return {
      CallExpression: checkCall,
    };
  },
};
