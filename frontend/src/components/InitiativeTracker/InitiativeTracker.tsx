import { useState, useEffect } from 'react';
import {
  getInitiativeEntries,
  updateInitiativeValue,
  removeFromInitiative,
  clearInitiative,
  getTokenUrl,
  getBaseTokenUrl,
  type InitiativeEntry,
  type MapToken
} from '../../api';
import './InitiativeTracker.css';

// Dynamically import all icons from assets/Icons directory
const iconModules = import.meta.glob('../../assets/Icons/*.{png,jpg,jpeg,gif}', { eager: true }) as Record<string, { default: string }>;
// Dynamically import all tokens from assets/JOCAT directory
const jocatModules = import.meta.glob('../../assets/JOCAT/*.{png,jpg,jpeg,gif}', { eager: true }) as Record<string, { default: string }>;

// Create a map of icon filenames to their import paths
const iconMap = new Map<string, string>();
Object.entries(iconModules).forEach(([path, module]) => {
  const fileName = path.split('/').pop();
  if (fileName) {
    iconMap.set(fileName, module.default);
  }
});

// Create a map of JOCAT filenames to their import paths
const jocatMap = new Map<string, string>();
Object.entries(jocatModules).forEach(([path, module]) => {
  const fileName = path.split('/').pop();
  if (fileName) {
    jocatMap.set(fileName, module.default);
  }
});

interface InitiativeTrackerProps {
  mapId: string;
  isDM: boolean;
  isSelectingToken: boolean;
  onSelectingChange: (selecting: boolean) => void;
  onTokenSelected: (mapToken: MapToken) => Promise<void>;
}

function InitiativeTracker({ mapId, isDM, isSelectingToken, onSelectingChange }: InitiativeTrackerProps) {
  const [entries, setEntries] = useState<InitiativeEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(true);

  async function loadInitiative() {
    try {
      const data = await getInitiativeEntries(mapId);
      setEntries(data);
    } catch (error) {
      console.error('Failed to load initiative:', error);
    }
  }

  function handleCancelSelection() {
    onSelectingChange(false);
  }

  function handleToggleCollapsed() {
    setIsCollapsed((prev) => !prev);
  }

  useEffect(() => {
    if (mapId) {
      loadInitiative();

      // Poll for updates every 2 seconds
      const interval = setInterval(() => {
        loadInitiative();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [mapId]);

  // Add ESC key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectingToken) {
        handleCancelSelection();
      }
    };

    if (isSelectingToken) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isSelectingToken]);

  const handleAddClick = () => {
    if (!isDM) return;
    onSelectingChange(true);
  };

  const handleEdit = (entry: InitiativeEntry) => {
    setEditingId(entry.id);
    setEditValue(entry.initiative_value.toString());
  };

  const handleSaveEdit = async (id: string) => {
    const value = parseInt(editValue, 10);
    if (isNaN(value) || value < 1 || value > 40) {
      alert('Initiative value must be between 1 and 40.');
      return;
    }

    try {
      await updateInitiativeValue(id, value);
      await loadInitiative();
      setEditingId(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update initiative:', error);
      alert('Failed to update initiative.');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this token from initiative?')) return;

    try {
      await removeFromInitiative(id);
      await loadInitiative();
    } catch (error) {
      console.error('Failed to remove from initiative:', error);
      alert('Failed to remove from initiative.');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all initiative entries?')) return;

    try {
      await clearInitiative(mapId);
      await loadInitiative();
    } catch (error) {
      console.error('Failed to clear initiative:', error);
      alert('Failed to clear initiative.');
    }
  };

  const getBaseTokenImageUrl = (imagePath: string) => {
    const fileName = imagePath.split('/').pop();
    if (fileName && iconMap.has(fileName)) {
      return iconMap.get(fileName)!;
    }
    if (fileName && jocatMap.has(fileName)) {
      return jocatMap.get(fileName)!;
    }
    return getBaseTokenUrl(imagePath);
  };

  const getImageUrl = (imagePath: string, isBaseToken: boolean) => {
    const isBasePath = imagePath.startsWith('/assets/') || imagePath.startsWith('assets/');
    if (isBaseToken || isBasePath) {
      return getBaseTokenImageUrl(imagePath);
    }
    return getTokenUrl(imagePath);
  };

  return (
    <>
      {isCollapsed ? (
        <div className="initiative-tracker collapsed">
          <button
            className="initiative-collapsed-toggle"
            onClick={handleToggleCollapsed}
            title="Show tracker"
            type="button"
          >
            Show tracker
          </button>
        </div>
      ) : (
        <div className="initiative-tracker">
          <div className="initiative-header">
            <h3>Initiative Tracker</h3>
            <div className="initiative-header-actions">
              <button
                className="initiative-toggle-btn"
                onClick={handleToggleCollapsed}
                title="Hide tracker"
                type="button"
              >
                Hide
              </button>
              {isDM && (
                <div className="initiative-actions">
                  <button
                    className="initiative-add-btn"
                    onClick={handleAddClick}
                    disabled={isSelectingToken}
                    title="Add token to initiative"
                  >
                    +
                  </button>
                  {entries.length > 0 && (
                    <button
                      className="initiative-clear-btn"
                      onClick={handleClearAll}
                      title="Clear all initiative"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="initiative-list">
            {entries.length === 0 ? (
              <div className="initiative-empty">
                {isDM ? 'Click + to add tokens to initiative' : 'No initiative entries'}
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="initiative-entry"
                  style={{
                    borderLeft: entry.token_border_color
                      ? `4px solid var(--color-${entry.token_border_color})`
                      : '4px solid transparent'
                  }}
                >
                  <div className="initiative-token-image">
                    <img
                      src={getImageUrl(entry.token_image, entry.is_base_token)}
                      alt={entry.token_name}
                    />
                  </div>
                  <div className="initiative-token-info">
                    <span className="initiative-token-name">{entry.token_name}</span>
                  </div>
                  <div className="initiative-value-container">
                    {editingId === entry.id && isDM ? (
                      <div className="initiative-edit-controls">
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="initiative-edit-input"
                          autoFocus
                        />
                        <button
                          className="initiative-save-btn"
                          onClick={() => handleSaveEdit(entry.id)}
                        >
                          ✓
                        </button>
                        <button
                          className="initiative-cancel-btn"
                          onClick={handleCancelEdit}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className="initiative-value"
                          onClick={() => isDM && handleEdit(entry)}
                          style={{ cursor: isDM ? 'pointer' : 'default' }}
                        >
                          {entry.initiative_value}
                        </span>
                        {isDM && (
                          <button
                            className="initiative-remove-btn"
                            onClick={() => handleRemove(entry.id)}
                            title="Remove from initiative"
                          >
                            ×
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Token selection overlay */}
      {isSelectingToken && (
        <div className="initiative-selection-overlay">
          <div className="initiative-selection-message">
            Click a token on the map to add to initiative, or press ESC to cancel
            <button onClick={handleCancelSelection}>Cancel</button>
          </div>
        </div>
      )}

      {/* Global click handler for token selection */}
      {isSelectingToken && (
        <style>{`
          .map-token {
            cursor: crosshair !important;
            pointer-events: auto !important;
          }
        `}</style>
      )}
    </>
  );
}

export { InitiativeTracker, type InitiativeTrackerProps };
export default InitiativeTracker;

