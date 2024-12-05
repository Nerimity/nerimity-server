import { Router } from 'express';
import { remindersAddRoute } from './remindersAddRoute';
import { remindersDeleteRoute } from './remindersDeleteRoute';
import { remindersGetRoute } from './remindersGet';

const RemindersRouter = Router();

remindersGetRoute(RemindersRouter);
remindersAddRoute(RemindersRouter);
remindersDeleteRoute(RemindersRouter);

export { RemindersRouter };
