import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db.js";
import { CATEGORIES, FREE_SERVICE_LIMIT } from "../config/constants.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { asyncHandler, httpError, isId, oid, str, validate } from "../utils/helpers.js";
import { lookupOne } from "../utils/pipelines.js";
import { countActiveServices, deleteServiceCascade } from "../utils/serviceOps.js";

const router = Router();
router.use(verifyToken, requireRole("vendor"));

const serviceSchema = z.object({
  serviceName: z.string().trim().min(3, "Service name must be at least 3 characters").max(100),
  category: z.string().refine((v) => CATEGORIES.includes(v), "Please choose a valid category"),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(2000),
  price: z.coerce.number().positive("Price must be greater than 0").max(10_000_000),
  location: z.string().trim().min(2, "Please enter a location").max(100),
  images: z
    .array(z.string().url("Invalid image URL").refine((u) => u.startsWith("https://"), "Image URL must use https"))
    .min(1, "Please upload at least one image")
    .max(6, "Maximum 6 images allowed"),
});

const updateSchema = serviceSchema.partial().extend({ isActive: z.boolean().optional() });

const limitError = () =>
  httpError(403, `Free plan allows up to ${FREE_SERVICE_LIMIT} active services. Upgrade to Premium to add more.`);

async function getOwnService(req) {
  if (!isId(req.params.id)) throw httpError(400, "Invalid service ID");
  const service = await getDb().collection("services").findOne({ _id: oid(req.params.id) });
  if (!service) throw httpError(404, "Service not found");
  if (!service.vendorId.equals(req.user._id)) throw httpError(403, "This is not your service");
  return service;
}

/* ---------- Stats ---------- */
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const vendorId = req.user._id;
    const [totalServices, activeServices, pendingBookings, acceptedBookings, activeSlots] =
      await Promise.all([
        db.collection("services").countDocuments({ vendorId }),
        db.collection("services").countDocuments({ vendorId, status: "approved", isActive: true }),
        db.collection("bookings").countDocuments({ vendorId, status: "pending" }),
        db.collection("bookings").countDocuments({ vendorId, status: "accepted" }),
        countActiveServices(vendorId),
      ]);

    res.json({
      totalServices,
      activeServices,
      pendingBookings,
      acceptedBookings,
      plan: req.user.isPremium ? "premium" : "free",
      subscriptionExpiresAt: req.user.subscriptionExpiresAt ?? null,
      serviceLimit: req.user.isPremium ? null : FREE_SERVICE_LIMIT,
      activeSlots,
    });
  }),
);

/* ---------- Services ---------- */
router.get(
  "/services",
  asyncHandler(async (req, res) => {
    const services = await getDb()
      .collection("services")
      .find({ vendorId: req.user._id })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ services });
  }),
);

router.get(
  "/services/:id",
  asyncHandler(async (req, res) => {
    res.json({ service: await getOwnService(req) });
  }),
);

router.post(
  "/services",
  asyncHandler(async (req, res) => {
    const data = validate(serviceSchema, req.body);

    if (!req.user.isPremium && (await countActiveServices(req.user._id)) >= FREE_SERVICE_LIMIT) {
      throw limitError();
    }

    const now = new Date();
    const doc = {
      vendorId: req.user._id, // client theke kokhono nibo na
      ...data,
      status: "pending", // admin approve korbe
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const { insertedId } = await getDb().collection("services").insertOne(doc);
    res.status(201).json({ service: { ...doc, _id: insertedId } });
  }),
);

router.patch(
  "/services/:id",
  asyncHandler(async (req, res) => {
    const service = await getOwnService(req);
    const data = validate(updateSchema, req.body); // status/vendorId zod strip kore dey
    if (!Object.keys(data).length) throw httpError(400, "Nothing to update");

    // abar active korle free limit check
    if (
      data.isActive === true &&
      !service.isActive &&
      service.status !== "rejected" &&
      !req.user.isPremium &&
      (await countActiveServices(req.user._id)) >= FREE_SERVICE_LIMIT
    ) {
      throw limitError();
    }

    const set = { ...data, updatedAt: new Date() };
    // rejected service edit korle abar review er jonno pending hoy
    const contentChanged = Object.keys(data).some((k) => k !== "isActive");
    if (service.status === "rejected" && contentChanged) set.status = "pending";

    const updated = await getDb()
      .collection("services")
      .findOneAndUpdate({ _id: service._id }, { $set: set }, { returnDocument: "after" });
    res.json({ service: updated });
  }),
);

router.delete(
  "/services/:id",
  asyncHandler(async (req, res) => {
    const service = await getOwnService(req);
    await deleteServiceCascade(service._id);
    res.json({ message: "Service deleted" });
  }),
);

/* ---------- Booking requests ---------- */
router.get(
  "/bookings",
  asyncHandler(async (req, res) => {
    const status = str(req.query.status);
    const match = { vendorId: req.user._id };
    if (["pending", "accepted", "rejected", "cancelled"].includes(status)) match.status = status;

    const bookings = await getDb()
      .collection("bookings")
      .aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        ...lookupOne("user", "customerId", "customer", ["name", "email", "image"]),
        ...lookupOne("services", "serviceId", "service", ["serviceName", "images", "price", "category"]),
      ])
      .toArray();

    res.json({ bookings });
  }),
);

router.patch(
  "/bookings/:id/status",
  asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) throw httpError(400, "Invalid booking ID");
    const { status } = validate(
      z.object({
        status: z.string().refine((v) => ["accepted", "rejected"].includes(v), "Status must be accepted or rejected"),
      }),
      req.body,
    );

    const bookings = getDb().collection("bookings");
    const booking = await bookings.findOne({ _id: oid(req.params.id) });
    if (!booking) throw httpError(404, "Booking request not found");
    if (!booking.vendorId.equals(req.user._id)) {
      throw httpError(403, "This booking belongs to another vendor");
    }

    // shudhu pending hole-i update hobe (race condition safe)
    const result = await bookings.updateOne(
      { _id: booking._id, status: "pending" },
      { $set: { status, updatedAt: new Date() } },
    );
    if (!result.modifiedCount) {
      throw httpError(409, "This request has already been processed and cannot be changed");
    }
    res.json({ message: `Booking ${status}`, status });
  }),
);

export default router;