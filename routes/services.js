import { Router } from "express";
import { getDb } from "../config/db.js";
import { CATEGORIES } from "../config/constants.js";
import {
  asyncHandler, escapeRegex, httpError, isId, oid, parsePaging, str,
} from "../utils/helpers.js";
import { lookupOne } from "../utils/pipelines.js";

const router = Router();

const SORTS = {
  latest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
};

const withVendor = lookupOne("user", "vendorId", "vendor", [
  "name", "businessName", "image", "subscriptionPlan",
]);

// GET /api/services?search=&category=&location=&sort=&page=&limit=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = str(req.query.search).slice(0, 80);
    const category = str(req.query.category);
    const location = str(req.query.location).slice(0, 80);
    const sortKey = SORTS[str(req.query.sort)] ? str(req.query.sort) : "latest";
    const { page, limit, skip } = parsePaging(req.query, 9);

    const filter = { status: "approved", isActive: true };
    if (search) filter.serviceName = { $regex: escapeRegex(search), $options: "i" };
    if (CATEGORIES.includes(category)) filter.category = category;
    if (location) filter.location = { $regex: escapeRegex(location), $options: "i" };

    const col = getDb().collection("services");
    const [services, total] = await Promise.all([
      col
        .aggregate([
          { $match: filter },
          { $sort: SORTS[sortKey] },
          { $skip: skip },
          { $limit: limit },
          ...withVendor,
        ])
        .toArray(),
      col.countDocuments(filter),
    ]);

    res.json({ services, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  }),
);

// GET /api/services/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!isId(req.params.id)) throw httpError(400, "Invalid service ID");

    const [service] = await getDb()
      .collection("services")
      .aggregate([
        { $match: { _id: oid(req.params.id), status: "approved", isActive: true } },
        ...withVendor,
      ])
      .toArray();

    if (!service) throw httpError(404, "Service not found or not available");
    res.json({ service });
  }),
);

export default router;