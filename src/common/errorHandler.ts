import { Request } from 'express';
import { validationResult } from 'express-validator';


export type CustomError = { message: string, path: string | null };

export function generateError(message: string, path?: string): CustomError {
  return {
    message,
    path: path || null
  };
}

export function customExpressValidatorResult(req: Request) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  const firstError = errors.array({onlyFirstError: true});
  return generateError(firstError[0].msg, firstError[0].param);
}