import { Router } from 'express';
import { applicationsCreate } from './applicationCreate';
import { applicationsGet } from './applicationsGet';
import { applicationGet } from './applicationGet';
import { applicationsCreateBot } from './applicationCreateBot';
import { applicationBotUpdate } from './applicationBotUpdate';
import { applicationBotGet } from './applicationBotGet';
import { applicationBotTokenGet } from './applicationBotTokenGet';
import { applicationBotTokenRefresh } from './applicationBotTokenRefresh';
import { applicationDelete } from './applicationDelete';
import { applicationUpdate } from './applicationUpdate';
import { applicationExistsCheck } from './applicationExistsCheck';

const ApplicationsRouter = Router();

applicationsCreate(ApplicationsRouter);
applicationsGet(ApplicationsRouter);
applicationGet(ApplicationsRouter);
applicationsCreateBot(ApplicationsRouter);
applicationDelete(ApplicationsRouter);
applicationUpdate(ApplicationsRouter);
applicationExistsCheck(ApplicationsRouter);

applicationBotUpdate(ApplicationsRouter);
applicationBotGet(ApplicationsRouter);
applicationBotTokenGet(ApplicationsRouter);
applicationBotTokenRefresh(ApplicationsRouter);

export { ApplicationsRouter };
