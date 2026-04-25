import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import * as buildingService from '../services/buildingService.js';
import * as classroomService from '../services/classroomService.js';
import * as nodeService from '../services/nodeService.js';
import * as edgeService from '../services/edgeService.js';
import * as locationService from '../services/locationService.js';
import * as navigationLocationService from '../services/navigationLocationService.js';
import * as navigationService from '../services/navigationService.js';
import { campusMaps } from '../data/campusMaps.js';

const TABS = ['buildings', 'classrooms', 'nodes', 'edges', 'locations', 'corridor'];
const NODE_TYPES = ['hallway', 'entrance', 'stairs', 'elevator'];
const LOCATION_TYPES = ['classroom', 'lab', 'office', 'facility'];
export default function AdminDashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('buildings');

  const [buildings, setBuildings] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [locations, setLocations] = useState([]);
  const [navigationLocations, setNavigationLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [buildingForm, setBuildingForm] = useState({ name: '', description: '', floors: 3 });
  const [classroomForm, setClassroomForm] = useState({ roomNumber: '', buildingId: '', floor: 0 });
  const [nodeForm, setNodeForm] = useState({
    name: '',
    buildingId: '',
    mapId: campusMaps[0]?.id ?? 'main-campus',
    floor: 0,
    x: 0,
    y: 0,
    type: 'hallway'
  });
  const [edgeForm, setEdgeForm] = useState({ fromNode: '', toNode: '', distance: 1 });
  const [locationForm, setLocationForm] = useState({ name: '', buildingId: '', floor: 0, nodeId: '', type: 'classroom' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [renamingNavLocationId, setRenamingNavLocationId] = useState('');
  const [renamingName, setRenamingName] = useState('');
  const [locationListSearch, setLocationListSearch] = useState('');
  const [navLocationListSearch, setNavLocationListSearch] = useState('');
  const [corridorAuditMapId, setCorridorAuditMapId] = useState(() => campusMaps[0]?.id || '');
  const [corridorAuditHealth, setCorridorAuditHealth] = useState(null);
  const [corridorAuditReach, setCorridorAuditReach] = useState(null);
  const [corridorAuditLoading, setCorridorAuditLoading] = useState(false);
  const [corridorAuditError, setCorridorAuditError] = useState('');

  const loadData = () => {
    setLoading(true);
    setError('');
    Promise.all([
      buildingService.getAll().then((r) => r.data),
      classroomService.getAll().then((r) => r.data),
      nodeService.getAll().then((r) => r.data),
      edgeService.getAll().then((r) => r.data),
      locationService.getAll().then((r) => r.data),
      navigationLocationService.getAll().then((r) => r.data?.data || [])
    ])
      .then(([b, c, n, e, l, nav]) => {
        setBuildings(b);
        setClassrooms(c);
        setNodes(n);
        setEdges(e);
        setLocations(l);
        setNavigationLocations(nav);
      })
      .catch((e) => setError(e.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadData();
  }, [isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAddBuilding = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await buildingService.create({ name: buildingForm.name.trim(), description: buildingForm.description.trim(), floors: Number(buildingForm.floors) || 1 });
      setBuildingForm({ name: '', description: '', floors: 3 });
      loadData();
    } catch (e) { setError(e.message || 'Failed to add building'); } finally { setSubmitting(false); }
  };

  const handleAddClassroom = async (e) => {
    e.preventDefault();
    if (!classroomForm.buildingId) { setError('Select a building'); return; }
    setError('');
    setSubmitting(true);
    try {
      await classroomService.create({ roomNumber: classroomForm.roomNumber.trim(), buildingId: classroomForm.buildingId, floor: Number(classroomForm.floor) || 0 });
      setClassroomForm((f) => ({ ...f, roomNumber: '', floor: 0 }));
      loadData();
    } catch (e) { setError(e.message || 'Failed to add classroom'); } finally { setSubmitting(false); }
  };

  const handleAddNode = async (e) => {
    e.preventDefault();
    if (!nodeForm.buildingId) { setError('Select a building'); return; }
    setError('');
    setSubmitting(true);
    try {
      await nodeService.create({
        name: nodeForm.name.trim(),
        buildingId: nodeForm.buildingId,
        mapId: nodeForm.mapId,
        floor: Number(nodeForm.floor) || 0,
        x: Number(nodeForm.x) || 0,
        y: Number(nodeForm.y) || 0,
        type: nodeForm.type
      });
      setNodeForm((f) => ({ ...f, name: '', floor: 0, x: 0, y: 0 }));
      loadData();
    } catch (e) { setError(e.message || 'Failed to add node'); } finally { setSubmitting(false); }
  };

  const handleAddEdge = async (e) => {
    e.preventDefault();
    if (!edgeForm.fromNode || !edgeForm.toNode) { setError('Select both nodes'); return; }
    if (edgeForm.fromNode === edgeForm.toNode) { setError('From and to must be different'); return; }
    setError('');
    setSubmitting(true);
    try {
      await edgeService.create({ fromNode: edgeForm.fromNode, toNode: edgeForm.toNode, distance: Number(edgeForm.distance) || 1 });
      setEdgeForm({ fromNode: '', toNode: '', distance: 1 });
      loadData();
    } catch (e) { setError(e.message || 'Failed to add edge'); } finally { setSubmitting(false); }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    if (!locationForm.buildingId || !locationForm.nodeId) { setError('Select building and node'); return; }
    setError('');
    setSubmitting(true);
    try {
      await locationService.create({
        name: locationForm.name.trim(),
        buildingId: locationForm.buildingId,
        floor: Number(locationForm.floor) || 0,
        nodeId: locationForm.nodeId,
        type: locationForm.type
      });
      setLocationForm((f) => ({ ...f, name: '', floor: 0 }));
      loadData();
    } catch (e) { setError(e.message || 'Failed to add location'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (kind, id) => {
    if (!window.confirm(`Delete this ${kind}?`)) return;
    setError('');
    setDeletingId(id);
    try {
      if (kind === 'classroom') await classroomService.remove(id);
      else if (kind === 'node') await nodeService.remove(id);
      else if (kind === 'edge') await edgeService.remove(id);
      else if (kind === 'location') await locationService.remove(id);
      else if (kind === 'nav-location') await navigationLocationService.remove(id);
      loadData();
    } catch (e) { setError(e.message || `Failed to delete ${kind}`); } finally { setDeletingId(null); }
  };

  const beginRenameNavLocation = (location) => {
    setRenamingNavLocationId(location._id);
    setRenamingName(location.name || '');
  };

  const cancelRenameNavLocation = () => {
    setRenamingNavLocationId('');
    setRenamingName('');
  };

  const filteredLocations = useMemo(() => {
    const q = locationListSearch.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((l) => {
      const name = (l.name || '').toLowerCase();
      const building = (l.buildingId?.name || String(l.buildingId?._id || l.buildingId || '')).toLowerCase();
      const type = (l.type || '').toLowerCase();
      const node = (l.nodeId?.name || String(l.nodeId?._id || l.nodeId || '')).toLowerCase();
      const floor = String(l.floor ?? '');
      return (
        name.includes(q) ||
        building.includes(q) ||
        type.includes(q) ||
        node.includes(q) ||
        floor.includes(q)
      );
    });
  }, [locations, locationListSearch]);

  const filteredNavigationLocations = useMemo(() => {
    const q = navLocationListSearch.trim().toLowerCase();
    if (!q) return navigationLocations;
    return navigationLocations.filter((l) => {
      const name = (l.name || '').toLowerCase();
      const kind = (l.kind || 'point').toLowerCase();
      const mapId = String(l.mapId || '').toLowerCase();
      const floor = String(l.floor ?? '');
      const xy = `${l.x},${l.y}`;
      const linked = (l.linksToLocation?.name || '').toLowerCase();
      return (
        name.includes(q) ||
        kind.includes(q) ||
        mapId.includes(q) ||
        floor.includes(q) ||
        xy.includes(q) ||
        linked.includes(q)
      );
    });
  }, [navigationLocations, navLocationListSearch]);

  const saveRenameNavLocation = async (e) => {
    e.preventDefault();
    if (!renamingNavLocationId) return;
    const trimmed = renamingName.trim();
    if (!trimmed) {
      setError('Enter a location name.');
      return;
    }
    const loc = navigationLocations.find((n) => String(n._id) === String(renamingNavLocationId));
    if (!loc) {
      setError('Map location not found. It may have been deleted.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await navigationLocationService.update(renamingNavLocationId, {
        name: trimmed,
        kind: loc.kind || 'point',
        building: loc.building?._id || loc.building,
        floor: Number(loc.floor),
        mapId: loc.mapId,
        x: Number(loc.x),
        y: Number(loc.y),
        corridorPoints:
          (loc.kind || 'point') === 'corridor' && Array.isArray(loc.corridorPoints)
            ? loc.corridorPoints
            : [],
        footprintPoints:
          (loc.kind || 'point') === 'point' && Array.isArray(loc.footprintPoints)
            ? loc.footprintPoints
            : [],
        linksToLocation:
          (loc.kind || 'point') === 'door' && loc.linksToLocation
            ? (loc.linksToLocation._id || loc.linksToLocation)
            : null
      });
      setRenamingNavLocationId('');
      setRenamingName('');
      loadData();
    } catch (e2) {
      setError(e2.message || 'Failed to rename map location');
    } finally {
      setSubmitting(false);
    }
  };

  const runCorridorAudit = async () => {
    if (!corridorAuditMapId) return;
    setCorridorAuditLoading(true);
    setCorridorAuditError('');
    try {
      const [h, r] = await Promise.all([
        navigationService.getCorridorHealth(corridorAuditMapId),
        navigationService.getCorridorLocationReachability(corridorAuditMapId)
      ]);
      setCorridorAuditHealth(h.data);
      setCorridorAuditReach(r.data);
    } catch (e) {
      setCorridorAuditError(e.message || 'Corridor check failed');
      setCorridorAuditHealth(null);
      setCorridorAuditReach(null);
    } finally {
      setCorridorAuditLoading(false);
    }
  };

  const openMapWithCorridorHighlights = () => {
    const rows = corridorAuditReach?.unreachable || [];
    const ids = rows.map((u) => String(u.id));
    navigate('/map', {
      state: {
        selectMapId: corridorAuditMapId,
        corridorOrphanIds: ids
      }
    });
  };

  if (!isAuthenticated) return null;
  if (loading && buildings.length === 0 && classrooms.length === 0) {
    return <div className="container"><p>Loading…</p></div>;
  }

  return (
    <div className="container admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="muted">Welcome, {user?.name || user?.email}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={handleLogout}>Log out</button>
      </div>

      {error && <div className="admin-dashboard-error card">{error}</div>}

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`btn ${activeTab === t ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'buildings' && (
        <>
          <section className="card admin-dashboard-section">
            <h2>Add building</h2>
            <form onSubmit={handleAddBuilding} className="admin-form-inline">
              <div className="admin-form-group"><label className="label">Name</label><input type="text" className="input" value={buildingForm.name} onChange={(e) => setBuildingForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Building name" /></div>
              <div className="admin-form-group"><label className="label">Description</label><input type="text" className="input" value={buildingForm.description} onChange={(e) => setBuildingForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" /></div>
              <div className="admin-form-group admin-form-group-sm"><label className="label">Floors</label><input type="number" min={1} className="input" value={buildingForm.floors} onChange={(e) => setBuildingForm((f) => ({ ...f, floors: e.target.value }))} /></div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding…' : 'Add building'}</button>
            </form>
          </section>
        </>
      )}

      {activeTab === 'classrooms' && (
        <>
          <section className="card admin-dashboard-section">
            <h2>Add classroom</h2>
            <form onSubmit={handleAddClassroom} className="admin-form-inline">
              <div className="admin-form-group"><label className="label">Room number</label><input type="text" className="input" value={classroomForm.roomNumber} onChange={(e) => setClassroomForm((f) => ({ ...f, roomNumber: e.target.value }))} required placeholder="e.g. 101" /></div>
              <div className="admin-form-group"><label className="label">Building</label><select className="input" value={classroomForm.buildingId} onChange={(e) => setClassroomForm((f) => ({ ...f, buildingId: e.target.value }))} required><option value="">Select building</option>{buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></div>
              <div className="admin-form-group admin-form-group-sm"><label className="label">Floor</label><input type="number" min={0} className="input" value={classroomForm.floor} onChange={(e) => setClassroomForm((f) => ({ ...f, floor: e.target.value }))} /></div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding…' : 'Add classroom'}</button>
            </form>
          </section>
          <section className="card admin-dashboard-section">
            <h2>Classroom list</h2>
            <p className="muted">{classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''}</p>
            {classrooms.length === 0 ? <p className="muted">No classrooms yet.</p> : (
              <ul className="admin-classroom-list">
                {classrooms.map((c) => (
                  <li key={c._id} className="admin-classroom-item">
                    <span><strong>{c.roomNumber}</strong>{c.buildingId && <span className="muted"> — {c.buildingId.name}, floor {c.floor}</span>}</span>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete('classroom', c._id)} disabled={deletingId === c._id}>{deletingId === c._id ? 'Deleting…' : 'Delete'}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {activeTab === 'nodes' && (
        <>
          <section className="card admin-dashboard-section">
            <h2>Add node</h2>
            <form onSubmit={handleAddNode} className="admin-form-inline">
              <div className="admin-form-group"><label className="label">Name</label><input type="text" className="input" value={nodeForm.name} onChange={(e) => setNodeForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Node name" /></div>
              <div className="admin-form-group"><label className="label">Building</label><select className="input" value={nodeForm.buildingId} onChange={(e) => setNodeForm((f) => ({ ...f, buildingId: e.target.value }))} required><option value="">Select building</option>{buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></div>
              <div className="admin-form-group"><label className="label">Map (floor plan)</label><select className="input" value={nodeForm.mapId} onChange={(e) => setNodeForm((f) => ({ ...f, mapId: e.target.value }))} required>{campusMaps.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
              <div className="admin-form-group admin-form-group-sm"><label className="label">Floor</label><input type="number" min={-2} className="input" value={nodeForm.floor} onChange={(e) => setNodeForm((f) => ({ ...f, floor: e.target.value }))} /></div>
              <div className="admin-form-group admin-form-group-sm"><label className="label">X</label><input type="number" className="input" value={nodeForm.x} onChange={(e) => setNodeForm((f) => ({ ...f, x: e.target.value }))} /></div>
              <div className="admin-form-group admin-form-group-sm"><label className="label">Y</label><input type="number" className="input" value={nodeForm.y} onChange={(e) => setNodeForm((f) => ({ ...f, y: e.target.value }))} /></div>
              <div className="admin-form-group"><label className="label">Type</label><select className="input" value={nodeForm.type} onChange={(e) => setNodeForm((f) => ({ ...f, type: e.target.value }))}>{NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding…' : 'Add node'}</button>
            </form>
          </section>
          <section className="card admin-dashboard-section">
            <h2>Node list</h2>
            <p className="muted">{nodes.length} node{nodes.length !== 1 ? 's' : ''}</p>
            {nodes.length === 0 ? <p className="muted">No nodes yet.</p> : (
              <ul className="admin-classroom-list">
                {nodes.map((n) => (
                  <li key={n._id} className="admin-classroom-item admin-classroom-item--stack">
                    <span><strong>{n.name}</strong> <span className="muted">— {n.buildingId?.name ?? n.buildingId}, map {n.mapId ?? '—'}, floor {n.floor}, ({n.x},{n.y}), {n.type}</span></span>
                    <span className="admin-nav-location-actions">
                      <Link className="btn btn-ghost btn-sm" to={`/map?editNode=${n._id}`}>
                        Edit on map
                      </Link>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete('node', n._id)} disabled={deletingId === n._id}>{deletingId === n._id ? 'Deleting…' : 'Delete'}</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {activeTab === 'edges' && (
        <>
          <section className="card admin-dashboard-section">
            <h2>Add edge</h2>
            <form onSubmit={handleAddEdge} className="admin-form-inline">
              <div className="admin-form-group"><label className="label">From node</label><select className="input" value={edgeForm.fromNode} onChange={(e) => setEdgeForm((f) => ({ ...f, fromNode: e.target.value }))} required><option value="">Select node</option>{nodes.map((n) => <option key={n._id} value={n._id}>{n.name} ({n.buildingId?.name})</option>)}</select></div>
              <div className="admin-form-group"><label className="label">To node</label><select className="input" value={edgeForm.toNode} onChange={(e) => setEdgeForm((f) => ({ ...f, toNode: e.target.value }))} required><option value="">Select node</option>{nodes.map((n) => <option key={n._id} value={n._id}>{n.name} ({n.buildingId?.name})</option>)}</select></div>
              <div className="admin-form-group admin-form-group-sm"><label className="label">Distance</label><input type="number" min={0} step={0.1} className="input" value={edgeForm.distance} onChange={(e) => setEdgeForm((f) => ({ ...f, distance: e.target.value }))} /></div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding…' : 'Add edge'}</button>
            </form>
          </section>
          <section className="card admin-dashboard-section">
            <h2>Edge list</h2>
            <p className="muted">{edges.length} edge{edges.length !== 1 ? 's' : ''}</p>
            {edges.length === 0 ? <p className="muted">No edges yet.</p> : (
              <ul className="admin-classroom-list">
                {edges.map((e) => (
                  <li key={e._id} className="admin-classroom-item admin-classroom-item--stack">
                    <span><strong>{e.fromNode?.name ?? e.fromNode}</strong> → <strong>{e.toNode?.name ?? e.toNode}</strong> <span className="muted">({e.distance})</span></span>
                    <span className="admin-nav-location-actions">
                      <Link className="btn btn-ghost btn-sm" to={`/map?editEdge=${e._id}`}>
                        Edit on map
                      </Link>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete('edge', e._id)} disabled={deletingId === e._id}>{deletingId === e._id ? 'Deleting…' : 'Delete'}</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {activeTab === 'locations' && (
        <>
          <section className="card admin-dashboard-section">
            <h2>Add location</h2>
            <form onSubmit={handleAddLocation} className="admin-form-inline">
              <div className="admin-form-group"><label className="label">Name</label><input type="text" className="input" value={locationForm.name} onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Location name" /></div>
              <div className="admin-form-group"><label className="label">Building</label><select className="input" value={locationForm.buildingId} onChange={(e) => setLocationForm((f) => ({ ...f, buildingId: e.target.value }))} required><option value="">Select building</option>{buildings.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select></div>
              <div className="admin-form-group admin-form-group-sm"><label className="label">Floor</label><input type="number" min={0} className="input" value={locationForm.floor} onChange={(e) => setLocationForm((f) => ({ ...f, floor: e.target.value }))} /></div>
              <div className="admin-form-group"><label className="label">Node</label><select className="input" value={locationForm.nodeId} onChange={(e) => setLocationForm((f) => ({ ...f, nodeId: e.target.value }))} required><option value="">Select node</option>{nodes.map((n) => <option key={n._id} value={n._id}>{n.name} ({n.buildingId?.name})</option>)}</select></div>
              <div className="admin-form-group"><label className="label">Type</label><select className="input" value={locationForm.type} onChange={(e) => setLocationForm((f) => ({ ...f, type: e.target.value }))}>{LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Adding…' : 'Add location'}</button>
            </form>
          </section>
          <section className="card admin-dashboard-section">
            <h2>Location list</h2>
            <div className="admin-list-search-wrap">
              <label className="label" htmlFor="admin-location-list-search">
                Search locations
              </label>
              <input
                id="admin-location-list-search"
                type="search"
                className="input admin-list-search-input"
                placeholder={
                  locations.length === 0
                    ? 'No locations yet — search will filter the list once items exist'
                    : 'Filter by name, building, floor, type, or node…'
                }
                value={locationListSearch}
                onChange={(e) => setLocationListSearch(e.target.value)}
                disabled={locations.length === 0}
                autoComplete="off"
              />
            </div>
            <p className="muted">
              {locations.length === 0
                ? '0 locations'
                : filteredLocations.length === locations.length
                  ? `${locations.length} location${locations.length !== 1 ? 's' : ''}`
                  : `${filteredLocations.length} shown of ${locations.length} location${locations.length !== 1 ? 's' : ''}`}
            </p>
            {locations.length === 0 ? (
              <p className="muted">No locations yet.</p>
            ) : filteredLocations.length === 0 ? (
              <p className="muted">No locations match your search.</p>
            ) : (
              <ul className="admin-classroom-list">
                {filteredLocations.map((l) => (
                  <li key={l._id} className="admin-classroom-item">
                    <span><strong>{l.name}</strong> <span className="muted">— {l.buildingId?.name ?? l.buildingId}, floor {l.floor}, {l.type}, node: {l.nodeId?.name ?? l.nodeId}</span></span>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete('location', l._id)} disabled={deletingId === l._id}>{deletingId === l._id ? 'Deleting…' : 'Delete'}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card admin-dashboard-section">
            <h2>Map locations (NavigationLocation)</h2>
            <div className="admin-list-search-wrap">
              <label className="label" htmlFor="admin-nav-location-list-search">
                Search map locations
              </label>
              <input
                id="admin-nav-location-list-search"
                type="search"
                className="input admin-list-search-input"
                placeholder={
                  navigationLocations.length === 0
                    ? 'No map locations yet — search will filter once items exist'
                    : 'Filter by name, kind, map, floor, coordinates, or linked room…'
                }
                value={navLocationListSearch}
                onChange={(e) => setNavLocationListSearch(e.target.value)}
                disabled={navigationLocations.length === 0}
                autoComplete="off"
              />
            </div>
            <p className="muted">
              {navigationLocations.length === 0
                ? '0 marked items.'
                : filteredNavigationLocations.length === navigationLocations.length
                  ? `${navigationLocations.length} marked item${navigationLocations.length !== 1 ? 's' : ''}.`
                  : `${filteredNavigationLocations.length} shown of ${navigationLocations.length} marked items.`}{' '}
              Use <strong>Edit on map</strong> to open the floor plan, highlight the item, and change points, corridors, or room outlines.
            </p>
            {navigationLocations.length === 0 ? <p className="muted">No map locations yet.</p> : filteredNavigationLocations.length === 0 ? (
              <p className="muted">No map locations match your search.</p>
            ) : (
              <ul className="admin-classroom-list">
                {filteredNavigationLocations.map((l) => (
                  <li key={l._id} className="admin-classroom-item">
                    {renamingNavLocationId === l._id ? (
                      <form className="admin-inline-rename" onSubmit={saveRenameNavLocation}>
                        <div className="admin-form-group">
                          <label className="label">Name</label>
                          <input
                            className="input"
                            value={renamingName}
                            onChange={(e) => setRenamingName(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <span className="admin-nav-location-actions">
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={submitting}
                          >
                            {submitting ? 'Saving…' : 'Save name'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={cancelRenameNavLocation}
                          >
                            Cancel
                          </button>
                        </span>
                      </form>
                    ) : (
                      <>
                        <span>
                          <strong>{l.name}</strong>{' '}
                          <span className="muted">
                            — {l.kind || 'point'}, {l.mapId}, floor {l.floor}, ({l.x},{l.y})
                            {(l.kind === 'corridor' && Array.isArray(l.corridorPoints))
                              ? `, points: ${l.corridorPoints.length}`
                              : ''}
                            {(l.kind === 'point' && Array.isArray(l.footprintPoints) && l.footprintPoints.length >= 3)
                              ? `, footprint: ${l.footprintPoints.length} corners`
                              : ''}
                            {(l.kind === 'door' && l.linksToLocation?.name)
                              ? `, entrance for: ${l.linksToLocation.name}`
                              : ''}
                          </span>
                        </span>
                        <span className="admin-nav-location-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => beginRenameNavLocation(l)}
                          >
                            Rename
                          </button>
                          <Link to={`/map?edit=${l._id}`} className="btn btn-ghost btn-sm">
                            Edit on map
                          </Link>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete('nav-location', l._id)}
                            disabled={deletingId === l._id}
                          >
                            {deletingId === l._id ? 'Deleting…' : 'Delete'}
                          </button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {activeTab === 'corridor' && (
        <>
          <section className="card admin-dashboard-section">
            <h2>Corridor QA</h2>
            <p className="muted">
              Check whether orange corridor polylines form one connected graph (same rules as routing), and list room/door pins
              that cannot snap to any corridor segment. Use this before debugging slow routes — fix reds by drawing or extending
              corridors, then re-run.
            </p>
            <div className="admin-form-inline" style={{ marginTop: '0.75rem', alignItems: 'flex-end' }}>
              <div className="admin-form-group">
                <label className="label" htmlFor="corridor-audit-map">
                  Floor plan (mapId)
                </label>
                <select
                  id="corridor-audit-map"
                  className="input"
                  value={corridorAuditMapId}
                  onChange={(e) => {
                    setCorridorAuditMapId(e.target.value);
                    setCorridorAuditHealth(null);
                    setCorridorAuditReach(null);
                  }}
                >
                  {campusMaps.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={runCorridorAudit} disabled={corridorAuditLoading}>
                {corridorAuditLoading ? 'Checking…' : 'Run corridor check'}
              </button>
            </div>
            {corridorAuditError && <p className="error-msg" style={{ marginTop: '0.75rem' }}>{corridorAuditError}</p>}
          </section>

          {corridorAuditHealth && (
            <section className="card admin-dashboard-section">
              <h3>Orange-line connectivity</h3>
              <p className={corridorAuditHealth.connected ? 'map-corridor-health-ok' : 'map-corridor-health-bad'}>
                {corridorAuditHealth.connected
                  ? 'All corridor chains connect into one walkable graph.'
                  : `Not fully connected — ${corridorAuditHealth.componentCount} separate piece(s). Join polylines at corners or add a short bridge segment.`}
              </p>
              <ul className="map-corridor-health-stats muted">
                <li>Saved corridor documents: {corridorAuditHealth.rawDocumentCount}</li>
                <li>Valid chains (≥2 points): {corridorAuditHealth.chainCount}</li>
                <li>Connected components: {corridorAuditHealth.componentCount}</li>
              </ul>
            </section>
          )}

          {corridorAuditReach && !corridorAuditReach.skipped && (
            <section className="card admin-dashboard-section">
              <h3>Pins vs corridor graph</h3>
              <p className="muted">
                Evaluated {corridorAuditReach.evaluatedCount} point/door pins
                {corridorAuditReach.corridorComponentCount > 1
                  ? ` (${corridorAuditReach.corridorComponentCount} separate corridor islands — pins must reach at least one).`
                  : '.'}
              </p>
              {corridorAuditReach.unreachableCount > 0 ? (
                <>
                  <p className="map-corridor-health-bad">
                    Pins flagged: {corridorAuditReach.unreachableCount}.
                    {corridorAuditReach.corridorQaMaxDistance != null ? (
                      <>
                        {' '}
                        Includes pins farther than <strong>{corridorAuditReach.corridorQaMaxDistance}</strong> map units from
                        any orange segment.
                      </>
                    ) : null}
                  </p>
                  <ul className="admin-classroom-list">
                    {corridorAuditReach.unreachable.map((row) => (
                      <li key={row.id} className="admin-classroom-item">
                        <span>
                          <strong>{row.name || row.id}</strong>
                          <span className="muted">
                            {' '}
                            — {row.kind}
                            {row.reason === 'missing_coordinates' ? ' (missing x/y)' : ''}
                            {row.reason === 'far_from_drawn_corridor'
                              ? ` (too far from corridor${row.minDistanceToCorridor != null ? ` ~${row.minDistanceToCorridor}` : ''})`
                              : ''}
                            {row.reason === 'no_corridor_path' ? ' (no graph path)' : ''}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={openMapWithCorridorHighlights}>
                    Show on map (red pins)
                  </button>
                </>
              ) : (
                <p className="map-corridor-health-ok">
                  Every pin reaches the corridor graph and is close enough to drawn orange segments (same QA rules as the map page).
                </p>
              )}
            </section>
          )}

          {corridorAuditReach?.skipped && (
            <section className="card admin-dashboard-section muted">
              <p>Add at least one corridor polyline (2+ points) on this map before pin reachability can be evaluated.</p>
            </section>
          )}
        </>
      )}

      <p className="admin-dashboard-back">
        <Link to="/" className="btn btn-ghost">← Back to Home</Link>
      </p>
    </div>
  );
}
