import { Router } from 'express';
import { getTenorCategories } from './getTenorCategories';
import { getTenorSearch } from './getTenorSearch';

const TenorRouter = Router();

getTenorCategories(TenorRouter);
getTenorSearch(TenorRouter);

export { TenorRouter };
