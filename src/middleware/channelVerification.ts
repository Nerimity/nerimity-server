import { NextFunction, Request, Response } from 'express';

interface Options {
  allowBot?: boolean;
}


// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Options {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function authenticate (opts?: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const {channelId} = req.params;
  };
}