import { Router } from 'express';
import { googleDriveLink } from './google-drive/googleDriveLink';
import { googleDriveCreateLink } from './google-drive/googleDriveCreateLink';
import { googleDriveUnlink } from './google-drive/googleDriveUnlink';
import { googleDriveGetAccessToken } from './google-drive/googleDriveGetAccessToken';
import { googleLink } from './google/googleLink';
import { googleCreateLink } from './google/googleCreateLink';
import { googleUnlink } from './google/googleUnlink';

const ConnectionsRouter = Router();

googleDriveLink(ConnectionsRouter);
googleDriveCreateLink(ConnectionsRouter);
googleDriveUnlink(ConnectionsRouter);
googleDriveGetAccessToken(ConnectionsRouter);

googleLink(ConnectionsRouter);
googleCreateLink(ConnectionsRouter);
googleUnlink(ConnectionsRouter);

export { ConnectionsRouter };
