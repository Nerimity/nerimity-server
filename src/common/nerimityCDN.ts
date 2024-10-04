import fetch from 'node-fetch';
import FormData from 'form-data';
import { CustomResult } from './CustomResult';
import env from './env';
import internal from 'stream';

export function proxyUrlImageDimensions(url: string): Promise<CustomResult<{ width: number; height: number }, any>> {
  return new Promise((resolve) => {
    fetch(env.LOCAL_NERIMITY_CDN + `proxy-dimensions?url=${encodeURI(url)}`, {
      method: 'GET',
      headers: {
        secret: env.NERIMITY_CDN_SECRET
      }
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
    } catch (err) { }

    if (!buffer) return resolve([null, 'Invalid base64 data.']);

    // const mimeType = base64MimeType(base64);
    const type = base64.split(';')[0]?.split('/')[1];

    if (!type) return resolve([null, 'Invalid type.']);

    form.append('secret', env.NERIMITY_CDN_SECRET);
    form.append('id', serverId);
    form.append('file', buffer, 'temp.' + type);

    fetch(env.LOCAL_NERIMITY_CDN + 'emojis', {
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
  } catch (err) { }

  if (!buffer) return [null, 'Invalid base64 data.'] as const;

  const type = opts.base64.split(';')[0]?.split('/')[1];
  if (!type) return [null, 'Invalid type.'] as const;

  form.append('secret', env.NERIMITY_CDN_SECRET);
  form.append('id', opts.uniqueId);

  if (opts.points) {
    form.append('points', JSON.stringify(opts.points));
  }

  form.append('file', buffer, 'temp.' + type);

  const [res, err] = await fetch(env.LOCAL_NERIMITY_CDN + 'avatars', {
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
    } catch (err) { }

    if (!buffer) return resolve([null, 'Invalid base64 data.']);

    // const mimeType = base64MimeType(base64);
    const type = base64.split(';')[0]?.split('/')[1];

    if (!type) return resolve([null, 'Invalid type.']);

    form.append('secret', env.NERIMITY_CDN_SECRET);
    form.append('id', uniqueId);
    form.append('file', buffer, 'temp.' + type);

    fetch(env.LOCAL_NERIMITY_CDN + 'banners', {
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

    fetch(env.LOCAL_NERIMITY_CDN + 'attachments', {
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

export async function deleteFile(path: string) {
  return await fetch(env.LOCAL_NERIMITY_CDN, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      secret: env.NERIMITY_CDN_SECRET
    },
    body: JSON.stringify({ path }),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  })
    .catch((err) => {
      console.log(err)
    });
}

// deletes 1000 images from a channel.
export async function deleteChannelAttachmentBatch(channelId: string): Promise<CustomResult<{ count?: number; status: boolean }, { type: string; error?: string }>> {
  return new Promise((resolve) => {
    fetch(env.LOCAL_NERIMITY_CDN + `/attachments/${channelId}/batch`, {
      method: 'DELETE',
      headers: {
        secret: env.NERIMITY_CDN_SECRET,
      },
    })
      .then(async (res) => {
        if (res.status == 200) return resolve([await res.json(), null]);
        return resolve([null, await res.json()]);
      })
      .catch(() => resolve([null, { type: 'CDN_CONNECTION_FAIL' }]));
  });
}

export async function deleteImageBatch(paths: string[]) {
  return await fetch(env.LOCAL_NERIMITY_CDN + 'batch', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      secret: env.NERIMITY_CDN_SECRET
    },
    body: JSON.stringify({ paths }),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  }).catch((e) => { });
}

// /verify/:groupId?/:fileId
interface VerifyUploadOpts {
  fileId: string;
  groupId?: string;
  type: "ATTACHMENT" | "AVATAR" | "BANNER" | "EMOJI";
  imageOnly?: boolean;
}

interface VerifyResponse {
  path: string;
  filesize: number;
  animated: boolean;
  duration: number;
  mimetype: string;
  compressed: boolean;
  width?: number;
  height?: number;
  expireAt?: number
}
export async function verifyUpload(opts: VerifyUploadOpts) {

  const url = new URL(env.LOCAL_NERIMITY_CDN);
  url.pathname = `verify/${opts.fileId}`;
  if (opts.groupId) url.pathname = `verify/${opts.groupId}/${opts.fileId}`;
  url.searchParams.set('type', opts.type);
  if (opts.imageOnly) url.searchParams.set('imageOnly', 'true');

  return await fetch(url, {
    method: 'POST',
    headers: {
      'secret': env.NERIMITY_CDN_SECRET,
    }
  })
    .then(async (res) => {
      if (res.status == 200) return [await res.json() as VerifyResponse, null] as const;
      return [null, (await res.json()).error as string] as const;
    })
    .catch(() => [null, 'Could not connect to the CDN.'] as const);
}