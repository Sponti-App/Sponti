import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { z } from "zod";

const validateBody =
    (schema: ZodType): RequestHandler =>
        (req, _res, next) => {
            const result = schema.safeParse(req.body);

            if (!result.success) {
                return next(
                    new Error(z.prettifyError(result.error), {
                        cause: { status: 400 },
                    })
                );
            }

            req.body = result.data;
            next();
        };

export default validateBody;
