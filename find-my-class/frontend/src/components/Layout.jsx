import { Outlet } from 'react-router-dom';
import Nav from './Nav.jsx';
import SiteFooter from './SiteFooter.jsx';

export default function Layout() {
  return (
    <div className="layout">
      <Nav />
      <main className="main flex-1 w-full">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
