import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Home' },
  { to: '/search', label: 'Search Classroom' },
  { to: '/map', label: 'Map' },
  { to: '/admin/login', label: 'Admin Login' },
  { to: '/admin/dashboard', label: 'Admin Dashboard' }
];

export default function Nav() {
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <NavLink to="/" className="nav-brand">
          Find My Class
        </NavLink>
        <ul className="nav-links">
          {links.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
