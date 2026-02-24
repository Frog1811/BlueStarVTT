import { useState } from 'react';
import { ConditionIcons, CONDITIONS, type ConditionType } from '../ConditionIcons';
import './ConditionSelector.css';

interface ConditionSelectorProps {
  position: { x: number; y: number };
  currentConditions: ConditionType[];
  onConditionToggle: (condition: ConditionType) => void;
  onClose: () => void;
}

function ConditionSelector({ position, currentConditions, onConditionToggle, onClose }: ConditionSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredConditions = CONDITIONS.filter(condition =>
    condition.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div
        className="condition-selector-overlay"
        onClick={onClose}
      />
      <div
        className="condition-selector"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 10001,
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="condition-selector-header">
          <h3>Add Status/Condition</h3>
          <button className="condition-close-btn" onClick={onClose}>×</button>
        </div>

        <input
          type="text"
          className="condition-search"
          placeholder="Search conditions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="condition-grid">
          {filteredConditions.map((condition) => {
            const Icon = ConditionIcons[condition];
            const isActive = currentConditions.includes(condition);

            return (
              <div
                key={condition}
                className={`condition-item ${isActive ? 'active' : ''}`}
                onClick={() => onConditionToggle(condition)}
                title={condition}
              >
                <div className="condition-icon">
                  <Icon />
                </div>
                <span className="condition-name">{condition}</span>
                {isActive && <span className="condition-check">✓</span>}
              </div>
            );
          })}
        </div>

        {filteredConditions.length === 0 && (
          <div className="condition-empty">No conditions found</div>
        )}
      </div>
    </>
  );
}

export default ConditionSelector;









