// import { Router } from "express";
// import Stripe from "stripe";
// import { getDb } from "../config/db.js";
// import { CURRENCY, PREMIUM_PRICE_CENTS } from "../config/constants.js";
// import { requireRole, verifyToken } from "../middleware/auth.js";
// import { asyncHandler, httpError, isId, oid, str } from "../utils/helpers.js";
// import { enforceFreeLimit } from "../utils/serviceOps.js";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// const router = Router();

// const clientUrl = () => process.env.CLIENT_URL.replace(/\/$/, "");

// /* ---------- Vendor endpoints ---------- */

// // vendor id token theke ashe, onno vendor er jonno session banano jabe na
// router.post(
//   "/checkout",
//   verifyToken,
//   requireRole("vendor"),
//   asyncHandler(async (req, res) => {
//     if (req.user.isPremium) throw httpError(409, "You are already on the Premium plan");

//     const meta = { vendorId: req.user.id, plan: "premium" };
//     const session = await stripe.checkout.sessions.create({
//       mode: "subscription",
//       client_reference_id: req.user.id,
//       customer_email: req.user.email,
//       line_items: [
//         {
//           quantity: 1,
//           price_data: {
//             currency: CURRENCY,
//             unit_amount: PREMIUM_PRICE_CENTS,
//             recurring: { interval: "month" },
//             product_data: {
//               name: "WedPlan Premium",
//               description: "Unlimited services and Premium Vendor badge",
//             },
//           },
//         },
//       ],
//       metadata: meta,
//       subscription_data: { metadata: meta },
//       success_url: `${clientUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url: `${clientUrl()}/payment/cancel`,
//     });

//     res.json({ url: session.url });
//   }),
// );

// // success page eta poll kore. Transaction webhook e toiri hoy, tai ekhane shudhu DB dekhi
// router.get(
//   "/session/:id",
//   verifyToken,
//   requireRole("vendor"),
//   asyncHandler(async (req, res) => {
//     const sessionId = str(req.params.id);
//     if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw httpError(400, "Invalid session");

//     const tx = await getDb()
//       .collection("transactions")
//       .findOne({ stripeSessionId: sessionId, vendorId: req.user._id });

//     if (!tx) return res.json({ status: "pending" });
//     res.json({
//       status: tx.status === "paid" ? "paid" : "failed",
//       plan: tx.plan,
//       amount: tx.amount,
//       currency: tx.currency,
//     });
//   }),
// );

// // cancel korle billing period shesh porjonto Premium thakbe
// router.post(
//   "/cancel",
//   verifyToken,
//   requireRole("vendor"),
//   asyncHandler(async (req, res) => {
//     const tx = await getDb()
//       .collection("transactions")
//       .findOne({ vendorId: req.user._id, status: "paid" }, { sort: { createdAt: -1 } });

//     if (!req.user.isPremium || !tx?.stripeSubscriptionId) {
//       throw httpError(400, "No active Premium subscription found");
//     }
//     await stripe.subscriptions.update(tx.stripeSubscriptionId, { cancel_at_period_end: true });
//     res.json({ message: "Your Premium plan will end at the end of the current billing period" });
//   }),
// );

// /* ---------- Webhook ---------- */

// const periodEnd = (sub) => {
//   // notun Stripe API version e eta items er vitor
//   const ts = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
//   return ts ? new Date(ts * 1000) : null;
// };

// async function activatePremium(vendorId, expiresAt) {
//   await getDb()
//     .collection("user")
//     .updateOne(
//       { _id: oid(vendorId) },
//       { $set: { subscriptionPlan: "premium", subscriptionExpiresAt: expiresAt } },
//     );
// }

// async function downgrade(vendorId) {
//   await getDb()
//     .collection("user")
//     .updateOne(
//       { _id: oid(vendorId) },
//       { $set: { subscriptionPlan: "free", subscriptionExpiresAt: null } },
//     );
//   await enforceFreeLimit(oid(vendorId));
// }

// async function onCheckoutCompleted(session) {
//   if (session.mode !== "subscription" || session.payment_status !== "paid") return;
//   const vendorId = session.metadata?.vendorId;
//   if (!isId(vendorId)) return;

//   const sub = await stripe.subscriptions.retrieve(session.subscription);

//   // upsert: webhook duibar ashleo ekta-i transaction thakbe
//   await getDb()
//     .collection("transactions")
//     .updateOne(
//       { stripeSessionId: session.id },
//       {
//         $set: {
//           vendorId: oid(vendorId),
//           plan: "premium",
//           amount: session.amount_total,
//           currency: session.currency,
//           stripeSubscriptionId: session.subscription,
//           status: "paid",
//         },
//         $setOnInsert: { createdAt: new Date() },
//       },
//       { upsert: true },
//     );

