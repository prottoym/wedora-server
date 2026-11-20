# 💍 Wedora – Wedding Planning Platform (Backend)

<p align="center">
  <b>A RESTful API for managing wedding services, bookings, vendors, and subscriptions.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe" />
</p>

<p align="center">
  <a href="https://wedora-server-beta.vercel.app/">Live API</a> •
  <a href="https://github.com/prottoym/wedora-server">GitHub Repository</a>
</p>

---

## 📖 About the Project

**Wedora** is a wedding planning platform designed to simplify the process of finding and managing wedding-related services.

The backend provides RESTful APIs for customers, vendors, and administrators. It handles service management, booking requests, user authentication, administrative operations, and vendor subscription payments.

The platform connects customers with wedding service providers through a centralized system.

## ✨ Key Features

### 👤 Customer
- Browse available wedding services.
- Search and filter services by category and location.
- View detailed service information.
- Submit wedding booking requests.
- View personal booking history.
- Track and cancel eligible pending bookings.

### 🏢 Vendor
- Manage vendor services.
- Create, update, and delete services.
- View vendor dashboard statistics.
- Manage service information and pricing.
- Access subscription features.
- Manage bookings related to their services.

### 🛡️ Admin
- View platform statistics.
- Manage customer and vendor accounts.
- Search and inspect users.
- Block or unblock users.
- Review submitted services.
- Approve or reject services.
- Manage service listings.
- View platform transactions.

### 💳 Payment & Subscription
- Stripe payment integration.
- Premium subscription checkout.
- Subscription status verification.
- Subscription cancellation.
- Stripe webhook event handling.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript Runtime |
| Express.js | Backend Framework |
| MongoDB | NoSQL Database |
| MongoDB Node.js Driver | Database Operations |
| Better Auth JWT / jose | Token Verification |
| Zod | Data Validation |
| Stripe | Payment & Subscription Management |
| CORS | Cross-Origin Resource Sharing |
| Helmet | HTTP Security Headers |
| dotenv | Environment Configuration |

## 📂 Project Structure

```text
wedora-server/
│
├── config/
│   ├── constants.js
│   └── db.js
│
├── middleware/
│   └── auth.js
│
├── routes/
│   ├── services.js
│   ├── vendor.js
│   ├── bookings.js
│   ├── admin.js
│   └── payments.js
│
├── scripts/
│
├── utils/
│
├── index.js
├── package.json
├── package-lock.json
└── .gitignore
```

## ⚙️ Installation & Setup

Follow these steps to run the backend locally.

### 1. Clone the Repository

```bash
git clone https://github.com/prottoym/wedora-server.git
```

### 2. Navigate to the Project Directory

```bash
cd wedora-server
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory and add the following configuration:

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string
DB_NAME=wedora

CLIENT_URL=http://localhost:3000

STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_signing_secret
```

**Important:** Replace the placeholder values with your actual credentials. Never upload your `.env` file or expose API keys and database credentials publicly.

### 5. Start the Server

```bash
node index.js
```

For development with Nodemon:

```bash
npx nodemon index.js
```

The local API will be available at:

```text
http://localhost:5000
```

## 🔗 API Endpoints

**Base URL:**

```text
https://wedora-server-beta.vercel.app
```

### General

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | API health check |
| GET | `/api/me` | Get authenticated user information |

### Public Services

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/services` | Get available services |
| GET | `/api/services/:id` | Get service details |

### Vendor

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/vendor/stats` | Get vendor dashboard statistics |
| GET | `/api/vendor/services` | Get vendor services |
| GET | `/api/vendor/services/:id` | Get a specific vendor service |
| POST | `/api/vendor/services` | Create a service |
| PATCH | `/api/vendor/services/:id` | Update a service |
| DELETE | `/api/vendor/services/:id` | Delete a service |

### Customer Bookings

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/bookings` | Create a booking |
| GET | `/api/bookings/mine` | Get customer bookings |
| GET | `/api/bookings/stats` | Get booking statistics |
| PATCH | `/api/bookings/:id/cancel` | Cancel an eligible booking |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stats` | Get platform statistics |
| GET | `/api/admin/users` | Get and search users |
| GET | `/api/admin/users/:id` | Get user details |
| PATCH | `/api/admin/users/:id/block` | Block or unblock a user |
| GET | `/api/admin/services` | Get and filter services |
| PATCH | `/api/admin/services/:id/status` | Update service status |
| DELETE | `/api/admin/services/:id` | Delete a service |
| GET | `/api/admin/transactions` | Get transactions |

### Payments

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/payments/checkout` | Create subscription checkout |
| GET | `/api/payments/session/:id` | Verify checkout session |
| POST | `/api/payments/cancel` | Cancel subscription |
| POST | `/api/payments/webhook` | Handle Stripe webhook events |

**Authentication:** Protected endpoints require a valid Bearer token and the appropriate user role.

## 💒 Wedding Service Categories

Wedora supports the following wedding service categories:

1. Photography & Videography
2. Wedding Venues
3. Decoration & Florist
4. Catering Services
5. Makeup & Styling
6. Wedding Fashion

## 🔐 Security

The backend implements several security measures:

- Role-Based Access Control (RBAC).
- Token verification for protected endpoints.
- Request validation using Zod.
- Secure HTTP headers with Helmet.
- CORS configuration.
- Stripe webhook signature verification.
- Environment-based secret management.

## 🚀 Deployment

The backend is deployed using **Vercel**.

**Live API:**  
https://wedora-server-beta.vercel.app/

For deployment, configure all required environment variables in your hosting provider's project settings.

### Stripe Webhook Configuration

Configure the following endpoint in your Stripe Dashboard:

```text
https://wedora-server-beta.vercel.app/api/payments/webhook
```

Add the webhook signing secret to your deployment environment variables:

```env
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_signing_secret
```

This allows the backend to verify incoming Stripe webhook events.

## 👨‍💻 Developer

**Prottoy Modak**

---

<p align="center">
  <b>Wedora – Making Wedding Planning Easier 💍</b>
</p>
