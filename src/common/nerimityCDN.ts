import fetch from 'node-fetch';
import FormData from 'form-data';
import { CustomResult } from './CustomResult';
import env from './env';
import internal from 'stream';

export function uploadAvatar(base64: string, uniqueId: string): Promise<CustomResult<{path: string}, any>> {
  return new Promise((resolve) => {
    const form = new FormData();
    const buffer = Buffer.from(base64.split(',')[1], 'base64');

    // const mimeType = base64MimeType(base64);
    const type = base64.split(';')[0].split('/')[1];

    form.append('secret', env.NERIMITY_CDN_SECRET);
    form.append('id', uniqueId);
    form.append('file', buffer, 'temp.' + type);

    fetch(env.NERIMITY_CDN + 'avatars', {
      method: 'POST',
      body: form,
    }).then(async (res) => {
      if (res.status == 200) return resolve([await res.json(), null]);
      resolve([null, await res.json()]);
    }).catch(() => [null, 'Could not connect to the CDN.']);
  });
}


export function uploadBanner(base64: string, uniqueId: string): Promise<CustomResult<{path: string}, any>> {
  return new Promise((resolve) => {
    const form = new FormData();
    const buffer = Buffer.from(base64.split(',')[1], 'base64');

    // const mimeType = base64MimeType(base64);
    const type = base64.split(';')[0].split('/')[1];

    form.append('secret', env.NERIMITY_CDN_SECRET);
    form.append('id', uniqueId);
    form.append('file', buffer, 'temp.' + type);

    fetch(env.NERIMITY_CDN + 'banners', {
      method: 'POST',
      body: form,
    }).then(async (res) => {
      if (res.status == 200) return resolve([await res.json(), null]);
      resolve([null, await res.json()]);
    }).catch(() => [null, 'Could not connect to the CDN.']);
  });
}

interface Dimensions {
  width: number;
  height: number;
}

export function uploadImage(readable: internal.Readable, filename: string, uniqueId: string): Promise<CustomResult<{path: string, dimensions: Dimensions}, any>>  {
  return new Promise((resolve) => {
    const form = new FormData();

    form.append('secret', env.NERIMITY_CDN_SECRET);
    form.append('id', uniqueId);
    form.append('file', readable, filename);

    fetch(env.NERIMITY_CDN + 'attachments', {
      method: 'POST',
      body: form,
    }).then(async (res) => {
      if (res.status == 200) return resolve([await res.json(), null]);
      resolve([null, await res.json()]);
    }).catch(() => [null, 'Could not connect to the CDN.']);
  });
}



export async function deleteImage(path: string)  {
  return await fetch(env.NERIMITY_CDN, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({path, secret: env.NERIMITY_CDN_SECRET}),
  });
}


// function base64MimeType(encoded: string) {
//   let result = null;
//   if (typeof encoded !== 'string') {
//     return result;
//   }
//   const mime = encoded.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);

//   if (mime && mime.length) {
//     result = mime[1];
//   }
//   return result;
// }