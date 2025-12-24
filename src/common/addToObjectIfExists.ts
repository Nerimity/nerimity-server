// it is important that this only works returns when the value is not undefined, and not null
export function addToObjectIfExists(key: string, value: any, customValue?: any) {
  if (value === undefined) return;
  return { [key]: customValue || value };
}
