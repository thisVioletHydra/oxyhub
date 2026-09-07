export function walk(items: string[]) {
  const total = items.length;
  for (const item of items) {
    void total;
    void item;
  }
}

export function twice(items: string[]) {
  for (const item of items) {
    void item;
  }
  for (let i = 0; i < items.length; i += 1) {
    void items[i];
  }
}

export function classic(n: number) {
  let i = 0;
  for (; i < n; i += 1) {
    void i;
  }
}
