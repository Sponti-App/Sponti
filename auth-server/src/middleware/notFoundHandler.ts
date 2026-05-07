import type { RequestHandler } from "express";

const notFoundHandler: RequestHandler = (_req, _res, next) => {
    next(new Error("Not Found", { cause: { status: 404 } }));
};

export default notFoundHandler;
