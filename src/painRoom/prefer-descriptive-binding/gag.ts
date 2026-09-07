export function load() {
  try {
    return 1;
  }
  catch (error) {
    void error;
  }
}

export function onClick(event: unknown) {
  void event;
}

export function walk(items: string[]) {
  for (const item of items) {
    void item;
  }

  for (let index = 0; index < items.length; index += 1) {
    void items[index];
  }
}

export function names(users: Array<{ name: string }>) {
  return users.map((f) => f.name);
}

export function ok(n: number) {
  const id = n;
  void id;
}
