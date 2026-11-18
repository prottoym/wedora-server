import { getDb } from "../config/db.js";
import { FREE_SERVICE_LIMIT } from "../config/constants.js";

export const countActiveServices = (vendorId) =>
  getDb()
    .collection("services")
    .countDocuments({ vendorId, isActive: true, status: { $ne: "rejected" } });

// service delete hole tar pending booking gulo cancelled hoye jabe
export async function deleteServiceCascade(serviceId) {
  const db = getDb();
  await db
    .collection("bookings")
    .updateMany(
      { serviceId, status: "pending" },
      { $set: { status: "cancelled", updatedAt: new Date() } },
    );
  await db.collection("services").deleteOne({ _id: serviceId });
}

// Premium shesh hole shobcheye purono 3ta active thakbe, baki inactive
export async function enforceFreeLimit(vendorId) {
  const services = getDb().collection("services");
  const base = { vendorId, isActive: true, status: { $ne: "rejected" } };

  const keep = await services
    .find(base, { projection: { _id: 1 } })
    .sort({ createdAt: 1 })
    .limit(FREE_SERVICE_LIMIT)
    .toArray();

  await services.updateMany(
    { ...base, _id: { $nin: keep.map((s) => s._id) } },
    { $set: { isActive: false } },
  );
}