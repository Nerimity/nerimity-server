import { Request } from 'express';
import { validationResult } from 'express-validator';

export function customValidateResult(req: Request) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  const firstError = errors.array({onlyFirstError: true});
  return {path: firstError[0].param, message: firstError[0].msg};
}