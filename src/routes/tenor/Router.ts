import { Router } from 'express';
import { getTenorCategories } from './getTenorCategories';

const TenorRouter = Router();

getTenorCategories(TenorRouter);

export { TenorRouter };
