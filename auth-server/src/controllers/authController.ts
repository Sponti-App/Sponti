import type { Request, Response } from 'express';

export const register = (req: Request, res: Response) => {
    res.json({
        message: "register works",
    });
};

export const login = (req: Request, res: Response) => {
    res.json({
        message: "login works",
    });
};