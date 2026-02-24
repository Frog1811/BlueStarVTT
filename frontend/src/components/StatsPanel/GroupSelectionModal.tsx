import { useState, useEffect } from 'react';
import {
  fetchTokenGroups,
  addTokenToGroup,
  removeTokenFromGroup,
  type TokenGroup
} from '../../api';
import './GroupSelectionModal.css';

interface GroupSelectionModalProps {
  campaignId: string;
  mapTokenId: string;
  onClose: () => void;
  onMembershipChanged?: () => void;
}

export default function GroupSelectionModal({ campaignId, mapTokenId, onClose, onMembershipChanged }: GroupSelectionModalProps) {
  const [groups, setGroups] = useState<TokenGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenGroupMemberships, setTokenGroupMemberships] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadGroupsAndMemberships();
  }, [campaignId, mapTokenId]);

  const loadGroupsAndMemberships = async () => {
    try {
      const fetchedGroups = await fetchTokenGroups(campaignId);
      setGroups(fetchedGroups);

      // Find which groups this token belongs to
      const membershipSet = new Set<string>();
      fetchedGroups.forEach(group => {
        if (group.members.some(m => m.map_token_id === mapTokenId)) {
          membershipSet.add(group.id);
        }
      });
      setTokenGroupMemberships(membershipSet);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const handleToggleGroupMembership = async (groupId: string) => {
    setLoading(true);
    try {
      const isMember = tokenGroupMemberships.has(groupId);

      if (isMember) {
        // Remove token from group
        console.log('[GroupSelectionModal] Removing token from group:', groupId);
        await removeTokenFromGroup(groupId, mapTokenId);
        setTokenGroupMemberships(prev => {
          const newSet = new Set(prev);
          newSet.delete(groupId);
          return newSet;
        });
      } else {
        // Add token to group
        console.log('[GroupSelectionModal] Adding token to group:', groupId);
        await addTokenToGroup(groupId, mapTokenId);
        setTokenGroupMemberships(prev => new Set([...prev, groupId]));
      }

      console.log('[GroupSelectionModal] Membership change complete');

      // Reload groups to get updated member counts
      console.log('[GroupSelectionModal] Reloading groups to update member counts');
      await loadGroupsAndMemberships();

      // Notify parent to refresh tokens
      if (onMembershipChanged) {
        console.log('[GroupSelectionModal] Calling onMembershipChanged callback');
        onMembershipChanged();
      }
    } catch (error) {
      console.error('Failed to toggle group membership:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="group-selection-modal-overlay" onClick={onClose}>
      <div className="group-selection-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="group-selection-header">
          <h3 className="group-selection-title">Add to Group</h3>
          <button
            className="group-selection-close"
            onClick={onClose}
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="group-selection-list">
          {groups.length > 0 ? (
            groups.map(group => (
              <div key={group.id} className="group-selection-item">
                <label className="group-selection-label">
                  <input
                    type="checkbox"
                    checked={tokenGroupMemberships.has(group.id)}
                    onChange={() => handleToggleGroupMembership(group.id)}
                    disabled={loading}
                  />
                  <span className="group-selection-name">{group.name}</span>
                </label>
              </div>
            ))
          ) : (
            <p className="group-selection-empty">No groups created yet</p>
          )}
        </div>

        <div className="group-selection-footer">
          <button
            className="group-selection-done"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

