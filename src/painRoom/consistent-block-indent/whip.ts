export function readHead(node: { type: string }, sourceCode: { getFirstToken: (value: object) => unknown }) {
  if (node.type === 'ArrowFunctionExpression') {
    const head = sourceCode.getFirstToken(
      node
    );
    void head;
  }
}
