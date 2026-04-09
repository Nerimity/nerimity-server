import { describe, expect, it } from 'vitest';
import { registerUser } from '../helpers/users';
import { createServer, createServerInvite, joinServerInvite } from '../helpers/servers';
import { genId } from '../helpers/generateId';



describe('joinServer', () => {
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

    const inviteRes = await createServerInvite(createServerResult.id, registerResult.token);

    expect(inviteRes).toHaveProperty('code');
    expect(typeof inviteRes.code).toBe('string');



    const suffix2 = genId();

    const registerResult2 = await registerUser({
      email: `test_${suffix2}@example.com`,
      username: `testuser_${suffix2}`,
      password: 'pass1234',
    });







    const joinServerResult = await joinServerInvite(inviteRes.code, registerResult2.token);

    expect(joinServerResult).toHaveProperty('id');
    expect(typeof joinServerResult.id).toBe('string');
    
    expect(joinServerResult).toHaveProperty('name');
    expect(typeof joinServerResult.name).toBe('string');
    expect(joinServerResult.name).toBe(createServerResult.name);



  });


});
