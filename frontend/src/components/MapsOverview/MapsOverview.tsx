import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  createFolder,
  deleteFolder,
  updateFolder,
  fetchFolders,
  fetchMaps,
  deleteMap,
  updateMap,
  uploadMap,
  getMapUrl,
  type MapFolder,
  type Map
} from '../../api';
import './MapsOverview.css';

interface MapsOverviewProps {
  onClose: () => void;
  onUpload?: () => void;
  onCreateFolder?: () => void;
  onFolderChange?: () => void;
  onMapChange?: () => void;
}

function MapsOverview({ onClose, onUpload, onCreateFolder, onFolderChange, onMapChange }: MapsOverviewProps) {
  const { sessionID } = useParams();
  const [folders, setFolders] = useState<MapFolder[]>([]);
  const [maps, setMaps] = useState<Map[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string; type: 'folder' | 'map' | 'empty' } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'rename'>('create');
  const [modalTarget, setModalTarget] = useState<{ type: 'folder' | 'map'; id?: string } | null>(null);
  const [modalValue, setModalValue] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [colorPickerFolder, setColorPickerFolder] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string>('');
  const [duplicateUploadMap, setDuplicateUploadMap] = useState<{ name: string; file: File } | null>(null);
  const [pendingMapMove, setPendingMapMove] = useState<{ map: Map; targetFolderId: string | null } | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!sessionID) return;
    try {
      const [f, m] = await Promise.all([fetchFolders(sessionID), fetchMaps(sessionID)]);
      setFolders(f);
      setMaps(m);
    } catch (error) {
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionID]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (showModal && modalInputRef.current) {
      modalInputRef.current.focus();
      modalInputRef.current.select();
    }
  }, [showModal]);

  const handleFileUpload = async (files: FileList) => {
    if (!sessionID) return;

    // Check first file for duplicates
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const fileName = file.name;
        if (checkDuplicateMapName(fileName)) {
          // Show duplicate dialog
          setDuplicateUploadMap({ name: fileName, file });
          setShowModal(true);
          setModalType('create');
          setModalValue(fileName);
          setModalTarget({ type: 'folder' });
          return; // Stop here - user must decide
        }

        try {
          await uploadMap(sessionID, file, currentFolderId || undefined);
        } catch (error) {
        }
      }
    }

    await loadData();
    onUpload?.();
    onMapChange?.();
  };

  const openCreateModal = () => {
    setModalType('create');
    setModalTarget({ type: 'folder' });
    setModalValue('');
    setShowModal(true);
    setContextMenu(null);
  };

  const openRenameModal = (type: 'folder' | 'map', id: string) => {
    setModalType('rename');
    setModalTarget({ type, id });
    const target = type === 'folder' ? folders.find(f => f.id === id) : maps.find(m => m.id === id);
    setModalValue(target?.name || '');
    setShowModal(true);
    setContextMenu(null);
  };

  const checkDuplicateFolderName = (name: string, excludeId?: string): boolean => {
    return currentFolders.some(f => f.name.toLowerCase() === name.toLowerCase() && f.id !== excludeId);
  };

  const checkDuplicateMapName = (name: string, excludeId?: string): boolean => {
    return currentMaps.some(m => m.name.toLowerCase() === name.toLowerCase() && m.id !== excludeId);
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
          await loadData();
          onUpload?.();
          onMapChange?.();
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
          await loadData();
          onMapChange?.();
        } catch (error) {
          alert('Failed to move map');
          return;
        }
        setShowModal(false);
        setPendingMapMove(null);
        setValidationError('');
        return;
      }

      if (!modalTarget) return;

      if (modalType === 'create' && modalTarget.type === 'folder') {
        // Check for duplicate folder name in current directory
        if (checkDuplicateFolderName(modalValue)) {
          setValidationError('A folder with this name already exists');
          return;
        }
        await createFolder(sessionID, {
          name: modalValue,
          parentFolderId: currentFolderId || undefined
        });
        await loadData();
        onCreateFolder?.();
        onFolderChange?.();
      } else if (modalType === 'rename' && modalTarget.id) {
        if (modalTarget.type === 'folder') {
          // Check for duplicate folder name (excluding self)
          if (checkDuplicateFolderName(modalValue, modalTarget.id)) {
            setValidationError('A folder with this name already exists');
            return;
          }
          await updateFolder(modalTarget.id, { name: modalValue });
          onFolderChange?.();
        } else {
          // Check for duplicate map name (excluding self)
          if (checkDuplicateMapName(modalValue, modalTarget.id)) {
            setValidationError('A map with this name already exists');
            return;
          }
          await updateMap(modalTarget.id, { name: modalValue });
          onMapChange?.();
        }
        await loadData();
      }
      setShowModal(false);
      setValidationError('');
      setDuplicateUploadMap(null);
    } catch (error) {
      alert('Operation failed');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, id: string, type: 'folder' | 'map' | 'empty') => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, id, type });
  };

  const handleDeleteFolder = async (id: string) => {
    if (!window.confirm('Delete folder?')) return;
    try {
      await deleteFolder(id);
      await loadData();
    } catch (error) {
    }
    setContextMenu(null);
  };

  const handleDeleteMap = async (id: string) => {
    if (!window.confirm('Delete map?')) return;
    try {
      await deleteMap(id);
      await loadData();
    } catch (error) {
    }
    setContextMenu(null);
  };

  const handleChangeFolderColor = async (folderId: string, color: string) => {
    try {
      await updateFolder(folderId, { color });
      await loadData();
      onFolderChange?.();
    } catch (error) {
    }
  };

  const handleOpenFolder = (folder: MapFolder) => {
    setCurrentFolderId(folder.id);
  };

  const handleGoBack = () => {
    setCurrentFolderId(null);
  };

  const handleMapDragStart = (e: React.DragEvent, map: Map) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(map));
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverFolderId(folderId as string | null);
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        const map = JSON.parse(data) as Map;

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
          setModalTarget({ type: 'map' });
          return;
        }

        // No duplicate, proceed with move
        await updateMap(map.id, { folder_id: folderId });
        await loadData();
        onMapChange?.();
      } catch (error) {
        alert('Failed to move map');
      }
    }
    setContextMenu(null);
  };

  // Filter folders and maps based on current folder
  const currentFolders = folders.filter(f => f.parent_folder_id === currentFolderId);
  const currentMaps = maps.filter(m => m.folder_id === currentFolderId);

  return (
    <div className="maps-overview-overlay" onClick={onClose}>
      <div
        className="maps-overview-content"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFileUpload(e.dataTransfer.files);
        }}
      >
        <button className="maps-overview-close" onClick={onClose}>✕</button>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <h2 className="maps-overview-title" style={{ margin: 0 }}>All Maps</h2>
          {currentFolderId && (
            <button
              onClick={handleGoBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '0.25rem 0.5rem',
              }}
              title="Go back"
            >
              ← Back
            </button>
          )}
        </div>

        <div
          className="maps-overview-grid"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY, id: 'empty', type: 'empty' });
          }}
        >
          {/* Move up folder icon - only show when in a subfolder */}
          {currentFolderId && (
            <div
              className={`overview-item overview-folder move-up-folder ${dragOverFolderId === 'parent' ? 'drag-over' : ''}`}
              onDoubleClick={() => handleGoBack()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
                setDragOverFolderId('parent');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverFolderId(null);
              }}
              onDrop={(e) => handleFolderDrop(e, null)}
              style={{ borderLeft: '3px solid #9333ea', cursor: 'pointer' }}
              title="Double-click to go back or drag maps here to move them to parent folder"
            >
              <span className="item-icon">📤</span>
              <span className="item-name">Move Up</span>
            </div>
          )}

          {currentFolders.map(folder => (
            <div
              key={folder.id}
              className={`overview-item overview-folder ${dragOverFolderId === folder.id ? 'drag-over' : ''}`}
              onContextMenu={(e) => handleContextMenu(e, folder.id, 'folder')}
              onDoubleClick={() => handleOpenFolder(folder)}
              onDragOver={(e) => handleFolderDragOver(e, folder.id)}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, folder.id)}
              style={{ borderLeft: `3px solid ${folder.color}` }}
            >
              <span className="item-icon">📁</span>
              <span className="item-name">{folder.name}</span>
            </div>
          ))}

          {currentMaps.map(map => (
            <div
              key={map.id}
              className="overview-item overview-map"
              onContextMenu={(e) => handleContextMenu(e, map.id, 'map')}
              draggable
              onDragStart={(e) => handleMapDragStart(e, map)}
            >
              <img src={getMapUrl(map.filepath)} alt={map.name} className="item-image" />
              <span className="item-name">{map.name}</span>
            </div>
          ))}

          {currentFolders.length === 0 && currentMaps.length === 0 && (
            <p className="overview-empty">No maps or folders</p>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'empty' && (
            <div className="context-menu-item" onClick={openCreateModal}>
              Create Folder
            </div>
          )}
          {contextMenu.type === 'folder' && (
            <>
              <div className="context-menu-item" onClick={() => openRenameModal('folder', contextMenu.id)}>
                Rename Folder
              </div>
              <div
                className="context-menu-item"
                onClick={() => setColorPickerFolder(contextMenu.id)}
              >
                Change Color
              </div>
              {colorPickerFolder === contextMenu.id && (
                <div className="color-picker">
                  {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'].map(color => (
                    <div
                      key={color}
                      className="color-option"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        handleChangeFolderColor(contextMenu.id, color);
                        setContextMenu(null);
                        setColorPickerFolder(null);
                      }}
                    />
                  ))}
                </div>
              )}
              <div
                className="context-menu-item danger"
                onClick={() => handleDeleteFolder(contextMenu.id)}
              >
                Delete Folder
              </div>
            </>
          )}
          {contextMenu.type === 'map' && (
            <>
              <div className="context-menu-item" onClick={() => openRenameModal('map', contextMenu.id)}>
                Rename Map
              </div>
              <div
                className="context-menu-item danger"
                onClick={() => handleDeleteMap(contextMenu.id)}
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
    </div>
  );
}

export default MapsOverview;




