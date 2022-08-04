export function addToObjectIfExists(key: string, value: any) {
  if (value === undefined) return;
  return { [key]: value };
}
