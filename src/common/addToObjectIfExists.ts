export function addToObjectIfExists(key: string, value: any, customValue?: any) {
  if (value === undefined) return;
  return { [key]: customValue || value };
}
