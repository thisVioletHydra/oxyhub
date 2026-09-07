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

export function spaced(items: string[]) {
  const total = items.length;

  for (const item of items) {
    void total;
    void item;
  }
}
