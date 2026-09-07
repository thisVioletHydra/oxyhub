export function single() {
  const value = 1;
  return value;
}

export function early(flag: boolean) {
  if (flag) {
    return 1;
  }

  return 0;
}
