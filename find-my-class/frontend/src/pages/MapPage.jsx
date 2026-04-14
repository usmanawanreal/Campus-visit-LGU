import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CampusImageMap from '../components/CampusImageMap.jsx';
import {
  campusMaps,
  floorNumberToMapId,
  isFloorPlanMapId,
  mapIdToFloorFilterValue
} from '../data/campusMaps.js';
import * as navigationLocationService from '../services/navigationLocationService.js';
import * as buildingService from '../services/buildingService.js';
import * as navigationService from '../services/navigationService.js';
import * as nodeService from '../services/nodeService.js';
import * as edgeService from '../services/edgeService.js';
import { useAuth } from '../context/AuthContext.jsx';

const NODE_TYPES = ['hallway', 'entrance', 'stairs', 'elevator'];

/** Persist the building-floor index that matches the selected floor-plan image (avoids saving floor 0 while on Third floor). */
function floorIndexForNavPayload(mapId, selectedFloor) {
  if (isFloorPlanMapId(mapId)) {
    const v = mapIdToFloorFilterValue(mapId);
    if (v !== null && v !== '') return Number(v);
  }
  return Number(selectedFloor);
}

function centroidPoints(pts) {
  if (!Array.isArray(pts) || pts.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += Number(p.x);
    sy += Number(p.y);
  }
  const n = pts.length;
  return { x: sx / n, y: sy / n };
}

/** Ray-cast test: point vs closed polygon in map x/y space. */
function pointInPolygon(px, py, vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3) return false;
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = Number(vertices[i].x);
    const yi = Number(vertices[i].y);
    const xj = Number(vertices[j].x);
    const yj = Number(vertices[j].y);
    if (yi > py !== yj > py) {
      const xinters = ((xj - xi) * (py - yi)) / (yj - yi + 1e-18) + xi;
      if (px < xinters) inside = !inside;
    }
  }
  return inside;
}

function polygonAreaAbs(vertices) {
  let a = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += Number(vertices[i].x) * Number(vertices[j].y);
    a -= Number(vertices[j].x) * Number(vertices[i].y);
  }
  return Math.abs(a / 2);
}

function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pointToSegmentClosestSq(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby || 1e-18;
  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return distSq(px, py, cx, cy);
}

function minDistSqPointToPolygonRing(px, py, vertices) {
  const n = vertices.length;
  let minD = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const d = pointToSegmentClosestSq(
      px,
      py,
      Number(vertices[i].x),
      Number(vertices[i].y),
      Number(vertices[j].x),
      Number(vertices[j].y)
    );
    if (d < minD) minD = d;
  }
  return minD;
}

/**
 * Room to link for a door click: smallest footprint that contains the point; else footprint
 * whose edge is nearest (doorways slightly outside the polygon); else nearest room pin if
 * this floor has no footprints at all (same map/floor).
 */
/** Saved `floor` on nav locations must match for site maps; floor-plan PNGs are keyed by mapId so we match all pins on that image. */
function sameMapNavPoint(loc, formMapId, floor) {
  if ((loc.kind || 'point') !== 'point') return false;
  if (String(loc.mapId) !== String(formMapId)) return false;
  if (isFloorPlanMapId(formMapId)) return true;
  return Number(loc.floor) === Number(floor);
}

function findRoomLocationForDoorClick({
  allLocations,
  formMapId,
  floor,
  x,
  y,
  coordinateMaxX,
  coordinateMaxY
}) {
  const px = Number(x);
  const py = Number(y);
  const span = Math.max(Number(coordinateMaxX) || 1000, Number(coordinateMaxY) || 1000, 1);
  const centroidMaxSq = (span * 0.2) ** 2;
  const edgeTolSq = (span * 0.035) ** 2;

  const withFootprint = allLocations.filter(
    (loc) =>
      sameMapNavPoint(loc, formMapId, floor) &&
      Array.isArray(loc.footprintPoints) &&
      loc.footprintPoints.length >= 3
  );

  const containing = [];
  for (const loc of withFootprint) {
    const ring = loc.footprintPoints.map((p) => ({ x: Number(p.x), y: Number(p.y) }));
    if (pointInPolygon(px, py, ring)) {
      containing.push({ loc, area: polygonAreaAbs(ring) });
    }
  }
  if (containing.length > 0) {
    containing.sort((a, b) => a.area - b.area);
    return containing[0].loc;
  }

  if (withFootprint.length > 0) {
    const nearEdge = [];
    for (const loc of withFootprint) {
      const ring = loc.footprintPoints.map((p) => ({ x: Number(p.x), y: Number(p.y) }));
      const d2 = minDistSqPointToPolygonRing(px, py, ring);
      if (d2 <= edgeTolSq) {
        nearEdge.push({ loc, d2, area: polygonAreaAbs(ring) });
      }
    }
    if (nearEdge.length > 0) {
      nearEdge.sort((a, b) => a.d2 - b.d2 || a.area - b.area);
      return nearEdge[0].loc;
    }
    return null;
  }

  const pins = allLocations.filter((loc) => sameMapNavPoint(loc, formMapId, floor));
  let best = null;
  let bestD = Infinity;
  for (const loc of pins) {
    const d2 = distSq(px, py, Number(loc.x), Number(loc.y));
    if (d2 < bestD && d2 <= centroidMaxSq) {
      bestD = d2;
      best = loc;
    }
  }
  return best;
}