//   await activatePremium(vendorId, periodEnd(sub));
// }

// async function onCheckoutExpired(session) {
//   const vendorId = session.metadata?.vendorId;
//   if (!isId(vendorId)) return;

//   await getDb()
//     .collection("transactions")
//     .updateOne(
//       { stripeSessionId: session.id },
//       {
//         $setOnInsert: {
//           vendorId: oid(vendorId),
//           plan: "premium",
//           amount: session.amount_total,
//           currency: session.currency,
//           stripeSubscriptionId: null,
//           status: "failed",
//           createdAt: new Date(),
//         },
//       },
//       { upsert: true },
//     );
// }

// // monthly renewal
// async function onInvoicePaid(invoice) {
//   const subId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
//   if (!subId || invoice.billing_reason !== "subscription_cycle") return;

//   const sub = await stripe.subscriptions.retrieve(subId);
//   const vendorId = sub.metadata?.vendorId;
//   if (isId(vendorId)) await activatePremium(vendorId, periodEnd(sub));
// }

// async function onSubscriptionUpdated(sub) {
//   const vendorId = sub.metadata?.vendorId;
//   if (!isId(vendorId)) return;

//   if (["active", "trialing"].includes(sub.status)) {
//     await activatePremium(vendorId, periodEnd(sub));
//   } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
//     await downgrade(vendorId);
//   }
// }

// async function onSubscriptionDeleted(sub) {
//   const vendorId = sub.metadata?.vendorId;
//   if (isId(vendorId)) await downgrade(vendorId);
// }

// // index.js e express.json() er AGE mount hoy, tai req.body raw Buffer
// export async function webhookHandler(req, res) {
//   let event;
//   try {
//     event = stripe.webhooks.constructEvent(
//       req.body,
//       req.headers["stripe-signature"],
//       process.env.STRIPE_WEBHOOK_SECRET,
//     );
//   } catch {
//     return res.status(400).send("Invalid signature");
//   }

//   try {
//     switch (event.type) {
//       case "checkout.session.completed":
//         await onCheckoutCompleted(event.data.object);
//         break;
//       case "checkout.session.expired":
//         await onCheckoutExpired(event.data.object);
//         break;
//       case "invoice.paid":
//         await onInvoicePaid(event.data.object);
//         break;
//       case "customer.subscription.updated":
//         await onSubscriptionUpdated(event.data.object);
//         break;
//       case "customer.subscription.deleted":
//         await onSubscriptionDeleted(event.data.object);
//         break;
//     }
//     res.json({ received: true });
//   } catch (err) {
//     console.error("Webhook error:", err);
//     res.status(500).send("Webhook handler failed"); // 500 dile Stripe abar try kore
//   }
// }

// export default router;


import { Router } from "express";
import Stripe from "stripe";
import { getDb } from "../config/db.js";
import { CURRENCY, PREMIUM_PRICE_CENTS } from "../config/constants.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { asyncHandler, httpError, isId, oid, str } from "../utils/helpers.js";
import { enforceFreeLimit } from "../utils/serviceOps.js";

const router = Router();

// Environment validation
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const clientUrl = process.env.CLIENT_URL;

if (!stripeSecret) {
  throw new Error("STRIPE_SECRET_KEY is missing in .env");
}

if (!webhookSecret) {
  console.warn("STRIPE_WEBHOOK_SECRET is missing. Webhook verification will fail.");
}

if (!clientUrl) {
  throw new Error("CLIENT_URL is missing in .env");
}

const stripe = new Stripe(stripeSecret);

const getClientUrl = () => {
  try {
    return new URL(clientUrl).origin;
  } catch {
    throw new Error("CLIENT_URL must be a valid URL");
  }
};

// ---------- Vendor Checkout ----------

router.post(
  "/checkout",
  verifyToken,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    if (req.user.isPremium) {
      throw httpError(409, "You are already on the Premium plan");
    }

    const meta = {
      vendorId: req.user.id,
      plan: "premium",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: req.user.id,
      customer_email: req.user.email,

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: PREMIUM_PRICE_CENTS,
            recurring: {
              interval: "month",
            },
            product_data: {
              name: "WedPlan Premium",
              description: "Unlimited services and Premium Vendor badge",
            },
          },
        },
      ],

      metadata: meta,

      subscription_data: {
        metadata: meta,
      },

      success_url: `${getClientUrl()}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getClientUrl()}/payment/cancel`,
    });

    res.json({
      success: true,
      url: session.url,
    });
  })
);

// ---------- Check Payment Session ----------

