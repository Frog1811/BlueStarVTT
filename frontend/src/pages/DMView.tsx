import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  createFolder,
  deleteFolder,
  updateFolder,
  fetchFolders,
  uploadMap,
  fetchMaps,
  deleteMap,
  updateMap,
  getMapUrl,
  setActiveMap,
  getActiveMap,
  fetchTokenFolders,
  fetchTokens,
  fetchBaseTokens,
  addTokenToMap,
  type MapFolder,
  type Map,
  type TokenFolder,
  type Token,
  type BaseToken,
  type MapToken,
  fetchMapTokens
} from '../api';
import MapsOverview from '../components/MapsOverview/MapsOverview';
import TokenManager from '../components/TokenManager/TokenManager';
import GridEditor from '../components/GridEditor/GridEditor';
import GridOverlay from '../components/GridOverlay/GridOverlay';
import MapTokenLayer from '../components/MapTokenLayer/MapTokenLayer';
import StatsPanel from '../components/StatsPanel/StatsPanel';
import InitiativeTracker from '../components/InitiativeTracker/InitiativeTracker';
import type { TokenUpdateEvent } from '../hooks/usePresence';

interface DMViewProps {
  sortedUsers: Array<{
    id: string;
    name: string;
    role: 'dm' | 'player';
    lastSeen: number;
  }>;
  connected: boolean;
  tokenUpdate: TokenUpdateEvent | null;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'folder' | 'map' | 'empty';
  targetId?: string;
}

