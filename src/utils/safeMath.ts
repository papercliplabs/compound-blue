export function safeDiv(num: number, den: number) {
  if (den == 0) {
    return 0;
  }

  return num / den;
}
