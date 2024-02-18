import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { verifyEmailConfirmCode } from '../../services/User/UserManagement';

export function userEmailConfirmCode(Router: Router) {
  Router.post(
    '/users/emails/verify',
    authenticate(),
    rateLimit({
      name: 'verify_email_code',
      expireMS: 600000, // 10 minutes
      requestCount: 8,
      useIP: true,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const code = req.query.code as string;

  const [status, error] = await verifyEmailConfirmCode(req.userCache.id, code);

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status });
}