function DMView({ sortedUsers, connected, tokenUpdate }: DMViewProps) {
  const { sessionID } = useParams();
  const [folders, setFolders] = useState<MapFolder[]>([]);
  const [maps, setMaps] = useState<Map[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: 'Root' }]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [colorPickerFolder, setColorPickerFolder] = useState<string | null>(null);
  const [activeMap, setActiveMapState] = useState<Map | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'rename'>('create');
  const [modalTarget, setModalTarget] = useState<{ type: 'folder' | 'map'; id?: string } | null>(null);
  const [modalValue, setModalValue] = useState('');
  const [showMapsOverview, setShowMapsOverview] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [tokenFolders, setTokenFolders] = useState<TokenFolder[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [baseTokens, setBaseTokens] = useState<BaseToken[]>([]);
  const [duplicateUploadMap, setDuplicateUploadMap] = useState<{ name: string; file: File } | null>(null);
  const [pendingMapMove, setPendingMapMove] = useState<{ map: Map; targetFolderId: string | null } | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPanX, setMapPanX] = useState(0);
  const [mapPanY, setMapPanY] = useState(0);
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [mapDragStart, setMapDragStart] = useState({ x: 0, y: 0 });
  const [mapFitToScreenZoom, setMapFitToScreenZoom] = useState(1);
  const [tokenRefreshKey, setTokenRefreshKey] = useState(0);
  const [groupRefreshKey, setGroupRefreshKey] = useState(0);
  const [initiativeSelectingToken, setInitiativeSelectingToken] = useState(false);
  // mapTokens is loaded for potential future use and to keep state in sync
  const [, setMapTokens] = useState<MapToken[]>([]);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const mapsListRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);


  // Load folders, maps, and active map
  useEffect(() => {
    if (sessionID) {
      loadFolders();
      loadMaps();
      loadActiveMap();
      loadTokenFolders();
      loadTokens();
      loadBaseTokens();
    }
  }, [sessionID]);

  // Load map tokens when active map changes
  useEffect(() => {
    if (activeMap?.id) {
      loadMapTokens();
    }
  }, [activeMap?.id]);

  const loadMapTokens = async () => {
    if (!activeMap?.id) return;
    try {
      const tokens = await fetchMapTokens(activeMap.id);
      setMapTokens(tokens);
    } catch (error) {
      console.error('Failed to load map tokens:', error);
    }
  };

  // Enable horizontal scrolling with mouse wheel (no Shift needed)
  useEffect(() => {
    const mapsList = mapsListRef.current;
    if (!mapsList) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        mapsList.scrollLeft += e.deltaY;
      }
    };

    mapsList.addEventListener('wheel', handleWheel, { passive: false });
    return () => mapsList.removeEventListener('wheel', handleWheel);
  }, []);

  // Handle canvas map zoom with mouse wheel
  const handleCanvasWheel = useCallback((e: WheelEvent) => {
    if (!canvasRef.current) return;

    e.preventDefault();

    const container = canvasRef.current;

    // Get the full dimensions of the container where the map is rendered
    const containerRect = container.getBoundingClientRect();

    // Get mouse position relative to the container
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    // Calculate zoom direction
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    const minZoom = Math.min(mapFitToScreenZoom * 0.5, 0.05);
    const newZoom = Math.max(minZoom, Math.min(5, mapZoom * zoomDelta));

    // The transform is applied to the zoom container as: translate(mapPanX, mapPanY) scale(mapZoom) from origin (0,0)
    //
    // To find what map content is under the cursor:
    // Position in viewport = Position in map * zoom + pan
    // Position in map = (Position in viewport - pan) / zoom

    const mapX = (mouseX - mapPanX) / mapZoom;
    const mapY = (mouseY - mapPanY) / mapZoom;

    // After zooming, we want the same map position to stay under the cursor
    // newPan = mousePosition - (mapPosition * newZoom)

    const newPanX = mouseX - mapX * newZoom;
    const newPanY = mouseY - mapY * newZoom;

    setMapZoom(newZoom);
    setMapPanX(newPanX);
    setMapPanY(newPanY);
  }, [mapZoom, mapPanX, mapPanY, mapFitToScreenZoom]);

  // Handle canvas panning with mouse drag (always enabled)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Don't start panning if we're selecting tokens for initiative
    if (initiativeSelectingToken) return;

    setIsDraggingMap(true);
    setMapDragStart({ x: e.clientX - mapPanX, y: e.clientY - mapPanY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMap) return;

    const newPanX = e.clientX - mapDragStart.x;
    const newPanY = e.clientY - mapDragStart.y;

    setMapPanX(newPanX);
    setMapPanY(newPanY);
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingMap(false);
  };

  // Calculate fit-to-screen zoom when map image loads
  const handleMapImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!canvasRef.current || !activeMap) return;

    const img = e.currentTarget;
    const container = canvasRef.current;

    const imageWidth = img.naturalWidth;
    const imageHeight = img.naturalHeight;

    // Update activeMap with actual image dimensions if they differ
    if (imageWidth !== activeMap.width || imageHeight !== activeMap.height) {
      setActiveMapState({
        ...activeMap,
        width: imageWidth,
        height: imageHeight
      });
    }

    // Use getBoundingClientRect for more accurate dimensions
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    if (imageWidth > 0 && imageHeight > 0 && containerWidth > 0 && containerHeight > 0) {
      // Calculate zoom to fit entire image in viewport
      const zoomX = containerWidth / imageWidth;
      const zoomY = containerHeight / imageHeight;
      const calculatedZoom = Math.min(zoomX, zoomY, 1); // Don't go above 1x
      setMapFitToScreenZoom(calculatedZoom);

      // Calculate center position
      // The scaled image dimensions
      const scaledWidth = imageWidth * calculatedZoom;
      const scaledHeight = imageHeight * calculatedZoom;

      // Center the image in the container
      const centerX = (containerWidth - scaledWidth) / 2;
      const centerY = (containerHeight - scaledHeight) / 2;

      setMapZoom(calculatedZoom);
      setMapPanX(centerX);
      setMapPanY(centerY);
    }
  };

  // Add wheel listener to canvas
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleCanvasWheel);
  }, [handleCanvasWheel]);

  // Reset fitToScreenZoom reference on map change
  useEffect(() => {
    setMapFitToScreenZoom(1);
  }, [activeMap?.id]);

  // Focus modal input when shown
  useEffect(() => {
    if (showModal && modalInputRef.current) {
      modalInputRef.current.focus();
    }
  }, [showModal]);

  const loadFolders = async () => {
    if (!sessionID) return;
    try {
      const folderList = await fetchFolders(sessionID);
      setFolders(folderList);
    } catch (error) {
    }
  };

  const loadMaps = async () => {
    if (!sessionID) return;
    try {
      const mapList = await fetchMaps(sessionID);
      setMaps(mapList);
    } catch (error) {
    }
  };

  const loadActiveMap = async () => {
    if (!sessionID) return;
    try {
      const result = await getActiveMap(sessionID);
      // Preserve natural dimensions if we already have them
      if (activeMap && result.map && result.map.id === activeMap.id) {
        // Same map - keep the corrected dimensions
        setActiveMapState({
          ...result.map,
          width: activeMap.width,
          height: activeMap.height
        });
      } else {
        // Different map - use new dimensions (will be corrected by onLoad)
        setActiveMapState(result.map);
      }
    } catch (error) {
    }
  };

  const loadTokenFolders = async () => {
    if (!sessionID) return;
    try {
      const folderList = await fetchTokenFolders(sessionID);
      setTokenFolders(folderList);
    } catch (error) {
    }
  };

  const loadTokens = async () => {
    if (!sessionID) return;
    try {
      const tokenList = await fetchTokens(sessionID);
      setTokens(tokenList);
    } catch (error) {
    }
  };

  const loadBaseTokens = async () => {
    try {
      const baseTokenList = await fetchBaseTokens();
      setBaseTokens(baseTokenList);
    } catch (error) {
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setColorPickerFolder(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, type: 'folder' | 'map' | 'empty', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 180; // Approximate menu width
    const menuHeight = 150; // Approximate menu height

    // Calculate position, keeping menu on screen
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }

    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }

    setContextMenu({
      x,
      y,
      type,
      targetId
    });
    setColorPickerFolder(null);
  };

  const openCreateModal = () => {
    setModalType('create');
    setModalTarget({ type: 'folder' });
    setModalValue('');
    setShowModal(true);
    setContextMenu(null);
  };

  const navigateToFolder = (folderId: string | null, folderName: string) => {
    setCurrentFolderId(folderId);

    // Update breadcrumb path
    if (folderId === null) {
      // Going to root
      setFolderPath([{ id: null, name: 'Root' }]);
    } else {
      // Check if folder is already in path (going back)
      const existingIndex = folderPath.findIndex(p => p.id === folderId);
      if (existingIndex !== -1) {
        // Going back - truncate path
        setFolderPath(folderPath.slice(0, existingIndex + 1));
      } else {
        // Going forward - add to path
        setFolderPath([...folderPath, { id: folderId, name: folderName }]);
      }
    }
  };

  const handleFolderClick = (folder: MapFolder) => {
    navigateToFolder(folder.id, folder.name);
  };

  const handleBreadcrumbClick = (pathIndex: number) => {
    const targetFolder = folderPath[pathIndex];
    navigateToFolder(targetFolder.id, targetFolder.name);
  };

  const openRenameModal = (type: 'folder' | 'map', id: string) => {
    setModalType('rename');
    setModalTarget({ type, id });

    // Get current name
    if (type === 'folder') {
      const folder = folders.find(f => f.id === id);
      setModalValue(folder?.name || '');
    } else {
      const map = maps.find(m => m.id === id);
      setModalValue(map?.name || '');
    }

    setShowModal(true);
    setContextMenu(null);
  };

  const handleModalSubmit = async () => {
    if (!modalValue.trim() || !sessionID) return;

    try {
      // Handle duplicate upload rename
      if (duplicateUploadMap) {
        try {
          // Create a new File object with the new name
          const renamedFile = new File([duplicateUploadMap.file], modalValue, {
            type: duplicateUploadMap.file.type,
            lastModified: duplicateUploadMap.file.lastModified,
          });
          await uploadMap(sessionID, renamedFile, currentFolderId || undefined);
          await loadMaps();
        } catch (error) {
          alert('Failed to upload map');
          return;
        }
        setShowModal(false);
        setDuplicateUploadMap(null);
        setValidationError('');
        return;
      }

      // Handle pending map move with duplicate rename
      if (pendingMapMove) {
        try {
          await updateMap(pendingMapMove.map.id, {
            folder_id: pendingMapMove.targetFolderId,
            name: modalValue
          });
          await loadMaps();
        } catch (error) {
          alert('Failed to move map');
          return;
        }
        setShowModal(false);
        setPendingMapMove(null);
        setValidationError('');
        return;
      }

      // Handle pending map move with duplicate rename
      if (pendingMapMove) {
        try {
          const { map, targetFolderId } = pendingMapMove as { map: Map; targetFolderId: string | null };
          await updateMap(map.id, {
            folder_id: targetFolderId,
            name: modalValue
          });
          await loadMaps();
        } catch (error) {
          alert('Failed to move map');
          return;
        }
        setShowModal(false);
        setPendingMapMove(null);
        setValidationError('');
        return;
      }

      if (modalType === 'create') {
        // Check for duplicate folder name
        const currentFolders = folders.filter(f => f.parent_folder_id === currentFolderId);
        if (currentFolders.some(f => f.name.toLowerCase() === modalValue.toLowerCase())) {
          setValidationError('A folder with this name already exists');
          return;
        }
        await createFolder(sessionID, {
          name: modalValue,
          parentFolderId: currentFolderId || undefined
        });
        await loadFolders();
      } else if (modalType === 'rename' && modalTarget) {
        if (modalTarget.type === 'folder' && modalTarget.id) {
          // Check for duplicate folder name (excluding self)
          const currentFolders = folders.filter(f => f.parent_folder_id === currentFolderId && f.id !== modalTarget.id);
          if (currentFolders.some(f => f.name.toLowerCase() === modalValue.toLowerCase())) {
            setValidationError('A folder with this name already exists');
            return;
          }
          await updateFolder(modalTarget.id, { name: modalValue });
          await loadFolders();
        } else if (modalTarget.type === 'map' && modalTarget.id) {
          // Check for duplicate map name (excluding self)
          const currentMaps = maps.filter(m => m.folder_id === currentFolderId && m.id !== modalTarget.id);
          if (currentMaps.some(m => m.name.toLowerCase() === modalValue.toLowerCase())) {
            setValidationError('A map with this name already exists');
            return;
          }
          await updateMap(modalTarget.id, { name: modalValue });
          await loadMaps();
        }
      }
      setShowModal(false);
      setModalValue('');
      setValidationError('');
    } catch (error) {
      alert('Operation failed');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder and all its contents?')) return;

    try {
      await deleteFolder(folderId);
      await loadFolders();
      await loadMaps();

      // If we're inside the deleted folder, go back to root
      if (currentFolderId === folderId) {
        navigateToFolder(null, 'Root');
      }
    } catch (error) {
      alert('Failed to delete folder');
    }
    setContextMenu(null);
  };

  const handleChangeFolderColor = async (folderId: string, color: string) => {
    try {
      await updateFolder(folderId, { color });
      await loadFolders();
    } catch (error) {
    }
  };

  const handleDeleteMap = async (mapId: string) => {
    if (!confirm('Delete this map?')) return;

    try {
      await deleteMap(mapId);
      await loadMaps();
      if (activeMap?.id === mapId) {
        await setActiveMap(sessionID!, null);
        setActiveMapState(null);
      }
    } catch (error) {
      alert('Failed to delete map');
    }
    setContextMenu(null);
  };

  const handleFileUpload = async (files: FileList | null, folderId?: string) => {
    if (!files || !sessionID) return;

    // Check first file for duplicates
    const firstFile = Array.from(files)[0];
    if (firstFile && firstFile.type.startsWith('image/')) {
      const mapsInFolder = folderId
        ? maps.filter(m => m.folder_id === folderId)
        : maps.filter(m => !m.folder_id);

      // Check for duplicate
      if (mapsInFolder.some(m => m.name.toLowerCase() === firstFile.name.toLowerCase())) {
        // Show duplicate dialog
        setDuplicateUploadMap({ name: firstFile.name, file: firstFile });
        setShowModal(true);
        setModalType('create');
        setModalValue(firstFile.name);
        setModalTarget({ type: 'folder' });
        return; // Stop here - user must decide
      }
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        try {
          await uploadMap(sessionID, file, folderId);
          successCount++;
        } catch (error: any) {
          failCount++;
          const errorMsg = error?.message || 'Unknown error';
          errors.push(`${file.name}: ${errorMsg}`);
        }
      } else {
      }
    }

    // Always reload maps after upload attempts
    await loadMaps();

    // Show summary
    if (failCount > 0) {
      alert(`Upload complete:\n✓ ${successCount} succeeded\n✗ ${failCount} failed\n\nErrors:\n${errors.join('\n')}`);
    } else if (successCount > 0) {
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent, folderId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    await handleFileUpload(files, folderId);
  };

  const handleMapDragStart = (e: React.DragEvent, map: Map) => {
    e.dataTransfer.setData('application/json', JSON.stringify(map));
    e.dataTransfer.setData('map-id', map.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const mapId = e.dataTransfer.types.includes('map-id');
    if (mapId) {
      setDragOverFolder(folderId as string | null);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);

    const mapData = e.dataTransfer.getData('application/json');
    if (mapData) {
      try {
        const map = JSON.parse(mapData) as Map;

        // Check for duplicate map name in target folder
        const targetMaps = folderId
          ? maps.filter(m => m.folder_id === folderId && m.id !== map.id)
          : maps.filter(m => !m.folder_id && m.id !== map.id);

        if (targetMaps.some(m => m.name.toLowerCase() === map.name.toLowerCase())) {
          // Show duplicate dialog
          setPendingMapMove({ map, targetFolderId: folderId });
          setShowModal(true);
          setModalType('create');
          setModalValue(map.name);
          setModalTarget({ type: 'folder' });
          return;
        }

        // No duplicate, proceed with move
        await updateMap(map.id, { folder_id: folderId });
        await loadMaps();
      } catch (error) {
        alert('Failed to move map');
      }
    }
  };

  const handleMapDropOnCanvas = async (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (data && sessionID) {
      try {
        const parsed = JSON.parse(data);

        // Check if it's a map or a token
        if (parsed.filepath) {
          // It's a map
          const map = parsed as Map;
          await setActiveMap(sessionID, map.id);
          setActiveMapState(map);
        } else if (parsed.id && activeMap) {
          // It's a token - handle token drop
          const token = parsed;

          // Check if grid is enabled
          if (!activeMap.grid_enabled) {
            alert('Please enable grid before placing tokens on the map.');
            return;
          }

          // Get canvas position
          const canvas = canvasRef.current;
          if (!canvas) return;
          const canvasRect = canvas.getBoundingClientRect();

          const canvasX = e.clientX - canvasRect.left;
          const canvasY = e.clientY - canvasRect.top;

          // Convert to map coordinates
          const mapPixelX = (canvasX - mapPanX) / mapZoom;
          const mapPixelY = (canvasY - mapPanY) / mapZoom;

          // Calculate grid position
          const cellWidth = activeMap.width / (activeMap.grid_cols || 10);
          const cellHeight = activeMap.height / (activeMap.grid_rows || 10);
          const gridX = Math.floor(mapPixelX / cellWidth);
          const gridY = Math.floor(mapPixelY / cellHeight);

          // Add token to map
          await addTokenToMap(activeMap.id, token.id, gridX, gridY, 1);
          setTokenRefreshKey(prev => prev + 1);  // Force MapTokenLayer to reload tokens
        }
      } catch (err) {
        // Error handling drop
      }
    }
  };

  const currentFolders = folders.filter(f => f.parent_folder_id === currentFolderId);
  const currentMaps = maps.filter(m => m.folder_id === currentFolderId);

  // Handle initiative token selection
  const handleInitiativeTokenSelected = async (mapToken: MapToken) => {
    if (!initiativeSelectingToken || !activeMap) return;

    // Import the functions here to avoid circular dependency
    const { addToInitiative, getInitiativeEntries } = await import('../api');

    // Check if token already in initiative
    try {
      const entries = await getInitiativeEntries(activeMap.id);
      const existing = entries.find((e: any) => e.map_token_id === mapToken.id);
      if (existing) {
        alert('This token is already in the initiative tracker.');
        setInitiativeSelectingToken(false);
        return;
      }

      // Add token with default initiative value of 10
      // User can edit the value after it's added
      await addToInitiative(activeMap.id, mapToken.id, 10);
      setInitiativeSelectingToken(false);
    } catch (error) {
      console.error('Failed to add to initiative:', error);
      alert('Failed to add token to initiative.');
      setInitiativeSelectingToken(false);
    }
  };

  return (
    <>
      <div className="dm-screen-left-container">
        <div className="dm-screen-players">
          <p className="dm-screen-title">
            Online {!connected && <span style={{ color: '#ff6b6b', fontSize: '0.8em' }}>(Disconnected)</span>}
          </p>
          <div className="online-list">
            {sortedUsers.length ? (
              <ul>
                {sortedUsers.map((user) => (
                  <li key={user.id} className={user.role === 'dm' ? 'online-dm' : 'online-player'}>
                    {user.role === 'dm' ? `${user.name} (DM)` : user.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="online-empty">No one online yet.</p>
            )}
          </div>
        </div>
        <div className="dm-screen-map">
          <p className="dm-screen-title">Map Editor</p>
          <GridEditor activeMap={activeMap} onGridUpdate={() => { loadMaps(); loadActiveMap(); }} />
        </div>
      </div>
      <div className="dm-screen">
        <div
          ref={canvasRef}
          className="dm-canvas"
          onDragOver={handleDragOver}
          onDrop={handleMapDropOnCanvas}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          style={{ cursor: initiativeSelectingToken ? 'crosshair' : (isDraggingMap ? 'grabbing' : 'grab') }}
        >
          {activeMap ? (
            <>
              {/* Initiative Tracker - positioned in top left, unaffected by zoom */}
              <InitiativeTracker
                mapId={activeMap.id}
                isDM={true}
                isSelectingToken={initiativeSelectingToken}
                onSelectingChange={setInitiativeSelectingToken}
                onTokenSelected={handleInitiativeTokenSelected}
              />
              <div className="map-zoom-container" style={{ transform: `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`, transformOrigin: '0 0' }}>
                <img
                  src={getMapUrl(activeMap.filepath)}
                  alt={activeMap.name}
                  className="active-map-image"
                  draggable={false}
                  onLoad={handleMapImageLoad}
                  style={{ display: 'block', userSelect: 'none' }}
                />
                <GridOverlay map={activeMap} />
                <MapTokenLayer
                  key={tokenRefreshKey}
                  map={activeMap}
                  campaignId={sessionID || ''}
                  isDM={true}
                  zoom={mapZoom}
                  panX={mapPanX}
                  panY={mapPanY}
                  onTokensChange={() => { loadActiveMap(); loadMapTokens(); }}
                  onGroupsRefresh={() => { setGroupRefreshKey(prev => prev + 1); }}
                  onTokenClick={initiativeSelectingToken ? handleInitiativeTokenSelected : undefined}
                  tokenUpdate={tokenUpdate}
                />
              </div>
            </>
          ) : (
            <p style={{ color: '#888', textAlign: 'center', marginTop: '2rem' }}>
              Drag maps here to display
            </p>
          )}
          {mapZoom > mapFitToScreenZoom && (
            <div className="zoom-controls-hint" style={{ position: 'absolute', bottom: '1rem', right: '1rem', color: '#888', fontSize: '0.8rem' }}>
              Scroll to zoom | Drag to pan
            </div>
          )}
        </div>
      </div>
      <div className="dm-screen-characters">
        <TokenManager
          campaignId={sessionID || ''}
          tokenFolders={tokenFolders}
          tokens={tokens}
          baseTokens={baseTokens}
          onFolderCreated={loadTokenFolders}
          onFolderDeleted={loadTokenFolders}
          onTokenCreated={loadTokens}
          onTokenUpdated={loadTokens}
          onTokenDeleted={loadTokens}
        />
      </div>
      <div className="dm-screen-footer">
        <div
          className={`dm-screen-footer-maps ${isDraggingOver ? 'dragging-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e)}
          onContextMenu={(e) => handleContextMenu(e, 'empty')}
        >
          <div className="maps-header">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
              <p className="dm-screen-title">Maps</p>
              <button
                onClick={() => setShowMapsOverview(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.3rem',
                  cursor: 'pointer',
                  color: '#e5e7eb',
                  padding: '0.25rem 0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#e5e7eb';
                }}
                title="View all maps"
              >
                📂
              </button>
            </div>
            {/* Breadcrumb Navigation */}
            <div className="breadcrumb">
              {folderPath.map((path, index) => (
                <span key={path.id || 'root'}>
                  <span
                    className={`breadcrumb-item ${index === folderPath.length - 1 ? 'active' : ''}`}
                    onClick={() => index < folderPath.length - 1 && handleBreadcrumbClick(index)}
                  >
                    {path.name}
                  </span>
                  {index < folderPath.length - 1 && <span className="breadcrumb-separator"> / </span>}
                </span>
              ))}
            </div>
          </div>
          <div ref={mapsListRef} className="maps-list">
            {/* Move up folder - only show when in a subfolder */}
            {currentFolderId && (
              <div
                className={`folder-item move-up-folder ${dragOverFolder === 'parent' ? 'drag-over' : ''}`}
                onDoubleClick={() => handleBreadcrumbClick(folderPath.length - 2)}
                title="Double-click to go up one level or drag maps here"
                onDragOver={(e) => handleFolderDragOver(e, null)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, null)}
                style={{ borderLeft: '3px solid #9333ea', cursor: 'pointer' }}
              >
                <span className="folder-icon">📤</span>
                <span className="folder-name">Move Up</span>
              </div>
            )}

            {/* Folders in current directory */}
            {currentFolders.map(folder => (
              <div
                key={folder.id}
                className={`folder-item ${dragOverFolder === folder.id ? 'drag-over' : ''}`}
                onDoubleClick={() => handleFolderClick(folder)}
                onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
                onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
                style={{ borderLeft: `3px solid ${folder.color}`, cursor: 'pointer' }}
              >
                <span className="folder-icon">📁</span>
                <span className="folder-name">{folder.name}</span>
              </div>
            ))}

            {/* Maps in current directory */}
            {currentMaps.map(map => (
              <div
                key={map.id}
                className="map-item"
                draggable
                onDragStart={(e) => handleMapDragStart(e, map)}
                onContextMenu={(e) => handleContextMenu(e, 'map', map.id)}
              >
                <img
                  src={getMapUrl(map.filepath)}
                  alt={map.name}
                  className="map-thumbnail"
                />
                <span className="map-name">{map.name}</span>
              </div>
            ))}

            {currentFolders.length === 0 && currentMaps.length === 0 && (
              <p className="empty-folder">Empty folder - Right-click to create folders or drag maps here</p>
            )}
          </div>
        </div>
        <div className="dm-screen-footer-stats">
          <StatsPanel
            campaignId={sessionID || ''}
            mapId={activeMap?.id || null}
            isDM={true}
            forceRefresh={groupRefreshKey}
            onTokensChanged={() => {
              console.log('[DMView] onTokensChanged callback from StatsPanel - refreshing map tokens');
              loadActiveMap();
              loadMapTokens();
              // Force MapTokenLayer to reload tokens with new visibility
              setTokenRefreshKey(prev => prev + 1);
            }}
          />
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'empty' && (
            <div className="context-menu-item" onClick={openCreateModal}>
              Create Folder
            </div>
          )}
          {contextMenu.type === 'folder' && contextMenu.targetId && (
            <>
              <div
                className="context-menu-item"
                onClick={() => openRenameModal('folder', contextMenu.targetId!)}
              >
                Rename Folder
              </div>
              <div
                className="context-menu-item"
                onClick={() => setColorPickerFolder(contextMenu.targetId!)}
              >
                Change Color
              </div>
              {colorPickerFolder === contextMenu.targetId && (
                <div className="color-picker">
                  {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'].map(color => (
                    <div
                      key={color}
                      className="color-option"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        handleChangeFolderColor(contextMenu.targetId!, color);
                        setContextMenu(null);
                        setColorPickerFolder(null);
                      }}
                    />
                  ))}
                </div>
              )}
              <div
                className="context-menu-item danger"
                onClick={() => handleDeleteFolder(contextMenu.targetId!)}
              >
                Delete Folder
              </div>
            </>
          )}
          {contextMenu.type === 'map' && contextMenu.targetId && (
            <>
              <div
                className="context-menu-item"
                onClick={() => openRenameModal('map', contextMenu.targetId!)}
              >
                Rename Map
              </div>
              <div
                className="context-menu-item danger"
                onClick={() => handleDeleteMap(contextMenu.targetId!)}
              >
                Delete Map
              </div>
            </>
          )}
        </div>
      )}

      {/* Custom Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              {pendingMapMove
                ? 'Map Already Exists in Folder'
                : (duplicateUploadMap
                  ? 'Map Already Exists'
                  : (modalType === 'create' ? 'Create Folder' : 'Rename ' + (modalTarget?.type === 'folder' ? 'Folder' : 'Map')))}
            </h3>
            {pendingMapMove && (
              <p style={{ color: '#e5e7eb', marginBottom: '1rem', fontSize: '0.9rem' }}>
                A map with the name "<strong>{pendingMapMove.map.name}</strong>" already exists in that folder. You can rename it below or cancel.
              </p>
            )}
            {duplicateUploadMap && (
              <p style={{ color: '#e5e7eb', marginBottom: '1rem', fontSize: '0.9rem' }}>
                A map with the name "<strong>{duplicateUploadMap.name}</strong>" already exists. You can rename it below or cancel.
              </p>
            )}
            <input
              ref={modalInputRef}
              type="text"
              className="modal-input"
              value={modalValue}
              onChange={(e) => {
                setModalValue(e.target.value);
                setValidationError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleModalSubmit();
                if (e.key === 'Escape') {
                  setShowModal(false);
                  setDuplicateUploadMap(null);
                  setPendingMapMove(null);
                  setValidationError('');
                }
              }}
              placeholder={pendingMapMove || duplicateUploadMap ? 'New map name...' : 'Enter name...'}
            />
            {validationError && (
              <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '0.5rem 0', minHeight: '1.2em' }}>
                {validationError}
              </p>
            )}
            <div className="modal-buttons">
              <button
                className="modal-button modal-button-cancel"
                onClick={() => {
                  setShowModal(false);
                  setDuplicateUploadMap(null);
                  setPendingMapMove(null);
                  setValidationError('');
                }}
              >
                Cancel
              </button>
              <button className="modal-button modal-button-submit" onClick={handleModalSubmit}>
                {pendingMapMove ? 'Rename & Move' : (duplicateUploadMap ? 'Rename & Upload' : (modalType === 'create' ? 'Create' : 'Rename'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maps Overview Modal */}
      {showMapsOverview && (
        <MapsOverview
          onClose={() => setShowMapsOverview(false)}
          onUpload={loadMaps}
          onCreateFolder={loadFolders}
          onFolderChange={loadFolders}
          onMapChange={loadMaps}
        />
      )}
    </>
  );
}

export default DMView;



