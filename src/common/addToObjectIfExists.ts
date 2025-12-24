// it is important that this only returns when the value is not undefined. null should be allowed.
export function addToObjectIfExists(key: string, value: any, customValue?: any) {
  if (value === undefined) return;
  return { [key]: customValue || value };
}
