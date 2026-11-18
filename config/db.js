import { MongoClient } from "mongodb";

let db;

export async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME || "wedora-DB");

  await Promise.all([
    db.collection("services").createIndex({ status: 1, isActive: 1, createdAt: -1 }),
    db.collection("services").createIndex({ vendorId: 1 }),
    db.collection("bookings").createIndex({ customerId: 1, createdAt: -1 }),
    db.collection("bookings").createIndex({ vendorId: 1, createdAt: -1 }),
    db.collection("bookings").createIndex({ serviceId: 1, customerId: 1, eventDate: 1 }),
    db.collection("transactions").createIndex({ stripeSessionId: 1 }, { unique: true }),
    db.collection("transactions").createIndex({ vendorId: 1, createdAt: -1 }),
  ]);

  console.log(`MongoDB connected (${db.databaseName})`);
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not connected");
  return db;
}