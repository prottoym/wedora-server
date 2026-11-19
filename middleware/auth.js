import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { getDb } from "../config/db.js";
import { isId, isPremium } from "../utils/helpers.js";

const baseUrl = () => process.env.CLIENT_URL.replace(/\/$/, "");

let jwks;
const getJwks = () =>
  (jwks ??= createRemoteJWKSet(new URL(`${baseUrl()}/api/auth/jwks`)));

export async function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Authentication required" });

  let payload;
  try {
    ({ payload } = await jwtVerify(token, getJwks(), { issuer: baseUrl() }));
  } catch {
    // expired / vul signature / vul issuer
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const id = payload.sub ?? payload.id;
    if (!isId(id)) return res.status(401).json({ message: "Invalid token" });

    // role / isBlocked token theke na, database theke nibo
    const user = await getDb().collection("user").findOne({ _id: new ObjectId(id) });
    if (!user) return res.status(401).json({ message: "User not found" });
    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      businessName: user.businessName,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      isPremium: isPremium(user),
    };
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have access to this resource" });
    }
    next();
  };