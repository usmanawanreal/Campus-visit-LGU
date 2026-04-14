import { useState, useEffect } from 'react';
import { isFloorPlanMapId, mapIdToFloorFilterValue } from '../data/campusMaps.js';

/**
 * Leaflet popup body for a navigation location (point / door / corridor anchor).
 * When `isAdmin`, the name can be edited and saved without opening the full admin form.
 */
export default function NavLocationPopupBody({ location, isAdmin, onRenameLocation }) {
  const [nameDraft, setNameDraft] = useState(location.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNameDraft(location.name || '');
    setError('');
  }, [location._id, location.name]);

  const isDoor = (location.kind || 'point') === 'door';
  const expectedFloor =
    location.mapId && isFloorPlanMapId(location.mapId)
      ? mapIdToFloorFilterValue(location.mapId)
      : null;
  const floorMismatch =
    expectedFloor != null &&
    expectedFloor !== '' &&
    Number(location.floor) !== Number(expectedFloor);

  const handleSave = async () => {
    const next = nameDraft.trim();
    if (!next) {
      setError('Name cannot be empty.');
      return;
    }
    if (next === (location.name || '').trim()) {
      setError('');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onRenameLocation(String(location._id), next);
    } catch (err) {
      setError(err?.message || 'Could not save name.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {isAdmin ? (
        <div style={{ marginBottom: '6px' }}>
          <label className="muted" style={{ fontSize: '11px', display: 'block', marginBottom: '2px' }}>
            Name (admin)
          </label>
          <input
            type="text"
            className="input"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            style={{ width: '100%', maxWidth: '220px', fontSize: '13px', padding: '4px 6px' }}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            style={{ marginTop: '6px' }}
            disabled={saving || nameDraft.trim() === (location.name || '').trim()}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save name'}
          </button>
          {error ? (
            <p className="error" style={{ fontSize: '11px', margin: '4px 0 0' }}>
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <strong>{location.name}</strong>
      )}
      {isDoor && <div className="muted">Door (route endpoint)</div>}
      <div>Building: {location.building?.name || 'Unknown'}</div>
      <div>Floor: {location.floor}</div>
      {floorMismatch && (
        <div className="muted" style={{ fontSize: '11px', marginTop: '6px', maxWidth: '220px' }}>
          This image is floor {expectedFloor} in the app. Open map admin, set Floor to {expectedFloor}, and save so
          doors and routing stay in sync.
        </div>
      )}
    </div>
  );
}
