# Find My Class

MERN stack application for campus classroom search, building management, and route/direction information.

## Structure

```
find-my-class/
  backend/    # Node.js + Express + MongoDB REST API
  frontend/   # React (Vite) + Axios
```

## Features

- **Classroom search** — Search by name or code
- **Building management** — List buildings, view details, manage via Admin
- **Route/path information** — Directions between buildings
- **Admin panel** — CRUD for buildings, classrooms, routes
- **Student UI** — Search, browse buildings/classrooms, view routes
- **Map placeholder** — Route visualization in the web app

## Quick start

### 1. Backend (port 5000)

```bash
cd backend
cp .env.example .env
# Edit .env: set MONGODB_URI (e.g. mongodb://localhost:27017/find-my-class) and JWT_SECRET
npm install
npm run dev
```

API runs at **http://localhost:5000**. CORS is enabled for the frontend origin(s).

### 2. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173** (Vite may use 5174 if 5173 is in use). All `/api` requests are proxied to the backend at port 5000.

### 3. MongoDB

Ensure MongoDB is running locally or set `MONGODB_URI` in `backend/.env` to your connection string.

### 4. Test classroom search

1. Open **http://localhost:5173** in a browser.
2. Go to **Search Classroom** (or **Map** for search + map).
3. Enter a room number (e.g. `101`) and click **Search** (or use the search box on the Map page).
4. The app calls `GET /api/classrooms/:roomNumber` via the proxy; results come from the backend. If no classrooms exist yet, add buildings and classrooms from **Admin Login** → **Admin Dashboard**.

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET/POST | /api/buildings | List / create buildings |
| GET/PUT/DELETE | /api/buildings/:id | Get / update / delete building |
| GET/POST | /api/classrooms | List / create classrooms |
| GET/PUT/DELETE | /api/classrooms/:id | Get / update / delete classroom |
| GET/POST | /api/routes | List / create routes |
| GET/PUT/DELETE | /api/routes/:id | Get / update / delete route |
| GET | /api/search/classrooms?q= | Search classrooms |
| GET | /api/search/buildings?q= | Search buildings |
