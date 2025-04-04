import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { serverMemberVerification } from '../../middleware/serverMemberVerification';
import { getServerBotCommands } from '../../services/Application';

export function serverBotCommandsGet(Router: Router) {
  Router.get(
    '/servers/:serverId/bot-commands',
    authenticate(),
    serverMemberVerification(),

    rateLimit({
      name: 'server_bot_commands',
      restrictMS: 10000,
      requests: 10,
    }),
    route
  );
}

async function route(req: Request, res: Response) {
  const commands = await getServerBotCommands(req.params.serverId!);

  res.json({
    commands,
  });
}
