import { Request } from 'express';
import { AlternativeValidationError, FieldValidationError, GroupedAlternativeValidationError, validationResult } from 'express-validator';
import env from './env';
import { Log } from './Log';

export type CustomError = { message: string; path: string | null };

export function generateError<A extends string, B extends string>(message: A, path?: B) {
  return {
    message,
    path: path || null,
  } as const;
}

export function customExpressValidatorResult(req: Request<unknown, unknown, unknown>) {
  const errors = validationResult(req as any);
  if (errors.isEmpty()) return null;
  const firstError = errors.array({ onlyFirstError: true })?.[0] as FieldValidationError | GroupedAlternativeValidationError;

  if (env.DEV_MODE) {
    // Log.error(JSON.stringify(firstError, null, 2));
  }

  if ('nestedErrors' in firstError) {
    console.log(firstError.nestedErrors[0]);
    return generateError(firstError.nestedErrors[0]?.[0]?.msg, firstError.nestedErrors[0]?.[0]?.path);
  }
  return generateError(firstError.msg, firstError.path);
}
