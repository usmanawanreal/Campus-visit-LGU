# Find My Class — Backend

Node.js + Express + MongoDB REST API.

## Navigation graph (file + database)

- **`graph/navigationAdjacency.config.js`** — manual adjacency list (`RAW_ADJACENCY`) keyed by `mapId|nodeName`. Merged at runtime with edges from the **`Edge`** collection for pathfinding.
- **`graph/buildAdjacencyFromConfig.js`** — resolves config keys to MongoDB node ids and Euclidean edge weights.

## Structure

```
backend/
  graph/
    navigationAdjacency.config.js
    buildAdjacencyFromConfig.js
  config/
    db.js              # MongoDB connection (mongoose)
  controllers/
    buildingController.js
    classroomController.js
    routeController.js
    searchController.js
  models/
    Building.js
    Classroom.js
    Route.js
    User.js
  routes/
    buildings.js
    classrooms.js
    routes.js
    search.js
  middleware/
    notFound.js
    errorHandler.js
  server.js
  .env.example
  package.json
```

## Setup

```bash
npm install
cp .env.example .env
# Edit .env: set MONGODB_URI, and JWT_SECRET (required for register/login — any long random string locally)
# Optional: PORT (default 5000)
```

## Scripts

- `npm start` — Run server (port 5000 by default)
- `npm run dev` — Run with watch mode

## Environment variables (dotenv)

- `PORT` — Server port (default: 5000)
- `MONGODB_URI` — MongoDB connection string (e.g. `mongodb://localhost:27017/find-my-class`)
- `JWT_SECRET` — **Required.** Secret string used to sign auth tokens (use a long random value; never commit real secrets)
- `NODE_ENV` — Optional: `development` / `production`
