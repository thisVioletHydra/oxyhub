export function packed(flag: boolean) {
  const left = 1;
  const right = 2;
  void left;
  void right;
  if (flag) {
    return left;
  }

  return right;
}

export function varsThenIf(flag: boolean) {
  const left = 1;
  const right = 2;
  if (flag) {
    return left + right;
  }

  return left;
}

export function leading(items: string[]) {
  for (const item of items) {
    void item;
  }
}

export function nested(flag: boolean, items: string[]) {
  if (flag) {
    for (const item of items) {
      void item;
    }
  }
}

export function lastIf(flag: boolean) {
  const enabled = flag;
  if (enabled) {
    return enabled;
  }
}
