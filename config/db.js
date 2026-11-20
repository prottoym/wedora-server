import { MongoClient } from "mongodb";

let db;
let connecting;

export function connectDB() {
  if (db) return Promise.resolve(db);

  if (!connecting) {
    connecting = (async () => {
      const client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
      });
      await client.connect();
      const database = client.db(process.env.DB_NAME || "wedora-DB");

      
      await Promise.allSettled([
        database.collection("services").createIndex({ status: 1, isActive: 1, createdAt: -1 }),
        database.collection("services").createIndex({ vendorId: 1 }),
        database.collection("bookings").createIndex({ customerId: 1, createdAt: -1 }),
        database.collection("bookings").createIndex({ vendorId: 1, createdAt: -1 }),
        database.collection("bookings").createIndex({ serviceId: 1, customerId: 1, eventDate: 1 }),
        database.collection("transactions").createIndex({ stripeSessionId: 1 }, { unique: true }),
        database.collection("transactions").createIndex({ vendorId: 1, createdAt: -1 }),
      ]);

      db = database;
      console.log(`MongoDB connected (${database.databaseName})`);
      return db;
    })().catch((err) => {
      connecting = null; 
      throw err;
    });
  }
  return connecting;
}

export function getDb() {
  if (!db) throw new Error("Database not connected");
  return db;
}
