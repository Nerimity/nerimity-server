import env from './env';

export async function turnstileVerify(token: string) {

  if (env.DEV_MODE) return true;

  const params = new URLSearchParams();
  params.append('secret', env.TURNSTILE_SECRET);
  params.append('response', token);

  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: params,
    }
     
  ).catch(() => { });

  if (!res) return false;

  const json = (await res.json()) as { success: boolean };
  return json.success;
}

