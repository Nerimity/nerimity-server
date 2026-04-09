import { describe, expect, it } from 'vitest';
import { registerUser } from '../helpers/users';
import { createServer } from '../helpers/servers';
import { genId } from '../helpers/generateId';



describe('createServer', () => {
  it('create a new server', async () => {
    const suffix = genId();

    const registerResult = await registerUser({
      email: `test_${suffix}@example.com`,
      username: `testuser_${suffix}`,
      password: 'pass1234',
    });


    const createServerResult = await createServer({
      name: `testserver_${suffix}`,
    }, registerResult.token);

    expect(createServerResult).toHaveProperty('id');
    expect(typeof createServerResult.id).toBe('string');
    
    expect(createServerResult).toHaveProperty('name');
    expect(typeof createServerResult.name).toBe('string');
   
  });


});
