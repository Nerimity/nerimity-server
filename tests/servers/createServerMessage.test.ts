import { describe, expect, it } from 'vitest';
import { emailConfirmCode, registerUser, sendEmailConfirmCode } from '../helpers/users';
import { createServer, createServerInvite, joinServerInvite } from '../helpers/servers';
import { createChannelMessage } from '../helpers/channels';
import { genId } from '../helpers/generateId';
import { setTimeout } from 'timers/promises';


describe('createServerMessage', () => {
  it('create a server message', async () => {
    const suffix = genId();


    const registerResult = await registerUser({
      email: `test_${suffix}@example.com`,
      username: `testuser_${suffix}`,
      password: 'pass1234',
    });
    const sendConfirmCodeResult = await sendEmailConfirmCode(registerResult.token);

    const code = sendConfirmCodeResult.message.split(": ")[2]!;
    await emailConfirmCode(code, registerResult.token);


    const createServerResult = await createServer({
      name: `testserver_${suffix}`,
    }, registerResult.token);

    const createMessageResult = await createChannelMessage(createServerResult.defaultChannelId, {
      content: `testmessage_${suffix}`,
    }, registerResult.token);

    expect(createMessageResult).toHaveProperty('id');
    expect(typeof createMessageResult.id).toBe('string');

    expect(createMessageResult).toHaveProperty('content');
    expect(createMessageResult.content).toBe(`testmessage_${suffix}`);
  });



  it('check message rate limit', async () => {
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

    const sendConfirmCodeResult = await sendEmailConfirmCode(registerResult2.token);

    const code = sendConfirmCodeResult.message.split(": ")[2]!;
    await emailConfirmCode(code, registerResult2.token);




    let rateLimited = false;
    let count = 0;


    for (let i = 0; i < 25; i++) {
      const msgSuffix = genId();
      try {
        count++;
        const createMessageResult = await createChannelMessage(createServerResult.defaultChannelId, {
          content: `testmessage_${msgSuffix}`,
          test_enable_rate_limit: true,
          test_enable_rate_limit_restrict_ms: 2000
        }, registerResult2.token);
      } catch (error: any) {
        if (error.status === 429) {
          rateLimited = true;
        }
        break;
      }
    }  
    
    expect(rateLimited).toBe(true);
    expect(count).toBe(21);


    await setTimeout(3000);


    // check if rate limit is reset
    const msgSuffix = genId();
    const createMessageResult = await createChannelMessage(createServerResult.defaultChannelId, {
      content: `testmessage_${msgSuffix}`,
      test_enable_rate_limit: true,
      test_enable_rate_limit_restrict_ms: 2000
    }, registerResult2.token);

    expect(createMessageResult).toHaveProperty('id');
    expect(typeof createMessageResult.id).toBe('string');

    expect(createMessageResult).toHaveProperty('content');
    expect(createMessageResult.content).toBe(`testmessage_${msgSuffix}`);

  });

});
