import pako from 'pako';

export function zip(string: string) {
  const binaryString = pako.deflate(string);
  return Buffer.from(binaryString).toString('base64');
}

export function unzip(base64: string) {
  try {
    const binaryString = Buffer.from(base64, 'base64');
    return pako.inflate(binaryString, { to: 'string' });
  } catch {
    return null;
  }
}
