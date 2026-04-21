# Find My Class — Frontend

**React 18** + **Vite 5** + **React Router 6** + **Axios**. Indoor maps use **Leaflet** with **react-leaflet** (`CRS.Simple` + image overlays) in `src/components/CampusImageMap.jsx`.

**Complete project guide (architecture, API, corridor routing, env, ports):** see the repository root [**`../README.md`**](../README.md).

## Quick setup

```bash
npm install
npm run dev
```

Default dev URL: **http://localhost:5174** (see `vite.config.js`).  
`/api` is proxied to the backend — **the proxy `target` port must match** `PORT` in `backend/.env`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server + HMR |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Local preview of production build |

## Important paths

| Path | Purpose |
|------|---------|
| `src/data/campusMaps.js` | Floor `mapId`s, PNG URLs, normalized coordinate ranges |
| `public/assets/maps/` | Floor plan PNG assets |
| `src/pages/MapPage.jsx` | Map UI, routing, admin drawing tools |
| `src/services/` | API clients (`api.js` adds `Authorization` from `localStorage`) |
| `src/context/AuthContext.jsx` | Admin session state |
