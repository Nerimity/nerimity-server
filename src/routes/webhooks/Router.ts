import { Router } from 'express';
import { webhookkExecute } from './webhookExecute';
import { webhookkExecuteGitHub } from './webhookExecuteGitHub';

const WebhooksRouter = Router();

webhookkExecute(WebhooksRouter);
webhookkExecuteGitHub(WebhooksRouter);

export { WebhooksRouter };
