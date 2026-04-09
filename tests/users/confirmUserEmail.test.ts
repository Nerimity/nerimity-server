import { describe, expect, it } from 'vitest';
import { emailConfirmCode, registerUser, sendEmailConfirmCode } from '../helpers/users';
import { genId } from '../helpers/generateId';



describe('confirmUserEmail', () => {
  it('confirm user email', async () => {
    const suffix = genId();

    const result = await registerUser({
      email: `test_${suffix}@example.com`,
      username: `testuser_${suffix}`,
      password: 'pass1234',
    });
    const sendConfirmCodeResult = await sendEmailConfirmCode(result.token);


    expect(sendConfirmCodeResult).toHaveProperty('message');
    expect(typeof sendConfirmCodeResult.message).toBe('string');



    const code = sendConfirmCodeResult.message.split(": ")[2];

    
    const confirmResult = await emailConfirmCode(code, result.token);

    expect(confirmResult).toHaveProperty('status');
    expect(confirmResult.status).toBe(true);


  });

});
