import { useState, useEffect } from 'react';
import {
  fetchTokenGroups,
  createTokenGroup,
  updateTokenGroup,
  deleteTokenGroup,
  toggleGroupVisibility,
  type TokenGroup
} from '../../api';
import './TokenGroupsTab.css';

interface TokenGroupsTabProps {
  campaignId: string;
  isDM: boolean;
  onTokensChanged?: () => void;
  refreshTrigger?: number;
}

export default function TokenGroupsTab({ campaignId, isDM, onTokensChanged, refreshTrigger }: TokenGroupsTabProps) {
  const [groups, setGroups] = useState<TokenGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  // Load token groups on mount and when refreshTrigger changes
  useEffect(() => {
    console.log('[TokenGroupsTab] useEffect triggered - campaignId:', campaignId, 'refreshTrigger:', refreshTrigger);
    loadGroups();
  }, [campaignId, refreshTrigger]);

  const loadGroups = async () => {
    try {
      console.log('[TokenGroupsTab] Fetching groups from API...');
      const fetchedGroups = await fetchTokenGroups(campaignId);
      console.log('[TokenGroupsTab] Groups fetched from API:', fetchedGroups);
      console.log('[TokenGroupsTab] Group member counts:', fetchedGroups.map(g => ({ name: g.name, memberCount: g.members.length })));
      setGroups(fetchedGroups);
      console.log('[TokenGroupsTab] Groups state updated');
    } catch (error) {
      console.error('[TokenGroupsTab] Failed to load token groups:', error);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    setLoading(true);
    try {
      const newGroup = await createTokenGroup(campaignId, newGroupName);
      setGroups(prev => [...prev, newGroup]);
      setNewGroupName('');
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroupName = async (groupId: string) => {
    if (!editingGroupName.trim()) return;

    try {
      await updateTokenGroup(groupId, editingGroupName);
      setGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, name: editingGroupName } : g
      ));
      setEditingGroupId(null);
      setEditingGroupName('');
    } catch (error) {
      console.error('Failed to update group name:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      await deleteTokenGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  const handleToggleGroupVisibility = async (groupId: string, currentVisibility: boolean) => {
    try {
      const newVisibility = !currentVisibility;
      setLoading(true);

      console.log('[TokenGroupsTab] Toggling group visibility:', { groupId, currentVisibility, newVisibility });

      await toggleGroupVisibility(groupId, newVisibility);

      console.log('[TokenGroupsTab] API call successful, reloading groups');

      // Reload groups from server to get fresh visibility state
      const updatedGroups = await fetchTokenGroups(campaignId);
      setGroups(updatedGroups);

      console.log('[TokenGroupsTab] Groups reloaded');

      // Notify parent to refresh map tokens with new visibility
      console.log('[TokenGroupsTab] Calling onTokensChanged to refresh map');
      if (onTokensChanged) {
        onTokensChanged();
      }

      console.log('[TokenGroupsTab] Visibility toggle complete');
    } catch (error) {
      console.error('[TokenGroupsTab] Error toggling visibility:', error);
    } finally {
      setLoading(false);
    }
  };

  // Determine if all members are visible
  const isGroupVisible = (group: TokenGroup) => {
    if (group.members.length === 0) return false;
    return group.members.every(m => m.is_visible_to_players);
  };

  return (
    <div className="stats-section">
      <p className="stats-title">Token Groups</p>
      {isDM ? (
        <>
          <div className="npc-input-section">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
              placeholder="Group name..."
              className="npc-input"
              disabled={loading}
            />
            <button
              onClick={handleCreateGroup}
              className="add-btn"
              disabled={loading || !newGroupName.trim()}
            >
              Add
            </button>
          </div>

          <div className="token-groups-list">
            {groups.length > 0 ? (
              groups.map(group => (
                <div key={group.id} className="token-group-item">
                  <div className="group-header">
                    {editingGroupId === group.id ? (
                      <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onBlur={() => {
                          if (editingGroupName.trim()) {
                            handleUpdateGroupName(group.id);
                          } else {
                            setEditingGroupId(null);
                            setEditingGroupName('');
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateGroupName(group.id);
                          }
                        }}
                        className="group-name-input"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="group-name"
                        onClick={() => {
                          setEditingGroupId(group.id);
                          setEditingGroupName(group.name);
                        }}
                      >
                        {group.name}
                      </span>
                    )}
                  </div>

                  <div className="group-controls">
                    <div className="visibility-toggle">
                      <label>Visible:</label>
                      <button
                        className={`toggle-switch ${isGroupVisible(group) ? 'active' : ''}`}
                        onClick={() => handleToggleGroupVisibility(group.id, isGroupVisible(group))}
                        title={group.members.length === 0 ? 'Add tokens to this group first' : ''}
                        disabled={group.members.length === 0}
                      />
                    </div>

                    <span className="member-count">
                      {group.members.length} {group.members.length === 1 ? 'token' : 'tokens'}
                    </span>

                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteGroup(group.id)}
                      title="Delete group"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">No groups yet. Click "Add" to create one.</p>
            )}
          </div>
        </>
      ) : (
        <p className="empty-state">Only DMs can manage token groups</p>
      )}
    </div>
  );
}


