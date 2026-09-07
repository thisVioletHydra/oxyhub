export function many(flag: boolean) {
  if (flag) {
    return 1;
  }
  const fallback = 0;
  return fallback;
}

export function twoThrows(flag: boolean) {
  if (flag) {
    throw new Error('yes');
  }
  const reason = 'no';
  throw new Error(reason);
}

export function throwThenReturn(flag: boolean) {
  if (flag) {
    throw new Error('no');
  }
  const value = 1;
  return value;
}
