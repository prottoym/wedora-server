import { ObjectId } from "mongodb";

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw httpError(400, result.error.issues[0]?.message || "Invalid data");
  }
  return result.data;
}

// ObjectId.isValid("123456789012") true dey (12 char string), tai strict check
export const isId = (v) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);
export const oid = (v) => new ObjectId(v);

// query param array/object hole NoSQL injection hoy, tai shudhu string nibo
export const str = (v) => (typeof v === "string" ? v.trim() : "");
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parsePaging(query, defaultLimit = 10) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

export const isPremium = (user) =>
  user?.subscriptionPlan === "premium" &&
  !!user.subscriptionExpiresAt &&
  new Date(user.subscriptionExpiresAt) > new Date();