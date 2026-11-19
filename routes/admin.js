import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db.js";
import { CATEGORIES } from "../config/constants.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import {
  asyncHandler, escapeRegex, httpError, isId, oid, parsePaging, str, validate,
} from "../utils/helpers.js";
import { lookupOne } from "../utils/pipelines.js";
import { deleteServiceCascade } from "../utils/serviceOps.js";

const router = Router();
router.use(verifyToken, requireRole("admin"));

const USER_FIELDS = {
  name: 1, email: 1, image: 1, role: 1, isBlocked: 1, businessName: 1,
  subscriptionPlan: 1, subscriptionExpiresAt: 1, emailVerified: 1, createdAt: 1,
};
const pages = (total, limit) => Math.max(Math.ceil(total / limit), 1);

/* ---------- Overview ---------- */
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const [totalUsers, totalVendors, totalCustomers, totalServices, pendingServices, totalTransactions, revenue] =
      await Promise.all([
        db.collection("user").countDocuments({}),
        db.collection("user").countDocuments({ role: "vendor" }),
        db.collection("user").countDocuments({ role: "customer" }),
        db.collection("services").countDocuments({}),
        db.collection("services").countDocuments({ status: "pending" }),
        db.collection("transactions").countDocuments({}),
        db
          .collection("transactions")
          .aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, total: { $sum: "$amount" } } }])
          .toArray(),
      ]);

    res.json({
      totalUsers, totalVendors, totalCustomers, totalServices, pendingServices,
      totalTransactions,
      totalRevenue: revenue[0]?.total ?? 0, // cents
    });
  }),
);

/* ---------- Users ---------- */
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const search = str(req.query.search).slice(0, 80);
    const role = str(req.query.role);
    const { page, limit, skip } = parsePaging(req.query, 10);

    const filter = {};
    if (["admin", "vendor", "customer"].includes(role)) filter.role = role;
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const col = getDb().collection("user");
    const [users, total] = await Promise.all([
      col.find(filter, { projection: USER_FIELDS }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);
    res.json({ users, total, page, pages: pages(total, limit) });
  }),
);

router.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) throw httpError(400, "Invalid user ID");
    const db = getDb();
    const _id = oid(req.params.id);

    const user = await db.collection("user").findOne({ _id }, { projection: USER_FIELDS });
    if (!user) throw httpError(404, "User not found");

    const [services, bookingsMade, bookingsReceived] = await Promise.all([
      db.collection("services").countDocuments({ vendorId: _id }),
      db.collection("bookings").countDocuments({ customerId: _id }),
      db.collection("bookings").countDocuments({ vendorId: _id }),
    ]);
    res.json({ user, stats: { services, bookingsMade, bookingsReceived } });
  }),
);

router.patch(
  "/users/:id/block",
  asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) throw httpError(400, "Invalid user ID");
    const { isBlocked } = validate(z.object({ isBlocked: z.boolean() }), req.body);

    if (req.params.id === req.user.id) throw httpError(400, "You cannot block yourself");

    const db = getDb();
    const target = await db.collection("user").findOne({ _id: oid(req.params.id) }, { projection: { role: 1 } });
    if (!target) throw httpError(404, "User not found");
    if (target.role === "admin") throw httpError(403, "Admin accounts cannot be blocked");

    await db.collection("user").updateOne({ _id: target._id }, { $set: { isBlocked, updatedAt: new Date() } });
    // block korle current session gulo-o shesh
    if (isBlocked) {
      await db.collection("session").deleteMany({ userId: { $in: [target._id, req.params.id] } });
    }
    res.json({ message: isBlocked ? "User blocked" : "User unblocked", isBlocked });
  }),
);

/* ---------- Services ---------- */
router.get(
  "/services",
  asyncHandler(async (req, res) => {
    const search = str(req.query.search).slice(0, 80);
    const status = str(req.query.status);
    const category = str(req.query.category);
    const { page, limit, skip } = parsePaging(req.query, 10);

    const match = {};
    if (["pending", "approved", "rejected"].includes(status)) match.status = status;
    if (CATEGORIES.includes(category)) match.category = category;
    if (search) match.serviceName = { $regex: escapeRegex(search), $options: "i" };

    const col = getDb().collection("services");
    const [services, total] = await Promise.all([
      col
        .aggregate([
          { $match: match },
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          ...lookupOne("user", "vendorId", "vendor", ["name", "email", "businessName"]),
        ])
        .toArray(),
      col.countDocuments(match),
    ]);
    res.json({ services, total, page, pages: pages(total, limit) });
  }),
);

router.patch(
  "/services/:id/status",
  asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) throw httpError(400, "Invalid service ID");
    const { status } = validate(
      z.object({
        status: z.string().refine((v) => ["pending", "approved", "rejected"].includes(v), "Invalid status"),
      }),
      req.body,
    );

    const result = await getDb()
      .collection("services")
      .updateOne({ _id: oid(req.params.id) }, { $set: { status, updatedAt: new Date() } });
    if (!result.matchedCount) throw httpError(404, "Service not found");
    res.json({ message: `Service ${status}`, status });
  }),
);

router.delete(
  "/services/:id",
  asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) throw httpError(400, "Invalid service ID");
    const service = await getDb().collection("services").findOne({ _id: oid(req.params.id) });
    if (!service) throw httpError(404, "Service not found");
    await deleteServiceCascade(service._id);
    res.json({ message: "Service deleted" });
  }),
);

/* ---------- Transactions (shudhu read, edit korar route-i nai) ---------- */
router.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const status = str(req.query.status);
    const { page, limit, skip } = parsePaging(req.query, 10);
    const match = ["paid", "failed"].includes(status) ? { status } : {};

    const col = getDb().collection("transactions");
    const [transactions, total] = await Promise.all([
      col
        .aggregate([
          { $match: match },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          ...lookupOne("user", "vendorId", "vendor", ["name", "email", "businessName"]),
        ])
        .toArray(),
      col.countDocuments(match),
    ]);
    res.json({ transactions, total, page, pages: pages(total, limit) });
  }),
);

export default router;