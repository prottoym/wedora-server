import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { asyncHandler, httpError, isId, oid, validate } from "../utils/helpers.js";
import { lookupOne } from "../utils/pipelines.js";

const router = Router();
// admin booking
router.use(verifyToken, requireRole("customer", "vendor"));

const validDay = (v) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
};
// timezone 
const minDate = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const bookingSchema = z.object({
  serviceId: z.string().refine(isId, "Invalid service"),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid event date")
    .refine(validDay, "Please choose a valid event date")
    .refine((v) => v >= minDate(), "Event date cannot be in the past"),
  eventLocation: z.string().trim().min(3, "Please enter the event location").max(150),
  message: z.string().trim().max(500, "Message is too long (max 500)").optional().default(""),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = validate(bookingSchema, req.body);
    const db = getDb();

    const service = await db
      .collection("services")
      .findOne({ _id: oid(data.serviceId), status: "approved", isActive: true });
    if (!service) throw httpError(404, "This service is not available for booking");
    if (service.vendorId.equals(req.user._id)) {
      throw httpError(403, "You cannot book your own service");
    }

    const duplicate = await db.collection("bookings").findOne({
      serviceId: service._id,
      customerId: req.user._id,
      eventDate: data.eventDate,
      status: { $in: ["pending", "accepted"] },
    });
    if (duplicate) {
      throw httpError(409, "You already have an active request for this service on that date");
    }

    const now = new Date();
    const doc = {
      serviceId: service._id,
      vendorId: service.vendorId, 
      customerId: req.user._id, // token 
      eventDate: data.eventDate,
      eventLocation: data.eventLocation,
      message: data.message,
      status: "pending",
      createdAt: now,
    };
    const { insertedId } = await db.collection("bookings").insertOne(doc);
    res.status(201).json({ booking: { ...doc, _id: insertedId } });
  }),
);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const bookings = await getDb()
      .collection("bookings")
      .aggregate([
        { $match: { customerId: req.user._id } },
        { $sort: { createdAt: -1 } },
        ...lookupOne("services", "serviceId", "service", [
          "serviceName", "images", "price", "category", "location",
        ]),
        ...lookupOne("user", "vendorId", "vendor", ["name", "businessName", "image", "email"]),
      ])
      .toArray();
    res.json({ bookings });
  }),
);

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const rows = await getDb()
      .collection("bookings")
      .aggregate([
        { $match: { customerId: req.user._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray();

    const by = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    res.json({
      total: rows.reduce((sum, r) => sum + r.count, 0),
      pending: by.pending ?? 0,
      accepted: by.accepted ?? 0,
      rejected: by.rejected ?? 0,
      cancelled: by.cancelled ?? 0,
    });
  }),
);

router.patch(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) throw httpError(400, "Invalid booking ID");

    const bookings = getDb().collection("bookings");
    const booking = await bookings.findOne({ _id: oid(req.params.id) });
    if (!booking) throw httpError(404, "Booking not found");
    if (!booking.customerId.equals(req.user._id)) {
      throw httpError(403, "You can only cancel your own bookings");
    }

    const result = await bookings.updateOne(
      { _id: booking._id, status: "pending" },
      { $set: { status: "cancelled", updatedAt: new Date() } },
    );
    if (!result.modifiedCount) {
      throw httpError(409, `A ${booking.status} booking cannot be cancelled`);
    }
    res.json({ message: "Booking cancelled", status: "cancelled" });
  }),
);

export default router;
