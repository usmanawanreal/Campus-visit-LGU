# Find My Class — Backend

Node.js **(ESM)** + **Express** + **MongoDB** (Mongoose) REST API for buildings, classrooms, auth, optional routing **nodes/edges**, and **navigation** (floor plans, corridors, doors, server-side pathfinding).

**Full documentation (tech stack, routing, env, API, troubleshooting):** see the repository root [**`../README.md`**](../README.md).

## Quick setup

```bash
npm install
cp .env.example .env
# Required: MONGODB_URI, JWT_SECRET
# Optional: PORT — must match frontend Vite proxy target (see ../README.md)
npm run dev
```

## Useful commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Watch mode (`node --watch server.js`) |
| `npm start` | Single run |
| `npm test` | Unit tests (corridor graph, path geometry, routing merge, doors, cross-floor penalty, …) |

## Notable directories

- **`controllers/`** — HTTP handlers (`navigationController`, `navigationLocationController`, …).  
- **`services/`** — Pathfinding, corridor graph (`pathfindingService`, `corridorWalkGraph`).  
- **`utils/`** — Route merging, footprint snapping, corridor connectivity, cross-floor waypoint helpers, tests alongside.  
- **`graph/`** — Optional static adjacency merged with DB **edges** for node-based routing.
