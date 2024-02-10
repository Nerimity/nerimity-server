import { Router } from 'express';
import { applicationsCreate } from './applicationCreate';
import { applicationsGet } from './applicationsGet';
import { applicationGet } from './applicationGet';

const ApplicationsRouter = Router();

applicationsCreate(ApplicationsRouter);
applicationsGet(ApplicationsRouter);
applicationGet(ApplicationsRouter);

export { ApplicationsRouter };
