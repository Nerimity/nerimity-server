import { Router } from 'express';
import { remindersAddRoute } from './remindersAddRoute';
import { remindersDeleteRoute } from './remindersDeleteRoute';

const RemindersRouter = Router();

remindersAddRoute(RemindersRouter);
remindersDeleteRoute(RemindersRouter);

export { RemindersRouter };
