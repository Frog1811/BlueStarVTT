import { useState, useEffect, useRef } from 'react';
import {
  createTokenFolder,
  deleteTokenFolder,
  uploadToken,
  createTokenFromBase,
  deleteToken,
  moveToken,
  updateToken,
  updateTokenFolder,
  getTokenUrl,
  type TokenFolder,
  type Token,
  type BaseToken
} from '../../api';
import './TokenManager.css';

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

// Build BaseToken-like entries from JOCAT assets
const jocatBaseTokens: BaseToken[] = Object.keys(jocatModules).map((path) => {
  const fileName = path.split('/').pop() || 'token';
  const name = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();

  return {
    id: `jocat-${fileName}`,
    name: name || fileName,
    imagePath: `/assets/JOCAT/${fileName}`
  } as BaseToken;
});

interface TokenManagerProps {
  campaignId: string;
  tokenFolders: TokenFolder[];
  tokens: Token[];
  baseTokens: BaseToken[];
  onFolderCreated?: () => void;
  onFolderDeleted?: () => void;
  onTokenCreated?: () => void;
  onTokenUpdated?: () => void;
  onTokenDeleted?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'folder' | 'token' | 'empty';
  targetId?: string;
  parentFolderId?: string | null;
}

interface ModalState {
  type: 'createFolder' | 'createToken' | 'editToken' | 'renameFolder';
  targetFolderId?: string;
  targetTokenId?: string;
}

