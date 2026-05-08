import { z } from "zod";

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const getPagination = ({ page, limit }: PaginationQuery) => {
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const toPagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
