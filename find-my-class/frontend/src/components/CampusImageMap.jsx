import { memo, useEffect, useMemo } from 'react';
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  useMap,
  useMapEvents
} from 'react-leaflet';
import { CRS, LatLng, LatLngBounds, divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import NavLocationPopupBody from './NavLocationPopupBody.jsx';
import { routePathSignature } from '../utils/routeDrawing.js';

function toLeafletPoint(point, mapDefinition) {
  // Convert normalized data coordinates into image-space coordinates used by CRS.Simple.
  const maxX = Number(mapDefinition.coordinateMaxX || mapDefinition.width || 1);
  const maxY = Number(mapDefinition.coordinateMaxY || mapDefinition.height || 1);
  const x = (Number(point.x) / maxX) * Number(mapDefinition.width);
  const y = (Number(point.y) / maxY) * Number(mapDefinition.height);
  return [y, x];
}

function fromLeafletPoint(latlng, mapDefinition) {
  // Convert click position from image-space back to normalized data coordinates.
  const maxX = Number(mapDefinition.coordinateMaxX || mapDefinition.width || 1);
  const maxY = Number(mapDefinition.coordinateMaxY || mapDefinition.height || 1);
  const x = (Number(latlng.lng) / Number(mapDefinition.width || 1)) * maxX;
  const y = (Number(latlng.lat) / Number(mapDefinition.height || 1)) * maxY;
  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2))
  };
}

