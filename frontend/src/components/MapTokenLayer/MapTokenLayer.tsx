import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchMapTokens,
  addTokenToMap,
  updateMapToken,
  removeMapToken,
  getTokenUrl,
  type MapToken,
  type Map as MapType
} from '../../api';
import type { TokenUpdateEvent } from '../../hooks/usePresence';
import ConditionSelector from '../ConditionSelector/ConditionSelector';
import GroupSelectionModal from '../StatsPanel/GroupSelectionModal';
import { ConditionIcons, type ConditionType } from '../ConditionIcons';
import './MapTokenLayer.css';

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

interface MapTokenLayerProps {
  map: MapType;
  campaignId: string;
  isDM: boolean;
  zoom?: number;
  panX?: number;
  panY?: number;
  onTokensChange?: () => void;
  onTokenClick?: (mapToken: MapToken) => void;
  tokenUpdate?: TokenUpdateEvent | null;
  onGroupsRefresh?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  mapToken: MapToken;
}

const BORDER_COLORS: Array<{ id: string; label: string; value: string | null }> = [
  { id: 'none', label: 'None', value: null },
  { id: 'red', label: 'Red', value: 'red' },
  { id: 'blue', label: 'Blue', value: 'blue' },
  { id: 'green', label: 'Green', value: 'green' },
  { id: 'yellow', label: 'Yellow', value: 'yellow' },
  { id: 'purple', label: 'Purple', value: 'purple' },
  { id: 'orange', label: 'Orange', value: 'orange' },
  { id: 'cyan', label: 'Cyan', value: 'cyan' }
];

