# LeakLens — Smart Water Leakage Intelligence Platform (MERN JavaScript Architecture)

An enterprise smart water leakage detection, risk scoring, hotspot matrix visualization, and multi-user incident tracking platform designed for campus hostels and residential communities.

Refactored from TypeScript into a clean, modern **JavaScript (ESM)** full-stack architecture with separated `frontend/` and `backend/` tiers.

---

## Architecture Overview

```text
LeakLens/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/            # Static images and icons
│   │   ├── components/        # Modals, tables, maps, portals & layout
│   │   ├── pages/             # Page export descriptors
│   │   ├── services/          # REST API client & client-side water math
│   │   ├── models/            # Domain descriptors & constants
│   │   ├── types/             # Runtime constants
│   │   ├── App.jsx            # Main root application shell & portal switcher
│   │   ├── main.jsx           # React 19 entry point
│   │   └── index.css          # Tailwind CSS v4 styling & navy theme
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── config/                # Environment, DB & auth configuration
│   ├── controllers/           # Auth, Leaks, Buildings, Admin & Analytics
│   ├── middleware/            # JWT authentication & role-based RBAC
│   ├── models/                # Mongoose models (User, Building, LeakReport, etc.)
│   ├── routes/                # Express REST endpoint routers
│   ├── services/              # Water loss math & reactive seed store
│   ├── utils/                 # Document normalization & formatters
│   ├── tests/                 # Full automated test suite (unit + integration)
│   ├── server.js              # Express REST API & Vite integration server
│   ├── package.json
│   └── .env.example
│
├── .gitignore
├── README.md
└── package.json
```

---

## Portals & Roles

1. **Resident Portal**
   - Individual resident self-registration with campus building and room assignment.
   - Secure bcrypt password hashing.
   - Real-time leak reporting with photo evidence upload and duplicate detection.
   - Strict resource isolation: Residents can only access their own reported complaints.

2. **Maintenance Portal**
   - Restricted technician gateway (public registration disabled; accounts provisioned by Estate Admin).
   - Filtered work queue showing only assigned work orders.
   - Status updates (In Progress, Resolved), repair notes, parts replaced, and after-repair photo uploads.

3. **Admin Portal**
   - Campus estate officer operations dashboard.
   - Full incident review, technician dispatching, and SLA management.
   - Campus building hotspot risk matrix and water loss analytics.
   - User provisioning and immutable audit timeline.

---

## Running the Application

### Option A: Unified Full-Stack (Single Command - Port 3000)
Runs the Express REST API and mounts Vite dev middleware together on port 3000:
```bash
npm install
npm run dev
```

### Option B: Separate Frontend and Backend Services

1. **Backend Service (Port 5000):**
```bash
cd backend
npm install
npm run dev
```

2. **Frontend Service (Port 5173 with API Proxy):**
```bash
cd frontend
npm install
npm run dev
```

---

## Testing

Run the automated test suite verifying password security, JWT RBAC, hydraulic flow math, duplicate detection, and REST endpoints:
```bash
npm test
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
# JWT signing secret
JWT_SECRET=your_strong_random_jwt_secret

# Estate Administrator Bootstrap Credentials
ADMIN_EMAIL=admin@leaklens.internal
ADMIN_PASSWORD=Admin@LeakLens2026!
ADMIN_NAME=Estate General Manager
ADMIN_PHONE=+91 99000 11223

# Database & Runtime
MONGODB_URI=mongodb://127.0.0.1:27017/leaklens
PORT=3000
```
