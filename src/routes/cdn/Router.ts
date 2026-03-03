import { Router } from 'express';
import { cdnGenerateToken } from './cdnGenerateToken';

const CdnRouter = Router();

cdnGenerateToken(CdnRouter);

export { CdnRouter };
