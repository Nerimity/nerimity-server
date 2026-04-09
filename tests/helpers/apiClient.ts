const apiBaseUrl = () => {
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL.replace(/\/$/, '');
  }

  const port = process.env.API_PORT || '8082';
  return `http://localhost:${port}/api`;
};

export type ApiError = {
  error?: string;
  message?: string;
  field?: string;
};

export async function postJson<TResponse>(path: string, opts: {body?: unknown, query?: Record<string, string>, token?: string}): Promise<TResponse> {
  const { body, token } = opts;

  const url =  new URL(`${apiBaseUrl()}${path}`);

  if (opts.query) {
    url.search = new URLSearchParams(opts.query).toString();
  }
  const res = await fetch(url.href, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as TResponse;

  if (!res.ok) {
    console.error(data);
    throw Object.assign(new Error('Request failed'), { status: res.status, data });
  }

  return data;
}
