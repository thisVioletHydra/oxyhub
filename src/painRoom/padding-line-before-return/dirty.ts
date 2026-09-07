export function many(flag: boolean) {
  if (flag) {
    return 1;
  }
  const fallback = 0;
  return fallback;
}
