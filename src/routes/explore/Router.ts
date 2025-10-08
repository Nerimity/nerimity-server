import { Router } from 'express';
import { exploreBump } from './exploreBump';
import { exploreDelete } from './exploreDelete';
import { exploreServerGet } from './exploreServerGet';
import { exploreServerJoin } from './exploreServerJoin';
import { exploreItemsGet } from './exploreItemsGet';
import { exploreServerUpdate } from './exploreServerUpdate';
import { exploreBotAppUpdate } from './exploreBotAppUpdate';
import { exploreBotAppGet } from './exploreBotAppGet';

const ExploreRouter = Router();

exploreBump(ExploreRouter);
exploreDelete(ExploreRouter);
exploreBotAppGet(ExploreRouter);
exploreBotAppUpdate(ExploreRouter);
exploreItemsGet(ExploreRouter);

exploreServerJoin(ExploreRouter);
exploreServerGet(ExploreRouter);
exploreServerUpdate(ExploreRouter);

export { ExploreRouter };
