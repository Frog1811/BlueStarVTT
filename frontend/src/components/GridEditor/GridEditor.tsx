import { useState, useEffect } from 'react';
import { updateMap, type Map } from '../../api';
import './GridEditor.css';

interface GridEditorProps {
  activeMap: Map | null;
  onGridUpdate: () => void;
}

function GridEditor({ activeMap, onGridUpdate }: GridEditorProps) {
  const [gridEnabled, setGridEnabled] = useState(false);
  const [gridCols, setGridCols] = useState(10);
  const [gridRows, setGridRows] = useState(10);
  const [gridColor, setGridColor] = useState<'white' | 'black' | 'pink'>('white');
  const [gridOpacity, setGridOpacity] = useState(100);

  // Update local state when active map changes
  useEffect(() => {
    if (activeMap) {
      setGridEnabled(activeMap.grid_enabled || false);
      setGridCols(activeMap.grid_cols || 10);
      setGridRows(activeMap.grid_rows || 10);
      setGridColor((activeMap.grid_color as 'white' | 'black' | 'pink') || 'white');
      setGridOpacity(activeMap.grid_opacity ?? 100);
    }
  }, [activeMap?.id]);

  const handleToggleGrid = async () => {
    if (!activeMap) return;

    const newEnabled = !gridEnabled;
    setGridEnabled(newEnabled);

    try {
      await updateMap(activeMap.id, { grid_enabled: newEnabled });
      onGridUpdate();
    } catch (error) {
      setGridEnabled(!newEnabled); // Revert on error
    }
  };

  const handleGridColsChange = async (value: number) => {
    if (!activeMap || value < 1 || value > 100) return;

    setGridCols(value);
    try {
      await updateMap(activeMap.id, { grid_cols: value });
      onGridUpdate();
    } catch (error) {
      // Error updating grid cols
    }
  };

  const handleGridRowsChange = async (value: number) => {
    if (!activeMap || value < 1 || value > 100) return;

    setGridRows(value);
    try {
      await updateMap(activeMap.id, { grid_rows: value });
      onGridUpdate();
    } catch (error) {
      // Error updating grid rows
    }
  };

  const handleGridColorChange = async (color: 'white' | 'black' | 'pink') => {
    if (!activeMap) return;

    setGridColor(color);
    try {
      await updateMap(activeMap.id, { grid_color: color });
      onGridUpdate();
    } catch (error) {
      // Error updating grid color
    }
  };

  const handleGridOpacityChange = async (value: number) => {
    if (!activeMap || value < 0 || value > 100) return;

    setGridOpacity(value);
    try {
      await updateMap(activeMap.id, { grid_opacity: value });
      onGridUpdate();
    } catch (error) {
      // Error updating grid opacity
    }
  };

  if (!activeMap) {
    return (
      <div className="grid-editor">
        <p className="grid-editor-empty">Select a map to configure grid</p>
      </div>
    );
  }

  return (
    <div className="grid-editor">
      <button
        className={`grid-toggle-btn ${gridEnabled ? 'active' : ''}`}
        onClick={handleToggleGrid}
      >
        {gridEnabled ? '✓ Remove Grid' : '+ Add Grid'}
      </button>

      {gridEnabled && (
        <div className="grid-controls">
          <div className="grid-control-group">
            <label className="grid-label">Grid Layout</label>
            <div className="grid-layout-inputs">
              <div className="grid-input-wrapper">
                <label className="grid-input-label">Columns (X)</label>
                <input
                  type="number"
                  className="grid-number-input"
                  value={gridCols}
                  onChange={(e) => handleGridColsChange(Number(e.target.value))}
                  min={1}
                  max={100}
                />
              </div>
              <div className="grid-input-wrapper">
                <label className="grid-input-label">Rows (Y)</label>
                <input
                  type="number"
                  className="grid-number-input"
                  value={gridRows}
                  onChange={(e) => handleGridRowsChange(Number(e.target.value))}
                  min={1}
                  max={100}
                />
              </div>
            </div>
          </div>

          <div className="grid-control-group">
            <label className="grid-label">Grid Color</label>
            <div className="grid-color-selector">
              <button
                className={`color-btn color-black ${gridColor === 'black' ? 'active' : ''}`}
                onClick={() => handleGridColorChange('black')}
                title="Black"
              />
              <button
                className={`color-btn color-white ${gridColor === 'white' ? 'active' : ''}`}
                onClick={() => handleGridColorChange('white')}
                title="White"
              />
              <button
                className={`color-btn color-pink ${gridColor === 'pink' ? 'active' : ''}`}
                onClick={() => handleGridColorChange('pink')}
                title="Pink"
              />
            </div>
          </div>

          <div className="grid-control-group">
            <label className="grid-label">Opacity: {gridOpacity}%</label>
            <input
              type="range"
              className="grid-opacity-slider"
              value={gridOpacity}
              onChange={(e) => handleGridOpacityChange(Number(e.target.value))}
              min={0}
              max={100}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default GridEditor;

