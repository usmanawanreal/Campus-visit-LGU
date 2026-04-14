import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="container">
      <section className="hero">
        <h1>Find My Class</h1>
        <p className="hero-sub">Find classrooms, view the campus map, and manage content as admin.</p>
        <div className="hero-actions">
          <Link to="/search" className="btn btn-primary">Search Classroom</Link>
          <Link to="/map" className="btn btn-ghost">Map</Link>
          <Link to="/admin/login" className="btn btn-ghost">Admin Login</Link>
        </div>
      </section>
      <div className="home-cards">
        <Link to="/search" className="card home-card">
          <h3>Search Classroom</h3>
          <p>Search by room number to find a classroom and its location.</p>
        </Link>
        <Link to="/map" className="card home-card">
          <h3>Map</h3>
          <p>View the campus map and wayfinding.</p>
        </Link>
        <Link to="/admin/login" className="card home-card">
          <h3>Admin</h3>
          <p>Log in to manage buildings, classrooms, and routes.</p>
        </Link>
      </div>
    </div>
  );
}
