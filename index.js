// // import express from 'express';
// // import dotenv from 'dotenv';
// // dotenv.config();
// // import cors from 'cors';

// // import { MongoClient } from 'mongodb';

// // const app = express();
// // const port =  process.env.PORT || 5000;

// // //mongodb connection
// // const client = new MongoClient(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.dapor4c.mongodb.net/`);


// // console.log(client);

// // //middleware
// // app.use(express.json());


// // export async function connectToMongoDB() {
// //   try {
// //     await client.connect();
// //     console.log("You successfully connected to MongoDB!");
// //     return client;
// //   } catch (err) {
// //     console.dir(err);
// //   }
// // }

// // const connectedClient = await connectToMongoDB();
// // const database = connectedClient.db('wedora');
// // const users = database.collection('user');



// // app.get('/', (req, res) => {
// //   res.send('Wedora is running!');
// // });

// // app.get('/users', async (req, res) => {
// //     const cursor = users.find({});
// //     const result = await cursor.toArray();
// //     res.json(result);

// // });

// // app.listen(port, () => {
// //   console.log(`Example app listening on port ${port}`);
// // });

// import "dotenv/config";
// import express from "express";
// import cors from "cors";
// import helmet from "helmet";
// import { connectDB } from "./config/db.js";
// import { verifyToken } from "./middleware/auth.js";
// import servicesRouter from "./routes/services.js";
// import vendorRouter from "./routes/vendor.js";
// import bookingsRouter from "./routes/bookings.js";
// import adminRouter from "./routes/admin.js";
// import paymentsRouter, { webhookHandler } from "./routes/payments.js";

// import dotenv from "dotenv";
// dotenv.config();

// const app = express();

// app.use(helmet());
// app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

// // Stripe signature verify korte raw body lage, tai express.json() er age
// app.post("/api/payments/webhook", express.raw({ type: "application/json" }), webhookHandler);

// app.use(express.json({ limit: "1mb" }));

// app.get("/", (_req, res) => res.json({ ok: true, name: "Wedora API" }));

// app.get("/api/me", verifyToken, (req, res) => {
//   const { _id, ...user } = req.user;
//   res.json(user);
// });

// app.use("/api/services", servicesRouter);
// app.use("/api/vendor", vendorRouter);
// app.use("/api/bookings", bookingsRouter);
// app.use("/api/admin", adminRouter);
// app.use("/api/payments", paymentsRouter);

// app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

// app.use((err, _req, res, _next) => {
//   const status = err.status || 500;
//   if (status >= 500) console.error(err);
//   res.status(status).json({ message: status >= 500 ? "Internal server error" : err.message });
// });

// const PORT = process.env.PORT || 5000;

// connectDB()
//   .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
//   .catch((err) => {
//     console.error("Failed to start server:", err.message);
//     process.exit(1);
//   });


import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDB } from "./config/db.js";
import { verifyToken } from "./middleware/auth.js";
import servicesRouter from "./routes/services.js";
import vendorRouter from "./routes/vendor.js";
import bookingsRouter from "./routes/bookings.js";
import adminRouter from "./routes/admin.js";
import paymentsRouter, { webhookHandler } from "./routes/payments.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

app.get("/", (_req, res) => res.json({ ok: true, name: "Wedora API" }));

// prottek request e age database connect hoyeche kina nishchit kore
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Stripe signature verify korte raw body lage, tai express.json() er age
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), webhookHandler);

app.use(express.json({ limit: "1mb" }));

app.get("/api/me", verifyToken, (req, res) => {
  const { _id, ...user } = req.user;
  res.json(user);
});

app.use("/api/services", servicesRouter);
app.use("/api/vendor", vendorRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/payments", paymentsRouter);

app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? "Internal server error" : err.message });
});

// local e port e sunbe, Vercel e shudhu export korbe
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}


export default app;