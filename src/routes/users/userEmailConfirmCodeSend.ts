import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { sendEmailConfirmCode } from '../../services/User';

export function userEmailConfirmCodeSend(Router: Router) {
  Router.post(
    '/users/emails/verify/send-code',
    authenticate(),
    rateLimit({
      name: 'verify_email_send_code',
      expireMS: 600000, // 10 minutes
      requestCount: 3,
      useIP: true,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const [result, error] = await sendEmailConfirmCode(req.accountCache.user.id);

  if (error) {
    return res.status(400).json(error);
  }

  res.json(result);
}
