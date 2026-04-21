# Find My Class — Campus navigation & classroom finder

A full-stack web application for **searching classrooms**, **browsing buildings**, and **indoor wayfinding** on large campus floor plans. Admins maintain buildings, rooms, optional graph nodes/edges, and rich **navigation locations** (rooms, doors, corridor polylines). Students and visitors use **Search** and an interactive **Map** with corridor-based routing and multi-floor guidance.

---

## Table of contents

1. [High-level architecture](#high-level-architecture)  
2. [Tech stack](#tech-stack)  
3. [Repository layout](#repository-layout)  
4. [How the system works](#how-the-system-works)  
5. [Prerequisites](#prerequisites)  
6. [Environment variables](#environment-variables)  
7. [Installation & local run](#installation--local-run)  
8. [Ports & Vite proxy](#ports--vite-proxy)  
9. [Data model overview](#data-model-overview)  
10. [Indoor routing (corridors, doors, floors)](#indoor-routing-corridors-doors-floors)  
11. [Map page (user + admin)](#map-page-user--admin)  
12. [REST API reference](#rest-api-reference)  
13. [Scripts (seed, tests)](#scripts-seed-tests)  
14. [Adding or changing floor plan images](#adding-or-changing-floor-plan-images)  
15. [Troubleshooting](#troubleshooting)  
16. [Security & production notes](#security--production-notes)

---

## High-level architecture

```text
Browser (React SPA)
    │
    │  HTTP  /api/*  (dev: Vite proxy → backend)
    ▼
Express REST API (Node.js, ESM)
    │
    ├── JWT auth (admin routes)
    └── MongoDB (Mongoose) — buildings, classrooms, users, graph, navigation locations
```

- **Frontend**: Single Page Application (SPA). Public pages use read-mostly APIs; **admin** actions send `Authorization: Bearer <token>`.
- **Backend**: Stateless API; **MongoDB** is the source of truth. Pathfinding runs **on the server** so clients cannot tamper with graph logic.

---

## Tech stack

| Layer | Technology | Role |
|--------|------------|------|
| **UI** | React 18 | Components, hooks, client state |
| **Routing (UI)** | React Router 6 | `/`, `/search`, `/map`, `/admin/login`, `/admin/dashboard` |
| **Build** | Vite 5 | Dev server, HMR, production bundle |
| **HTTP client** | Axios | Base URL `/api`, JWT on requests from `localStorage` |
| **Maps** | Leaflet + react-leaflet | `CRS.Simple` image overlays for floor PNGs; markers, polylines, popups |
| **API** | Express 4 | JSON REST, CORS, centralized error handler |
| **Runtime** | Node.js 20+ (recommended) | ESM (`"type": "module"`) |
| **ODM** | Mongoose 8 | Schemas, validation, queries |
| **Database** | MongoDB | Atlas or self-hosted |
| **Auth** | bcrypt + jsonwebtoken | Password hashing; signed JWT for admins |

**Pathfinding implementation** (server-side, plain JavaScript): corridor polylines → undirected walk graph → **A\*** shortest path; optional geometric checks so paths stay near drawn segments; separate utilities for doors, footprints, cross-floor waypoint scoring.

---

## Repository layout

```text
find-my-class/
├── README.md                 ← This file (project overview)
├── backend/
│   ├── server.js             Express app entry, routes mount, listen
│   ├── config/               DB connection
│   ├── controllers/          Route handlers (business logic orchestration)
│   ├── middleware/           auth, validation, errors
│   ├── models/               Mongoose schemas
│   ├── routes/               Express routers → controllers
│   ├── services/             pathfinding, corridor graph build
│   ├── utils/                merge legs, geometry, connectivity tests
│   ├── scripts/              Optional seed / cleanup scripts
│   └── package.json
└── frontend/
    ├── index.html
    ├── vite.config.js        Dev server + `/api` proxy
    ├── public/assets/maps/   Floor PNGs (large images)
    └── src/
        ├── App.jsx           Route table
        ├── context/          AuthContext (token + user)
        ├── components/       Layout, CampusImageMap, popups, etc.
        ├── data/campusMaps.js  Map ids, image URLs, floor ↔ mapId helpers
        ├── pages/            Home, Search, Map, Admin
        ├── services/         axios wrappers per domain
        └── index.css         Global + map layout styles
```

---

## How the system works

### Public experience

1. **Home** — Entry and navigation into the app.  
2. **Search Classroom** — Queries classrooms (by number/name depending on API usage).  
3. **Map** — Pick a **campus / floor** image, filter by building/floor, optionally show **pins & orange corridor guides**, then **Draw route** between two saved **navigation locations**. The blue polyline is computed on the server from **corridor geometry** when corridors exist on that map.

### Admin experience

1. **Admin Login** — Email/password → JWT stored in `localStorage`.  
2. **Admin Dashboard** — CRUD for **buildings**, **classrooms**, **routing nodes**, **edges**, **legacy locations**, and bulk view of **navigation locations**.  
3. **Map page (while logged in)** — Same map UI plus tools to **add/edit** navigation points, **doors**, **corridor polylines**, **room footprints**, and **routing nodes/edges** without leaving the map. Pin popups allow **quick rename** of a location when admin is logged in.

### Auth flow

- `POST /api/auth/login` returns `{ user, token }`.  
- Frontend stores token and sends `Authorization: Bearer <token>` on protected requests.  
- **Navigation location** create/update/delete require admin (`protectAdmin` middleware).

---

## Prerequisites

- **Node.js** 18+ (20 LTS recommended)  
- **npm** (bundled with Node)  
- **MongoDB** reachable via URI (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))

---

## Environment variables

Create **`backend/.env`** from **`backend/.env.example`**:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | Mongo connection string (e.g. `mongodb://localhost:27017/find-my-class`) |
| `JWT_SECRET` | Yes | Long random string used to sign JWTs (server refuses to start if missing) |
| `PORT` | No | API port (default **5000** in code; see [Ports & Vite proxy](#ports--vite-proxy)) |
| `NODE_ENV` | No | `development` / `production` |
| `CORS_ORIGIN` | No | Comma-separated allowed browser origins (defaults include localhost Vite ports) |

Never commit real `.env` files or secrets.

---

## Installation & local run

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: MONGODB_URI, JWT_SECRET, and optionally PORT (must match Vite proxy)
npm install
npm run dev
```

Health check: `GET http://localhost:<PORT>/api/health` → `{ "status": "ok", ... }`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (default **http://localhost:5174** per `vite.config.js`).

### 3. First-time data

Use **Admin Dashboard** to create **buildings** and **classrooms**, or run optional **seed scripts** in `backend/scripts/` (see [Scripts](#scripts-seed-tests)).

---

## Ports & Vite proxy

- **`frontend/vite.config.js`** proxies **`/api`** to **`http://localhost:7000`** by default.  
- **`backend/server.js`** uses **`PORT`** from env, or **5000** if unset.

**You must align them:** either set `PORT=7000` in `backend/.env`, **or** change the Vite `proxy.target` to match your backend port (e.g. `5000`). If they differ, the browser will get connection errors when calling `/api`.

The dev frontend is configured to use **port 5174** (`server.port` in Vite). CORS in the backend already allows `5173` and `5174` by default; add more origins via `CORS_ORIGIN` if needed.

---

## Data model overview

| Model | Purpose |
|--------|---------|
| **User** | Admin accounts (login). |
| **Building** | Campus buildings, optional floor count metadata. |
| **Classroom** | Room records linked to buildings (search / listings). |
| **Location** | Legacy/simple location records used by some flows. |
| **Node / Edge** | Optional **graph** for pathfinding (hallway, stairs, elevator, etc.) when not using corridor-only mode. |
| **NavigationLocation** | Primary map content: **`point`** (rooms/landmarks), **`door`** (threshold pins, optional link to a room), **`corridor`** (polyline through hallways). Unique index on **`mapId` + `floor` + `name`** — names must not collide on the same floor image. |

Coordinates for navigation are stored in a **normalized** 0–1000 (or configured max) space; the frontend maps them onto each PNG using `campusMaps.js` width/height and `coordinateMaxX` / `coordinateMaxY`.

---

## Indoor routing (corridors, doors, floors)

### Same floor / same `mapId`

1. Server loads **corridor** documents for that `mapId`.  
2. Builds a **walk graph** from polyline vertices (chain edges, coincident merges, controlled cross-chain links).  
3. Snaps start/end using **footprints** or door/room coordinates.  
4. Runs **A\***; may reject paths that deviate too far from saved segments (anti–“cut through walls”).  
5. Returns a **path** and **segments** (each segment has `mapId`, `points`, etc.).

### Doors

Doors can link to a **room** (`linksToLocation`). Routing may start or end at the **door pin** when configured, so the line meets the doorway instead of only the room centroid.

### Cross-floor (different `mapId`, same building)

- Requires **transition points** on each floor (e.g. stair landings) saved as **navigation points** on the correct `mapId` for that building.  
- Server evaluates pairs of waypoints and picks a feasible pair; **stair-like names** are preferred over arbitrary rooms when scores tie.  
- Response **`meta`** includes **`crossMap`**, **`transitionWaypoints`**, **`multiFloorRouteHints`** (step-by-step text including **Next Pic**), and segment list for the UI to switch floor images.

### Corridor health

`GET /api/navigation/corridor-health?mapId=<id>` — reports whether saved corridor polylines form one connected component under the same graph rules as routing.

---

## Map page (user + admin)

- **Floor selector** — Switches PNG and `mapId` (see `src/data/campusMaps.js`).  
- **Filters** — Building and floor narrow the location list.  
- **Route** — Start + destination dropdowns (and search), **Draw Route**, optional **corridor connection check**.  
- **Multi-segment routes** — Sidebar and on-map **Next Pic** / **Prev Pic** step through segments and sync the floor image.  
- **Overlays** — Toggle pins, footprints, corridors; admin drawing modes for new geometry.  
- **Admin rename** — Logged-in admins can edit a location’s **name** from the pin popup (**Save name**).

---

## REST API reference

Base path: **`/api`**. Unless noted, bodies are JSON.

### Health

| Method | Path | Auth | Description |
|--------|------|------|---------------|
| GET | `/api/health` | No | Liveness |

### Auth

| Method | Path | Auth | Description |
|--------|------|------|---------------|
| POST | `/api/auth/login` | No | Admin login → JWT |
| POST | `/api/auth/register` | Varies | If enabled in your deployment |

### Buildings & classrooms

| Method | Path | Auth | Description |
|--------|------|------|---------------|
| GET/POST | `/api/buildings` | Mixed | List / create |
| GET/PUT/DELETE | `/api/buildings/:id` | Mixed | CRUD |
| GET/POST | `/api/classrooms` | Mixed | List / create |
| GET/PUT/DELETE | `/api/classrooms/:id` | Mixed | CRUD |

### Search

| Method | Path | Auth | Description |
|--------|------|------|---------------|
| GET | `/api/search/classrooms?q=` | No | Search classrooms |
| GET | `/api/search/buildings?q=` | No | Search buildings |

### Legacy routes & graph (optional pathfinding graph)

| Method | Path | Auth | Description |
|--------|------|------|---------------|
| GET/POST | `/api/routes` | Mixed | Route records |
| GET/PUT/DELETE | `/api/routes/:id` | Mixed | CRUD |
| GET/POST | `/api/nodes` | Admin create | Routing nodes |
| GET/PUT/DELETE | `/api/nodes/:id` | Admin | CRUD |
| GET/POST | `/api/edges` | Admin create | Edges between nodes |
| GET/PUT/DELETE | `/api/edges/:id` | Admin | CRUD |

### Locations (legacy model)

| Method | Path | Auth | Description |
|--------|------|------|---------------|
| GET/POST | `/api/locations` | Mixed | List / create |
| GET/PUT/DELETE | `/api/locations/:id` | Mixed | CRUD |

### Navigation (floor plans, corridors, doors)

| Method | Path | Auth | Description |
|--------|------|------|---------------|
| GET | `/api/navigation/locations` | No | Query params: `mapId`, `building`, `floor` — list navigation locations |
| POST | `/api/navigation/locations` | **Admin** | Create point / door / corridor |
| PUT | `/api/navigation/locations/:id` | **Admin** | Update (full payload: name, kind, mapId, floor, x, y, arrays, door link) |
| DELETE | `/api/navigation/locations/:id` | **Admin** | Delete |
| GET | `/api/navigation/route?start=&end=&mapId=` | No | Shortest/indoor route: `path`, `segments`, rich `meta` |
| GET | `/api/navigation/corridor-health?mapId=` | No | Connectivity report for corridors on that map |

---

## Scripts (seed, tests)

### Backend (`cd backend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | `node --watch server.js` — auto-restart on file changes |
| `npm start` | Production-style single run |
| `npm test` | Node’s built-in test runner on `*.test.js` (corridor graph, geometry, routing merge, doors, connectivity, cross-floor penalty, …) |
| `npm run seed:map` | See `scripts/seedNavigationData.js` |
| `npm run seed:navigation-locations` | See `scripts/seedNavigationLocations.js` |
| `npm run cleanup:test-navigation-locations` | Cleanup utility |

### Frontend (`cd frontend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |

---

## Adding or changing floor plan images

1. Add PNG files under **`frontend/public/assets/maps/`**.  
2. Edit **`frontend/src/data/campusMaps.js`**: new entry with **`id`**, **`label`**, **`imageUrl`** (via `mapAsset('filename.png')`), **`width` / `height`** (pixel size of the PNG), and **`coordinateMaxX` / `coordinateMaxY`** (normalized coordinate range used in DB).  
3. If the map is a **dedicated floor** of a building, add its `id` to **`FLOOR_PLAN_MAP_IDS`** and wire **`floorNumberToMapId` / `mapIdToFloorFilterValue`** so filters and floor sync behave correctly.  
4. Re-seed or create **navigation locations** for that `mapId` in Admin / Map tools.

---

## Troubleshooting

| Symptom | Things to check |
|--------|------------------|
| `Failed to fetch` / network errors on `/api` | Backend running? **Vite proxy port** = backend **`PORT`**? |
| `JWT_SECRET is not set` | Add `JWT_SECRET` to `backend/.env` and restart |
| Mongo connection errors | `MONGODB_URI`, IP allowlist (Atlas), VPN |
| Route returns 404 / “corridor” messages | Corridors saved on **same `mapId`** as rooms? Polylines **connected**? Use **corridor-health** |
| Cross-floor route fails | Same **building** on both pins? Transition **points** on **each** `mapId`? |
| Duplicate name on save | Unique **`mapId` + `floor` + `name`** — pick a different name or fix floor field |
| Blue line cuts through rooms | Corridor graph / snap scoring; see backend `footprintRouting` and `corridorWalkGraph` |

---

## Security & production notes

- Use a **strong `JWT_SECRET`** and **HTTPS** in production.  
- Restrict **CORS** to your real front-end origin(s).  
- Do not expose **MongoDB credentials** in client code or public repos.  
- Rate-limit and validate auth on admin routes (already using middleware; consider extra hardening for public deployments).  
- Large floor PNGs: serve via CDN or static hosting; tune cache headers.

---

## License / ownership

Set as appropriate for your institution (not specified in this template).

---

## Contributing

1. Keep **backend `PORT`** and **Vite proxy** in sync locally.  
2. Run **`npm test`** in `backend` after changing routing or graph logic.  
3. Match existing code style; avoid unrelated refactors in the same change.

For deeper frontend-only notes, see **`frontend/README.md`**. For API-only notes, see **`backend/README.md`** (if present).
