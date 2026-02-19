import { zstdCompress } from 'node:zlib';

export const compressString = (input: string) => {
  const encoder = new TextEncoder();
  const binaryInput = encoder.encode(input);
  return new Promise<Buffer>((resolve, reject) => {
    zstdCompress(binaryInput, (err, compressed) => {
      if (err) {
        reject(err);
      } else {
        resolve(compressed);
      }
    });
  });
};

export const compressObject = (obj: any) => {
  const jsonString = JSON.stringify(obj);
  return compressString(jsonString);
};