/** Extra zoom-out steps below the level that fits the image (large PNGs need a low min zoom). */
const ZOOM_OUT_BUFFER = 10;
const ABSOLUTE_MIN_ZOOM = -18;
const corridorHandleIcon = divIcon({
  className: 'corridor-draft-handle',
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

function MapBoundsUpdater({ bounds, mapInstanceKey }) {
  const map = useMap();

  useEffect(() => {
    map.setMaxBounds(bounds);

    const applyBoundsAndZoomLimits = (animate = true) => {
      map.invalidateSize();
      const fitZoom = map.getBoundsZoom(bounds);
      const safeFit = Number.isFinite(fitZoom) ? fitZoom : 0;
      // Allow zooming out well past "fit" so huge floor plans (e.g. 15k px) can show fully on screen.
      const minZ = Math.max(safeFit - ZOOM_OUT_BUFFER, ABSOLUTE_MIN_ZOOM);
      map.setMinZoom(minZ);
      map.fitBounds(bounds, {
        animate,
        duration: animate ? 0.35 : 0,
        padding: [4, 4]
      });
    };

    // First paint after floor change: snap without animation to avoid stacked-overlay flash.
    applyBoundsAndZoomLimits(false);
    const onResize = () => applyBoundsAndZoomLimits(true);
    window.addEventListener('resize', onResize);
    const t = setTimeout(() => applyBoundsAndZoomLimits(true), 120);

    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(t);
    };
  }, [map, bounds, mapInstanceKey]);

  return null;
}

function MapClickCapture({ onMapClick, mapDefinition }) {
  useMapEvents({
    click(event) {
      onMapClick?.(fromLeafletPoint(event.latlng, mapDefinition));
    }
  });
  return null;
}

function MapFocusLocation({ focusedLocation, mapDefinition }) {
  const map = useMap();

  useEffect(() => {
    if (!focusedLocation) return;
    map.flyTo(toLeafletPoint(focusedLocation, mapDefinition), Math.max(map.getZoom(), 1), {
      animate: true,
      duration: 0.35
    });
  }, [map, focusedLocation, mapDefinition]);

  return null;
}

function MapFocusRoute({ routePath, mapDefinition }) {
  const map = useMap();

  useEffect(() => {
    if (!routePath || routePath.length < 2) return;
    const bounds = new LatLngBounds(
      routePath.map((point) => {
        const [lat, lng] = toLeafletPoint(point, mapDefinition);
        return new LatLng(Number(lat), Number(lng));
      })
    );
    map.flyToBounds(bounds, { animate: true, duration: 0.35, padding: [20, 20] });
  }, [map, routePath, mapDefinition]);

  return null;
}

function CampusImageMap({
  mapKey,
  mapDefinition,
  locations = [],
  corridors = [],
  corridorDraftPoints = [],
  selectedCorridorPointIndex = -1,
  /** Graph nodes for routing: { _id, name, x, y, mapId, floor?, type?, buildingId? } */
  navigationNodes = [],
  /** Node ids to emphasize (e.g. while editing a node or edge on the map). */
  focusedNavigationNodeIds = [],
  /** Optional {x,y} points in map data coords — e.g. edge preview on the active floor plan. */
  edgePreviewPath = [],
  onMapClick,
  onCorridorPointDrag,
  onCorridorPointSelect,
  focusedLocationId,
  /** Screen polyline points in normalized map coords (start → A* path → end). */
  routePath = [],
  /** Point locations that may include footprintPoints (room/building outline). */
  footprintLocations = [],
  /** Draft corners while defining a room outline (same coords as map clicks). */
  footprintDraftPoints = [],
  /** Pending door placements before batch save: { x, y, label? } in map data coords. */
  doorDraftPoints = [],
  /** When true, map pin popups allow renaming navigation locations (admin session). */
  isAdminRenameEnabled = false,
  /** (id, newName) => Promise — persists name via API; parent refreshes location lists. */
  onRenameNavigationLocation,
  /** Location ids that cannot snap to any corridor island — drawn in red when listed. */
  orphanLocationIds = [],
  /** After stair audit: cannot walk corridor graph to stairs/elevator — green pins. */
  stairGapLocationIds = [],
  /** Cross-floor connectivity audit: cannot reach another floor via corridors + stairs — pink pins. */
  crossFloorGapLocationIds = []
}) {
  const floorKey = mapKey ?? mapDefinition.id;
  const bounds = useMemo(
    () => new LatLngBounds([0, 0], [mapDefinition.height, mapDefinition.width]),
    [mapDefinition.height, mapDefinition.width]
  );
  const focusedLocation = useMemo(() => {
    if (focusedLocationId == null || focusedLocationId === '') return null;
    const want = String(focusedLocationId);
    return locations.find((location) => String(location._id ?? location.id ?? '') === want) || null;
  }, [locations, focusedLocationId]);
  const normalizedRoute = useMemo(
    () => routePath.map((point) => toLeafletPoint(point, mapDefinition)),
    [routePath, mapDefinition]
  );
  const normalizedEdgePreview = useMemo(
    () =>
      (edgePreviewPath || [])
        .map((point) => toLeafletPoint(point, mapDefinition))
        .filter((p) => Array.isArray(p) && p.length === 2),
    [edgePreviewPath, mapDefinition]
  );
  const routeLayerKey = useMemo(() => routePathSignature(routePath), [routePath]);
  const focusedNavIdSet = useMemo(
    () => new Set((focusedNavigationNodeIds || []).map(String)),
    [focusedNavigationNodeIds]
  );
  const orphanIdSet = useMemo(
    () => new Set((orphanLocationIds || []).map(String)),
    [orphanLocationIds]
  );
  const stairGapIdSet = useMemo(
    () => new Set((stairGapLocationIds || []).map(String)),
    [stairGapLocationIds]
  );
  const crossFloorGapIdSet = useMemo(
    () => new Set((crossFloorGapLocationIds || []).map(String)),
    [crossFloorGapLocationIds]
  );
  const normalizedLocations = useMemo(
    () =>
      locations.map((location) => ({
        ...location,
        leafletCenter: toLeafletPoint(location, mapDefinition)
      })),
    [locations, mapDefinition]
  );
  const normalizedCorridors = useMemo(
    () =>
      corridors.map((corridor) => ({
        ...corridor,
        leafletPoints: (corridor.corridorPoints || [])
          .map((p) => toLeafletPoint(p, mapDefinition))
          .filter((p) => Array.isArray(p) && p.length === 2)
      })),
    [corridors, mapDefinition]
  );
  const normalizedNavNodes = useMemo(
    () =>
      navigationNodes.map((node) => ({
        ...node,
        leafletCenter: toLeafletPoint(node, mapDefinition)
      })),
    [navigationNodes, mapDefinition]
  );
  const normalizedLocationFootprints = useMemo(
    () =>
      (footprintLocations || [])
        .filter((loc) => Array.isArray(loc.footprintPoints) && loc.footprintPoints.length >= 3)
        .map((loc) => ({
          id: loc._id,
          leafletRing: loc.footprintPoints
            .map((p) => toLeafletPoint(p, mapDefinition))
            .filter((p) => Array.isArray(p) && p.length === 2)
        }))
        .filter((item) => item.leafletRing.length >= 3),
    [footprintLocations, mapDefinition]
  );
  const normalizedFootprintDraft = useMemo(
    () =>
      (footprintDraftPoints || [])
        .map((p) => toLeafletPoint(p, mapDefinition))
        .filter((p) => Array.isArray(p) && p.length === 2),
    [footprintDraftPoints, mapDefinition]
  );
  const normalizedCorridorDraft = useMemo(
    () =>
      corridorDraftPoints.map((point, index) => ({
        index,
        point,
        leafletCenter: toLeafletPoint(point, mapDefinition)
      })),
    [corridorDraftPoints, mapDefinition]
  );
  const normalizedDoorDraft = useMemo(
    () =>
      (doorDraftPoints || [])
        .map((p, index) => ({
          index,
          label: p.label || `Door ${index + 1}`,
          leafletCenter: toLeafletPoint({ x: p.x, y: p.y }, mapDefinition)
        }))
        .filter((item) => Array.isArray(item.leafletCenter) && item.leafletCenter.length === 2),
    [doorDraftPoints, mapDefinition]
  );

  return (
    <MapContainer
      key={floorKey}
      crs={CRS.Simple}
      bounds={bounds}
      maxBounds={bounds}
      maxBoundsViscosity={1}
      minZoom={ABSOLUTE_MIN_ZOOM}
      maxZoom={6}
      zoomControl
      scrollWheelZoom
      className="campus-image-map"
    >
      <MapBoundsUpdater bounds={bounds} mapInstanceKey={floorKey} />
      <MapClickCapture onMapClick={onMapClick} mapDefinition={mapDefinition} />
      <MapFocusLocation focusedLocation={focusedLocation} mapDefinition={mapDefinition} />
      <MapFocusRoute routePath={routePath} mapDefinition={mapDefinition} />
      <ImageOverlay url={mapDefinition.imageUrl} bounds={bounds} />
      {normalizedLocationFootprints.map((fp) => (
        <Polygon
          key={`loc-fp-${fp.id}`}
          positions={fp.leafletRing}
          pathOptions={{
            color: '#7c3aed',
            weight: 2,
            fillColor: '#a78bfa',
            fillOpacity: 0.15,
            opacity: 0.9
          }}
        />
      ))}
      {normalizedFootprintDraft.length > 1 && (
        <Polyline
          key={`footprint-draft-${normalizedFootprintDraft.length}`}
          positions={normalizedFootprintDraft}
          pathOptions={{ color: '#7c3aed', weight: 3, opacity: 0.85, dashArray: '6 4' }}
        />
      )}
      {normalizedFootprintDraft.length >= 3 && (
        <Polygon
          key={`footprint-draft-fill-${normalizedFootprintDraft.length}`}
          positions={normalizedFootprintDraft}
          pathOptions={{
            color: '#7c3aed',
            weight: 2,
            fillColor: '#a78bfa',
            fillOpacity: 0.12,
            dashArray: '4 3'
          }}
        />
      )}
      {routePath.length > 1 && (
        <Polyline
          key={routeLayerKey || 'route-empty'}
          positions={normalizedRoute}
          pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.95, lineJoin: 'round' }}
        />
      )}
      {normalizedEdgePreview.length > 1 && (
        <Polyline
          key={`edge-preview-${normalizedEdgePreview.length}`}
          positions={normalizedEdgePreview}
          pathOptions={{ color: '#7c3aed', weight: 4, opacity: 0.9, dashArray: '6 4', lineJoin: 'round' }}
        />
      )}
      {normalizedNavNodes.map((node) => {
        const focusedNav = focusedNavIdSet.has(String(node._id));
        return (
        <CircleMarker
          key={`nav-${node._id}`}
          center={node.leafletCenter}
          radius={focusedNav ? 9 : 5}
          pathOptions={
            focusedNav
              ? { color: '#b45309', fillColor: '#fbbf24', fillOpacity: 0.98, weight: 2 }
              : {
                  color: '#047857',
                  fillColor: '#10b981',
                  fillOpacity: 0.92,
                  weight: 1
                }
          }
        >
          <Popup>
            <div>
              <strong>Node: {node.name}</strong>
              <div className="muted" style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                id: {node._id}
              </div>
              <div>mapId: {node.mapId}</div>
              <div>floor: {node.floor}</div>
              {node.type && <div>type: {node.type}</div>}
            </div>
          </Popup>
        </CircleMarker>
        );
      })}
      {normalizedCorridors.map((corridor) => (
        corridor.leafletPoints.length > 1 ? (
          <Polyline
            key={`corridor-${corridor._id}`}
            positions={corridor.leafletPoints}
            pathOptions={{ color: '#f97316', weight: 4, opacity: 0.95, dashArray: '8 6' }}
          />
        ) : null
      ))}
      {normalizedCorridorDraft.length > 1 && (
        <Polyline
          key={`corridor-draft-${normalizedCorridorDraft.length}`}
          positions={normalizedCorridorDraft.map((item) => item.leafletCenter)}
          pathOptions={{ color: '#f59e0b', weight: 5, opacity: 0.95 }}
        />
      )}
      {normalizedCorridorDraft.map((item) => (
        <Marker
          key={`corridor-draft-handle-${item.index}`}
          position={item.leafletCenter}
          icon={corridorHandleIcon}
          draggable
          eventHandlers={{
            click: () => onCorridorPointSelect?.(item.index),
            dragend: (event) => {
              const latlng = event.target.getLatLng();
              onCorridorPointDrag?.(item.index, fromLeafletPoint(latlng, mapDefinition));
            }
          }}
        >
          <Popup>
            <div>
              Corridor point #{item.index + 1}
              {selectedCorridorPointIndex === item.index ? ' (selected)' : ''}
            </div>
          </Popup>
        </Marker>
      ))}
      {normalizedDoorDraft.map((item) => (
        <CircleMarker
          key={`door-draft-${item.index}`}
          center={item.leafletCenter}
          radius={8}
          pathOptions={{
            color: '#b45309',
            fillColor: '#fbbf24',
            fillOpacity: 0.92,
            weight: 2,
            dashArray: '4 3'
          }}
        >
          <Popup>
            <div>
              <strong>Pending door</strong>
              <div className="muted" style={{ fontSize: '12px' }}>
                {item.label}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
      {normalizedLocations.map((location) => {
        const isDoor = (location.kind || 'point') === 'door';
        const locId = String(location._id ?? location.id ?? '');
        const focused =
          focusedLocationId != null &&
          focusedLocationId !== '' &&
          locId === String(focusedLocationId);
        const isOrphan = locId !== '' && orphanIdSet.has(locId);
        const isCrossFloorGap = locId !== '' && crossFloorGapIdSet.has(locId);
        const isStairGap = locId !== '' && stairGapIdSet.has(locId);
        const pathOptions = focused
          ? { color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.98, weight: 2 }
          : isOrphan
            ? { color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.98, weight: 3 }
            : isCrossFloorGap
              ? { color: '#be185d', fillColor: '#f472b6', fillOpacity: 0.96, weight: 3 }
              : isStairGap
                ? { color: '#15803d', fillColor: '#22c55e', fillOpacity: 0.96, weight: 3 }
                : isDoor
                  ? { color: '#78350f', fillColor: '#d97706', fillOpacity: 0.95, weight: 2 }
                  : { color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.95, weight: 2 };
        return (
          <CircleMarker
            key={locId || `pin-${location.name}-${location.leafletCenter.join(',')}`}
            center={location.leafletCenter}
            radius={
              focused ? 11 : isOrphan ? 11 : isCrossFloorGap ? 10 : isStairGap ? 10 : isDoor ? 9 : 8
            }
            pathOptions={pathOptions}
          >
            <Popup>
              {isOrphan && (
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#b91c1c' }}>
                  Not linked to corridor graph — extend orange lines or move this pin closer to a hallway.
                </p>
              )}
              {isCrossFloorGap && !isOrphan && (
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#be185d' }}>
                  Cross-floor connectivity: this pin is not on a complete corridor + stair path to another floor image
                  in this building (see sidebar list for the reason).
                </p>
              )}
              {isStairGap && !isOrphan && !isCrossFloorGap && (
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#15803d' }}>
                  Stair audit: cannot reach stairs/elevator along corridors from this pin — fix orange lines or add a
                  labeled stair/elevator point on this floor.
                </p>
              )}
              <NavLocationPopupBody
                location={location}
                isAdmin={Boolean(isAdminRenameEnabled && onRenameNavigationLocation)}
                onRenameLocation={onRenameNavigationLocation}
              />
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

export default memo(CampusImageMap);
