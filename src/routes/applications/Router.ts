import { Router } from 'express';
import { applicationsCreate } from './applicationCreate';
import { applicationsGet } from './applicationsGet';
import { applicationGet } from './applicationGet';
import { applicationsCreateBot } from './applicationCreateBot';
import { applicationBotUpdate } from './applicationBotUpdate';

const ApplicationsRouter = Router();

applicationsCreate(ApplicationsRouter);
applicationsGet(ApplicationsRouter);
applicationGet(ApplicationsRouter);
applicationsCreateBot(ApplicationsRouter);
applicationBotUpdate(ApplicationsRouter);
export { ApplicationsRouter };
