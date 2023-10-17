import { FlakeId } from '@nerimity/flakeid';

const flakeId = new FlakeId({
  mid: 42, // optional, define machine id
  timeOffset: (2013 - 1970) * 31536000 * 1000 // optional, define a offset time
});

export const generateId = () => flakeId.gen().toString();