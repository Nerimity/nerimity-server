import { Router } from 'express';
import { ticketsCreate } from './ticketsCreate';
import { ticketsGet } from './ticketsGet';
import { ticketGet } from './ticketGet';

const TicketsRouter = Router();

ticketGet(TicketsRouter);
ticketsGet(TicketsRouter);
ticketsCreate(TicketsRouter);

export { TicketsRouter };
