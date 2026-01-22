import { ChainableCommander } from 'ioredis';

// remove duplicate values from an array
export function removeDuplicates<T extends any[]>(arr: T) {
  return Array.from(new Set(arr)) as T;
}

export function ensureArray(value: any): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function arrayDiff<T>(arr1: any[], arr2: any[], key?: string) {
  return arr1.filter(function (i: any) {
    if (!key) {
      return arr2.indexOf(i) < 0;
    }
    return !arr2.find((i2) => i2[key] === i[key]);
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

export function isString(value: any): value is string {
  return typeof value === 'string' || value instanceof String;
}

/**
 * @returns A Date object where minutes, seconds, and milliseconds are set to zero.
 */
export function getHourStart(date: Date = new Date()): Date {
  const hourStart = new Date(date);
  hourStart.setMinutes(0, 0, 0);
  hourStart.setSeconds(0, 0);
  return hourStart;
}

// input: linear-gradient(90deg, #ff0000 0%, #00ff00 100%)
// output lg45#ff0000 0#00ff00 100
export const convertLinearGradientStringToFormat = (str: string) => {
  const wrapperRegex = /^linear-gradient\((.*)\)$/i;
  const match = str.match(wrapperRegex);
  if (!match) return [null, 'Invalid Format'] as const;

  const parts = match[1]?.split(',').map((p) => p.trim());
  if (!parts) return [null, 'Invalid Format'] as const;

  if (parts.length < 3 || parts.length > 5) {
    return [null, 'Error: Must have degree and 2-4 color stops'] as const;
  }

  const degMatch = parts[0]?.match(/^(\d+)deg$/i);
  if (!degMatch?.[1]) return [null, 'Invalid Degree'] as const;
  const d = parseInt(degMatch[1]);
  if (d < 0 || d > 360) return [null, 'Degree out of range'] as const;

  const items = [];
  for (let i = 1; i < parts.length; i++) {
    const stopRegex = /^(#[a-f0-9]{3,6})\s*(\d+)%$/i;
    const m = parts[i]?.match(stopRegex);
    if (!m) return [null, 'Invalid Color Syntax'] as const;
    items.push({ hex: m[1], stop: m[2] });
  }

  let result = `lg${d}${items[0]?.hex}`;

  for (let i = 1; i < items.length; i++) {
    const prevStop = items[i - 1]?.stop;
    const currHex = items[i]?.hex;
    result += ` ${prevStop}${currHex}`;
  }

  result += ` ${items[items.length - 1]?.stop}`;

  return [result, null] as const;
};

export async function safeExec<T extends any[]>(batch: ChainableCommander): Promise<{ [K in keyof T]: T[K] | null }> {
  const results = await batch.exec();

  if (!results) {
    throw new Error('Pipeline connection failed');
  }

  return results.map(([err, res]) => (err ? null : res)) as any;
}
