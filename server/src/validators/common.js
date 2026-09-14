import { z } from "zod";

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid identifier");
export const page = z.coerce.number().int().min(1).default(1);
export const limit = z.coerce.number().int().min(1).max(50).default(20);
export const emptyBody = z.object({}).default({});
export const emptyQuery = z.object({}).default({});
export const emptyParams = z.object({}).default({});

export const requestSchema = ({ body = emptyBody, query = emptyQuery, params = emptyParams } = {}) =>
  z.object({ body, query, params });

export const idParams = (key = "id") => z.object({ [key]: objectId });
export const paginationQuery = z.object({ page, limit });
export const httpUrl = z.string().url().max(500).refine((value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "URL must use HTTP or HTTPS");
export const optionalHttpUrl = z.union([httpUrl, z.literal("")]);
