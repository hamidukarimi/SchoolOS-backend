import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";

type ValidationTarget = "body" | "params" | "query";

const validate =
  (schema: ZodSchema, target: ValidationTarget = "body"): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: result.error.issues.map((issue) => issue.message),
      });
      return;
    }

    req[target] = result.data;
    next();
  };

export default validate;