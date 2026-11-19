import "dotenv/config";
import { MongoClient } from "mongodb";

const email = process.argv[2];
if (!email) {
  console.log("Usage: node scripts/make-admin.js <email>");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

const res = await client
  .db(process.env.DB_NAME || "wedora-DB")
  .collection("user")
  .updateOne({ email: email.toLowerCase() }, { $set: { role: "admin", isBlocked: false } });

console.log(res.matchedCount ? `${email} is now an admin` : "No user found with that email");
await client.close();