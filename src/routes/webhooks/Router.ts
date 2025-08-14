import { Router } from 'express';
import { webhookkExecute } from './webhookExecute';
import { webhookkExecuteGitHub } from './webhookExecuteGithub';

const WebhooksRouter = Router();

webhookkExecute(WebhooksRouter);
webhookkExecuteGitHub(WebhooksRouter);

export { WebhooksRouter };
