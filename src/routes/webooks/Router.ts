import { Router } from 'express';
import { webhookkExecute } from './webhookExecute';

const WebhooksRouter = Router();

webhookkExecute(WebhooksRouter);

export { WebhooksRouter };