function TokenManager({
  campaignId,
  tokenFolders,
  tokens,
  baseTokens,
  onFolderCreated,
  onFolderDeleted,
  onTokenCreated,
  onTokenUpdated,
  onTokenDeleted
}: TokenManagerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [selectedBaseToken, setSelectedBaseToken] = useState<BaseToken | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState('');
  const [createTokenTab, setCreateTokenTab] = useState<'upload' | 'base'>('upload');
  const [draggedToken, setDraggedToken] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // Helper function to get base token image URL
  const getBaseTokenImageUrl = (imagePath: string): string => {
    // imagePath is like "/assets/Icons/Aberration.png" or "/assets/JOCAT/Some.png"
    const fileName = imagePath.split('/').pop();
    if (fileName && iconMap.has(fileName)) {
      return iconMap.get(fileName)!;
    }
    if (fileName && jocatMap.has(fileName)) {
      return jocatMap.get(fileName)!;
    }
    // Fallback to the original path
    return imagePath;
  };

  const allBaseTokens = [...baseTokens, ...jocatBaseTokens];

  // Get folder hierarchy
  const getFoldersByParent = (parentId: string | null): TokenFolder[] => {
    return tokenFolders.filter(f => f.parent_folder_id === parentId);
  };

  // Get tokens in folder
  const getTokensByFolder = (folderId: string | null): Token[] => {
    return tokens.filter(t => t.token_folder_id === folderId && !t.is_base_token);
  };

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, type: 'folder' | 'token' | 'empty', targetId?: string, parentFolderId?: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 180;
    const menuHeight = 120;

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }

    setContextMenu({ x, y, type, targetId, parentFolderId });
  };

  // Close context menu on outside click
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

  // Focus modal input
  useEffect(() => {
    if (showModal && modalInputRef.current && modalState?.type !== 'createToken') {
      modalInputRef.current.focus();
    }
  }, [showModal, modalState]);

  // Open create folder modal
  const openCreateFolderModal = (parentFolderId?: string) => {
    setModalState({ type: 'createFolder', targetFolderId: parentFolderId });
    setFolderName('');
    setValidationError('');
    setShowModal(true);
    setContextMenu(null);
  };

  // Open create token modal
  const openCreateTokenModal = (folderId?: string) => {
    setModalState({ type: 'createToken', targetFolderId: folderId });
    setTokenName('');
    setSelectedBaseToken(null);
    setUploadedFile(null);
    setCreateTokenTab('upload');
    setValidationError('');
    setShowModal(true);
    setContextMenu(null);
  };

  // Open edit token modal
  const openEditTokenModal = (tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    setModalState({ type: 'editToken', targetTokenId: tokenId });
    setTokenName(token.name);
    setUploadedFile(null);
    setSelectedBaseToken(null);
    setCreateTokenTab('upload');
    setValidationError('');
    setShowModal(true);
    setContextMenu(null);
  };

  // Open rename folder modal
  const openRenameFolderModal = (folderId: string) => {
    const folder = tokenFolders.find(f => f.id === folderId);
    if (!folder) return;

    setModalState({ type: 'renameFolder', targetFolderId: folderId });
    setFolderName(folder.name);
    setValidationError('');
    setShowModal(true);
    setContextMenu(null);
  };

  // Handle folder creation
  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      setValidationError('Folder name is required');
      return;
    }

    const parentFolderId = modalState?.targetFolderId || null;
    const siblingFolders = tokenFolders.filter(f => f.parent_folder_id === parentFolderId);
    if (siblingFolders.some(f => f.name.toLowerCase() === folderName.toLowerCase())) {
      setValidationError('A folder with this name already exists in this directory');
      return;
    }

    try {
      await createTokenFolder(campaignId, {
        name: folderName,
        parentFolderId: parentFolderId
      });
      setShowModal(false);
      setFolderName('');
      onFolderCreated?.();
    } catch (error) {
      setValidationError('Failed to create folder');
    }
  };

  // Handle folder rename
  const handleRenameFolder = async () => {
    if (!folderName.trim()) {
      setValidationError('Folder name is required');
      return;
    }

    const folderId = modalState?.targetFolderId;
    if (!folderId) return;

    const folder = tokenFolders.find(f => f.id === folderId);
    if (!folder) return;

    // Check for duplicate folder names in the same parent directory (excluding self)
    const siblingFolders = tokenFolders.filter(
      f => f.parent_folder_id === folder.parent_folder_id && f.id !== folderId
    );
    if (siblingFolders.some(f => f.name.toLowerCase() === folderName.toLowerCase())) {
      setValidationError('A folder with this name already exists in this directory');
      return;
    }

    try {
      await updateTokenFolder(folderId, { name: folderName });
      setShowModal(false);
      setFolderName('');
      onFolderCreated?.();
    } catch (error) {
      setValidationError('Failed to rename folder');
    }
  };

  // Handle token creation
  const handleCreateToken = async () => {
    if (!tokenName.trim()) {
      setValidationError('Token name is required');
      return;
    }

    if (createTokenTab === 'upload' && !uploadedFile) {
      setValidationError('Please upload an image or select from Base tokens');
      return;
    }

    if (createTokenTab === 'base' && !selectedBaseToken) {
      setValidationError('Please select a Base token');
      return;
    }

    try {
      const folderId = modalState?.targetFolderId;

      // Get folder name from tokenFolders list
      let folderName = 'root';
      if (folderId) {
        const folder = tokenFolders.find(f => f.id === folderId);
        if (folder) {
          folderName = folder.name;
        }
      }

      if (createTokenTab === 'upload' && uploadedFile) {
        await uploadToken(campaignId, uploadedFile, tokenName, folderId, folderName);
      } else if (createTokenTab === 'base' && selectedBaseToken) {
        await createTokenFromBase(campaignId, tokenName, selectedBaseToken.imagePath, folderId);
      }

      setShowModal(false);
      setTokenName('');
      setUploadedFile(null);
      setSelectedBaseToken(null);
      onTokenCreated?.();
    } catch (error) {
      setValidationError('Failed to create token');
    }
  };

  // Handle token update
  const handleUpdateToken = async () => {
    if (!tokenName.trim()) {
      setValidationError('Token name is required');
      return;
    }

    const tokenId = modalState?.targetTokenId;
    if (!tokenId) return;

    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;

    try {
      // If using Base Token, we don't upload a file
      if (createTokenTab === 'base' && selectedBaseToken) {
        await updateToken(tokenId, {
          name: tokenName,
          imagePath: selectedBaseToken.imagePath
        });
      } else if (uploadedFile) {
        // If uploading a new file, need to pass folder name for multer to save to correct directory
        let folderName = 'root';
        if (token.token_folder_id) {
          const folder = tokenFolders.find(f => f.id === token.token_folder_id);
          if (folder) {
            folderName = folder.name;
          }
        }

        await updateToken(tokenId, {
          name: tokenName,
          file: uploadedFile,
          tokenFolderName: folderName
        });
      } else {
        // Just updating the name
        await updateToken(tokenId, {
          name: tokenName
        });
      }

      setShowModal(false);
      setTokenName('');
      setUploadedFile(null);
      setSelectedBaseToken(null);
      onTokenUpdated?.();
    } catch (error) {
      setValidationError('Failed to update token');
    }
  };

  // Handle folder deletion
  const handleDeleteFolder = async (folderId: string) => {
    if (confirm('Delete this folder and all tokens inside?')) {
      try {
        await deleteTokenFolder(folderId);
        setContextMenu(null);
        onFolderDeleted?.();
      } catch (error) {
      }
    }
  };

  // Handle token deletion
  const handleDeleteToken = async (tokenId: string) => {
    try {
      await deleteToken(tokenId);
      setContextMenu(null);
      onTokenDeleted?.();
    } catch (error: any) {
      // Check if error is due to token being used on maps
      if (error?.message === 'token in use') {
        const usageCount = (error as any).usageCount || 1;
        const message = `This token is currently used on ${usageCount} map${usageCount > 1 ? 's' : ''}. Are you sure you want to delete this token? It will be removed from all maps.`;

        if (confirm(message)) {
          try {
            const { forceDeleteToken } = await import('../../api');
            await forceDeleteToken(tokenId);
            setContextMenu(null);
            onTokenDeleted?.();
          } catch (forceError) {
            alert('Failed to delete token');
          }
        }
      } else {
        alert('Failed to delete token');
      }
    }
  };

  // Drag and drop handlers
  const handleTokenDragStart = (e: React.DragEvent, tokenId: string) => {
    setDraggedToken(tokenId);
    e.dataTransfer.effectAllowed = 'copyMove';

    // Find the token in custom tokens
    let token = tokens.find(t => t.id === tokenId);

    // If not found, search in base tokens and convert to proper format
    if (!token) {
      const baseToken = allBaseTokens.find(t => t.id === tokenId);
      if (baseToken) {
        // Convert base token to token format for drag
        token = {
          id: baseToken.id,
          name: baseToken.name,
          image_path: baseToken.imagePath,
          is_base_token: true,
          campaign_id: '',
          token_folder_id: null,
          created_at: new Date().toISOString()
        } as any;
      }
    }

    if (token) {
      e.dataTransfer.setData('application/json', JSON.stringify(token));
    }
  };

  const handleTokenDragEnd = () => {
    setDraggedToken(null);
  };

  const handleFolderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedToken) {
      try {
        await moveToken(draggedToken, targetFolderId);
        setDraggedToken(null);
        onTokenUpdated?.();
      } catch (error) {
        // Error moving token
      }
    }
  };

  // Render folder tree recursively
  const renderFolderTree = (parentFolderId: string | null = null, depth = 0) => {
    const folders = getFoldersByParent(parentFolderId);
    // For root level (parentFolderId === null), get all tokens with no folder
    // For subfolder level, get tokens in that folder
    const folderTokens = getTokensByFolder(parentFolderId);

    return (
      <>
        {folders.map(folder => (
          <div key={folder.id} style={{ marginLeft: depth > 0 ? '0.5rem' : '0' }}>
            <div
              className="token-folder-header"
              onDragOver={handleFolderDragOver}
              onDrop={(e) => handleFolderDrop(e, folder.id)}
              style={{ backgroundColor: draggedToken ? '#232a38' : undefined }}
              onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
              onClick={() => toggleFolder(folder.id)}
            >
              <button
                className="folder-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(folder.id);
                }}
              >
                {expandedFolders.has(folder.id) ? '▼' : '▶'}
              </button>
              <span className="folder-icon">📦</span>
              <span className="folder-name">{folder.name}</span>
            </div>

            {expandedFolders.has(folder.id) && (
              <div
                className="folder-contents"
                onContextMenu={(e) => {
                  // Allow creating subfolders by right-clicking in folder contents area
                  handleContextMenu(e, 'empty', undefined, folder.id);
                }}
              >
                {renderFolderTree(folder.id, depth + 1)}
                {getTokensByFolder(folder.id).length > 0 && (
                  <div className="folder-tokens-grid">
                    {getTokensByFolder(folder.id).map(token => (
                      <div
                        key={token.id}
                        className="token-item"
                        draggable
                        onDragStart={(e) => handleTokenDragStart(e, token.id)}
                        onDragEnd={handleTokenDragEnd}
                        style={{ opacity: draggedToken === token.id ? 0.5 : 1 }}
                        onContextMenu={(e) => handleContextMenu(e, 'token', token.id)}
                      >
                        <img
                          src={token.image_path.startsWith('/assets/') ? getBaseTokenImageUrl(token.image_path) : getTokenUrl(token.image_path)}
                          alt={token.name}
                          className="token-thumbnail"
                          draggable={false}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect fill="%23666" width="48" height="48"/><text x="24" y="24" text-anchor="middle" dominant-baseline="central" fill="%23fff" font-size="10">icon</text></svg>';
                          }}
                        />
                        <span className="token-name" title={token.name}>{token.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {parentFolderId === null && folderTokens.length > 0 && (
          <div
            className="root-tokens"
            onDragOver={handleFolderDragOver}
            onDrop={(e) => handleFolderDrop(e, null)}
            style={{ backgroundColor: draggedToken ? '#232a38' : undefined }}
          >
            {folderTokens.map(token => (
              <div
                key={token.id}
                className="token-item"
                draggable
                onDragStart={(e) => handleTokenDragStart(e, token.id)}
                onDragEnd={handleTokenDragEnd}
                style={{ opacity: draggedToken === token.id ? 0.5 : 1 }}
                onContextMenu={(e) => handleContextMenu(e, 'token', token.id)}
              >
                <img
                  src={token.image_path.startsWith('/assets/') ? getBaseTokenImageUrl(token.image_path) : getTokenUrl(token.image_path)}
                  alt={token.name}
                  className="token-thumbnail"
                  draggable={false}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect fill="%23666" width="48" height="48"/><text x="24" y="24" text-anchor="middle" dominant-baseline="central" fill="%23fff" font-size="10">icon</text></svg>';
                  }}
                />
                <span className="token-name" title={token.name}>{token.name}</span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  // Render JOCAT tokens folder (top-level, read-only)
  const renderJocatFolder = () => {
    const isExpanded = expandedFolders.has('JOCAT_TOKENS');

    return (
      <div className="base-folder-section">
        <div
          className="token-folder-header base-folder-header"
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => toggleFolder('JOCAT_TOKENS')}
        >
          <button
            className="folder-toggle"
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder('JOCAT_TOKENS');
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="folder-icon">📦</span>
          <span className="folder-name base-folder-name">Tokens</span>
          <span className="read-only-badge">READ-ONLY</span>
        </div>

        {isExpanded && (
          <div className="folder-contents base-folder-contents">
            {jocatBaseTokens.map(token => (
              <div
                key={token.id}
                className="token-item base-token-item"
                draggable
                onDragStart={(e) => handleTokenDragStart(e, token.id)}
                onDragEnd={handleTokenDragEnd}
                style={{ opacity: draggedToken === token.id ? 0.5 : 1 }}
              >
                <img
                  src={getBaseTokenImageUrl(token.imagePath)}
                  alt={token.name}
                  className="token-thumbnail"
                  draggable={false}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect fill="%23666" width="48" height="48"/><text x="24" y="24" text-anchor="middle" dominant-baseline="central" fill="%23fff" font-size="10">icon</text></svg>';
                  }}
                />
                <span className="token-name base-token-name" title={token.name}>{token.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="token-manager">
      <div className="token-manager-header">
        <h3>Tokens</h3>
      </div>

      <div
        className="token-manager-content"
        onContextMenu={(e) => {
          // Only show context menu if clicking in custom section (not on Base folder)
          const target = e.target as HTMLElement;
          if (!target.closest('.base-folder-section')) {
            e.preventDefault();
            e.stopPropagation();
            handleContextMenu(e, 'empty');
          }
        }}
      >
        {renderJocatFolder()}

        <div
          className="custom-folders-section"
          onDragOver={handleFolderDragOver}
          onDrop={(e) => handleFolderDrop(e, null)}
          style={{ backgroundColor: draggedToken ? '#232a38' : undefined }}
        >
          {tokenFolders.length === 0 && tokens.length === 0 ? (
            <div className="token-manager-empty">
              <p>No custom tokens or folders</p>
              <p className="empty-hint">Right-click to create a folder</p>
            </div>
          ) : (
            renderFolderTree()
          )}
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
            <div className="context-menu-item" onClick={() => openCreateFolderModal(contextMenu.parentFolderId || undefined)}>
              Create Folder
            </div>
          )}
          {contextMenu.type === 'folder' && contextMenu.targetId && (
            <>
              <div
                className="context-menu-item"
                onClick={() => openRenameFolderModal(contextMenu.targetId!)}
              >
                Rename Folder
              </div>
              <div
                className="context-menu-item"
                onClick={() => openCreateFolderModal(contextMenu.targetId)}
              >
                Create Subfolder
              </div>
              <div
                className="context-menu-item"
                onClick={() => openCreateTokenModal(contextMenu.targetId)}
              >
                Create Token
              </div>
              <div
                className="context-menu-item danger"
                onClick={() => handleDeleteFolder(contextMenu.targetId!)}
              >
                Delete Folder
              </div>
            </>
          )}
          {contextMenu.type === 'token' && contextMenu.targetId && (
            <>
              <div
                className="context-menu-item"
                onClick={() => openEditTokenModal(contextMenu.targetId!)}
              >
                Edit Token
              </div>
              <div
                className="context-menu-item danger"
                onClick={() => handleDeleteToken(contextMenu.targetId!)}
              >
                Delete Token
              </div>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showModal && modalState?.type === 'createFolder' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create Folder</h3>
            <input
              ref={modalInputRef}
              type="text"
              className="modal-input"
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                setValidationError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowModal(false);
              }}
              placeholder="Enter folder name..."
            />
            {validationError && (
              <p className="modal-error">{validationError}</p>
            )}
            <div className="modal-buttons">
              <button className="modal-button modal-button-cancel" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="modal-button modal-button-submit" onClick={handleCreateFolder}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && modalState?.type === 'createToken' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content token-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create Token</h3>

            <div className="modal-tabs">
              <button
                className={`modal-tab ${createTokenTab === 'upload' ? 'active' : ''}`}
                onClick={() => setCreateTokenTab('upload')}
              >
                Upload Image
              </button>
              <button
                className={`modal-tab ${createTokenTab === 'base' ? 'active' : ''}`}
                onClick={() => setCreateTokenTab('base')}
              >
                Select Base Token
              </button>
            </div>

            {createTokenTab === 'upload' && (
              <div className="modal-tab-content">
                <div
                  className="file-drop-zone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0]) {
                      setUploadedFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  {uploadedFile ? (
                    <p className="file-selected">✓ {uploadedFile.name}</p>
                  ) : (
                    <>
                      <p>Drag & drop image here</p>
                      <p className="file-hint">or</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setUploadedFile(e.target.files[0]);
                      }
                    }}
                    style={{ display: 'none' }}
                    id="file-input"
                  />
                  <button
                    className="modal-button"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    Choose File
                  </button>
                </div>
              </div>
            )}

            {createTokenTab === 'base' && (
              <div className="modal-tab-content">
                <div className="base-token-grid">
                  {allBaseTokens.map(token => (
                    <div
                      key={token.id}
                      className={`base-token-select ${selectedBaseToken?.id === token.id ? 'selected' : ''}`}
                      onClick={() => setSelectedBaseToken(token)}
                    >
                      <img src={getBaseTokenImageUrl(token.imagePath)} alt={token.name} />
                      <span>{token.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input
              type="text"
              className="modal-input"
              value={tokenName}
              onChange={(e) => {
                setTokenName(e.target.value);
                setValidationError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateToken();
                if (e.key === 'Escape') setShowModal(false);
              }}
              placeholder="Enter token name..."
            />

            {validationError && (
              <p className="modal-error">{validationError}</p>
            )}

            <div className="modal-buttons">
              <button className="modal-button modal-button-cancel" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="modal-button modal-button-submit" onClick={handleCreateToken}>
                Create Token
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && modalState?.type === 'editToken' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content token-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Token</h3>

            <div className="modal-tabs">
              <button
                className={`modal-tab ${createTokenTab === 'upload' ? 'active' : ''}`}
                onClick={() => setCreateTokenTab('upload')}
              >
                Upload Image
              </button>
              <button
                className={`modal-tab ${createTokenTab === 'base' ? 'active' : ''}`}
                onClick={() => setCreateTokenTab('base')}
              >
                Select Base Token
              </button>
            </div>

            <div className="edit-token-section">
              <label>Token Name</label>
              <input
                ref={modalInputRef}
                type="text"
                className="modal-input"
                value={tokenName}
                onChange={(e) => {
                  setTokenName(e.target.value);
                  setValidationError('');
                }}
                placeholder="Enter token name..."
              />
            </div>

            {createTokenTab === 'upload' && (
              <div className="edit-token-section">
                <label>Change Image (optional)</label>
                <div
                  className="file-drop-zone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0]) {
                      setUploadedFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  {uploadedFile ? (
                    <p className="file-selected">✓ {uploadedFile.name}</p>
                  ) : (
                    <>
                      <p>Drag & drop new image</p>
                      <p className="file-hint">or</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setUploadedFile(e.target.files[0]);
                      }
                    }}
                    style={{ display: 'none' }}
                    id="edit-file-input"
                  />
                  <button
                    className="modal-button"
                    onClick={() => document.getElementById('edit-file-input')?.click()}
                  >
                    Choose File
                  </button>
                </div>
              </div>
            )}

            {createTokenTab === 'base' && (
              <div className="edit-token-section">
                <label>Select Base Token</label>
                <div className="base-token-grid">
                  {allBaseTokens.map(token => (
                    <div
                      key={token.id}
                      className={`base-token-select ${selectedBaseToken?.id === token.id ? 'selected' : ''}`}
                      onClick={() => setSelectedBaseToken(token)}
                    >
                      <img src={getBaseTokenImageUrl(token.imagePath)} alt={token.name} />
                      <span>{token.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validationError && (
              <p className="modal-error">{validationError}</p>
            )}

            <div className="modal-buttons">
              <button className="modal-button modal-button-cancel" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="modal-button modal-button-submit" onClick={handleUpdateToken}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && modalState?.type === 'renameFolder' && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename Folder</h3>
            <input
              ref={modalInputRef}
              type="text"
              className="modal-input"
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                setValidationError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameFolder();
                if (e.key === 'Escape') setShowModal(false);
              }}
              placeholder="Enter folder name..."
            />
            {validationError && (
              <p className="modal-error">{validationError}</p>
            )}
            <div className="modal-buttons">
              <button className="modal-button modal-button-cancel" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="modal-button modal-button-submit" onClick={handleRenameFolder}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TokenManager;
