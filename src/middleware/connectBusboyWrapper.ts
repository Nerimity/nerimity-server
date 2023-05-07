// when file field exists, consider the request to be done.

import connectBusboy from 'connect-busboy';
import { NextFunction, Request, Response } from 'express';
import { generateError } from '../common/errorHandler';

export function connectBusboyWrapper(req: Request, res: Response, next: NextFunction) {
  if (!req.headers['content-type']?.startsWith('multipart/form-data')) return next();
  
  connectBusboy({immediate: true, limits: {files: 1, fileSize: 7840000}})(req, res, () => {
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
    fileInfo = {name, file, info};
    req.fileInfo = fileInfo;
    next();
  });
  req.busboy.on('close', () => {
    if ((fileInfo?.file as any)?.truncated) {
      res.status(403).json(generateError('File size limit exceeded.'));
      return;
    }
  });
}