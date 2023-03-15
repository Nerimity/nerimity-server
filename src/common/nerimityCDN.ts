import fetch from 'node-fetch';
import FormData from 'form-data';
import { CustomResult } from './CustomResult';
import env from './env';

export function uploadAvatar(base64: string, uniqueId: string): Promise<CustomResult<{path: string}, any>> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    const buffer = Buffer.from(base64.split(',')[1], 'base64');

    // const mimeType = base64MimeType(base64);
    const type = base64.split(';')[0].split('/')[1];

    form.append('secret', env.NERIMITY_CDN_SECRET);
    form.append('id', uniqueId);
    form.append('file', buffer, 'temp.' + type);

    fetch(env.NERIMITY_CDN + 'avatar', {
      method: 'POST',
      body: form,
    }).then(async (res) => {
      if (res.status == 200) return resolve([await res.json(), null]);
      resolve([null, await res.json()]);
    });
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