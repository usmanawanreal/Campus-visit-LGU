# Find My Class — Frontend

React (Vite) + React Router + Axios. Modern UI with dark theme.

## Setup

```bash
npm install
npm run dev
```

Runs at http://localhost:3000. API calls are proxied to the backend (see `vite.config.js`).

## Scripts

- `npm run dev` — Development server
- `npm run build` — Production build
- `npm run preview` — Preview production build

## Structure

```
frontend/
  public/
    favicon.svg
  src/
    api/
      client.js      # Axios instance
      services.js    # API methods
    components/
      Layout.jsx
      Nav.jsx
    pages/
      Home.jsx
      Search.jsx
      Buildings.jsx
      BuildingDetail.jsx
      Classrooms.jsx
      ClassroomDetail.jsx
      RoutesPage.jsx
      RouteDetail.jsx
      MapPage.jsx          # Route search and map placeholder
      Admin.jsx
    App.jsx
    main.jsx
    index.css
  index.html
  vite.config.js
  package.json
```
