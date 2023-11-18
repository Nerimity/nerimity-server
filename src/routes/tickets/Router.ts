import { Router } from 'express';
import { ticketsCreate } from './ticketsCreate';
import { ticketsGet } from './ticketsGet';

const TicketsRouter = Router();

ticketsGet(TicketsRouter);
ticketsCreate(TicketsRouter);

export { TicketsRouter };
