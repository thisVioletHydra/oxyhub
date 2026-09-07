export function run(flag: boolean) {
  if (flag === true) {
    function foo(
      node
    ) {}
    void foo;
  }
}

export function inline(node: string) {
  void node;
}
