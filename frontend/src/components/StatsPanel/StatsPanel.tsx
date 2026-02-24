import { useState, useEffect, useCallback } from 'react';
import {
  getPlayerStats,
  updatePlayerStats,
  updatePlayerStatsById,
  deletePlayerStats,
  updatePlayerStatName,
  deleteEncounterNPC,
  createEncounterNPC,
  updateEncounterNPC,
  getEncounterNPCs,
  getMapNotes,
  saveMapNotes,
  type PlayerStat,
  type EncounterNPC
} from '../../api';
import './StatsPanel.css';
import PlayerStatsIcon from './icons/PlayerStatsIcon';
import EncounterStatsIcon from './icons/EncounterStatsIcon';
import MapNotesIcon from './icons/MapNotesIcon';
import TokenGroupsIcon from './icons/TokenGroupsIcon';
import TokenGroupsTab from './TokenGroupsTab';

interface StatsPanelProps {
  campaignId: string;
  mapId: string | null;
  isDM: boolean;
  onTokensChanged?: () => void;
  forceRefresh?: number;
}

type TabType = 'player-stats' | 'encounter-stats' | 'token-groups' | 'map-notes';

export default function StatsPanel({ campaignId, mapId, isDM, onTokensChanged, forceRefresh }: StatsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('player-stats');
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [encounterNPCs, setEncounterNPCs] = useState<EncounterNPC[]>([]);
  // ...existing code...
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mapNotes, setMapNotes] = useState<string>('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newNPCName, setNewNPCName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveDebounceTimer, setSaveDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Wrapper callback to refresh groups and call parent callback
  const handleTokensChanged = useCallback(() => {
    console.log('[StatsPanel] handleTokensChanged called, current refreshTrigger:', refreshTrigger);
    console.log('[StatsPanel] About to increment refreshTrigger');
    setRefreshTrigger(prev => {
      const newValue = prev + 1;
      console.log('[StatsPanel] refreshTrigger changed:', prev, '→', newValue);
      return newValue;
    });
    onTokensChanged?.();
  }, [onTokensChanged, refreshTrigger]);

  // When forceRefresh changes (from modal close), reload groups
  useEffect(() => {
    if (forceRefresh !== undefined && forceRefresh !== 0) {
      console.log('[StatsPanel] forceRefresh triggered:', forceRefresh);
      setRefreshTrigger(prev => prev + 1);
    }
  }, [forceRefresh]);

  // State for tracking edits in forms
  type PlayerEdit = { hp: number; maxHp: number; ac: number | string };
  type NpcEdit = { name: string; hp: number; maxHp: number; ac: number | string };

  const [playerEdits, setPlayerEdits] = useState<Record<string, PlayerEdit>>({});
  const [playerNameEdits, setPlayerNameEdits] = useState<Record<string, string>>({});
  const [npcEdits, setNpcEdits] = useState<Record<string, NpcEdit>>({});

  // Load player stats
  useEffect(() => {
    if (!campaignId) return;

    const loadPlayerStats = async () => {
      try {
        const stats = await getPlayerStats(campaignId);
        // Show all player stats created for this campaign
        setPlayerStats(stats);
      } catch (error) {
        console.error('Failed to load player stats:', error);
      }
    };

    loadPlayerStats();
  }, [campaignId]);

  // Load encounter NPCs
  useEffect(() => {
    if (!mapId) return;

    const loadEncounterNPCs = async () => {
      try {
        const npcs = await getEncounterNPCs(mapId);
        setEncounterNPCs(npcs);
      } catch (error) {
        console.error('Failed to load encounter NPCs:', error);
      }
    };

    loadEncounterNPCs();
  }, [mapId]);

  // Load map notes
  useEffect(() => {
    if (!campaignId || !mapId) return;

    const loadMapNotes = async () => {
      try {
        const notes = await getMapNotes(campaignId, mapId);
        setMapNotes(notes.content || '');
      } catch (error) {
        console.error('Failed to load map notes:', error);
      }
    };

    loadMapNotes();
  }, [campaignId, mapId]);

  // Handle player HP/AC updates
  const handlePlayerStatsUpdate = async (stat: PlayerStat, currentHp: number, maxHp: number, armorClass: number | null) => {
    try {
      // For DM-created players (no user_id), use updatePlayerStatsById
      if (!stat.user_id) {
        await updatePlayerStatsById(campaignId, stat.id, currentHp, maxHp, armorClass);
      } else {
        // For real users, use the old endpoint with userId
        await updatePlayerStats(campaignId, stat.user_id, currentHp, maxHp, armorClass);
      }
      setPlayerStats(prev => prev.map(s =>
        s.id === stat.id
          ? { ...s, current_hp: currentHp, max_hp: maxHp, armor_class: armorClass }
          : s
      ));
    } catch (error) {
      console.error('Failed to update player stats:', error);
    }
  };

  // Handle player tracker creation
  const handleAddPlayerTracker = async () => {
    if (!newPlayerName.trim()) return;

    setLoading(true);
    try {
      // Send player name to backend - it will create with generated user_id
      await updatePlayerStats(campaignId, '', newPlayerName);

      // Reload player stats to get the newly created tracker from database
      const stats = await getPlayerStats(campaignId);
      setPlayerStats(stats);
      setNewPlayerName('');
    } catch (error) {
      console.error('Failed to create player tracker:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle player tracker deletion
  const handleDeletePlayerTracker = async (stat: PlayerStat) => {
    try {
      // Delete from database using the correct API
      await deletePlayerStats(stat.id);
      // Remove from state
      setPlayerStats(prev => prev.filter(s => s.id !== stat.id));
    } catch (error) {
      console.error('Failed to delete player tracker:', error);
    }
  };

  // Handle NPC creation
  const handleAddNPC = async () => {
    if (!newNPCName.trim() || !mapId) return;

    setLoading(true);
    try {
      const newNPC = await createEncounterNPC(campaignId, mapId, newNPCName, 0, 0, null);
      setEncounterNPCs(prev => [...prev, newNPC]);
      setNewNPCName('');
    } catch (error) {
      console.error('Failed to create NPC:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle NPC update
  const handleNPCUpdate = async (npc: EncounterNPC, currentHp: number, maxHp: number, armorClass: number | null, name?: string) => {
    try {
      const npcName = name || npc.name;
      await updateEncounterNPC(npc.id, npcName, currentHp, maxHp, armorClass);
      setEncounterNPCs(prev => prev.map(n =>
        n.id === npc.id
          ? { ...n, name: npcName, current_hp: currentHp, max_hp: maxHp, armor_class: armorClass }
          : n
      ));
    } catch (error) {
      console.error('Failed to update NPC:', error);
    }
  };

  // Handle NPC deletion
  const handleDeleteNPC = async (npcId: string) => {
    try {
      await deleteEncounterNPC(npcId);
      setEncounterNPCs(prev => prev.filter(n => n.id !== npcId));
    } catch (error) {
      console.error('Failed to delete NPC:', error);
    }
  };

  // Handle map notes change with debounced save
  const handleMapNotesChange = (content: string) => {
    setMapNotes(content);

    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);

    const timer = setTimeout(() => {
      saveMapNotesToDB(content);
    }, 1500);

    setSaveDebounceTimer(timer);
  };

  const saveMapNotesToDB = async (content: string) => {
    if (!campaignId || !mapId) return;

    try {
      await saveMapNotes(campaignId, mapId, content);
    } catch (error) {
      console.error('Failed to save map notes:', error);
    }
  };

  // Copy notes to clipboard
  const handleCopyNotes = () => {
    navigator.clipboard.writeText(mapNotes).catch(() => {
      alert('Failed to copy notes');
    });
  };

  // Render markdown - simple implementation for *italic* and **bold**
  const renderMarkdown = (text: string) => {
    // First replace **bold** (must be before *italic* to avoid conflicts)
    let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Then replace *italic*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Replace line breaks
    html = html.replace(/\n/g, '<br/>');
    return html;
  };

  // Render player tracker
  const renderPlayerTracker = (stat: PlayerStat) => {
    const edit = playerEdits[stat.id] || { hp: stat.current_hp, maxHp: stat.max_hp, ac: stat.armor_class ?? '' };

    return (
      <div key={stat.id} className="npc-row">
        <input
          type="text"
          value={playerNameEdits[stat.id] ?? stat.username}
          onChange={(e) => setPlayerNameEdits(prev => ({
            ...prev,
            [stat.id]: e.target.value
          }))}
          onBlur={() => {
            // When blurring, if name changed, update in database
            const newName = playerNameEdits[stat.id];
            if (newName && newName !== stat.username) {
              // Update in database
              updatePlayerStatName(stat.id, newName).then(() => {
                // Update local state
                setPlayerStats(prev => prev.map(s =>
                  s.id === stat.id ? { ...s, username: newName } : s
                ));
              }).catch(error => {
                console.error('Failed to update player name:', error);
              });
            }
            setPlayerNameEdits(prev => {
              const newEdits = { ...prev };
              delete newEdits[stat.id];
              return newEdits;
            });
          }}
          className="npc-name-input"
        />
        <div className="npc-controls">
          <div className="hp-section">
            <input
              type="number"
              min="0"
              value={edit.hp}
              onChange={(e) => setPlayerEdits((prev: Record<string, PlayerEdit>) => ({
                ...prev,
                [stat.id]: { ...edit, hp: Number(e.target.value) }
              }))}
              onBlur={() => {
                handlePlayerStatsUpdate(stat, edit.hp, edit.maxHp, edit.ac ? Number(edit.ac) : null);
                setPlayerEdits((prev: Record<string, PlayerEdit>) => {
                  const newEdits = { ...prev };
                  delete newEdits[stat.id];
                  return newEdits;
                });
              }}
              className="hp-input"
              title="Current HP"
            />
            <span className="separator">/</span>
            <input
              type="number"
              min="0"
              value={edit.maxHp}
              onChange={(e) => setPlayerEdits((prev: Record<string, PlayerEdit>) => ({
                ...prev,
                [stat.id]: { ...edit, maxHp: Number(e.target.value) }
              }))}
              onBlur={() => {
                handlePlayerStatsUpdate(stat, edit.hp, edit.maxHp, edit.ac ? Number(edit.ac) : null);
                setPlayerEdits((prev: Record<string, PlayerEdit>) => {
                  const newEdits = { ...prev };
                  delete newEdits[stat.id];
                  return newEdits;
                });
              }}
              className="hp-input"
              title="Max HP"
            />
          </div>
          <div className="ac-section">
            <label>AC:</label>
            <input
              type="number"
              value={edit.ac}
              onChange={(e) => setPlayerEdits((prev: Record<string, PlayerEdit>) => ({
                ...prev,
                [stat.id]: { ...edit, ac: e.target.value }
              }))}
              onBlur={() => {
                handlePlayerStatsUpdate(stat, edit.hp, edit.maxHp, edit.ac ? Number(edit.ac) : null);
                setPlayerEdits((prev: Record<string, PlayerEdit>) => {
                  const newEdits = { ...prev };
                  delete newEdits[stat.id];
                  return newEdits;
                });
              }}
              className="ac-input"
              placeholder="-"
            />
          </div>
          <button
            className="delete-btn"
            onClick={() => handleDeletePlayerTracker(stat)}
            title="Delete player tracker"
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  // Render NPC tracker
  const renderNPCTracker = (npc: EncounterNPC) => {
    const edit = npcEdits[npc.id] || { name: npc.name, hp: npc.current_hp, maxHp: npc.max_hp, ac: npc.armor_class ?? '' };

    return (
      <div key={npc.id} className="npc-row">
        <input
          type="text"
          value={edit.name}
          onChange={(e) => setNpcEdits((prev: Record<string, NpcEdit>) => ({
            ...prev,
            [npc.id]: { ...edit, name: e.target.value }
          }))}
          onBlur={() => {
            handleNPCUpdate(npc, edit.hp, edit.maxHp, edit.ac ? Number(edit.ac) : null, edit.name);
            setNpcEdits((prev: Record<string, NpcEdit>) => {
              const newEdits = { ...prev };
              delete newEdits[npc.id];
              return newEdits;
            });
          }}
          className="npc-name-input"
        />
        <div className="npc-controls">
          <div className="hp-section">
            <input
              type="number"
              min="0"
              value={edit.hp}
              onChange={(e) => setNpcEdits((prev: Record<string, NpcEdit>) => ({
                ...prev,
                [npc.id]: { ...edit, hp: Number(e.target.value) }
              }))}
              onBlur={() => {
                handleNPCUpdate(npc, edit.hp, edit.maxHp, edit.ac ? Number(edit.ac) : null);
                setNpcEdits((prev: Record<string, NpcEdit>) => {
                  const newEdits = { ...prev };
                  delete newEdits[npc.id];
                  return newEdits;
                });
              }}
              className="hp-input"
            />
            <span className="separator">/</span>
            <input
              type="number"
              min="0"
              value={edit.maxHp}
              onChange={(e) => setNpcEdits((prev: Record<string, NpcEdit>) => ({
                ...prev,
                [npc.id]: { ...edit, maxHp: Number(e.target.value) }
              }))}
              onBlur={() => {
                handleNPCUpdate(npc, edit.hp, edit.maxHp, edit.ac ? Number(edit.ac) : null);
                setNpcEdits((prev: Record<string, NpcEdit>) => {
                  const newEdits = { ...prev };
                  delete newEdits[npc.id];
                  return newEdits;
                });
              }}
              className="hp-input"
            />
          </div>
          <div className="ac-section">
            <label>AC:</label>
            <input
              type="number"
              value={edit.ac}
              onChange={(e) => setNpcEdits((prev: Record<string, NpcEdit>) => ({
                ...prev,
                [npc.id]: { ...edit, ac: e.target.value }
              }))}
              onBlur={() => {
                handleNPCUpdate(npc, edit.hp, edit.maxHp, edit.ac ? Number(edit.ac) : null);
                setNpcEdits((prev: Record<string, NpcEdit>) => {
                  const newEdits = { ...prev };
                  delete newEdits[npc.id];
                  return newEdits;
                });
              }}
              className="ac-input"
              placeholder="-"
            />
          </div>
          <button
            className="delete-btn"
            onClick={() => handleDeleteNPC(npc.id)}
            title="Delete NPC"
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'player-stats' as TabType, label: 'Player stats', icon: <PlayerStatsIcon /> },
    { id: 'encounter-stats' as TabType, label: 'Encounter stats', icon: <EncounterStatsIcon /> },
    { id: 'token-groups' as TabType, label: 'Token groups', icon: <TokenGroupsIcon /> },
    { id: 'map-notes' as TabType, label: 'Map notes', icon: <MapNotesIcon /> },
  ];

  return (
    <div className="stats-panel">
      <div className="stats-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`stats-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            <span className="stats-tab-icon">{tab.icon}</span>
            {activeTab === tab.id && <span className="stats-tab-label">{tab.label}</span>}
          </button>
        ))}
      </div>

      <div className="stats-content">
        {activeTab === 'player-stats' && (
          <div className="stats-section">
            <p className="stats-title">Player Stats</p>
            {isDM ? (
              <>
                <div className="npc-input-section">
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPlayerTracker()}
                    placeholder="Player name..."
                    className="npc-input"
                    disabled={loading}
                  />
                  <button
                    onClick={handleAddPlayerTracker}
                    className="add-btn"
                    disabled={loading || !newPlayerName.trim()}
                  >
                    Add
                  </button>
                </div>
                <div className="npc-list">
                  {playerStats.length > 0 ? (
                    playerStats.map(stat => renderPlayerTracker(stat))
                  ) : (
                    <p className="empty-state">No player trackers yet. Click "Add" to create one.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="empty-state">Only DMs can manage player stats</p>
            )}
          </div>
        )}

        {activeTab === 'encounter-stats' && (
          <div className="stats-section">
            <p className="stats-title">Encounter Stats</p>
            {isDM ? (
              <>
                <div className="npc-input-section">
                  <input
                    type="text"
                    value={newNPCName}
                    onChange={(e) => setNewNPCName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddNPC()}
                    placeholder="NPC name..."
                    className="npc-input"
                    disabled={!mapId || loading}
                  />
                  <button
                    onClick={handleAddNPC}
                    className="add-btn"
                    disabled={!mapId || loading || !newNPCName.trim()}
                  >
                    Add
                  </button>
                </div>
                <div className="npc-list">
                  {encounterNPCs.length > 0 ? (
                    encounterNPCs.map(npc => renderNPCTracker(npc))
                  ) : (
                    <p className="empty-state">
                      {mapId ? 'No NPCs added. Click "Add" to create one.' : 'Select a map to add NPCs'}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="empty-state">Only DMs can view and manage encounter stats</p>
            )}
          </div>
        )}

        {/* Token Groups Tab - Keep mounted to handle background updates */}
        <div style={{ display: activeTab === 'token-groups' ? 'block' : 'none' }}>
          <TokenGroupsTab
            campaignId={campaignId}
            isDM={isDM}
            onTokensChanged={handleTokensChanged}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {activeTab === 'map-notes' && (
          <div className="stats-section">
            <div className="notes-header">
              <p className="stats-title">Map Notes</p>
              <button
                className="copy-btn"
                onClick={handleCopyNotes}
                title="Copy all notes to clipboard"
                disabled={!mapNotes.trim()}
              >
                📋 Copy
              </button>
            </div>
            {isDM ? (
              <div className="notes-editor">
                <textarea
                  value={mapNotes}
                  onChange={(e) => handleMapNotesChange(e.target.value)}
                  placeholder="Add notes here... Use *italic* and **bold**"
                  disabled={!mapId}
                />
                <div className="notes-preview">
                  <h4>Preview:</h4>
                  <div
                    className="markdown-rendered"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(mapNotes) }}
                  />
                </div>
                <div className="notes-help">
                  Use <strong>*text*</strong> for italic, <strong>**text**</strong> for bold
                </div>
              </div>
            ) : (
              <p className="empty-state">Only DMs can view map notes</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}









