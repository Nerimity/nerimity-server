import { Router } from 'express';
import { ticketsCreate } from './ticketsCreate';
import { ticketsGet } from './ticketsGet';
import { ticketGet } from './ticketGet';
import { ticketUpdate } from './ticketUpdate';

const TicketsRouter = Router();

ticketGet(TicketsRouter);
ticketsGet(TicketsRouter);
ticketsCreate(TicketsRouter);
ticketUpdate(TicketsRouter);

export { TicketsRouter };
