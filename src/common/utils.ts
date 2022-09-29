// remove duplicate values from an array
export function removeDuplicates(arr: any[]) {
  return Array.from(new Set(arr));
}

export function arrayDiff<T>(arr1: any[], arr2: any[], key?: string) {
  return arr1.filter(function(i: any) {
    if (!key) {
      return arr2.indexOf(i) < 0;
    }
    return !arr2.find(i2 => i2[key] === i[key]);
  }) as unknown as T;
}