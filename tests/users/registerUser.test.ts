import { describe, expect, it } from 'vitest';
import { registerUser } from '../helpers/users';



describe('registerUser', () => {
  it('registers a new user', async () => {
    const suffix = Date.now().toString(36);

    const result = await registerUser({
      email: `test_${suffix}@example.com`,
      username: `testuser_${suffix}`,
      password: 'pass1234',
    });

    expect(result).toHaveProperty('token');
    expect(typeof (result as { token?: string }).token).toBe('string');
  });

  it('rejects duplicate emails', async () => {
    const suffix = Date.now().toString(36);
    const email = `dup_${suffix}@example.com`;

    await registerUser({
      email,
      username: `dupuser_${suffix}`,
      password: 'pass1234',
    });

    await expect(
      registerUser({
        email,
        username: `dupuser_${suffix}_b`,
        password: 'pass1234',
      })
    ).rejects.toMatchObject({
      status: 400,
      data: {
        message: 'Email already exists.',
        path: 'email',
      },
    });
  });
});
