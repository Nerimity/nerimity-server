import { Router } from 'express';
import { getTenorCategories } from './getTenorCategories';
import { getTenorSearch } from './getTenorSearch';
import { getTenorTrending } from './getTenorTrending';

const TenorRouter = Router();

getTenorCategories(TenorRouter);
getTenorSearch(TenorRouter);
getTenorTrending(TenorRouter);

export { TenorRouter };
