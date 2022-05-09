// remove duplicate values from an array
export function removeDuplicates(arr: any[]) {
  return Array.from(new Set(arr));
}