import { ZodError } from "zod";

/**
 * Validation middleware: run schema.parse on req (body, query, params)
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const toValidate = {
      body: req.body,
      query: req.query,
      params: req.params,
    };
    const parsed = schema.parse(toValidate);
    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.query !== undefined) req.query = parsed.query;
    if (parsed.params !== undefined) req.params = parsed.params;
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({ path: e.path.join("."), message: e.message }));
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
        error: { code: "VALIDATION_ERROR", message: "Validation failed", details: errors },
      });
    }
    next(err);
  }
};
