import { Router } from 'express';
import { remindersAddRoute } from './remindersAddRoute';
import { remindersDeleteRoute } from './remindersDeleteRoute';
import { remindersGetRoute } from './remindersGet';
import { remindersUpdateRoute } from './remindersUpdate';

const RemindersRouter = Router();

remindersGetRoute(RemindersRouter);
remindersAddRoute(RemindersRouter);
remindersDeleteRoute(RemindersRouter);
remindersUpdateRoute(RemindersRouter);

export { RemindersRouter };
