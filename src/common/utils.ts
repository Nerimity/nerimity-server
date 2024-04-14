// remove duplicate values from an array
export function removeDuplicates(arr: any[]) {
  return Array.from(new Set(arr));
}

export function arrayDiff<T>(arr1: any[], arr2: any[], key?: string) {
  return arr1.filter(function (i: any) {
    if (!key) {
      return arr2.indexOf(i) < 0;
    }
    return !arr2.find(i2 => i2[key] === i[key]);
  }) as unknown as T;
}

export function omitFromObject<T extends object, K extends keyof T>(object: T, keys: K[]): Omit<T, K> {
  const result = { ...object };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

const hexRegex = /^#(([0-9A-Fa-f]{2}){3,4}|[0-9A-Fa-f]{3})$/;
export const isValidHex = (hex: string) => hexRegex.test(hex);
