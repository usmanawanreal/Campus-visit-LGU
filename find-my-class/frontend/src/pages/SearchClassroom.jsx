import { useState } from 'react';
import * as classroomService from '../services/classroomService.js';

export default function SearchClassroom() {
  const [roomNumber, setRoomNumber] = useState('');
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = roomNumber.trim();
    if (!trimmed) {
      setError('Enter a classroom number');
      setClassroom(null);
      return;
    }
    setError('');
    setClassroom(null);
    setLoading(true);
    try {
      const { data } = await classroomService.getByRoomNumber(trimmed);
      setClassroom(data);
    } catch (err) {
      setClassroom(null);
      setError(err.response?.status === 404 ? 'Classroom not found.' : err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container search-classroom-page">
      <header className="search-classroom-header">
        <h1>Search Classroom</h1>
        <p className="muted">Enter a classroom number and click Search to find building, floor, and location.</p>
      </header>

      <form onSubmit={handleSearch} className="search-classroom-form card">
        <div className="search-classroom-row">
          <label htmlFor="room-number" className="label">Classroom number</label>
          <input
            id="room-number"
            type="text"
            className="input search-classroom-input"
            placeholder="e.g. 101, 202-A"
            value={roomNumber}
            onChange={(e) => {
              setRoomNumber(e.target.value);
              setError('');
            }}
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary search-classroom-btn"
            disabled={loading}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {error && <p className="search-classroom-error">{error}</p>}
      </form>

      {classroom && (
        <section className="search-classroom-result card" aria-live="polite">
          <h2>Classroom details</h2>
          <dl className="search-classroom-dl">
            <div className="search-classroom-row-detail">
              <dt>Room number</dt>
              <dd>{classroom.roomNumber}</dd>
            </div>
            <div className="search-classroom-row-detail">
              <dt>Building</dt>
              <dd>{classroom.buildingId?.name ?? '—'}</dd>
            </div>
            <div className="search-classroom-row-detail">
              <dt>Floor</dt>
              <dd>{classroom.floor ?? '—'}</dd>
            </div>
            <div className="search-classroom-row-detail">
              <dt>Location</dt>
              <dd>
                {classroom.coordinates?.x != null && classroom.coordinates?.y != null
                  ? `Coordinates (x, y): ${classroom.coordinates.x}, ${classroom.coordinates.y}`
                  : classroom.buildingId
                    ? `${classroom.buildingId.name}, Floor ${classroom.floor}`
                    : '—'}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}