/** Unique door names per map/floor (single or batch create). */
function suggestNextDoorName({ allLocations, linkedRoomId, formMapId, floor }) {
  const room = allLocations.find((l) => String(l._id) === String(linkedRoomId));
  const roomLabel = (room?.name || '').trim() || 'Room';
  const sameMapFloor = (l) =>
    String(l.mapId) === String(formMapId) &&
    (isFloorPlanMapId(formMapId) || Number(l.floor) === Number(floor));
  const linkMatch = (l) => {
    const ref = l.linksToLocation?._id ?? l.linksToLocation;
    return ref != null && String(ref) === String(linkedRoomId);
  };
  const doorsForRoom = allLocations.filter(
    (l) => (l.kind || 'point') === 'door' && sameMapFloor(l) && linkMatch(l)
  );
  const names = new Set(doorsForRoom.map((l) => l.name));
  const base = `${roomLabel} — door`;
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${roomLabel} — door ${n}`)) n += 1;
  return `${roomLabel} — door ${n}`;
}

function getFriendlyLoadError(error) {
  const msg = error?.message || '';
  if (/network|failed to fetch|timeout/i.test(msg)) {
    return 'Unable to load locations right now. Please check your connection and try again.';
  }
  return 'Could not load locations for this map. Please try again.';
}

function getFriendlyRouteError(error) {
  const msg = error?.message || '';
  if (/same map image|same map id|corridors across different floor plans/i.test(msg)) return msg;
  if (/No walkable path/i.test(msg)) return msg;
  if (/Routes between two different floor plans must start and end in the same building/i.test(msg)) {
    return msg;
  }
  if (/Cross-floor routing needs/i.test(msg)) return msg;
  if (/No walkable cross-floor path/i.test(msg)) return msg;
  if (/not found/i.test(msg)) return 'Selected location is no longer available. Please reselect.';
  if (/network|failed to fetch|timeout/i.test(msg)) {
    return 'Route service is currently unavailable. Please try again.';
  }
  return 'Unable to calculate route right now. Please try again.';
}

export default function MapPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedMapId, setSelectedMapId] = useState(campusMaps[0].id);
  const [allLocations, setAllLocations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [locationsError, setLocationsError] = useState('');
  const [buildings, setBuildings] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);
  const [corridorDraftPoints, setCorridorDraftPoints] = useState([]);
  const [defineRoomFootprint, setDefineRoomFootprint] = useState(false);
  const [footprintDraftPoints, setFootprintDraftPoints] = useState([]);
  const [selectedCorridorPointIndex, setSelectedCorridorPointIndex] = useState(-1);
  /** When set, Save updates this navigation location (point, door, or corridor). */
  const [editingNavLocationId, setEditingNavLocationId] = useState('');
  const [newLocationKind, setNewLocationKind] = useState('point');
  const [doorLinksToLocationId, setDoorLinksToLocationId] = useState('');
  /** When on, map clicks add pending door dots; one Save creates all (any mix of rooms). */
  const [doorMultiPlaceMode, setDoorMultiPlaceMode] = useState(false);
  /** Pending doors: each stores its linked room so you can switch room and keep adding. */
  const [pendingDoors, setPendingDoors] = useState([]);
  const [newLocationName, setNewLocationName] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedFloor, setSelectedFloor] = useState(0);
  const [formMapId, setFormMapId] = useState(campusMaps[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedLocationId, setFocusedLocationId] = useState(null);
  const [startLocationId, setStartLocationId] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [routeSegments, setRouteSegments] = useState([]);
  const [activeRouteSegmentIndex, setActiveRouteSegmentIndex] = useState(0);
  const [isRouteAutoStepEnabled, setIsRouteAutoStepEnabled] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [routeMeta, setRouteMeta] = useState(null);
  const [routeSlowHint, setRouteSlowHint] = useState('');
  const [corridorHealth, setCorridorHealth] = useState(null);
  const [corridorHealthError, setCorridorHealthError] = useState('');
  const [corridorHealthLoading, setCorridorHealthLoading] = useState(false);
  const [filterBuildingId, setFilterBuildingId] = useState('');
  const [filterFloor, setFilterFloor] = useState('');
  const [navigationNodes, setNavigationNodes] = useState([]);
  const [showNavigationNodes, setShowNavigationNodes] = useState(false);
  /** Orange corridor guides & blue place pins are hidden until enabled (clean floor plan by default). */
  const [showMapBaseOverlays, setShowMapBaseOverlays] = useState(false);
  const [navNodeName, setNavNodeName] = useState('');
  const [navNodeType, setNavNodeType] = useState('hallway');
  const [nodeSaving, setNodeSaving] = useState(false);
  const [nodeSaveError, setNodeSaveError] = useState('');
  const [nodeSaveSuccess, setNodeSaveSuccess] = useState('');
  /** Deep-link / map edit: update existing routing node instead of create. */
  const [editingNavNodeId, setEditingNavNodeId] = useState('');
  const [focusedNavigationNodeIds, setFocusedNavigationNodeIds] = useState([]);
  const [editingEdgeId, setEditingEdgeId] = useState('');
  const [edgeMapForm, setEdgeMapForm] = useState({ fromNode: '', toNode: '', distance: 1 });
  const [allNodesForEdgeSelect, setAllNodesForEdgeSelect] = useState([]);
  const [edgeSaving, setEdgeSaving] = useState(false);
  const [edgeSaveError, setEdgeSaveError] = useState('');
  const [edgeSaveSuccess, setEdgeSaveSuccess] = useState('');

  const selectedMap = useMemo(
    () => campusMaps.find((item) => item.id === selectedMapId) || campusMaps[0],
    [selectedMapId]
  );
  /** One PNG per id — mapId already picks the floor; extra floor filter drops pins with mismatched floor numbers. */
  const isDedicatedFloorPlan = isFloorPlanMapId(selectedMap.id);
  const selectedFilterBuilding = useMemo(
    () => buildings.find((building) => building._id === filterBuildingId) || null,
    [buildings, filterBuildingId]
  );
  const floorOptions = useMemo(() => {
    let list;
    if (selectedFilterBuilding?.floors) {
      list = Array.from({ length: Number(selectedFilterBuilding.floors) }, (_, idx) => idx);
    } else {
      list = Array.from(new Set(locations.map((location) => Number(location.floor))));
    }
    // Include basement indices so map dropdown ↔ floor filter stay in sync with floor-plan ids.
    const merged = new Set([...list, -2, -1]);
    return Array.from(merged).sort((a, b) => a - b);
  }, [selectedFilterBuilding, locations]);
  const filteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((location) => location.name.toLowerCase().includes(q));
  }, [locations, searchQuery]);
  const mapPointLocations = useMemo(
    () => filteredLocations.filter((location) => (location.kind || 'point') !== 'corridor'),
    [filteredLocations]
  );
  const mapCorridors = useMemo(
    () => filteredLocations.filter((location) => (location.kind || 'point') === 'corridor'),
    [filteredLocations]
  );
  const editableCorridorsForForm = useMemo(
    () =>
      allLocations.filter((location) => {
        if ((location.kind || 'point') !== 'corridor') return false;
        if (String(location.mapId) !== String(formMapId)) return false;
        if (isFloorPlanMapId(formMapId)) return true;
        return Number(location.floor) === Number(selectedFloor);
      }),
    [allLocations, formMapId, selectedFloor]
  );
  /** Point locations on the same plan as the form — doors can link here so routes end at the door. */
  const doorLinkTargetOptions = useMemo(
    () =>
      allLocations.filter((loc) => {
        if ((loc.kind || 'point') !== 'point') return false;
        if (String(loc.mapId) !== String(formMapId)) return false;
        if (isFloorPlanMapId(formMapId)) return true;
        return Number(loc.floor) === Number(selectedFloor);
      }),
    [allLocations, formMapId, selectedFloor]
  );
  const formMapDefinition = useMemo(
    () => campusMaps.find((m) => m.id === formMapId) || campusMaps[0],
    [formMapId]
  );

  /** Markers for the active floor only (search + optional floor filter). */
  const mapMarkers = useMemo(() => {
    if (filterFloor === '' || isDedicatedFloorPlan) return mapPointLocations;
    const f = Number(filterFloor);
    return mapPointLocations.filter((loc) => Number(loc.floor) === f);
  }, [mapPointLocations, filterFloor, isDedicatedFloorPlan]);
  const mapVisibleCorridors = useMemo(() => {
    if (filterFloor === '' || isDedicatedFloorPlan) return mapCorridors;
    const f = Number(filterFloor);
    return mapCorridors.filter((loc) => Number(loc.floor) === f);
  }, [mapCorridors, filterFloor, isDedicatedFloorPlan]);

  const mapNavigationNodes = useMemo(() => {
    const filterByFloor = (list) => {
      if (filterFloor === '' || isDedicatedFloorPlan) return list;
      const f = Number(filterFloor);
      return list.filter((node) => Number(node.floor) === f);
    };
    if (showNavigationNodes) return filterByFloor(navigationNodes);
    const idSet = new Set((focusedNavigationNodeIds || []).map(String));
    if (idSet.size === 0) return [];
    return filterByFloor(navigationNodes.filter((node) => idSet.has(String(node._id))));
  }, [navigationNodes, filterFloor, showNavigationNodes, focusedNavigationNodeIds, isDedicatedFloorPlan]);

  /** Without overlays: bare PNG; search focus can still show one pin. Route polyline is separate. */
  const locationsOnMap = useMemo(() => {
    if (showMapBaseOverlays) return mapMarkers;
    if (focusedLocationId) return mapMarkers.filter((l) => l._id === focusedLocationId);
    return [];
  }, [showMapBaseOverlays, mapMarkers, focusedLocationId]);

  const corridorsOnMap = showMapBaseOverlays ? mapVisibleCorridors : [];
  const navigationNodesOnMap = useMemo(() => {
    if (showMapBaseOverlays) return mapNavigationNodes;
    if ((focusedNavigationNodeIds || []).length > 0) return mapNavigationNodes;
    return [];
  }, [showMapBaseOverlays, mapNavigationNodes, focusedNavigationNodeIds]);

  const edgePreviewPath = useMemo(() => {
    if (!editingEdgeId || !edgeMapForm.fromNode || !edgeMapForm.toNode) return [];
    const from = allNodesForEdgeSelect.find((n) => String(n._id) === String(edgeMapForm.fromNode));
    const to = allNodesForEdgeSelect.find((n) => String(n._id) === String(edgeMapForm.toNode));
    if (!from || !to) return [];
    const mid = selectedMap.id;
    if (String(from.mapId) !== String(mid) || String(to.mapId) !== String(mid)) return [];
    return [
      { x: Number(from.x), y: Number(from.y) },
      { x: Number(to.x), y: Number(to.y) }
    ];
  }, [editingEdgeId, edgeMapForm, allNodesForEdgeSelect, selectedMap.id]);

  /** Doors are routing attachments only — not shown in search or start/destination lists. */
  const searchResults = useMemo(() => {
    const withoutDoors = filteredLocations.filter((l) => (l.kind || 'point') !== 'door');
    return withoutDoors.slice(0, 8);
  }, [filteredLocations]);
  const routeStartLocation = useMemo(
    () => allLocations.find((l) => l._id === startLocationId) || null,
    [allLocations, startLocationId]
  );
  const routeEndLocation = useMemo(
    () => allLocations.find((l) => l._id === destinationLocationId) || null,
    [allLocations, destinationLocationId]
  );
  const activeRouteSegment = useMemo(
    () => routeSegments[activeRouteSegmentIndex] || null,
    [routeSegments, activeRouteSegmentIndex]
  );
  const activeRoutePath = useMemo(
    () => (activeRouteSegment ? activeRouteSegment.points : []),
    [activeRouteSegment]
  );
  const mapIdToLabel = useMemo(() => {
    const m = new Map();
    campusMaps.forEach((c) => m.set(String(c.id), c.label));
    return m;
  }, []);
  /** Places users can pick for routes (rooms/places only — not corridors or doors). */
  const selectableLocations = useMemo(() => {
    const list = allLocations.filter((l) => {
      const k = l.kind || 'point';
      return k !== 'corridor' && k !== 'door';
    });
    const labelFor = (id) => mapIdToLabel.get(String(id || '')) || String(id || '').trim() || 'Map';
    return [...list].sort((a, b) => {
      const cm = labelFor(a.mapId).localeCompare(labelFor(b.mapId));
      if (cm !== 0) return cm;
      const fa = Number(a.floor);
      const fb = Number(b.floor);
      if (Number.isFinite(fa) && Number.isFinite(fb) && fa !== fb) return fa - fb;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [allLocations, mapIdToLabel]);

  const formatLocationOptionLabel = useCallback(
    (location) => {
      const mapLabel = mapIdToLabel.get(String(location.mapId || '')) || location.mapId || '';
      const floor =
        Number.isFinite(Number(location.floor)) ? `floor ${location.floor}` : '';
      return [location.name, mapLabel, floor].filter(Boolean).join(' — ');
    },
    [mapIdToLabel]
  );

  const clearDrawnRoute = useCallback(() => {
    setRouteSegments([]);
    setActiveRouteSegmentIndex(0);
    setRouteError('');
    setRouteMeta(null);
    setRouteSlowHint('');
  }, []);

  /** Doors are no longer valid route endpoints in the UI — reset stale selections. */
  useEffect(() => {
    if (!allLocations.length) return;
    const start = startLocationId
      ? allLocations.find((l) => String(l._id) === String(startLocationId))
      : null;
    const end = destinationLocationId
      ? allLocations.find((l) => String(l._id) === String(destinationLocationId))
      : null;
    let cleared = false;
    if (start && (start.kind || 'point') === 'door') {
      setStartLocationId('');
      cleared = true;
    }
    if (end && (end.kind || 'point') === 'door') {
      setDestinationLocationId('');
      cleared = true;
    }
    if (cleared) clearDrawnRoute();
  }, [allLocations, startLocationId, destinationLocationId, clearDrawnRoute]);

  useEffect(() => {
    let isCancelled = false;
    const loadAllLocations = async () => {
      try {
        const { data } = await navigationLocationService.getAll({});
        if (!isCancelled) setAllLocations(data?.data || []);
      } catch {
        if (!isCancelled) setAllLocations([]);
      }
    };
    loadAllLocations();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadLocations = async () => {
      // Keep server-side filtering so large datasets remain fast in demo mode.
      setIsLoadingLocations(true);
      setLocationsError('');
      try {
        const params = { mapId: selectedMap.id };
        if (filterBuildingId) params.building = filterBuildingId;
        if (filterFloor !== '' && !isDedicatedFloorPlan) params.floor = Number(filterFloor);

        const { data } = await navigationLocationService.getAll(params);
        if (!isCancelled) {
          setLocations(data?.data || []);
          setFocusedLocationId((prev) => (editingNavLocationId ? prev : null));
        }
      } catch (error) {
        if (!isCancelled) {
          setLocations([]);
          setLocationsError(getFriendlyLoadError(error));
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingLocations(false);
        }
      }
    };

    loadLocations();
    return () => {
      isCancelled = true;
    };
  }, [selectedMap.id, filterBuildingId, filterFloor, editingNavLocationId, isDedicatedFloorPlan]);

  useEffect(() => {
    let isCancelled = false;
    const loadNodes = async () => {
      try {
        const params = { mapId: selectedMap.id };
        if (filterBuildingId) params.buildingId = filterBuildingId;
        if (filterFloor !== '' && !isDedicatedFloorPlan) params.floor = Number(filterFloor);
        const { data } = await nodeService.getAll(params);
        if (!isCancelled) setNavigationNodes(Array.isArray(data) ? data : []);
      } catch {
        if (!isCancelled) setNavigationNodes([]);
      }
    };
    loadNodes();
    return () => {
      isCancelled = true;
    };
  }, [selectedMap.id, filterBuildingId, filterFloor, isDedicatedFloorPlan]);

  useEffect(() => {
    setFormMapId(selectedMapId);
  }, [selectedMapId]);

  useEffect(() => {
    let isCancelled = false;
    const loadBuildings = async () => {
      try {
        const { data } = await buildingService.getAll();
        if (!isCancelled) {
          setBuildings(data || []);
          if (data?.length > 0) setSelectedBuildingId((prev) => prev || data[0]._id);
        }
      } catch {
        if (!isCancelled) setBuildings([]);
      }
    };
    loadBuildings();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Switch floor image when the floor filter changes (one floor plan at a time).
  useEffect(() => {
    if (filterFloor === '' || filterFloor === undefined) return;
    const n = Number(filterFloor);
    if (!Number.isNaN(n)) setSelectedFloor(n);
    const floorMapId = floorNumberToMapId(filterFloor);
    if (floorMapId && campusMaps.some((map) => map.id === floorMapId)) {
      setSelectedMapId(floorMapId);
    }
  }, [filterFloor]);

  const handleNavigationMapChange = useCallback((mapId) => {
    setSelectedMapId(mapId);
    const floorVal = mapIdToFloorFilterValue(mapId);
    if (floorVal !== null) {
      setFilterFloor(floorVal);
      setSelectedFloor(Number(floorVal));
    } else {
      setFilterFloor('');
    }
  }, []);

  const goToRouteSegment = useCallback((nextIndex) => {
    setActiveRouteSegmentIndex((prev) => {
      const idx = Math.max(0, Math.min(nextIndex, routeSegments.length - 1));
      const seg = routeSegments[idx];
      if (seg?.mapId) {
        setSelectedMapId(seg.mapId);
        const floorVal = mapIdToFloorFilterValue(seg.mapId);
        if (floorVal !== null) {
          setFilterFloor(floorVal);
          setSelectedFloor(Number(floorVal));
        } else {
          setFilterFloor('');
        }
      }
      return idx;
    });
  }, [routeSegments]);

  const handleRenameNavigationLocationFromPopup = useCallback(
    async (locationId, newName) => {
      const loc = allLocations.find((l) => String(l._id) === String(locationId));
      if (!loc) throw new Error('Location not found.');
      const trimmed = String(newName || '').trim();
      if (!trimmed) throw new Error('Enter a name.');
      const kind = loc.kind || 'point';
      const buildingId = loc.building?._id ?? loc.building;
      if (!buildingId) throw new Error('Location has no building assigned.');
      const payload = {
        name: trimmed,
        kind,
        building: buildingId,
        floor: Number(loc.floor),
        mapId: String(loc.mapId),
        x: Number(loc.x),
        y: Number(loc.y),
        corridorPoints: Array.isArray(loc.corridorPoints)
          ? loc.corridorPoints.map((p) => ({ x: Number(p.x), y: Number(p.y) }))
          : [],
        footprintPoints: Array.isArray(loc.footprintPoints)
          ? loc.footprintPoints.map((p) => ({ x: Number(p.x), y: Number(p.y) }))
          : [],
        ...(kind === 'door'
          ? {
              linksToLocation:
                (loc.linksToLocation && loc.linksToLocation._id) || loc.linksToLocation || null
            }
          : {})
      };
      await navigationLocationService.update(locationId, payload);
      const { data: allData } = await navigationLocationService.getAll({});
      setAllLocations(allData?.data || []);
      const params = { mapId: selectedMap.id };
      if (filterBuildingId) params.building = filterBuildingId;
      if (filterFloor !== '' && !isDedicatedFloorPlan) params.floor = Number(filterFloor);
      const { data } = await navigationLocationService.getAll(params);
      setLocations(data?.data || []);
    },
    [
      allLocations,
      selectedMap.id,
      filterBuildingId,
      filterFloor,
      isDedicatedFloorPlan
    ]
  );

  useEffect(() => {
    if (!isRouteAutoStepEnabled) return;
    if (!activeRouteSegment) return;
    if (routeLoading) return;
    if (activeRouteSegmentIndex >= routeSegments.length - 1) return;

    const timer = setTimeout(() => {
      goToRouteSegment(activeRouteSegmentIndex + 1);
    }, 2200);

    return () => clearTimeout(timer);
  }, [
    isRouteAutoStepEnabled,
    activeRouteSegment,
    routeLoading,
    activeRouteSegmentIndex,
    routeSegments.length,
    goToRouteSegment
  ]);

  const handleMapClick = useCallback(
    ({ x, y }) => {
      if (newLocationKind === 'corridor') {
        setCorridorDraftPoints((prev) => [...prev, { x, y }]);
        setSelectedCorridorPointIndex(-1);
        setSelectedCoordinate({ x, y });
      } else if (newLocationKind === 'point' && defineRoomFootprint) {
        setFootprintDraftPoints((prev) => [...prev, { x, y }]);
        setSelectedCoordinate({ x, y });
      } else if (newLocationKind === 'door' && doorMultiPlaceMode) {
        const autoRoom = findRoomLocationForDoorClick({
          allLocations,
          formMapId,
          floor: selectedFloor,
          x,
          y,
          coordinateMaxX: formMapDefinition.coordinateMaxX,
          coordinateMaxY: formMapDefinition.coordinateMaxY
        });
        const linkId = autoRoom ? String(autoRoom._id) : doorLinksToLocationId || '';
        if (!linkId) {
          setSaveError(
            'No room matched this click. Add a footprint (room outline) for each place, click closer to a room pin, or pick a room in the list below.'
          );
          setSaveSuccess('');
          return;
        }
        if (autoRoom) setDoorLinksToLocationId(linkId);
        setPendingDoors((prev) => [
          ...prev,
          {
            key: `pd-${Date.now()}-${prev.length}-${Math.random().toString(36).slice(2, 7)}`,
            x,
            y,
            linksToLocationId: linkId
          }
        ]);
        setSelectedCoordinate({ x, y });
        setCorridorDraftPoints([]);
        setFootprintDraftPoints([]);
        setSaveError('');
      } else {
        setSelectedCoordinate({ x, y });
        setCorridorDraftPoints([]);
        setFootprintDraftPoints([]);
        if (newLocationKind === 'door' && !doorMultiPlaceMode) {
          const autoRoom = findRoomLocationForDoorClick({
            allLocations,
            formMapId,
            floor: selectedFloor,
            x,
            y,
            coordinateMaxX: formMapDefinition.coordinateMaxX,
            coordinateMaxY: formMapDefinition.coordinateMaxY
          });
          if (autoRoom) setDoorLinksToLocationId(String(autoRoom._id));
        }
      }
      if (!(newLocationKind === 'door' && doorMultiPlaceMode)) {
        setSaveSuccess('');
      }
      setNodeSaveError('');
      setNodeSaveSuccess('');
      setEdgeSaveError('');
      setEdgeSaveSuccess('');
    },
    [
      newLocationKind,
      defineRoomFootprint,
      doorMultiPlaceMode,
      doorLinksToLocationId,
      allLocations,
      formMapId,
      selectedFloor,
      formMapDefinition
    ]
  );

  const handleCorridorPointDrag = useCallback((index, point) => {
    setCorridorDraftPoints((prev) => prev.map((p, idx) => (idx === index ? point : p)));
    setSelectedCoordinate(point);
    setSelectedCorridorPointIndex(index);
  }, []);

  const handleSelectSearchResult = useCallback((locationId) => {
    setFocusedLocationId(locationId);
  }, []);

  const handleSaveCoordinate = async () => {
    if (newLocationKind === 'door' && doorMultiPlaceMode) {
      if (pendingDoors.length === 0) {
        setSaveError(
          'Add at least one door on the map (click door positions — rooms are detected from outlines or nearby pins), then save. Turn off “many doors” for a single door.'
        );
        return;
      }
      if (!selectedBuildingId) {
        setSaveError('Select a building.');
        return;
      }
      if (editingNavLocationId) {
        setSaveError('Cancel editing a location before saving multiple doors.');
        return;
      }
      const count = pendingDoors.length;
      setIsSaving(true);
      setSaveError('');
      setSaveSuccess('');
      try {
        let simulated = [...allLocations];
        const navFloor = floorIndexForNavPayload(formMapId, selectedFloor);
        for (const d of pendingDoors) {
          const name = suggestNextDoorName({
            allLocations: simulated,
            linkedRoomId: d.linksToLocationId,
            formMapId,
            floor: navFloor
          });
          await navigationLocationService.create({
            name,
            kind: 'door',
            building: selectedBuildingId,
            floor: navFloor,
            mapId: formMapId,
            x: d.x,
            y: d.y,
            corridorPoints: [],
            footprintPoints: [],
            linksToLocation: d.linksToLocationId || null
          });
          simulated = [
            ...simulated,
            {
              _id: `temp-${simulated.length}`,
              kind: 'door',
              name,
              mapId: formMapId,
              floor: navFloor,
              linksToLocation: d.linksToLocationId
            }
          ];
        }
        const params = { mapId: selectedMap.id };
        if (filterBuildingId) params.building = filterBuildingId;
        if (filterFloor !== '' && !isDedicatedFloorPlan) params.floor = Number(filterFloor);
        const { data } = await navigationLocationService.getAll(params);
        setLocations(data?.data || []);
        const { data: allData } = await navigationLocationService.getAll({});
        setAllLocations(allData?.data || []);
        setPendingDoors([]);
        setSaveSuccess(
          `Saved ${count} door${count === 1 ? '' : 's'}. Add more dots and save again, or turn off “many doors, one save”.`
        );
        setSelectedCoordinate(null);
      } catch (error) {
        setSaveError(error.message || 'Failed to save doors.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (newLocationKind === 'corridor' && corridorDraftPoints.length < 2) {
      setSaveError('Corridor requires at least 2 clicked points.');
      return;
    }
    if (newLocationKind === 'point' && defineRoomFootprint) {
      if (footprintDraftPoints.length < 3) {
        setSaveError('Room outline needs at least 3 corners — click the map to add each corner.');
        return;
      }
    } else if (newLocationKind !== 'corridor' && !selectedCoordinate) {
      setSaveError('Click on the map first to capture coordinates.');
      return;
    }
    if (!newLocationName.trim()) {
      setSaveError('Enter a location name.');
      return;
    }
    if (!selectedBuildingId) {
      setSaveError('Select a building.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      const roomCentroid =
        newLocationKind === 'point' && defineRoomFootprint && footprintDraftPoints.length >= 3
          ? centroidPoints(footprintDraftPoints)
          : null;
      const payload = {
        name: newLocationName.trim(),
        kind: newLocationKind,
        building: selectedBuildingId,
        floor: floorIndexForNavPayload(formMapId, selectedFloor),
        mapId: formMapId,
        x:
          newLocationKind === 'corridor'
            ? corridorDraftPoints[0].x
            : roomCentroid
              ? roomCentroid.x
              : selectedCoordinate.x,
        y:
          newLocationKind === 'corridor'
            ? corridorDraftPoints[0].y
            : roomCentroid
              ? roomCentroid.y
              : selectedCoordinate.y,
        corridorPoints: newLocationKind === 'corridor' ? corridorDraftPoints : [],
        footprintPoints:
          newLocationKind === 'point' && defineRoomFootprint && footprintDraftPoints.length >= 3
            ? footprintDraftPoints
            : [],
        ...(newLocationKind === 'door'
          ? { linksToLocation: doorLinksToLocationId || null }
          : {})
      };
      if (editingNavLocationId) {
        await navigationLocationService.update(editingNavLocationId, payload);
      } else {
        await navigationLocationService.create(payload);
      }

      const params = { mapId: selectedMap.id };
      if (filterBuildingId) params.building = filterBuildingId;
      if (filterFloor !== '' && !isDedicatedFloorPlan) params.floor = Number(filterFloor);
      const { data } = await navigationLocationService.getAll(params);
      setLocations(data?.data || []);
      const { data: allData } = await navigationLocationService.getAll({});
      setAllLocations(allData?.data || []);
      const savedCorridor = newLocationKind === 'corridor';
      setSaveSuccess(
        savedCorridor
          ? `${editingNavLocationId ? 'Corridor updated.' : 'Corridor saved.'} Turn on “Show place pins & corridor guides”, then use “Check corridor connection” — it should report one connected network before Draw route will cross the whole floor.`
          : editingNavLocationId
            ? 'Location updated successfully.'
            : 'Location saved successfully.'
      );
      setNewLocationName('');
      setCorridorDraftPoints([]);
      setFootprintDraftPoints([]);
      setDefineRoomFootprint(false);
      setDoorLinksToLocationId('');
      setDoorMultiPlaceMode(false);
      setPendingDoors([]);
      setSelectedCorridorPointIndex(-1);
      setEditingNavLocationId('');
    } catch (error) {
      setSaveError(error.message || 'Failed to save location.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartNavLocationEdit = useCallback(
    (locationId) => {
      const loc = allLocations.find((l) => String(l._id) === String(locationId));
      if (!loc) return;
      const kind = loc.kind || 'point';
      setEditingNavNodeId('');
      setFocusedNavigationNodeIds([]);
      setEditingEdgeId('');
      setEdgeMapForm({ fromNode: '', toNode: '', distance: 1 });
      setEdgeSaveError('');
      setEdgeSaveSuccess('');
      setEditingNavLocationId(loc._id);
      setDoorMultiPlaceMode(false);
      setPendingDoors([]);
      setFocusedLocationId(loc._id);
      setShowMapBaseOverlays(true);
      setNewLocationName(loc.name || '');
      setSelectedBuildingId(loc.building?._id || loc.building || '');
      setSelectedFloor(Number(loc.floor) || 0);
      const mapId = loc.mapId || selectedMapId;
      setFormMapId(mapId);
      setSelectedMapId(mapId);
      const floorVal = mapIdToFloorFilterValue(mapId);
      if (floorVal !== null) setFilterFloor(floorVal);
      else if (loc.floor !== undefined && loc.floor !== null) setFilterFloor(String(loc.floor));
      else setFilterFloor('');
      const b = loc.building?._id || loc.building;
      if (b) setFilterBuildingId(String(b));

      if (kind === 'corridor') {
        setNewLocationKind('corridor');
        setCorridorDraftPoints(Array.isArray(loc.corridorPoints) ? [...loc.corridorPoints] : []);
        setSelectedCorridorPointIndex(-1);
        setDefineRoomFootprint(false);
        setFootprintDraftPoints([]);
        setDoorLinksToLocationId('');
        setSelectedCoordinate(null);
      } else if (kind === 'door') {
        setNewLocationKind('door');
        setCorridorDraftPoints([]);
        setSelectedCorridorPointIndex(-1);
        setDefineRoomFootprint(false);
        setFootprintDraftPoints([]);
        setDoorLinksToLocationId(loc.linksToLocation?._id || loc.linksToLocation || '');
        setSelectedCoordinate({ x: Number(loc.x), y: Number(loc.y) });
      } else {
        setNewLocationKind('point');
        setCorridorDraftPoints([]);
        setSelectedCorridorPointIndex(-1);
        const fp =
          Array.isArray(loc.footprintPoints) && loc.footprintPoints.length >= 3
            ? loc.footprintPoints.map((p) => ({ x: Number(p.x), y: Number(p.y) }))
            : [];
        if (fp.length >= 3) {
          setDefineRoomFootprint(true);
          setFootprintDraftPoints(fp);
          const c = centroidPoints(fp);
          setSelectedCoordinate(
            c ? { x: c.x, y: c.y } : { x: Number(loc.x), y: Number(loc.y) }
          );
        } else {
          setDefineRoomFootprint(false);
          setFootprintDraftPoints([]);
          setSelectedCoordinate({ x: Number(loc.x), y: Number(loc.y) });
        }
        setDoorLinksToLocationId('');
      }
      setSaveError('');
      setSaveSuccess('');
    },
    [allLocations, selectedMapId]
  );

  const handleCancelNavLocationEdit = useCallback(() => {
    setEditingNavLocationId('');
    setDoorMultiPlaceMode(false);
    setPendingDoors([]);
    setCorridorDraftPoints([]);
    setSelectedCorridorPointIndex(-1);
    setFootprintDraftPoints([]);
    setDefineRoomFootprint(false);
    setDoorLinksToLocationId('');
    setFocusedLocationId(null);
  }, []);

  const handleStartNavNodeEdit = useCallback((node) => {
    if (!node?._id) return;
    setEditingNavLocationId('');
    setFocusedLocationId(null);
    setEditingEdgeId('');
    setEdgeMapForm({ fromNode: '', toNode: '', distance: 1 });
    setEdgeSaveError('');
    setEdgeSaveSuccess('');
    setEditingNavNodeId(node._id);
    setFocusedNavigationNodeIds([String(node._id)]);
    setShowMapBaseOverlays(true);
    setShowNavigationNodes(true);
    setNavNodeName(node.name || '');
    setNavNodeType(node.type || 'hallway');
    const b = node.buildingId?._id || node.buildingId;
    setSelectedBuildingId(b ? String(b) : '');
    setSelectedFloor(Number(node.floor) || 0);
    const mapId = node.mapId || selectedMapId;
    setFormMapId(mapId);
    setSelectedMapId(mapId);
    const floorVal = mapIdToFloorFilterValue(mapId);
    if (floorVal !== null) setFilterFloor(floorVal);
    else if (node.floor !== undefined && node.floor !== null) setFilterFloor(String(node.floor));
    else setFilterFloor('');
    if (b) setFilterBuildingId(String(b));
    setSelectedCoordinate({ x: Number(node.x), y: Number(node.y) });
    setNodeSaveError('');
    setNodeSaveSuccess('');
  }, [selectedMapId]);

  const handleCancelNavNodeEdit = useCallback(() => {
    setEditingNavNodeId('');
    setFocusedNavigationNodeIds([]);
    setNavNodeName('');
    setNodeSaveError('');
    setNodeSaveSuccess('');
  }, []);

  const handleStartEdgeEdit = useCallback((edge) => {
    if (!edge?._id || !edge.fromNode || !edge.toNode) return;
    setEditingNavLocationId('');
    setFocusedLocationId(null);
    setEditingNavNodeId('');
    setNavNodeName('');
    setNodeSaveError('');
    setNodeSaveSuccess('');
    const from = edge.fromNode;
    const to = edge.toNode;
    setEditingEdgeId(edge._id);
    setFocusedNavigationNodeIds(
      [from._id || from, to._id || to].filter(Boolean).map(String)
    );
    setEdgeMapForm({
      fromNode: String(from._id || from),
      toNode: String(to._id || to),
      distance: edge.distance ?? 1
    });
    setShowMapBaseOverlays(true);
    setShowNavigationNodes(true);
    setFilterBuildingId('');
    const mapId = from.mapId || selectedMapId;
    setFormMapId(mapId);
    setSelectedMapId(mapId);
    const floorVal = mapIdToFloorFilterValue(mapId);
    if (floorVal !== null) setFilterFloor(floorVal);
    else if (from.floor !== undefined && from.floor !== null) setFilterFloor(String(from.floor));
    else setFilterFloor('');
    setEdgeSaveError('');
    setEdgeSaveSuccess('');
  }, [selectedMapId]);

  const handleCancelEdgeEdit = useCallback(() => {
    setEditingEdgeId('');
    setFocusedNavigationNodeIds([]);
    setEdgeMapForm({ fromNode: '', toNode: '', distance: 1 });
    setEdgeSaveError('');
    setEdgeSaveSuccess('');
  }, []);

  const editIdFromUrl = searchParams.get('edit');
  useEffect(() => {
    if (!editIdFromUrl) return;
    if (allLocations.length === 0) return;
    const loc = allLocations.find((l) => String(l._id) === String(editIdFromUrl));
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('edit');
        return next;
      },
      { replace: true }
    );
    if (loc) {
      handleStartNavLocationEdit(loc._id);
    } else {
      setSaveError('That map location was not found. It may have been deleted.');
    }
  }, [editIdFromUrl, allLocations, handleStartNavLocationEdit, setSearchParams]);

  const editNodeFromUrl = searchParams.get('editNode');
  useEffect(() => {
    if (!editNodeFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await nodeService.getById(editNodeFromUrl);
        if (cancelled) return;
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('editNode');
            return next;
          },
          { replace: true }
        );
        if (data) handleStartNavNodeEdit(data);
        else setNodeSaveError('That routing node was not found. It may have been deleted.');
      } catch {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete('editNode');
              return next;
            },
            { replace: true }
          );
          setNodeSaveError('That routing node was not found. It may have been deleted.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editNodeFromUrl, handleStartNavNodeEdit, setSearchParams]);

  const editEdgeFromUrl = searchParams.get('editEdge');
  useEffect(() => {
    if (!editEdgeFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const [edgeRes, nodesRes] = await Promise.all([
          edgeService.getById(editEdgeFromUrl),
          nodeService.getAll({})
        ]);
        if (cancelled) return;
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('editEdge');
            return next;
          },
          { replace: true }
        );
        const edge = edgeRes?.data;
        const allNodes = Array.isArray(nodesRes?.data) ? nodesRes.data : [];
        setAllNodesForEdgeSelect(allNodes);
        if (edge?._id && edge.fromNode && edge.toNode) handleStartEdgeEdit(edge);
        else setEdgeSaveError('That graph edge was not found. It may have been deleted.');
      } catch {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete('editEdge');
              return next;
            },
            { replace: true }
          );
          setEdgeSaveError('That graph edge was not found. It may have been deleted.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editEdgeFromUrl, handleStartEdgeEdit, setSearchParams]);

  useEffect(() => {
    if (!editingEdgeId) return;
    let cancelled = false;
    nodeService
      .getAll({})
      .then((r) => {
        if (!cancelled) setAllNodesForEdgeSelect(Array.isArray(r?.data) ? r.data : []);
      })
      .catch(() => {
        if (!cancelled) setAllNodesForEdgeSelect([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editingEdgeId]);

  useEffect(() => {
    if (!editingEdgeId) return;
    const a = edgeMapForm.fromNode;
    const b = edgeMapForm.toNode;
    setFocusedNavigationNodeIds([a, b].filter(Boolean).map(String));
  }, [editingEdgeId, edgeMapForm.fromNode, edgeMapForm.toNode]);

  useEffect(() => {
    if (!routeLoading) {
      setRouteSlowHint('');
      return;
    }
    const timer = setTimeout(() => {
      setRouteSlowHint(
        'Route is taking longer than usual. If it never finishes, corridors or routing nodes may be missing between these two places.'
      );
    }, 6000);
    return () => clearTimeout(timer);
  }, [routeLoading]);

  const handleSaveNavigationNode = async () => {
    if (!isAuthenticated) {
      setNodeSaveError('Sign in via Admin Login to save routing nodes.');
      return;
    }
    if (!selectedCoordinate) {
      setNodeSaveError('Click on the map first to capture coordinates.');
      return;
    }
    if (!navNodeName.trim()) {
      setNodeSaveError('Enter a node name.');
      return;
    }
    if (!selectedBuildingId) {
      setNodeSaveError('Select a building.');
      return;
    }

    setNodeSaving(true);
    setNodeSaveError('');
    setNodeSaveSuccess('');
    try {
      const payload = {
        name: navNodeName.trim(),
        buildingId: selectedBuildingId,
        mapId: formMapId,
        floor: floorIndexForNavPayload(formMapId, selectedFloor),
        x: selectedCoordinate.x,
        y: selectedCoordinate.y,
        type: navNodeType
      };
      if (editingNavNodeId) {
        await nodeService.update(editingNavNodeId, payload);
      } else {
        await nodeService.create(payload);
      }
      const params = { mapId: selectedMap.id };
      if (filterBuildingId) params.buildingId = filterBuildingId;
      if (filterFloor !== '' && !isDedicatedFloorPlan) params.floor = Number(filterFloor);
      const { data } = await nodeService.getAll(params);
      setNavigationNodes(Array.isArray(data) ? data : []);
      setNodeSaveSuccess(editingNavNodeId ? 'Routing node updated.' : 'Routing node saved.');
      setNavNodeName('');
      if (editingNavNodeId) {
        setEditingNavNodeId('');
        setFocusedNavigationNodeIds([]);
      }
    } catch (error) {
      setNodeSaveError(error.message || 'Failed to save node.');
    } finally {
      setNodeSaving(false);
    }
  };

  const handleSaveEdgeOnMap = async () => {
    if (!isAuthenticated) {
      setEdgeSaveError('Sign in via Admin Login to save graph edges.');
      return;
    }
    if (!editingEdgeId) return;
    if (!edgeMapForm.fromNode || !edgeMapForm.toNode) {
      setEdgeSaveError('Select both endpoints.');
      return;
    }
    if (String(edgeMapForm.fromNode) === String(edgeMapForm.toNode)) {
      setEdgeSaveError('From and to nodes must be different.');
      return;
    }
    setEdgeSaving(true);
    setEdgeSaveError('');
    setEdgeSaveSuccess('');
    try {
      await edgeService.update(editingEdgeId, {
        fromNode: edgeMapForm.fromNode,
        toNode: edgeMapForm.toNode,
        distance: Number(edgeMapForm.distance) || 1
      });
      setEdgeSaveSuccess('Graph edge updated.');
      setEditingEdgeId('');
      setFocusedNavigationNodeIds([]);
      setEdgeMapForm({ fromNode: '', toNode: '', distance: 1 });
    } catch (error) {
      setEdgeSaveError(error.message || 'Failed to save edge.');
    } finally {
      setEdgeSaving(false);
    }
  };

  const handleCheckCorridorHealth = useCallback(async () => {
    setCorridorHealth(null);
    setCorridorHealthError('');
    setCorridorHealthLoading(true);
    try {
      const { data } = await navigationService.getCorridorHealth(selectedMap.id);
      setCorridorHealth(data);
    } catch (err) {
      setCorridorHealthError(err?.message || 'Could not check corridors.');
    } finally {
      setCorridorHealthLoading(false);
    }
  }, [selectedMap.id]);

  const handleDrawRoute = async () => {
    if (allLocations.length === 0) {
      setRouteError('No locations available yet.');
      return;
    }
    if (!startLocationId || !destinationLocationId) {
      setRouteError('Select start and destination locations.');
      return;
    }
    if (startLocationId === destinationLocationId) {
      setRouteError('Start and destination must be different.');
      return;
    }

    setRouteLoading(true);
    setRouteError('');
    setRouteSegments([]);
    setRouteMeta(null);
    setRouteSlowHint('');
    setActiveRouteSegmentIndex(0);
    try {
      const route = await navigationService.getRouteWithSegments(
        startLocationId,
        destinationLocationId,
        isFloorPlanMapId(selectedMap.id) ? { mapId: selectedMap.id } : {}
      );
      if (!route.segments || route.segments.length === 0) {
        setRouteMeta(route.meta || null);
        const diag = route.meta?.routingDiagnostics;
        setRouteError(
          diag?.explain ||
            'No path found. This floor needs saved corridor polylines (orange lines) on the same map image as your rooms, connected into one network. Doors on the drawing are not enough—you must trace hallways in admin. Marking doors is optional and only refines start/end points.'
        );
        return;
      }
      setRouteSegments(route.segments);
      setRouteMeta(route.meta || null);
      setActiveRouteSegmentIndex(0);
      const first = route.segments[0];
      if (first?.mapId) {
        setSelectedMapId(first.mapId);
        const floorVal = mapIdToFloorFilterValue(first.mapId);
        if (floorVal !== null) {
          setFilterFloor(floorVal);
          setSelectedFloor(Number(floorVal));
        } else {
          setFilterFloor('');
        }
      }
    } catch (error) {
      setRouteMeta(null);
      setRouteSlowHint('');
      setRouteError(getFriendlyRouteError(error));
    } finally {
      setRouteLoading(false);
    }
  };

  return (
    <section className="map-page-shell" aria-label="Campus map page">
      <aside className="map-sidebar">
        <h2 className="map-sidebar-title">Campus Navigation</h2>
        <label className="label" htmlFor="map-image-select">Map</label>
        <select
          id="map-image-select"
          className="input"
          value={selectedMapId}
          onChange={(e) => handleNavigationMapChange(e.target.value)}
        >
          {campusMaps.map((map) => (
            <option key={map.id} value={map.id}>
              {map.label}
            </option>
          ))}
        </select>
        <p className="muted map-same-map-hint">
          Start and destination list <strong>rooms and places</strong> only. Marked doors are not separate choices: pick the room, and the path uses linked doors at start/end when they exist. The route draws on the first floor plan, then you can move to the next segment (or wait for auto-step) to see the next map.
        </p>
        <label className="map-checkbox-label map-overlays-toggle">
          <input
            type="checkbox"
            checked={showMapBaseOverlays}
            onChange={(e) => setShowMapBaseOverlays(e.target.checked)}
          />
          <span>Show place pins &amp; corridor guides</span>
        </label>
        <p className="muted map-overlays-explainer">
          Orange dashed lines are saved corridors for routing, not a path. After you use Draw route, your path is a solid blue line.
        </p>
        <p className="muted map-overlays-explainer">
          It is normal for door markers to sit right beside those orange lines: walking happens on the corridor graph, and the blue route snaps to the nearest corridor segment, then connects to your door pins when they are slightly inside a room or off the polyline.
        </p>
        <p className="muted map-overlays-explainer">
          <strong>Corridors</strong> (click the map to draw polylines, save as corridor) are required so routes can follow hallways. <strong>Doors</strong> are optional: add door pins linked to a room if you want paths to start/end at the doorway instead of only along the corridor near the room.
        </p>
        <div className="map-corridor-health-tools">
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleCheckCorridorHealth}
            disabled={corridorHealthLoading}
          >
            {corridorHealthLoading ? 'Checking…' : 'Check corridor connection (this map)'}
          </button>
          <p className="muted map-corridor-health-hint">
            Uses the map selected above (<strong>{selectedMap.label}</strong>). Verifies orange corridor lines form <strong>one</strong> connected network (same rules as routing).
          </p>
          {corridorHealthError && <p className="error map-admin-msg">{corridorHealthError}</p>}
          {corridorHealth && (
            <div className="map-corridor-health-result muted" role="status">
              <p className={corridorHealth.connected ? 'map-corridor-health-ok' : 'map-corridor-health-bad'}>
                {corridorHealth.connected
                  ? 'Corridors are connected — routing can walk the whole hallway graph.'
                  : `Not fully connected — ${corridorHealth.componentCount} separate piece(s) detected.`}
              </p>
              <ul className="map-corridor-health-stats">
                <li>Saved corridor items: {corridorHealth.rawDocumentCount}</li>
                <li>Valid chains (≥2 points): {corridorHealth.chainCount}</li>
                <li>Graph vertices: {corridorHealth.vertexCount}</li>
                <li>Polyline segments: {corridorHealth.segmentCount}</li>
                <li>Connected components: {corridorHealth.componentCount}</li>
              </ul>
              {Array.isArray(corridorHealth.chainNames) && corridorHealth.chainNames.length > 0 && (
                <p className="muted">Names: {corridorHealth.chainNames.join(', ')}</p>
              )}
              {Array.isArray(corridorHealth.whatToDoNext) && corridorHealth.whatToDoNext.length > 0 && (
                <ul className="map-corridor-health-next">
                  {corridorHealth.whatToDoNext.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <label className="label" htmlFor="start-location-select">Start Location</label>
        <select
          id="start-location-select"
          className="input"
          value={startLocationId}
          onChange={(e) => {
            setStartLocationId(e.target.value);
            clearDrawnRoute();
          }}
        >
          <option value="">Select start</option>
          {selectableLocations.map((location) => (
            <option key={location._id} value={location._id}>
              {formatLocationOptionLabel(location)}
            </option>
          ))}
        </select>

        <label className="label" htmlFor="destination-location-select">Destination</label>
        <select
          id="destination-location-select"
          className="input"
          value={destinationLocationId}
          onChange={(e) => {
            setDestinationLocationId(e.target.value);
            clearDrawnRoute();
          }}
        >
          <option value="">Select destination</option>
          {selectableLocations.map((location) => (
            <option key={location._id} value={location._id}>
              {formatLocationOptionLabel(location)}
            </option>
          ))}
        </select>

        <label className="map-search-label" htmlFor="map-location-search">Search</label>
        <input
          id="map-location-search"
          className="input map-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Type location name"
        />
        {searchQuery.trim() && (
          <div className="map-search-results">
            {searchResults.length === 0 ? (
              <p className="map-search-empty">No matches found.</p>
            ) : (
              searchResults.map((location) => (
                <button
                  key={location._id}
                  type="button"
                  className={`map-search-result-btn ${focusedLocationId === location._id ? 'active' : ''}`}
                  onClick={() => handleSelectSearchResult(location._id)}
                >
                  {location.name}
                </button>
              ))
            )}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary map-route-btn"
          onClick={handleDrawRoute}
          disabled={routeLoading}
        >
          {routeLoading ? 'Drawing...' : 'Draw Route'}
        </button>
        {routeMeta?.routeStartsAtDoor && (
          <p className="muted map-route-door-hint">
            Path starts from door <strong>{routeMeta.routeStartsAtDoor.name || 'entrance'}</strong> (linked to your start place).
          </p>
        )}
        {routeMeta?.routingDiagnostics && (
          <p className="muted map-route-diagnostics" role="status">
            {routeMeta.routingDiagnostics.explain}
            {Number.isFinite(Number(routeMeta.routingDiagnostics.corridorPolylinesOnStartMap)) && (
              <span className="map-route-diagnostics-detail">
                {' '}
                Corridor polylines saved for start map:{' '}
                <strong>{routeMeta.routingDiagnostics.corridorPolylinesOnStartMap}</strong>
                {routeMeta.routingDiagnostics.startMapId ? (
                  <>
                    {' '}
                    (<code>{routeMeta.routingDiagnostics.startMapId}</code>)
                  </>
                ) : null}
                .
              </span>
            )}
          </p>
        )}
        {routeMeta?.routeEndsAtDoor && (
          <p className="muted map-route-door-hint">
            Path ends at door <strong>{routeMeta.routeEndsAtDoor.name || 'marked entrance'}</strong> (linked to your destination), not at the room outline.
          </p>
        )}
        {routeMeta?.crossMap && routeMeta?.transitionWaypoints && (
          <p className="muted map-route-transition-hint">
            Cross-floor path uses transition points:{' '}
            <strong>{routeMeta.transitionWaypoints.onStartFloorPlan || '—'}</strong> on the first map, then{' '}
            <strong>{routeMeta.transitionWaypoints.onDestinationFloorPlan || '—'}</strong> on the destination map.
          </p>
        )}
        {routeMeta?.crossMap &&
          Array.isArray(routeMeta.multiFloorRouteHints) &&
          routeMeta.multiFloorRouteHints.length > 0 && (
            <ol className="map-multi-floor-hints muted" aria-label="Steps for multiple floors">
              {routeMeta.multiFloorRouteHints.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ol>
          )}
        {routeSegments.length > 1 && (
          <div className="map-route-steps">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => goToRouteSegment(activeRouteSegmentIndex - 1)}
              disabled={activeRouteSegmentIndex <= 0}
            >
              {routeMeta?.crossMap ? 'Prev Pic' : 'Prev Segment'}
            </button>
            <span className="muted">
              {routeMeta?.crossMap ? 'Floor' : 'Segment'} {activeRouteSegmentIndex + 1}/{routeSegments.length}
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => goToRouteSegment(activeRouteSegmentIndex + 1)}
              disabled={activeRouteSegmentIndex >= routeSegments.length - 1}
            >
              {routeMeta?.crossMap ? 'Next Pic' : 'Next Segment'}
            </button>
            <label className="map-checkbox-label">
              <input
                type="checkbox"
                checked={isRouteAutoStepEnabled}
                onChange={(e) => setIsRouteAutoStepEnabled(e.target.checked)}
              />
              <span>Auto-step</span>
            </label>
          </div>
        )}
        {routeError && <p className="error map-route-error">{routeError}</p>}
        {!routeError && routeSlowHint && (
          <p className="muted map-route-slow-hint">{routeSlowHint}</p>
        )}

        <div className="map-divider" />
        <label className="label" htmlFor="filter-building-select">Building</label>
        <select
          id="filter-building-select"
          className="input"
          value={filterBuildingId}
          onChange={(e) => setFilterBuildingId(e.target.value)}
        >
          <option value="">All buildings</option>
          {buildings.map((building) => (
            <option key={building._id} value={building._id}>
              {building.name}
            </option>
          ))}
        </select>
        <label className="label" htmlFor="filter-floor-select">Floor</label>
        <select
          id="filter-floor-select"
          className="input"
          value={filterFloor}
          onChange={(e) => setFilterFloor(e.target.value)}
        >
          <option value="">All floors</option>
          {floorOptions.map((floor) => (
            <option key={floor} value={floor}>
              {floor < 0 ? `Basement ${Math.abs(floor)}` : `Floor ${floor}`}
            </option>
          ))}
        </select>
        <div className="map-divider" />
        <label className="map-checkbox-label">
          <input
            type="checkbox"
            checked={showNavigationNodes}
            onChange={(e) => setShowNavigationNodes(e.target.checked)}
          />
          <span>Show routing nodes</span>
        </label>
        <p className="muted map-nodes-hint">
          Green dots are graph nodes for pathfinding (mapId, x, y). Connect them with edges in Admin → Nodes.
        </p>

        {isAuthenticated && (
          <>
            <div className="map-divider" />
            <p className="map-admin-title">
              {editingNavLocationId ? 'Admin: Edit map location' : 'Admin: Add Campus Location'}
            </p>
            {editingNavLocationId ? (
              <p className="map-admin-hint map-admin-editing-banner">
                Editing <strong>{newLocationName || 'location'}</strong> — highlighted on the map. Adjust corners or corridor points, then{' '}
                <strong>Save changes</strong>.
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={handleCancelNavLocationEdit}
                >
                  Cancel
                </button>
              </p>
            ) : (
              <p className="map-admin-hint">
                {newLocationKind === 'door' && doorMultiPlaceMode
                  ? 'Click each doorway; the linked room is chosen from the outline you are inside (or the nearest room pin). Then save once.'
                  : 'Click the map to auto-fill coordinates, then save.'}
              </p>
            )}
            <p className="map-admin-coords">
              X: {selectedCoordinate?.x ?? '-'} | Y: {selectedCoordinate?.y ?? '-'}
              {newLocationKind === 'door' && doorMultiPlaceMode && pendingDoors.length > 0
                ? ` · ${pendingDoors.length} pending`
                : ''}
            </p>
            <label className="label">Mark as</label>
            <select
              className="input"
              value={newLocationKind}
              onChange={(e) => {
                const next = e.target.value;
                setEditingNavLocationId('');
                setNewLocationKind(next);
                if (next !== 'corridor') {
                  setCorridorDraftPoints([]);
                  setSelectedCorridorPointIndex(-1);
                }
                if (next === 'corridor' || next === 'door') {
                  setDefineRoomFootprint(false);
                  setFootprintDraftPoints([]);
                }
                if (next !== 'door') {
                  setDoorLinksToLocationId('');
                  setDoorMultiPlaceMode(false);
                  setPendingDoors([]);
                }
              }}
            >
              <option value="point">Point location</option>
              <option value="door">Door (route ends here for linked place)</option>
              <option value="corridor">Corridor (polyline)</option>
            </select>
            {newLocationKind === 'door' && (
              <>
                <label className="map-checkbox-label" style={{ marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={doorMultiPlaceMode}
                    disabled={!!editingNavLocationId}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setDoorMultiPlaceMode(on);
                      setPendingDoors([]);
                      if (on) {
                        setEditingNavLocationId('');
                        setNewLocationKind('door');
                        setShowMapBaseOverlays(true);
                        setSaveSuccess('');
                        setSaveError('');
                      }
                    }}
                  />
                  <span>Many doors, one save — click the map for each door, then save once</span>
                </label>
                {doorMultiPlaceMode && !editingNavLocationId && (
                  <p className="muted" style={{ marginTop: '0.35rem' }}>
                    Click door positions on the map; each dot is linked to the room whose footprint contains that point (smallest room if several). If a place has no outline, the nearest room pin within range is used. Use the list below only to override when auto-detect fails.
                  </p>
                )}
                {doorMultiPlaceMode && pendingDoors.length > 0 && (
                  <p className="muted" style={{ marginTop: '0.35rem' }}>
                    Pending: <strong>{pendingDoors.length}</strong> door{pendingDoors.length === 1 ? '' : 's'} on the map.
                    <span className="map-corridor-actions" style={{ marginLeft: '0.35rem', display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPendingDoors((prev) => prev.slice(0, -1))}
                        disabled={pendingDoors.length === 0}
                      >
                        Undo last
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPendingDoors([])}
                        disabled={pendingDoors.length === 0}
                      >
                        Clear all
                      </button>
                    </span>
                  </p>
                )}
                <label className="label" htmlFor="door-links-to-select" style={{ marginTop: '0.5rem' }}>
                  {doorMultiPlaceMode ? 'Override room (optional — used if click is not inside/near any room)' : 'Links to place (optional)'}
                </label>
                <select
                  id="door-links-to-select"
                  className="input"
                  value={doorLinksToLocationId}
                  onChange={(e) => setDoorLinksToLocationId(e.target.value)}
                >
                  <option value="">
                    {doorMultiPlaceMode ? '— Auto from map click (or pick to force) —' : 'None — door only on map'}
                  </option>
                  {doorLinkTargetOptions.map((loc) => (
                    <option key={loc._id} value={loc._id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <p className="muted" style={{ marginTop: '0.35rem' }}>
                  {doorMultiPlaceMode
                    ? 'Save room polygons (point + “Room outline”) for best accuracy. Single-door mode also auto-fills the link when you click inside a footprint or near a pin.'
                    : 'Click the door threshold; the link auto-fills from the room outline or nearest pin. You can still pick a room manually from the list.'}
                </p>
              </>
            )}
            {newLocationKind === 'point' && (
              <label className="map-checkbox-label" style={{ marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={defineRoomFootprint}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setDefineRoomFootprint(on);
                    if (!on) setFootprintDraftPoints([]);
                  }}
                />
                <span>Room / building outline (click ≥3 corners)</span>
              </label>
            )}
            {newLocationKind === 'point' && defineRoomFootprint && (
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                Corners: {footprintDraftPoints.length}. Route picks the best side toward corridors.
              </p>
            )}
            {newLocationKind === 'point' && defineRoomFootprint && (
              <div className="map-corridor-actions" style={{ marginTop: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setFootprintDraftPoints((prev) => prev.slice(0, -1))}
                  disabled={footprintDraftPoints.length === 0}
                >
                  Undo last corner
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setFootprintDraftPoints([])}
                  disabled={footprintDraftPoints.length === 0}
                >
                  Clear outline
                </button>
              </div>
            )}
            {newLocationKind === 'corridor' && (
              <div className="map-corridor-tools">
                <label className="label">Edit existing corridor</label>
                <select
                  className="input"
                  value={newLocationKind === 'corridor' ? editingNavLocationId : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) {
                      handleCancelNavLocationEdit();
                      return;
                    }
                    handleStartNavLocationEdit(value);
                  }}
                >
                  <option value="">New corridor</option>
                  {editableCorridorsForForm.map((corridor) => (
                    <option key={corridor._id} value={corridor._id}>
                      {corridor.name}
                    </option>
                  ))}
                </select>
                <p className="muted">Corridor points: {corridorDraftPoints.length} (click map to add)</p>
                <p className="muted map-corridor-workflow-hint">
                  Redrawing a floor: delete old corridor items in Admin if needed, then trace the hallway centerline
                  in one go when possible (or meet other corridors exactly at corners). Save, run Check corridor
                  connection for this map, then Draw route.
                </p>
                <div className="map-corridor-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCorridorDraftPoints((prev) => prev.slice(0, -1))}
                    disabled={corridorDraftPoints.length === 0}
                  >
                    Undo last point
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCorridorDraftPoints([])}
                    disabled={corridorDraftPoints.length === 0}
                  >
                    Clear corridor
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (selectedCorridorPointIndex < 0) return;
                      setCorridorDraftPoints((prev) => prev.filter((_, idx) => idx !== selectedCorridorPointIndex));
                      setSelectedCorridorPointIndex(-1);
                    }}
                    disabled={selectedCorridorPointIndex < 0}
                  >
                    Remove selected point
                  </button>
                  {editingNavLocationId && newLocationKind === 'corridor' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleCancelNavLocationEdit}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </div>
            )}
            <label className="label">Location name</label>
            {newLocationKind === 'door' && doorMultiPlaceMode && !editingNavLocationId && (
              <p className="muted" style={{ marginBottom: '0.35rem' }}>
                Not used while placing many doors — each door gets a unique name from its linked room when you save.
              </p>
            )}
            <input
              className="input"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder="e.g. Room A-109"
              disabled={newLocationKind === 'door' && doorMultiPlaceMode && !editingNavLocationId}
            />
            <label className="label">Building</label>
            <select
              className="input"
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
            >
              {buildings.map((building) => (
                <option key={building._id} value={building._id}>
                  {building.name}
                </option>
              ))}
            </select>
            <label className="label">Floor</label>
            <input
              className="input"
              type="number"
              min={-2}
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
            />
            <label className="label" htmlFor="admin-map-id-select">Map</label>
            <select
              id="admin-map-id-select"
              className="input"
              value={formMapId}
              onChange={(e) => handleNavigationMapChange(e.target.value)}
            >
              {campusMaps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.label}
                </option>
              ))}
            </select>
            <button className="btn btn-primary map-admin-save-btn" type="button" onClick={handleSaveCoordinate} disabled={isSaving}>
              {isSaving
                ? 'Saving...'
                : editingNavLocationId
                  ? 'Save changes'
                  : newLocationKind === 'door' && doorMultiPlaceMode
                    ? pendingDoors.length > 0
                      ? `Save all ${pendingDoors.length} door${pendingDoors.length === 1 ? '' : 's'}`
                      : 'Save all doors'
                    : 'Save Coordinates'}
            </button>
            {saveError && <p className="error map-admin-msg">{saveError}</p>}
            {saveSuccess && <p className="map-admin-success map-admin-msg">{saveSuccess}</p>}

            {editingEdgeId && (
              <>
                <div className="map-divider" />
                <p className="map-admin-title">Admin: Edit graph edge</p>
                <p className="map-admin-hint map-admin-editing-banner">
                  Endpoints are highlighted on the map. When both nodes are on this floor plan, a purple dashed line shows the edge.
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: '0.5rem' }}
                    onClick={handleCancelEdgeEdit}
                  >
                    Cancel
                  </button>
                </p>
                <label className="label" htmlFor="edge-map-from-node">From node</label>
                <select
                  id="edge-map-from-node"
                  className="input"
                  value={edgeMapForm.fromNode}
                  onChange={(e) => setEdgeMapForm((f) => ({ ...f, fromNode: e.target.value }))}
                >
                  <option value="">Select node</option>
                  {allNodesForEdgeSelect.map((n) => (
                    <option key={n._id} value={n._id}>
                      {n.name} ({n.buildingId?.name ?? 'building'})
                    </option>
                  ))}
                </select>
                <label className="label" htmlFor="edge-map-to-node">To node</label>
                <select
                  id="edge-map-to-node"
                  className="input"
                  value={edgeMapForm.toNode}
                  onChange={(e) => setEdgeMapForm((f) => ({ ...f, toNode: e.target.value }))}
                >
                  <option value="">Select node</option>
                  {allNodesForEdgeSelect.map((n) => (
                    <option key={n._id} value={n._id}>
                      {n.name} ({n.buildingId?.name ?? 'building'})
                    </option>
                  ))}
                </select>
                <label className="label" htmlFor="edge-map-distance">Distance</label>
                <input
                  id="edge-map-distance"
                  className="input"
                  type="number"
                  min={0}
                  step={0.1}
                  value={edgeMapForm.distance}
                  onChange={(e) => setEdgeMapForm((f) => ({ ...f, distance: e.target.value }))}
                />
                <button
                  className="btn btn-primary map-admin-save-btn"
                  type="button"
                  onClick={handleSaveEdgeOnMap}
                  disabled={edgeSaving}
                >
                  {edgeSaving ? 'Saving…' : 'Save edge'}
                </button>
                {edgeSaveError && <p className="error map-admin-msg">{edgeSaveError}</p>}
                {edgeSaveSuccess && <p className="map-admin-success map-admin-msg">{edgeSaveSuccess}</p>}
              </>
            )}

            <div className="map-divider" />
            <p className="map-admin-title">
              {editingNavNodeId ? 'Admin: Edit routing node' : 'Admin: Add routing node'}
            </p>
            {editingNavNodeId ? (
              <p className="map-admin-hint map-admin-editing-banner">
                Editing <strong>{navNodeName || 'node'}</strong> — highlighted on the map. Click to move, then{' '}
                <strong>Save changes</strong>.
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={handleCancelNavNodeEdit}
                >
                  Cancel
                </button>
              </p>
            ) : (
              <p className="map-admin-hint">Uses the same map click, building, floor, and map as above.</p>
            )}
            <label className="label">Node name</label>
            <input
              className="input"
              value={navNodeName}
              onChange={(e) => setNavNodeName(e.target.value)}
              placeholder="e.g. Hallway junction A"
            />
            <label className="label">Node type</label>
            <select className="input" value={navNodeType} onChange={(e) => setNavNodeType(e.target.value)}>
              {NODE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary map-admin-save-btn"
              type="button"
              onClick={handleSaveNavigationNode}
              disabled={nodeSaving || Boolean(editingEdgeId)}
            >
              {nodeSaving ? 'Saving node…' : editingNavNodeId ? 'Save changes' : 'Save routing node'}
            </button>
            {nodeSaveError && <p className="error map-admin-msg">{nodeSaveError}</p>}
            {nodeSaveSuccess && <p className="map-admin-success map-admin-msg">{nodeSaveSuccess}</p>}
          </>
        )}
      </aside>

      <div className="map-main-area">
        {(isLoadingLocations || locationsError) && (
          <div className="map-status-inline">
            {isLoadingLocations ? 'Loading locations...' : locationsError}
          </div>
        )}
        <div className="map-canvas-wrap map-canvas-wrap--floor" key={selectedMap.id}>
          {routeSegments.length > 1 && (
            <div className="map-floor-step-float" role="group" aria-label="Change route floor view">
              {activeRouteSegmentIndex > 0 && (
                <button
                  type="button"
                  className="btn btn-sm map-floor-step-float-btn"
                  onClick={() => goToRouteSegment(activeRouteSegmentIndex - 1)}
                >
                  {routeMeta?.crossMap ? 'Prev Pic' : 'Prev'}
                </button>
              )}
              {activeRouteSegmentIndex < routeSegments.length - 1 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm map-floor-step-float-btn"
                  onClick={() => goToRouteSegment(activeRouteSegmentIndex + 1)}
                >
                  Next Pic
                </button>
              )}
            </div>
          )}
          <CampusImageMap
            mapKey={selectedMap.id}
            mapDefinition={selectedMap}
            locations={locationsOnMap}
            footprintLocations={locationsOnMap}
            footprintDraftPoints={
              newLocationKind === 'point' && defineRoomFootprint ? footprintDraftPoints : []
            }
            corridors={corridorsOnMap}
            corridorDraftPoints={newLocationKind === 'corridor' ? corridorDraftPoints : []}
            doorDraftPoints={
              newLocationKind === 'door' && doorMultiPlaceMode
                ? pendingDoors.map((d) => {
                    const room = doorLinkTargetOptions.find(
                      (l) => String(l._id) === String(d.linksToLocationId)
                    );
                    return { x: d.x, y: d.y, label: room?.name ? `→ ${room.name}` : 'Linked room' };
                  })
                : []
            }
            selectedCorridorPointIndex={selectedCorridorPointIndex}
            navigationNodes={navigationNodesOnMap}
            focusedNavigationNodeIds={focusedNavigationNodeIds}
            edgePreviewPath={edgePreviewPath}
            onMapClick={handleMapClick}
            onCorridorPointDrag={handleCorridorPointDrag}
            onCorridorPointSelect={setSelectedCorridorPointIndex}
            focusedLocationId={focusedLocationId}
            routePath={activeRoutePath}
            isAdminRenameEnabled={isAuthenticated}
            onRenameNavigationLocation={handleRenameNavigationLocationFromPopup}
          />
        </div>
      </div>
    </section>
  );
}
