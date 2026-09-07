export function three(alpha: boolean, beta: boolean, gamma: boolean) {
  if (alpha || beta || gamma) {
    return true;
  }

  return false;
}

export function named(alpha: boolean, beta: boolean, gamma: boolean, delta: boolean) {
  if (isBlocked(alpha, beta, gamma, delta)) {
    return true;
  }

  return false;
}

function isBlocked(alpha: boolean, beta: boolean, gamma: boolean, delta: boolean) {
  return alpha || beta || gamma || delta;
}
