export function requireValue<T>(value: T | undefined | null, name: string): T {
  if (value == undefined || value == null) {
    throw new Error(`Require valid value for variable: ${name}`);
  }
  return value;
}
