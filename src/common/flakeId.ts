import { FlakeId } from '@nerimity/flakeid';
import env from './env';

const flakeId = new FlakeId({
  mid: 42 + (env.CLUSTER_INDEX || 0),
  timeOffset: (2013 - 1970) * 31536000 * 1000, // optional, define a offset time
});

export const generateId = () => flakeId.gen().toString();
