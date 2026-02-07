const apiBaseUrl = () => {
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL.replace(/\/$/, '');
  }

  const port = process.env.API_PORT || '8080';
  return `http://localhost:${port}/api`;
};

export type ApiError = {
  error?: string;
  message?: string;
  field?: string;
};

export async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as TResponse;

  if (!res.ok) {
    throw Object.assign(new Error('Request failed'), { status: res.status, data });
  }

  return data;
}