function MapTokenLayer({ map, campaignId, isDM, zoom = 1, panX = 0, panY = 0, onTokensChange, onTokenClick, tokenUpdate, onGroupsRefresh }: MapTokenLayerProps) {
  const [mapTokens, setMapTokens] = useState<MapToken[]>([]);
  const [draggingToken, setDraggingToken] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [conditionSelector, setConditionSelector] = useState<{ x: number; y: number; mapToken: MapToken } | null>(null);
  const [groupSelectionModal, setGroupSelectionModal] = useState<{ mapTokenId: string } | null>(null);
  const [resizeInput, setResizeInput] = useState('1');
  const [nameInput, setNameInput] = useState('');
  const [selectedBorderColor, setSelectedBorderColor] = useState<string>('none');
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingTokenDataRef = useRef<MapToken | null>(null);

  // Check if grid is enabled
  const hasGrid = map.grid_enabled;
  const gridCols = map.grid_cols || 10;
  const gridRows = map.grid_rows || 10;

  // Use map dimensions (should be updated to natural dimensions by parent)
  const finalMapWidth = map.width;
  const finalMapHeight = map.height;

  const loadMapTokens = async () => {
    try {
      console.log('[MapTokenLayer] Loading map tokens from API');
      const tokens = await fetchMapTokens(map.id);
      console.log('[MapTokenLayer] Received tokens:', tokens.length);

      // Ensure boolean values are properly converted from database integers
      const convertedTokens = tokens.map(token => ({
        ...token,
        is_visible_to_players: Boolean(token.is_visible_to_players),
        transparency: Number(token.transparency) || 1,
        player_moveable: Boolean(token.player_moveable)
      }));

      console.log('[MapTokenLayer] Converted tokens, updating state');
      setMapTokens(convertedTokens);

      // Update context menu with fresh token data if menu is open
      setContextMenu(prev => {
        if (!prev) return null;
        const updatedToken = convertedTokens.find(t => t.id === prev.mapToken.id);
        if (updatedToken) {
          return { ...prev, mapToken: updatedToken };
        }
        return prev;
      });

      console.log('[MapTokenLayer] Map tokens updated successfully');
    } catch (error) {
      console.error('[MapTokenLayer] Error loading tokens:', error);
    }
  };

  // Load map tokens
  useEffect(() => {
    loadMapTokens();

    // For players, poll for token updates every 3 seconds
    // DM has explicit refresh via onTokensChange callback
    if (!isDM) {
      const interval = setInterval(loadMapTokens, 100);
      return () => clearInterval(interval);
    }
  }, [map.id, isDM]);

  // Listen for real-time token updates from SSE
  useEffect(() => {
    if (tokenUpdate && tokenUpdate.mapId === map.id) {
      // Update the specific token in the state
      setMapTokens(prevTokens => {
        const updatedToken = {
          ...tokenUpdate.mapToken,
          is_visible_to_players: Boolean(tokenUpdate.mapToken.is_visible_to_players),
          transparency: Number(tokenUpdate.mapToken.transparency) || 1,
          player_moveable: Boolean(tokenUpdate.mapToken.player_moveable)
        };

        const index = prevTokens.findIndex(t => t.id === updatedToken.id);
        if (index >= 0) {
          const newTokens = [...prevTokens];
          newTokens[index] = updatedToken;
          return newTokens;
        } else {
          // Token was added
          return [...prevTokens, updatedToken];
        }
      });
    }
  }, [tokenUpdate, map.id]);

  // Handle drop from token manager
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if grid is enabled
    if (!hasGrid) {
      alert('Please enable grid before placing tokens on the map.');
      return;
    }

    if (!isDM) {
      return; // Only DM can place tokens
    }

    const tokenData = e.dataTransfer.getData('application/json');
    if (!tokenData) return;

    try {
      const token = JSON.parse(tokenData);

      // Get mouse position in map space (accounting for zoom and pan)
      const mouseMapPos = getMapSpaceCoordinates(e.clientX, e.clientY);

      // Calculate exact cell dimensions
      const cellWidthExact = map.width / gridCols;
      const cellHeightExact = map.height / gridRows;

      // Convert to grid coordinates and snap
      const gridX = Math.floor(mouseMapPos.x / cellWidthExact);
      const gridY = Math.floor(mouseMapPos.y / cellHeightExact);

      // Try adding token to map. If token.id doesn't exist in DB (common when images were moved between base folders),
      // attempt a set of fallback candidate ids derived from the image filename.
      const tryAddWithCandidate = async (candidateId: string) => {
        try {
          await addTokenToMap(map.id, candidateId, gridX, gridY, 1);
          return true;
        } catch (err: any) {
          // Only swallow 'token not found' so other errors still surface
          if (err instanceof Error && err.message && err.message.toLowerCase().includes('token not found')) {
            return false;
          }
          throw err;
        }
      };

      // First attempt: use token.id if present
      let added = false;
      if (token.id) {
        try {
          await addTokenToMap(map.id, token.id, gridX, gridY, 1);
          added = true;
        } catch (err: any) {
          // If token not found, we'll try fallbacks below
          if (!(err instanceof Error) || !err.message.toLowerCase().includes('token not found')) {
            throw err;
          }
        }
      }

      if (!added) {
        // Build fallback candidates using the token's image path (image_path or imagePath)
        const imagePath: string | undefined = token.image_path || token.imagePath || '';
        const fileName = (imagePath || '').split('/').pop() || '';
        const nameNoExt = fileName.replace(/\.[^/.]+$/, '') || '';

        const candidates: string[] = [];
        // include name without extension (Icons base tokens used this id)
        if (nameNoExt) candidates.push(nameNoExt);
        // include jocat- + filename (backend uses this for JOCAT tokens)
        if (fileName) candidates.push(`jocat-${fileName}`);
        // include jocat- + name without ext (defensive)
        if (nameNoExt) candidates.push(`jocat-${nameNoExt}`);

        // ensure we don't retry the original id twice
        if (token.id && !candidates.includes(token.id)) {
          candidates.unshift(token.id);
        }

        for (const cand of candidates) {
          if (!cand) continue;
          const ok = await tryAddWithCandidate(cand);
          if (ok) {
            added = true;
            break;
          }
        }
      }

      if (!added) {
        throw new Error('token not found');
      }

      await loadMapTokens();
      onTokensChange?.();
    } catch (error) {
      if (error instanceof Error) {
        alert(`Failed to add token: ${error.message}`);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Helper function to convert viewport coordinates to map space
  const getMapSpaceCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    // Get the parent container (the one that clips the zoomed content)
    // PlayerView uses player-screen-content, DMView uses dm-canvas
    const mapContainer = document.querySelector('.player-screen-content') as HTMLElement ||
                         document.querySelector('.dm-canvas') as HTMLElement;
    if (!mapContainer) return { x: clientX, y: clientY };

    const containerRect = mapContainer.getBoundingClientRect();

    // Convert viewport coords to container-relative coords
    const containerX = clientX - containerRect.left;
    const containerY = clientY - containerRect.top;

    // Reverse the pan and zoom transforms
    // The zoom container applies: translate(panX, panY) scale(zoom)
    // map_coord = (container_coord - pan) / zoom
    const mapX = (containerX - panX) / zoom;
    const mapY = (containerY - panY) / zoom;

    return { x: mapX, y: mapY };
  };

  // Handle token dragging on map (for DM or player-moveable tokens)
  const handleTokenMouseDown = (e: React.MouseEvent, mapToken: MapToken) => {
    // Check if player can move this token
    const canMove = isDM || (mapToken.player_moveable && mapToken.is_visible_to_players);
    if (!canMove) return;

    // Only start dragging on left click (button 0), not right click (button 2)
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    // If onTokenClick is provided, call it (for initiative selection)
    if (onTokenClick) {
      onTokenClick(mapToken);
      return;
    }

    // Get mouse position in map space (accounting for zoom and pan)
    const mouseMapPos = getMapSpaceCoordinates(e.clientX, e.clientY);

    // Calculate token's current position in map space based on grid position
    const cellWidthExact = map.width / gridCols;
    const cellHeightExact = map.height / gridRows;
    const tokenSize = mapToken.size || 1;
    const tokenWidth = cellWidthExact * tokenSize;
    const tokenHeight = cellHeightExact * tokenSize;

    // Calculate token's top-left position from its grid coordinates
    const tokenMapX = mapToken.x * cellWidthExact;
    const tokenMapY = mapToken.y * cellHeightExact;

    // Calculate token's CENTER position in map space
    const tokenCenterX = tokenMapX + tokenWidth / 2;
    const tokenCenterY = tokenMapY + tokenHeight / 2;

    // Calculate offset from token center to mouse position
    const offsetX = mouseMapPos.x - tokenCenterX;
    const offsetY = mouseMapPos.y - tokenCenterY;

    setDragOffset({
      x: offsetX,
      y: offsetY
    });

    // Store token data in ref to avoid dependency issues during drag
    draggingTokenDataRef.current = mapToken;
    setDraggingToken(mapToken.id);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingToken || !draggingTokenDataRef.current) return;

    try {
      // Use the token data from ref (stable during drag)
      const token = draggingTokenDataRef.current;

      // Get mouse position in map space (accounting for zoom and pan)
      const mouseMapPos = getMapSpaceCoordinates(e.clientX, e.clientY);

      // Calculate exact cell dimensions
      const cellWidthExact = map.width / gridCols;
      const cellHeightExact = map.height / gridRows;

      // Safety check
      if (!cellWidthExact || !cellHeightExact || !isFinite(cellWidthExact) || !isFinite(cellHeightExact)) {
        return;
      }

      // Token dimensions
      const tokenSize = token.size || 1;
      const tokenWidth = cellWidthExact * tokenSize;
      const tokenHeight = cellHeightExact * tokenSize;

      // Subtract the drag offset from mouse position to get token's CENTER position
      const tokenCenterX = mouseMapPos.x - dragOffset.x;
      const tokenCenterY = mouseMapPos.y - dragOffset.y;

      // Convert center to top-left for positioning
      const mapTokenX = tokenCenterX - tokenWidth / 2;
      const mapTokenY = tokenCenterY - tokenHeight / 2;

      // Snap to grid: convert to grid coordinates, then back to pixels
      const gridX = Math.round(mapTokenX / cellWidthExact);
      const gridY = Math.round(mapTokenY / cellHeightExact);

      // Clamp to valid range
      const clampedGridX = Math.max(0, Math.min(gridCols - 1, gridX));
      const clampedGridY = Math.max(0, Math.min(gridRows - 1, gridY));

      // Convert back to pixel position for snapped display
      const snappedPixelX = clampedGridX * cellWidthExact;
      const snappedPixelY = clampedGridY * cellHeightExact;

      // Update position visually with grid snapping
      const tokenElement = document.querySelector(`[data-map-token-id="${draggingToken}"]`) as HTMLElement;
      if (tokenElement) {
        tokenElement.style.left = `${snappedPixelX}px`;
        tokenElement.style.top = `${snappedPixelY}px`;
      }
    } catch (error) {
      console.error('Error in handleMouseMove:', error);
    }
  }, [draggingToken, dragOffset, map.width, map.height, gridCols, gridRows, zoom, panX, panY]);

  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    if (!draggingToken || !draggingTokenDataRef.current) return;

    // Use the token data from ref (stable during drag)
    const token = draggingTokenDataRef.current;

    // Get mouse position in map space (accounting for zoom and pan)
    const mouseMapPos = getMapSpaceCoordinates(e.clientX, e.clientY);

    // Calculate exact cell dimensions
    const cellWidthExact = map.width / gridCols;
    const cellHeightExact = map.height / gridRows;

    // Safety check for division by zero
    if (!cellWidthExact || !cellHeightExact || !isFinite(cellWidthExact) || !isFinite(cellHeightExact)) {
      console.error('Invalid cell dimensions');
      draggingTokenDataRef.current = null;
      setDraggingToken(null);
      return;
    }

    // Token dimensions
    const tokenSize = token.size || 1;
    const tokenWidth = cellWidthExact * tokenSize;
    const tokenHeight = cellHeightExact * tokenSize;

    // Subtract the drag offset from mouse position to get token's CENTER position
    const tokenCenterX = mouseMapPos.x - dragOffset.x;
    const tokenCenterY = mouseMapPos.y - dragOffset.y;

    // Convert center to top-left for grid calculation
    const mapTokenX = tokenCenterX - tokenWidth / 2;
    const mapTokenY = tokenCenterY - tokenHeight / 2;

    // Snap to grid and clamp to valid range
    const gridX = Math.max(0, Math.min(gridCols - 1, Math.round(mapTokenX / cellWidthExact)));
    const gridY = Math.max(0, Math.min(gridRows - 1, Math.round(mapTokenY / cellHeightExact)));

    // Safety check for NaN
    if (!isFinite(gridX) || !isFinite(gridY)) {
      console.error('Invalid grid coordinates:', { gridX, gridY });
      draggingTokenDataRef.current = null;
      setDraggingToken(null);
      return;
    }

    try {
      await updateMapToken(draggingToken, { x: gridX, y: gridY });

      // Small delay to allow SSE broadcast to complete, then reload for full data
      setTimeout(() => {
        loadMapTokens();
      }, 100);

      onTokensChange?.();
    } catch (error) {
      console.error('Error updating token position:', error);
    }

    // Clear the ref
    draggingTokenDataRef.current = null;
    setDraggingToken(null);
  }, [draggingToken, dragOffset, map.width, map.height, gridCols, gridRows, loadMapTokens, onTokensChange, zoom, panX, panY]);

  useEffect(() => {
    if (draggingToken) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingToken, handleMouseMove, handleMouseUp]);

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent, mapToken: MapToken) => {
    if (!isDM) return;

    e.preventDefault();
    e.stopPropagation();

    // Get mouse position in map space (accounting for zoom and pan)
    const mouseMapPos = getMapSpaceCoordinates(e.clientX, e.clientY);


    // Calculate offset: position menu to the right of where we clicked, or below if near edge
    let mapMenuX = mouseMapPos.x + 10; // 10px offset to the right
    let mapMenuY = mouseMapPos.y + 10; // 10px offset down

    // If menu would go off the right edge, position it to the left instead
    if (mapMenuX + 200 > map.width) {
      mapMenuX = mouseMapPos.x - 210; // 200px menu width + 10px gap
    }

    // If menu would go off the bottom edge, position it above instead
    if (mapMenuY + 200 > map.height) {
      mapMenuY = mouseMapPos.y - 210; // Assume ~200px menu height + 10px gap
    }

    setContextMenu({
      x: mapMenuX,
      y: mapMenuY,
      mapToken
    });
    setResizeInput(String(mapToken.size));
    setNameInput(mapToken.token_instance_name || '');
    setSelectedBorderColor(mapToken.border_color || 'none');
  };

  // Close context menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const handleRemoveToken = async (mapTokenId: string) => {
    try {
      await removeMapToken(mapTokenId);
      await loadMapTokens();
      onTokensChange?.();
    } catch (error) {
    }
  };

  const handleResizeToken = async (mapTokenId: string, newSize: number) => {
    if (newSize < 1 || newSize > 10) {
      alert('Token size must be between 1 and 10');
      return;
    }

    try {
      await updateMapToken(mapTokenId, { size: newSize });
      await loadMapTokens();
      onTokensChange?.();
    } catch (error) {
      // Error resizing token
    }
  };

  const handleToggleTokenVisibility = async (mapTokenId: string, currentVisibility: boolean) => {
    try {
      console.log('[MapTokenLayer] Toggling token visibility:', { mapTokenId, currentVisibility });

      // Toggle: if currently visible, hide it; if hidden, show it
      const newVisibility = !currentVisibility;
      const newTransparency = newVisibility ? 1.0 : 0.25; // Transparent only when hidden

      await updateMapToken(mapTokenId, {
        is_visible_to_players: newVisibility,
        transparency: newTransparency
      });

      console.log('[MapTokenLayer] API update successful, reloading tokens');

      // Reload map tokens
      await loadMapTokens();

      console.log('[MapTokenLayer] Tokens reloaded');

      // Small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('[MapTokenLayer] Context menu closed, notifying parent');
      setContextMenu(null);

      onTokensChange?.();
    } catch (error) {
      console.error('[MapTokenLayer] Error toggling visibility:', error);
    }
  };

  const handleTogglePlayerMoveable = async (mapTokenId: string, currentMoveable: boolean) => {
    try {
      const newMoveable = !currentMoveable;
      await updateMapToken(mapTokenId, {
        player_moveable: newMoveable
      });
      await loadMapTokens();
      onTokensChange?.();
    } catch (error) {
      console.error('Error toggling player moveable:', error);
    }
  };

  const handleSaveTokenName = async (mapTokenId: string) => {
    try {
      await updateMapToken(mapTokenId, {
        token_instance_name: nameInput || null
      });
      await loadMapTokens();
      onTokensChange?.();

    } catch (error) {
      console.error('Error saving token name:', error);
    }
  };  const handleSetBorderColor = async (mapTokenId: string, color: string | null) => {
    try {
      const colorValue = color === 'none' ? null : color;
      await updateMapToken(mapTokenId, {
        border_color: colorValue
      });
      setSelectedBorderColor(color || 'none');
      await loadMapTokens();
      onTokensChange?.();
    } catch (error) {
      // Error toggling visibility
    }
  };

  const handleOpenConditionSelector = (mapToken: MapToken) => {
    // Calculate token's position on the map
    const cellWidthExact = finalMapWidth / gridCols;
    const cellHeightExact = finalMapHeight / gridRows;
    const tokenSize = mapToken.size || 1;

    // Token's top-left position in map space
    const tokenX = mapToken.x * cellWidthExact;
    const tokenY = mapToken.y * cellHeightExact;

    // Token dimensions
    const tokenWidth = cellWidthExact * tokenSize;

    // Position popup to the right of the token in map space
    let mapPopupX = tokenX + tokenWidth + 10; // 10px gap to the right of token
    let mapPopupY = tokenY;

    // If popup would go off the right edge, position it to the left instead
    if (mapPopupX + 320 > finalMapWidth) { // 320px is popup min-width
      mapPopupX = tokenX - 330; // Position to left with 10px gap
    }

    // If popup would go off bottom, adjust upward
    if (mapPopupY + 500 > finalMapHeight) { // 500px is popup max-height
      mapPopupY = finalMapHeight - 510;
    }

    // Ensure popup doesn't go off top or left in map space
    if (mapPopupY < 0) mapPopupY = 10;
    if (mapPopupX < 0) mapPopupX = 10;

    // Convert map space to viewport space (apply zoom and pan)
    // Get the map container (either player-screen-content or dm-canvas)
    const mapContainer = document.querySelector('.player-screen-content') as HTMLElement ||
                         document.querySelector('.dm-canvas') as HTMLElement;

    if (mapContainer) {
      const containerRect = mapContainer.getBoundingClientRect();

      // Apply zoom and pan transforms: viewport = (map * zoom) + pan + containerOffset
      const viewportX = (mapPopupX * zoom) + panX + containerRect.left;
      const viewportY = (mapPopupY * zoom) + panY + containerRect.top;

      setConditionSelector({ x: viewportX, y: viewportY, mapToken });
    } else {
      // Fallback if container not found
      setConditionSelector({ x: mapPopupX, y: mapPopupY, mapToken });
    }

    setContextMenu(null);
  };

  const handleConditionToggle = async (condition: ConditionType) => {
    if (!conditionSelector) return;

    try {
      const currentConditions = conditionSelector.mapToken.conditions
        ? JSON.parse(conditionSelector.mapToken.conditions) as ConditionType[]
        : [];

      let newConditions: ConditionType[];
      if (currentConditions.includes(condition)) {
        // Remove condition (clicking same condition removes it)
        newConditions = [];
      } else {
        // Replace with new condition (only 1 condition at a time)
        newConditions = [condition];
      }

      await updateMapToken(conditionSelector.mapToken.id, {
        conditions: JSON.stringify(newConditions)
      });

      // Update local state
      const updatedToken = {
        ...conditionSelector.mapToken,
        conditions: JSON.stringify(newConditions)
      };
      setConditionSelector({ ...conditionSelector, mapToken: updatedToken });

      await loadMapTokens();
      onTokensChange?.();
    } catch (error) {
      console.error('Error toggling condition:', error);
    }
  };

  // Get token image URL
  const getMapTokenImageUrl = (mapToken: MapToken): string => {
    // Safety check for undefined image_path
    if (!mapToken.image_path) {
      console.error('Token has no image_path:', mapToken);
      return ''; // Return empty string as fallback
    }

    // Check if it's a base token path (starts with /assets/)
    if (mapToken.image_path.startsWith('/assets/')) {
      const fileName = mapToken.image_path.split('/').pop();
      if (fileName && iconMap.has(fileName)) {
        return iconMap.get(fileName)!;
      }
      if (fileName && jocatMap.has(fileName)) {
        return jocatMap.get(fileName)!;
      }
      // Fallback to the original path
      return mapToken.image_path;
    }
    // Custom uploaded token - add stable cache busting to prevent browser cache issues
    const tokenUrl = getTokenUrl(mapToken.image_path);
    if (mapToken.image_path.toLowerCase().endsWith('.gif')) {
      // Use token ID hash for stable cache busting (won't change on re-render)
      return `${tokenUrl}?v=${mapToken.id.slice(0, 8)}`;
    }
    return tokenUrl;
  };

  if (!hasGrid) {
    return null; // Don't render tokens if grid is not enabled
  }

  return (
    <div
      ref={containerRef}
      className="map-token-layer"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${finalMapWidth}px`,
        height: `${finalMapHeight}px`,
        pointerEvents: 'none', // Let clicks pass through empty areas to map below
        zIndex: 100
      }}
    >
      {mapTokens.map((mapToken) => {
        // Filter: Players should not see tokens that are marked as not visible
        if (!isDM && mapToken.is_visible_to_players === false) {
          return null;
        }

        const tokenSize = mapToken.size || 1;

        // Calculate cell dimensions with full precision (in map image space)
        const cellWidthExact = finalMapWidth / gridCols;
        const cellHeightExact = finalMapHeight / gridRows;


        // Calculate position using exact cell dimensions (in map space)
        const mapPixelLeft = mapToken.x * cellWidthExact;
        const mapPixelTop = mapToken.y * cellHeightExact;

        // Total size in map space (zoom is applied by parent container)
        const pixelWidth = cellWidthExact * tokenSize;
        const pixelHeight = cellHeightExact * tokenSize;

        // For DMs, apply the stored transparency value; for players always full opacity
        const displayOpacity = isDM ? Number(mapToken.transparency) : 1;

        // Determine if players can interact with this token
        const playerCanMove = !isDM && mapToken.player_moveable && mapToken.is_visible_to_players;

        return (
          <div
            key={mapToken.id}
            data-map-token-id={mapToken.id}
            data-border-color={mapToken.border_color || 'none'}
            className={`map-token ${isDM || playerCanMove ? 'dm-draggable' : ''} ${draggingToken === mapToken.id ? 'dragging' : ''}`}
            style={{
              position: 'absolute',
              left: `${mapPixelLeft}px`,
              top: `${mapPixelTop}px`,
              width: `${pixelWidth}px`,
              height: `${pixelHeight}px`,
              cursor: (isDM || playerCanMove) ? (onTokenClick ? 'pointer' : 'move') : 'default',
              pointerEvents: (isDM || playerCanMove || onTokenClick) ? 'auto' : 'none',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseDown={(e) => handleTokenMouseDown(e, mapToken)}
            onContextMenu={(e) => handleContextMenu(e, mapToken)}
          >
            <img
              src={getMapTokenImageUrl(mapToken)}
              alt={mapToken.name}
              className="token-image"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                userSelect: 'none',
                opacity: displayOpacity
              }}
            />
            {mapToken.token_instance_name && (
              <div className="token-name-plate">
                {mapToken.token_instance_name}
              </div>
            )}

            {/* Condition Badges */}
            {mapToken.conditions && (() => {
              try {
                const conditions = JSON.parse(mapToken.conditions) as ConditionType[];
                if (conditions.length > 0) {
                  return (
                    <div className="token-conditions">
                      {conditions.map((condition, index) => {
                        const Icon = ConditionIcons[condition];
                        return (
                          <div
                            key={condition}
                            className="condition-badge"
                            title={condition}
                            style={{
                              top: `${index * 26}px`
                            }}
                          >
                            <Icon />
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              } catch (e) {
                // Invalid JSON, ignore
              }
              return null;
            })()}
          </div>
        );
      })}

      {/* Context Menu */}
      {contextMenu && isDM && (
        <div
          ref={contextMenuRef}
          className="map-token-context-menu"
          style={{
            position: 'absolute',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 10000,
            pointerEvents: 'auto'
          }}
        >
          <div className="context-menu-visibility" onClick={(e) => e.stopPropagation()}>
            <label>Player Visibility</label>
            <button
              className={`toggle-switch ${contextMenu.mapToken.is_visible_to_players === true ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentVisibility = contextMenu.mapToken.is_visible_to_players === true;
                handleToggleTokenVisibility(contextMenu.mapToken.id, currentVisibility);
              }}
            />
          </div>
          <div className="context-menu-divider" />

          <div className="context-menu-visibility" onClick={(e) => e.stopPropagation()}>
            <label>Player Moveable</label>
            <button
              className={`toggle-switch ${contextMenu.mapToken.player_moveable === true ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentMoveable = contextMenu.mapToken.player_moveable === true;
                handleTogglePlayerMoveable(contextMenu.mapToken.id, currentMoveable);
              }}
            />
          </div>
          <div className="context-menu-divider" />

          <div className="context-menu-name" onClick={(e) => e.stopPropagation()}>
            <label>{contextMenu.mapToken.token_instance_name ? 'Change Name' : 'Add Name'}</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter token name..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSaveTokenName(contextMenu.mapToken.id);
                }
              }}
            />
            {!contextMenu.mapToken.token_instance_name && (
              <button
                onClick={() => handleSaveTokenName(contextMenu.mapToken.id)}
                style={{ marginTop: '0.25rem' }}
              >
                Add
              </button>
            )}
            {contextMenu.mapToken.token_instance_name && (
              <button
                onClick={() => {
                  setNameInput('');
                  handleSaveTokenName(contextMenu.mapToken.id);
                }}
                style={{
                  marginTop: '0.25rem',
                  background: '#ef4444'
                }}
              >
                Remove Name
              </button>
            )}
          </div>
          <div className="context-menu-divider" />

          <div className="context-menu-colors" onClick={(e) => e.stopPropagation()}>
            <label>Border Color</label>
            <div className="color-picker-grid">
              {BORDER_COLORS.map((color) => (
                <div
                  key={color.id}
                  className={`color-swatch color-swatch-${color.id} ${selectedBorderColor === color.id ? 'selected' : ''}`}
                  title={color.label}
                  onClick={() => handleSetBorderColor(contextMenu.mapToken.id, color.value)}
                />
              ))}
            </div>
          </div>
          <div className="context-menu-divider" />

          <div className="context-menu-resize" onClick={(e) => e.stopPropagation()}>
            <label>Size (grid squares):</label>
            <input
              type="number"
              min="1"
              max="10"
              value={resizeInput}
              onChange={(e) => setResizeInput(e.target.value)}
            />
            <button onClick={() => handleResizeToken(contextMenu.mapToken.id, parseInt(resizeInput))}>
              Apply
            </button>
          </div>
          <div className="context-menu-divider" />

          <div
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              // Position will be calculated automatically next to the token
              handleOpenConditionSelector(contextMenu.mapToken);
            }}
          >
            Add Status
          </div>
          <div className="context-menu-divider" />

          <div
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setGroupSelectionModal({ mapTokenId: contextMenu.mapToken.id });
              setContextMenu(null);
            }}
          >
            Add to Group
          </div>
          <div className="context-menu-divider" />

          <div className="context-menu-item" onClick={() => handleRemoveToken(contextMenu.mapToken.id)}>
            Remove Token
          </div>
        </div>
      )}

      {/* Group Selection Modal - Render outside map container using Portal */}
      {groupSelectionModal && createPortal(
        <GroupSelectionModal
          campaignId={campaignId}
          mapTokenId={groupSelectionModal.mapTokenId}
          onClose={() => {
            console.log('[MapTokenLayer] Modal closing, triggering group refresh');
            setGroupSelectionModal(null);
            // Refresh tokens on map
            loadMapTokens();
            onTokensChange?.();
            // Also refresh groups display
            onGroupsRefresh?.();
          }}
          onMembershipChanged={() => {
            console.log('[MapTokenLayer] Membership changed (modal still open)');
            loadMapTokens();
          }}
        />,
        document.body
      )}

      {/* Condition Selector - Render outside map container using Portal */}
      {conditionSelector && createPortal(
        <ConditionSelector
          position={{ x: conditionSelector.x, y: conditionSelector.y }}
          currentConditions={
            conditionSelector.mapToken.conditions
              ? JSON.parse(conditionSelector.mapToken.conditions) as ConditionType[]
              : []
          }
          onConditionToggle={handleConditionToggle}
          onClose={() => setConditionSelector(null)}
        />,
        document.body
      )}
    </div>
  );
}

export default MapTokenLayer;



































































