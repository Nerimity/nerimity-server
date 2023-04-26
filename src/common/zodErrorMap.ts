import { z } from 'zod';

const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (ctx.defaultError === 'Required') {
    return {message: `${issue.path.join('.')} is required.`};
  }
  
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return {message: `${issue.path.join('.')} must be a ${issue.expected}`};
  }

  if (issue.code === z.ZodIssueCode.too_small) {
    if (issue.type === 'string') {
      if (issue.inclusive && ctx.data === '') {
        return {message: `${issue.path.join('.')} is required.`};
      }
      return {message: `${issue.path.join('.')} must be at least ${issue.minimum} characters long`};
    }
    
    return {message: `${issue.path.join('.')} must be greater than ${issue.minimum}`};
  }

  if (issue.code === z.ZodIssueCode.too_big) {
    if (issue.type === 'string') {
      return {message: `${issue.path.join('.')} must be at most ${issue.maximum} characters long`};
    }
    return {message: `${issue.path.join('.')} must be less than ${issue.maximum}`};
  }
  
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);