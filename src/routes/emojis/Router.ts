import { Router } from 'express';
import { emojisGetServer } from './server';

const EmojisRouter = Router();

emojisGetServer(EmojisRouter);

export { EmojisRouter };
