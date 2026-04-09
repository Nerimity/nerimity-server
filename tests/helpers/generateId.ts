import {FlakeId} from '@nerimity/flakeid';

const flakeId = new FlakeId({
  mid: Number(process.env.VITEST_WORKER_ID) || 42,
  timeOffset: (2013 - 1970) * 31536000 * 1000,
});

export function genId() {



  const id = flakeId.gen().toString();;
  return id;
}