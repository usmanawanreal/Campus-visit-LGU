import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import SearchClassroom from './pages/SearchClassroom.jsx';
import MapPage from './pages/MapPage.jsx';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<SearchClassroom />} />
        <Route path="map" element={<MapPage />} />
        <Route path="login" element={<Login />} />
        <Route path="admin">
          <Route path="login" element={<Navigate to="/login" replace />} />
          <Route path="dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
