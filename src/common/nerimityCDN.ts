import fetch from 'node-fetch';
import FormData from 'form-data';
import { CustomResult } from './CustomResult';
import env from './env';
import internal from 'stream';

export function proxyUrlImageDimensions(url: string): Promise<CustomResult<{ width: number; height: number }, any>> {
  return new Promise((resolve) => {
    fetch(env.NERIMITY_CDN + `proxy-dimensions?url=${encodeURI(url)}&secret=${env.NERIMITY_CDN_SECRET}`, {
      method: 'GET',
    })
      .then(async (res) => {
        if (res.status == 200) return resolve([await res.json(), null]);
        resolve([null, true]);
      })
      .catch(() => [null, true]);
  });
}
export function uploadEmoji(base64: string, serverId: string): Promise<CustomResult<{ path: string; id: string; gif: boolean }, any>> {
  return new Promise((resolve) => {
    const form = new FormData();
    let buffer: Buffer | undefined;
    try {
      buffer = Buffer.from(base64.split(',')[1], 'base64');
    } catch (err) {}

    if (!buffer) return resolve([null, 'Invalid base64 data.']);

    // const mimeType = base64MimeType(base64);
    const type = base64.split(';')[0]?.split('/')[1];

    if (!type) return resolve([null, 'Invalid type.']);

    form.append('secret', env.NERIMITY_CDN_SECRET);
    form.append('id', serverId);
    form.append('file', buffer, 'temp.' + type);

    fetch(env.NERIMITY_CDN + 'emojis', {
      method: 'POST',
      body: form,
    })
      .then(async (res) => {
        if (res.status == 200) return resolve([await res.json(), null]);
        resolve([null, await res.json()]);
      })
      .catch(() => [null, 'Could not connect to the CDN.']);
  });
}

interface UploadAvatarOpts {
  base64: string;
  uniqueId: string;
  points?: number[];
}
export async function uploadAvatar(opts: UploadAvatarOpts) {
  const form = new FormData();
  const bufferString = opts.base64.split(',')[1];
  if (!bufferString) return [null, 'Invalid base64 data.'] as const;
  let buffer: Buffer | undefined;

  try {
    buffer = Buffer.from(bufferString, 'base64');
  } catch (err) {}

  if (!buffer) return [null, 'Invalid base64 data.'] as const;

  const type = opts.base64.split(';')[0]?.split('/')[1];
  if (!type) return [null, 'Invalid type.'] as const;

  form.append('secret', env.NERIMITY_CDN_SECRET);
  form.append('id', opts.uniqueId);

  if (opts.points) {
    form.append('points', JSON.stringify(opts.points));
  }

  form.append('file', buffer, 'temp.' + type);

  const [res, err] = await fetch(env.NERIMITY_CDN + 'avatars', {
    method: 'POST',
    body: form,
  })
    .then(async (res) => {
      if (res.status == 200) return [(await res.json()) as { path: string }, null] as const;
      return [null, await res.json()] as const;
    })
    .catch(() => [null, 'Could not connect to the CDN.'] as const);

  return [res, err] as const;
}

export function uploadBanner(base64: string, uniqueId: string): Promise<CustomResult<{ path: string }, any>> {
  return new Promise((resolve) => {
    const form = new FormData();
    let buffer: Buffer | undefined;
    try {
      buffer = Buffer.from(base64.split(',')[1], 'base64');
    } catch (err) {}

    if (!buffer) return resolve([null, 'Invalid base64 data.']);

    // const mimeType = base64MimeType(base64);
    const type = base64.split(';')[0]?.split('/')[1];

    if (!type) return resolve([null, 'Invalid type.']);

    form.append('secret', env.NERIMITY_CDN_SECRET);
    form.append('id', uniqueId);
    form.append('file', buffer, 'temp.' + type);

    fetch(env.NERIMITY_CDN + 'banners', {
      method: 'POST',
      body: form,
    })
      .then(async (res) => {
        if (res.status == 200) return resolve([await res.json(), null]);
        resolve([null, await res.json()]);
      })
      .catch(() => [null, 'Could not connect to the CDN.']);
  });
}

interface Dimensions {
  width: number;
  height: number;
}

export function uploadImage(readable: internal.Readable, filename: string, uniqueId: string): Promise<CustomResult<{ path: string; dimensions: Dimensions }, any>> {
  return new Promise((resolve) => {
    const form = new FormData();

    form.append('secret', env.NERIMITY_CDN_SECRET);
    form.append('id', uniqueId);
    form.append('file', readable, filename);

    fetch(env.NERIMITY_CDN + 'attachments', {
      method: 'POST',
      body: form,
    })
      .then(async (res) => {
        if (res.status == 200) return resolve([await res.json(), null]);
        resolve([null, await res.json()]);
      })
      .catch(() => [null, 'Could not connect to the CDN.']);
  });
}

export async function deleteImage(path: string) {
  return await fetch(env.NERIMITY_CDN, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path, secret: env.NERIMITY_CDN_SECRET }),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  }).catch(() => {});
}

// deletes 1000 images from a channel.
export async function deleteChannelAttachmentBatch(channelId: string): Promise<CustomResult<{ count?: number; status: boolean }, { type: string; code?: string }>> {
  return new Promise((resolve) => {
    fetch(env.NERIMITY_CDN + `channels/${channelId}/attachments/batch`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ secret: env.NERIMITY_CDN_SECRET }),
    })
      .then(async (res) => {
        if (res.status == 200) return resolve([await res.json(), null]);
        return resolve([null, await res.json()]);
      })
      .catch(() => resolve([null, { type: 'CDN_CONNECTION_FAIL' }]));
  });
}

export async function deleteImageBatch(paths: string[]) {
  return await fetch(env.NERIMITY_CDN + 'batch', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paths, secret: env.NERIMITY_CDN_SECRET }),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  }).catch((e) => {});
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