router.get(
  "/session/:id",
  verifyToken,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    const sessionId = str(req.params.id);

    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      throw httpError(400, "Invalid session ID");
    }

    const tx = await getDb()
      .collection("transactions")
      .findOne({
        stripeSessionId: sessionId,
        vendorId: oid(req.user.id),
      });

    if (!tx) {
      return res.json({ status: "pending" });
    }

    res.json({
      status: tx.status === "paid" ? "paid" : "failed",
      plan: tx.plan,
      amount: tx.amount,
      currency: tx.currency,
    });
  })
);

// ---------- Cancel Subscription ----------

router.post(
  "/cancel",
  verifyToken,
  requireRole("vendor"),
  asyncHandler(async (req, res) => {
    const tx = await getDb()
      .collection("transactions")
      .findOne(
        {
          vendorId: oid(req.user.id),
          status: "paid",
        },
        {
          sort: { createdAt: -1 },
        }
      );

    if (!req.user.isPremium || !tx?.stripeSubscriptionId) {
      throw httpError(400, "No active Premium subscription found");
    }

    await stripe.subscriptions.update(
      tx.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    res.json({
      success: true,
      message:
        "Your Premium plan will end at the end of the current billing period",
    });
  })
);

// ---------- Subscription Helpers ----------

const periodEnd = (sub) => {
  const timestamp =
    sub.current_period_end ??
    sub.items?.data?.[0]?.current_period_end;

  return timestamp ? new Date(timestamp * 1000) : null;
};

async function activatePremium(vendorId, expiresAt) {
  await getDb()
    .collection("user")
    .updateOne(
      { _id: oid(vendorId) },
      {
        $set: {
          subscriptionPlan: "premium",
          subscriptionExpiresAt: expiresAt,
        },
      }
    );
}

async function downgrade(vendorId) {
  await getDb()
    .collection("user")
    .updateOne(
      { _id: oid(vendorId) },
      {
        $set: {
          subscriptionPlan: "free",
          subscriptionExpiresAt: null,
        },
      }
    );

  await enforceFreeLimit(oid(vendorId));
}

// ---------- Webhook Events ----------

async function onCheckoutCompleted(session) {
  if (
    session.mode !== "subscription" ||
    session.payment_status !== "paid"
  ) {
    return;
  }

  const vendorId = session.metadata?.vendorId;

  if (!isId(vendorId)) return;

  const sub = await stripe.subscriptions.retrieve(
    session.subscription
  );

  await getDb()
    .collection("transactions")
    .updateOne(
      { stripeSessionId: session.id },
      {
        $set: {
          vendorId: oid(vendorId),
          plan: "premium",
          amount: session.amount_total,
          currency: session.currency,
          stripeSubscriptionId: session.subscription,
          status: "paid",
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

  await activatePremium(vendorId, periodEnd(sub));
}

async function onCheckoutExpired(session) {
  const vendorId = session.metadata?.vendorId;

  if (!isId(vendorId)) return;

  await getDb()
    .collection("transactions")
    .updateOne(
      { stripeSessionId: session.id },
      {
        $setOnInsert: {
          vendorId: oid(vendorId),
          plan: "premium",
          amount: session.amount_total,
          currency: session.currency,
          stripeSubscriptionId: null,
          status: "failed",
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
}

async function onInvoicePaid(invoice) {
  const subscriptionId =
    invoice.subscription ??
    invoice.parent?.subscription_details?.subscription;

  if (!subscriptionId) return;

  if (invoice.billing_reason !== "subscription_cycle") return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const vendorId = sub.metadata?.vendorId;

  if (isId(vendorId)) {
    await activatePremium(vendorId, periodEnd(sub));
  }
}

async function onSubscriptionUpdated(sub) {
  const vendorId = sub.metadata?.vendorId;

  if (!isId(vendorId)) return;

  if (["active", "trialing"].includes(sub.status)) {
    await activatePremium(vendorId, periodEnd(sub));
  } else if (
    ["canceled", "unpaid", "incomplete_expired"].includes(sub.status)
  ) {
    await downgrade(vendorId);
  }
}

async function onSubscriptionDeleted(sub) {
  const vendorId = sub.metadata?.vendorId;

  if (isId(vendorId)) {
    await downgrade(vendorId);
  }
}

// ---------- Stripe Webhook Handler ----------

export async function webhookHandler(req, res) {
  if (!webhookSecret) {
    return res.status(500).send("Stripe webhook secret is not configured");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe signature error:", error.message);

    return res.status(400).send("Invalid Stripe webhook signature");
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object);
        break;

      case "checkout.session.expired":
        await onCheckoutExpired(event.data.object);
        break;

      case "invoice.paid":
        await onInvoicePaid(event.data.object);
        break;

      case "customer.subscription.updated":
        await onSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object);
        break;

      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);

    res.status(500).send("Webhook handler failed");
  }
}

export default router;
