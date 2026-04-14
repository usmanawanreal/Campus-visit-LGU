export default function MapImageSelector({ maps, selectedMapId, onChange }) {
  return (
    <div className="map-selector">
      <label htmlFor="campus-map-selector" className="map-selector-label">
        Select map
      </label>
      <select
        id="campus-map-selector"
        className="input map-selector-input"
        value={selectedMapId}
        onChange={(e) => onChange(e.target.value)}
      >
        {maps.map((mapItem) => (
          <option key={mapItem.id} value={mapItem.id}>
            {mapItem.label}
          </option>
        ))}
      </select>
    </div>
  );
}

