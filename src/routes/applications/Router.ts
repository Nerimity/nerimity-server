import { Router } from 'express';
import { applicationsCreate } from './applicationCreate';
import { applicationsGet } from './applicationsGet';
import { applicationGet } from './applicationGet';
import { applicationsCreateBot } from './applicationCreateBot';

const ApplicationsRouter = Router();

applicationsCreate(ApplicationsRouter);
applicationsGet(ApplicationsRouter);
applicationGet(ApplicationsRouter);
applicationsCreateBot(ApplicationsRouter);

export { ApplicationsRouter };
