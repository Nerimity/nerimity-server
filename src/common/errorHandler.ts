import { Request } from 'express';
import { FieldValidationError, validationResult } from 'express-validator';


export type CustomError = { message: string, path: string | null };

export function generateError<A extends string, B extends string>(message: A, path?: B) {
  return {
    message,
    path: path || null
  } as const;
}

export function customExpressValidatorResult(req: Request<unknown, unknown, unknown>) {
  const errors = validationResult(req as any);
  if (errors.isEmpty()) return null;
  const firstError = errors.array({ onlyFirstError: true }) as FieldValidationError[];
  return generateError(firstError[0].msg, firstError[0].path);
}