export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  meta: PaginationMeta;
}

export function parsePagination(params: PaginationParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const pages = Math.ceil(total / limit) || 1;
  return {
    data,
    total,
    page,
    limit,
    meta: {
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    },
  };
}
