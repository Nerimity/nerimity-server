import { Request } from 'express';
import { validationResult } from 'express-validator';
import { ZodError } from 'zod';


export type CustomError = { message: string, path: string | number | null };

export function generateError(message: string, path?: string | number): CustomError {
  return {
    message,
    path: path || null
  };
}

export function customExpressValidatorResult(req: Request<unknown, unknown, unknown>) {
  const errors = validationResult(req as any);
  if (errors.isEmpty()) return null;
  const firstError = errors.array({onlyFirstError: true});
  return generateError(firstError[0].msg, firstError[0].param);
}

export function customZodError(error: ZodError) {
  const errors = error.errors;
  if (!errors.length) return null;
  const firstError = errors[0];
  firstError.path.length;
  return generateError(firstError.message, firstError.path[firstError.path.length - 1]);
}