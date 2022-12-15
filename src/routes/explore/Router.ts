import {Router} from 'express';
import { exploreServerBump } from './exploreServerBump';
import { exploreServerDelete } from './exploreServerDelete';
import { exploreServerGet } from './exploreServerGet';
import { exploreServerJoin } from './exploreServerJoin';
import { exploreServersGet } from './exploreServersGet';
import { exploreServerUpdate } from './exploreServerUpdate';



const ExploreRouter = Router();

exploreServerJoin(ExploreRouter);
exploreServerBump(ExploreRouter);
exploreServerGet(ExploreRouter);
exploreServersGet(ExploreRouter);
exploreServerUpdate(ExploreRouter);
exploreServerDelete(ExploreRouter);


export {ExploreRouter};