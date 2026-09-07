export function twoIfs(kind: string, flag: boolean) {
  if (kind === 'block') {
    return 1;
  }
  if (kind === 'case') {
    return 2;
  }

  return flag ? 3 : 0;
}

export function afterIf(flag: boolean) {
  const enabled = flag;
  if (enabled === false) {
    return 'skip';
  }
  const label = 'main';
  return label;
}

export function afterFor(items: string[]) {
  for (const item of items) {
    void item;
  }
  const total = items.length;
  void total;
}
