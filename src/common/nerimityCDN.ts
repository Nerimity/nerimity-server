import { CustomResult } from './CustomResult';
import env from './env';

export function proxyUrlImageDimensions(url: string): Promise<CustomResult<{ width: number; height: number; animated: boolean }, any>> {
  return new Promise((resolve) => {
    fetch(env.LOCAL_NERIMITY_CDN + `proxy-dimensions?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        secret: env.NERIMITY_CDN_SECRET,
      },
    })
      .then(async (res) => {
        if (res.status == 200) return resolve([await res.json(), null]);
        resolve([null, true]);
      })
      .catch((err) => resolve([null, true]));
  });
}

export async function deleteFile(path: string) {
  return await fetch(env.LOCAL_NERIMITY_CDN, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      secret: env.NERIMITY_CDN_SECRET,
    },
    body: JSON.stringify({ path }),
  }).catch((err) => {
    console.trace(err);
  });
}

// deletes 1000 images from a channel.
export async function deleteChannelAttachmentBatch(channelId: string): Promise<CustomResult<{ count?: number; status: boolean }, { type: string; error?: string }>> {
  return new Promise((resolve) => {
    fetch(env.LOCAL_NERIMITY_CDN + `attachments/${channelId}/batch`, {
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
      secret: env.NERIMITY_CDN_SECRET,
    },
    body: JSON.stringify({ paths }),
  }).catch((e) => {});
}

// /verify/:groupId?/:fileId
interface VerifyUploadOpts {
  fileId: string;
  groupId?: string;
  type: 'ATTACHMENT' | 'AVATAR' | 'BANNER' | 'EMOJI';
  imageOnly?: boolean;
}

export interface VerifyResponse {
  fileId: string;
  path: string;
  filesize: number;
  animated: boolean;
  duration: number;
  mimetype: string;
  compressed: boolean;
  width?: number;
  height?: number;
  expireAt?: number;
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
      secret: env.NERIMITY_CDN_SECRET,
    },
  })
    .then(async (res) => {
      if (res.status == 200) return [(await res.json()) as VerifyResponse, null] as const;
      return [null, (await res.json()).error as string] as const;
    })
    .catch(() => [null, 'Could not connect to the CDN.'] as const);
}
