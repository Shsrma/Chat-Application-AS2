import { z } from 'zod';
import { ApiError } from './errorMiddleware.js';

/**
 * Middleware to validate request params, query, or body based on a custom Zod Schema
 */
export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      // Map Zod errors to a single readable string
      const errors = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return next(new ApiError(400, `Validation Error: ${errors}`));
    }
    next(err);
  }
};
