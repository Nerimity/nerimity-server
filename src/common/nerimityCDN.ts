import { CustomResult } from './CustomResult';
import env from './env';

export function proxyUrlImageDimensions(url: string): Promise<CustomResult<{ width: number; height: number; animated: boolean }, any>> {
  return new Promise((resolve) => {
    fetch(env.LOCAL_NERIMITY_CDN + `proxy-dimensions?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        Authorization: env.NERIMITY_CDN_SECRET,
      },
    })
      .then(async (res) => {
        if (res.status == 200) return resolve([await res.json(), null]);
        console.log('failed to get dimensions', await res.json());
        resolve([null, true]);
      })
      .catch((err) => resolve([null, true]));
  });
}

export async function deleteFile(path: string) {
  return await fetch(env.LOCAL_NERIMITY_CDN + 'internal', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: env.NERIMITY_CDN_SECRET,
    },
    body: JSON.stringify({ path }),
  }).catch((err) => {
    console.trace(err);
  });
}

// deletes 1000 images from a channel.
export async function deleteChannelAttachmentBatch(channelId: string): Promise<CustomResult<{ count?: number; status: boolean }, { type: string; error?: string }>> {
  return new Promise((resolve) => {
    fetch(env.LOCAL_NERIMITY_CDN + `internal/attachments/${channelId}/batch`, {
      method: 'DELETE',
      headers: {
        Authorization: env.NERIMITY_CDN_SECRET,
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
  return await fetch(env.LOCAL_NERIMITY_CDN + 'internal/batch', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: env.NERIMITY_CDN_SECRET,
    },
    body: JSON.stringify({ paths }),
  }).catch((e) => {});
}

// /verify/:groupId?/:fileId
interface VerifyUploadOpts {
  userId: string;
  fileId: string;
  groupId?: string;
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
  url.pathname = `/internal/verify-file`;

  return await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: env.NERIMITY_CDN_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: opts.userId,
      fileId: opts.fileId,
      groupId: opts.groupId,
    }),
  })
    .then(async (res) => {
      if (res.status == 200) return [(await res.json()) as VerifyResponse, null] as const;
      return [null, (await res.json()).message as string] as const;
    })
    .catch(() => [null, 'Could not connect to the CDN.'] as const);
}

interface GenerateTokenOps {
  userId: string;
  channelId?: string;
}
export interface GenerateTokenResponse {
  token: string;
}
export async function generateToken(opts: GenerateTokenOps) {
  const url = new URL(env.LOCAL_NERIMITY_CDN);
  url.pathname = `/internal/generate-token`;

  return await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: env.NERIMITY_CDN_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: opts.userId,
      channelId: opts.channelId,
    }),
  })
    .then(async (res) => {
      if (res.status == 200) return [(await res.json()) as GenerateTokenResponse, null] as const;
      return [null, (await res.json()).message as string] as const;
    })
    .catch(() => [null, 'Could not connect to the CDN.'] as const);
}
