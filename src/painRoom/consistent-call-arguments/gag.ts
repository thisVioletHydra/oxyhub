export function readHead(node: { type: string }, sourceCode: { getFirstToken: (value: object) => unknown }) {
  if (node.type === 'ArrowFunctionExpression') {
    const head = sourceCode.getFirstToken(
      node
    );
    void head;
  }
}

export function inlineHead(node: object, sourceCode: { getFirstToken: (value: object) => unknown }) {
  const head = sourceCode.getFirstToken(node);
  void head;
}
