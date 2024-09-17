// when file field exists, consider the request to be done.

import connectBusboy from 'connect-busboy';
import { NextFunction, Request, Response } from 'express';
import { generateError } from '../common/errorHandler';

export function connectBusboyWrapper(req: Request, res: Response, next: NextFunction) {
  if (!req.headers['content-type']?.startsWith('multipart/form-data')) return next();

  connectBusboy({ immediate: true, limits: { files: 1, fileSize: 7840000 } })(req, res, () => {
    //
  });
  if (!req.busboy) return next();

  const fields: any = {};
  let fileInfo: typeof req.fileInfo | undefined;

  req.busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  req.busboy.on('file', async (name, file, info) => {
    req.body = fields;

    if (req.body.silent) {
      try {
        req.body.silent = JSON.parse(req.body.silent);
      } catch {
        return res.status(400).json(generateError('Invalid silent format.'));
      }
    }

    // used for message replies
    if (typeof req.body.replyToMessageIds === 'string') {
      try {
        req.body.replyToMessageIds = JSON.parse(req.body.replyToMessageIds);
        req.body.mentionReplies = JSON.parse(req.body.mentionReplies as unknown as string);
      } catch (e) {
        return res.status(400).json(generateError('Invalid replyToMessageIds format.'));
      }
    }

    fileInfo = { name, file, info };
    req.fileInfo = fileInfo;
    next();
  });
  req.busboy.on('error', (error) => {
    console.error(error);
    res.json(generateError('Something went wrong. Please try again later. (connectBusboyWrapper.ts)'));
  });
}
