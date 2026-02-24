const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = await response.json();
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // Ignore JSON parse errors.
    }
    throw new Error(message);
  }

  // Handle 204 No Content responses (no body)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type User = {
  id: string;
  username: string;
  email: string;
  role?: string;
};

export type Campaign = {
  id: string;
  name: string;
  DungeonMaster: string;
};

export type PresenceRole = 'dm' | 'player';

export type PresenceUser = {
  id: string;
  name: string;
  role: PresenceRole;
  lastSeen: number;
};

export type PresencePayload = {
  sessionId: string;
  users: PresenceUser[];
  serverTime: number;
};

export type MapFolder = {
  id: string;
  campaign_id: string;
  name: string;
  color: string;
  parent_folder_id: string | null;
  created_at: string;
};

export type Map = {
  id: string;
  campaign_id: string;
  folder_id: string | null;
  name: string;
  filename: string;
  filepath: string;
  width: number;
  height: number;
  grid_enabled: boolean;
  grid_cols: number;
  grid_rows: number;
  grid_color: string;
  grid_opacity: number;
  created_at: string;
};

export type TokenFolder = {
  id: string;
  campaign_id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
};

export type Token = {
  id: string;
  campaign_id: string;
  token_folder_id: string | null;
  name: string;
  image_path: string;
  is_base_token: boolean;
  created_at: string;
};

export type BaseToken = {
  id: string;
  name: string;
  imagePath: string;
};

export type MapToken = {
  id: string;
  map_id: string;
  token_id: string;
  x: number;
  y: number;
  size: number;
  name: string;
  image_path: string;
  is_base_token: boolean;
  is_visible_to_players: boolean;
  transparency: number;
  token_instance_name?: string;
  border_color?: string;
  player_moveable?: boolean;
  conditions?: string; // JSON array of condition names
  created_at: string;
};

export function registerUser(payload: {
  username: string;
  email: string;
  password: string;
}) {
  return request<User>("/api/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function loginUser(payload: { email: string; password: string }) {
  return request<User>("/api/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

// Fetch a user's public profile by ID (includes role)
export function fetchUserById(userId: string) {
  return request<User>(`/api/users/${encodeURIComponent(userId)}`);
}

export function createCampaign(payload: { name: string; dungeonMasterId: string }) {
  return request<Campaign>("/api/campaigns", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchCampaigns(userId: string) {
  return request<Campaign[]>(`/api/users/${encodeURIComponent(userId)}/campaigns`);
}

export function fetchCampaign(campaignId: string) {
  return request<Campaign>(`/api/campaigns/${encodeURIComponent(campaignId)}`);
}

export function updateCampaign(campaignId: string, payload: { name: string }) {
  return request<Campaign>(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteCampaign(campaignId: string) {
  return request<void>(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    method: "DELETE"
  });
}

export function presenceStreamUrl(
  sessionId: string,
  identity: { userId?: string; name: string; role: PresenceRole },
  campaignId?: string
) {
  const params = new URLSearchParams({
    sessionId,
    name: identity.name,
    role: identity.role
  });

  if (identity.userId) {
    params.set('userId', identity.userId);
  }

  if (campaignId) {
    params.set('campaignId', campaignId);
  }

  return `${API_BASE}/api/presence/stream?${params.toString()}`;
}

// Folder API functions
export function createFolder(campaignId: string, payload: { name: string; parentFolderId?: string; color?: string }) {
  return request<MapFolder>(`/api/campaigns/${encodeURIComponent(campaignId)}/folders`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchFolders(campaignId: string) {
  return request<MapFolder[]>(`/api/campaigns/${encodeURIComponent(campaignId)}/folders`);
}

export function updateFolder(folderId: string, payload: { name?: string; color?: string }) {
  return request<MapFolder>(`/api/folders/${encodeURIComponent(folderId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteFolder(folderId: string) {
  return request<{ message: string }>(`/api/folders/${encodeURIComponent(folderId)}`, {
    method: "DELETE"
  });
}

// Map API functions
export async function uploadMap(campaignId: string, file: File, folderId?: string): Promise<Map> {
  const formData = new FormData();
  formData.append('map', file);
  if (folderId) {
    formData.append('folderId', folderId);
  }
  formData.append('campaignId', campaignId);

  const response = await fetch(`${API_BASE}/api/campaigns/${encodeURIComponent(campaignId)}/maps`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    let message = `Upload failed (${response.status} ${response.statusText})`;
    try {
      const body = await response.json();
      if (body?.message) {
        message = body.message;
      }
      if (body?.error) {
        message += `: ${body.error}`;
      }
    } catch (e) {
      // Could not parse error response
    }
    throw new Error(message);
  }

  const result = await response.json();
  return result as Map;
}

export function fetchMaps(campaignId: string) {
  return request<Map[]>(`/api/campaigns/${encodeURIComponent(campaignId)}/maps`);
}

export function deleteMap(mapId: string) {
  return request<{ message: string }>(`/api/maps/${encodeURIComponent(mapId)}`, {
    method: "DELETE"
  });
}

export function updateMap(mapId: string, payload: {
  name?: string;
  folder_id?: string | null;
  grid_enabled?: boolean;
  grid_cols?: number;
  grid_rows?: number;
  grid_color?: string;
  grid_opacity?: number;
}) {
  return request<Map>(`/api/maps/${encodeURIComponent(mapId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function getMapUrl(filepath: string) {
  return `${API_BASE}/maps/${filepath}`;
}

// Active map endpoints
export function setActiveMap(campaignId: string, mapId: string | null) {
  return request<{ campaign_id: string; active_map_id: string | null }>(`/api/campaigns/${encodeURIComponent(campaignId)}/active-map`, {
    method: "POST",
    body: JSON.stringify({ mapId })
  });
}

export function getActiveMap(campaignId: string) {
  return request<{ campaign_id: string; active_map_id: string | null; map: Map | null }>(`/api/campaigns/${encodeURIComponent(campaignId)}/active-map`);
}

// Token Folder endpoints
export function createTokenFolder(campaignId: string, payload: { name: string; parentFolderId?: string | null }) {
  return request<TokenFolder>(`/api/campaigns/${encodeURIComponent(campaignId)}/token-folders`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchTokenFolders(campaignId: string) {
  return request<TokenFolder[]>(`/api/campaigns/${encodeURIComponent(campaignId)}/token-folders`);
}

export function updateTokenFolder(folderId: string, payload: { name: string }) {
  return request<TokenFolder>(`/api/token-folders/${encodeURIComponent(folderId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteTokenFolder(folderId: string) {
  return request<{ message: string }>(`/api/token-folders/${encodeURIComponent(folderId)}`, {
    method: "DELETE"
  });
}

// Token endpoints
export async function uploadToken(campaignId: string, file: File, name: string, tokenFolderId?: string, tokenFolderName?: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('campaignId', campaignId);
  if (tokenFolderId) {
    formData.append('tokenFolderId', tokenFolderId);
  }

  // Build URL with query params for folder name (multer needs it before body is parsed)
  const folderName = tokenFolderName || 'root';
  const url = `${API_BASE}/api/campaigns/${encodeURIComponent(campaignId)}/tokens?tokenFolderName=${encodeURIComponent(folderName)}`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    let message = "Token upload failed";
    try {
      const body = await response.json();
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(message);
  }

  return response.json() as Promise<Token>;
}

export async function createTokenFromBase(campaignId: string, name: string, imagePath: string, tokenFolderId?: string) {
  const response = await request<Token>(`/api/campaigns/${encodeURIComponent(campaignId)}/tokens/from-base`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      imagePath,
      tokenFolderId: tokenFolderId || null
    })
  });

  return response;
}

export function fetchTokens(campaignId: string) {
  return request<Token[]>(`/api/campaigns/${encodeURIComponent(campaignId)}/tokens`);
}

export function fetchBaseTokens() {
  return request<BaseToken[]>(`/api/base-tokens`);
}

export async function updateToken(tokenId: string, payload: { name?: string; file?: File; imagePath?: string; campaignId?: string; tokenFolderId?: string | null; tokenFolderName?: string }) {
  // If only updating name and/or imagePath (no file), use JSON
  if (!payload.file) {
    const jsonPayload: Record<string, string | null> = {};
    if (payload.name) {
      jsonPayload.name = payload.name;
    }
    if (payload.imagePath) {
      jsonPayload.imagePath = payload.imagePath;
    }

    const response = await fetch(`${API_BASE}/api/tokens/${encodeURIComponent(tokenId)}`, {
      method: 'PATCH',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(jsonPayload)
    });

    if (!response.ok) {
      let message = "Token update failed";
      try {
        const body = await response.json();
        if (body?.message) {
          message = body.message;
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(message);
    }

    return response.json() as Promise<Token>;
  }

  // If uploading a file, use FormData with query parameters
  const formData = new FormData();

  if (payload.name) {
    formData.append('name', payload.name);
  }
  if (payload.file) {
    formData.append('file', payload.file);
  }

  // Build URL with query parameter for folder name (multer needs this before body is parsed)
  const folderName = payload.tokenFolderName || 'root';
  let url = `${API_BASE}/api/tokens/${encodeURIComponent(tokenId)}?tokenFolderName=${encodeURIComponent(folderName)}`;


  const response = await fetch(url, {
    method: 'PATCH',
    body: formData
    // Note: Do NOT set Content-Type header for FormData - browser sets it automatically
  });

  if (!response.ok) {
    let message = "Token update failed";
    try {
      const body = await response.json();
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(message);
  }

  return response.json() as Promise<Token>;
}

export function deleteToken(tokenId: string) {
  return request<{ message: string; usageCount?: number; confirmDelete?: boolean }>(`/api/tokens/${encodeURIComponent(tokenId)}`, {
    method: "DELETE"
  });
}

export function forceDeleteToken(tokenId: string) {
  return request<{ message: string }>(`/api/tokens/${encodeURIComponent(tokenId)}/force`, {
    method: "DELETE"
  });
}

export function moveToken(tokenId: string, targetFolderId: string | null) {
  return request<Token>(`/api/tokens/${encodeURIComponent(tokenId)}/move`, {
    method: "PATCH",
    body: JSON.stringify({ tokenFolderId: targetFolderId })
  });
}

// Map Token API functions
export function addTokenToMap(mapId: string, tokenId: string, x: number, y: number, size?: number) {
  return request<MapToken>(`/api/maps/${encodeURIComponent(mapId)}/tokens`, {
    method: "POST",
    body: JSON.stringify({ tokenId, x, y, size: size || 1 })
  });
}

export function fetchMapTokens(mapId: string) {
  return request<MapToken[]>(`/api/maps/${encodeURIComponent(mapId)}/tokens`);
}

export function updateMapToken(mapTokenId: string, payload: { x?: number; y?: number; size?: number; is_visible_to_players?: boolean; transparency?: number; token_instance_name?: string | null; border_color?: string | null; player_moveable?: boolean; conditions?: string }) {
  return request<MapToken>(`/api/map-tokens/${encodeURIComponent(mapTokenId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function removeMapToken(mapTokenId: string) {
  return request<{ message: string }>(`/api/map-tokens/${encodeURIComponent(mapTokenId)}`, {
    method: "DELETE"
  });
}

export function getTokenUrl(imagePath: string) {
  // imagePath is formatted as "tokens/campaignId/folderId/tokenId.{ext}"
  return `${API_BASE}/${imagePath}`;
}

export function getBaseTokenUrl(imagePath: string) {
  // imagePath is already formatted as "/assets/Icons/IconName.png"
  return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
}

// ===== PLAYER STATS API =====

export type PlayerStat = {
  id: string;
  user_id: string;
  username: string;
  current_hp: number;
  max_hp: number;
  armor_class: number | null;
};

export function getPlayerStats(campaignId: string) {
  return request<PlayerStat[]>(`/api/campaigns/${encodeURIComponent(campaignId)}/player-stats`);
}

export function updatePlayerStats(campaignId: string, userId: string, playerNameOrHp: string | number, maxHp?: number, armorClass?: number | null) {
  // Handle both old format (userId, currentHp, maxHp) and new format (userId='', playerName, 0, 0)
  let body: any;

  if (userId === '' && typeof playerNameOrHp === 'string') {
    // New format: creating DM player tracker with just name
    body = { playerName: playerNameOrHp, currentHp: 0, maxHp: 0, armorClass: null };
  } else {
    // Old format: updating existing tracker
    body = { userId, currentHp: playerNameOrHp, maxHp, armorClass };
  }

  return request<{ success: boolean }>(`/api/campaigns/${encodeURIComponent(campaignId)}/player-stats`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function updatePlayerStatsById(campaignId: string, statId: string, currentHp: number, maxHp: number, armorClass: number | null) {
  return request<{ success: boolean }>(`/api/campaigns/${encodeURIComponent(campaignId)}/player-stats`, {
    method: "POST",
    body: JSON.stringify({ statId, currentHp, maxHp, armorClass })
  });
}

export function deletePlayerStats(statId: string) {
  return request<{ success: boolean }>(`/api/player-stats/${encodeURIComponent(statId)}`, {
    method: "DELETE"
  });
}

export function updatePlayerStatName(statId: string, playerName: string) {
  return request<{ success: boolean }>(`/api/player-stats/${encodeURIComponent(statId)}`, {
    method: "PATCH",
    body: JSON.stringify({ playerName })
  });
}

// ===== ENCOUNTER NPC API =====

export type EncounterNPC = {
  id: string;
  name: string;
  current_hp: number;
  max_hp: number;
  armor_class: number | null;
};

export function getEncounterNPCs(mapId: string) {
  return request<EncounterNPC[]>(`/api/maps/${encodeURIComponent(mapId)}/encounter-npcs`);
}

export function createEncounterNPC(campaignId: string, mapId: string, name: string, currentHp: number, maxHp: number, armorClass: number | null) {
  return request<EncounterNPC>(`/api/campaigns/${encodeURIComponent(campaignId)}/maps/${encodeURIComponent(mapId)}/encounter-npcs`, {
    method: "POST",
    body: JSON.stringify({ name, currentHp, maxHp, armorClass })
  });
}

export function updateEncounterNPC(npcId: string, name: string, currentHp: number, maxHp: number, armorClass: number | null) {
  return request<{ success: boolean }>(`/api/encounter-npcs/${encodeURIComponent(npcId)}`, {
    method: "PATCH",
    body: JSON.stringify({ name, currentHp, maxHp, armorClass })
  });
}

export function deleteEncounterNPC(npcId: string) {
  return request<{ success: boolean }>(`/api/encounter-npcs/${encodeURIComponent(npcId)}`, {
    method: "DELETE"
  });
}

// ===== MAP NOTES API =====

export type MapNote = {
  id: string | null;
  content: string;
};

export function getMapNotes(campaignId: string, mapId: string) {
  return request<MapNote>(`/api/campaigns/${encodeURIComponent(campaignId)}/maps/${encodeURIComponent(mapId)}/notes`);
}

export function saveMapNotes(campaignId: string, mapId: string, content: string) {
  return request<{ success: boolean }>(`/api/campaigns/${encodeURIComponent(campaignId)}/maps/${encodeURIComponent(mapId)}/notes`, {
    method: "POST",
    body: JSON.stringify({ content })
  });
}

// ===== INITIATIVE TRACKER API =====

export type InitiativeEntry = {
  id: string;
  map_id: string;
  map_token_id: string;
  initiative_value: number;
  sort_order: number;
  token_name: string;
  token_image: string;
  is_base_token: boolean;
  token_border_color: string | null;
};

export function getInitiativeEntries(mapId: string) {
  return request<InitiativeEntry[]>(`/api/maps/${encodeURIComponent(mapId)}/initiative`);
}

export function addToInitiative(mapId: string, mapTokenId: string, initiativeValue: number) {
  return request<InitiativeEntry>(`/api/maps/${encodeURIComponent(mapId)}/initiative`, {
    method: "POST",
    body: JSON.stringify({ mapTokenId, initiativeValue })
  });
}

export function updateInitiativeValue(initiativeId: string, initiativeValue: number) {
  return request<{ success: boolean }>(`/api/initiative/${encodeURIComponent(initiativeId)}`, {
    method: "PATCH",
    body: JSON.stringify({ initiativeValue })
  });
}

export function removeFromInitiative(initiativeId: string) {
  return request<{ success: boolean }>(`/api/initiative/${encodeURIComponent(initiativeId)}`, {
    method: "DELETE"
  });
}

export function clearInitiative(mapId: string) {
  return request<{ success: boolean }>(`/api/maps/${encodeURIComponent(mapId)}/initiative`, {
    method: "DELETE"
  });
}

// ===== TOKEN GROUPS API =====

export type TokenGroupMember = {
  map_token_id: string;
  is_visible_to_players: boolean;
};

export type TokenGroup = {
  id: string;
  campaign_id: string;
  name: string;
  created_at: string;
  members: TokenGroupMember[];
};

export function createTokenGroup(campaignId: string, name: string) {
  return request<TokenGroup>(`/api/campaigns/${encodeURIComponent(campaignId)}/token-groups`, {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

export function fetchTokenGroups(campaignId: string) {
  return request<TokenGroup[]>(`/api/campaigns/${encodeURIComponent(campaignId)}/token-groups`);
}

export function updateTokenGroup(groupId: string, name: string) {
  return request<{ success: boolean }>(`/api/token-groups/${encodeURIComponent(groupId)}`, {
    method: "PATCH",
    body: JSON.stringify({ name })
  });
}

export function deleteTokenGroup(groupId: string) {
  return request<{ success: boolean }>(`/api/token-groups/${encodeURIComponent(groupId)}`, {
    method: "DELETE"
  });
}

export function addTokenToGroup(groupId: string, mapTokenId: string) {
  return request<{ success: boolean; memberId: string }>(`/api/token-groups/${encodeURIComponent(groupId)}/members`, {
    method: "POST",
    body: JSON.stringify({ mapTokenId })
  });
}

export function removeTokenFromGroup(groupId: string, mapTokenId: string) {
  return request<{ success: boolean }>(`/api/token-groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(mapTokenId)}`, {
    method: "DELETE"
  });
}

export function toggleGroupVisibility(groupId: string, visible: boolean) {
  return request<{ success: boolean; updated: number }>(`/api/token-groups/${encodeURIComponent(groupId)}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ visible })
  });
}

// Bug Reports

export type BugReport = {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
};

export function getBugReports() {
  return request<BugReport[]>("/api/bug-reports");
}

export function createBugReport(userId: string, username: string, content: string) {
  return request<BugReport>("/api/bug-reports", {
    method: "POST",
    body: JSON.stringify({ userId, username, content })
  });
}

export function deleteBugReport(reportId: string, userId: string) {
  return request<{ success: boolean }>(`/api/bug-reports/${encodeURIComponent(reportId)}`, {
    method: "DELETE",
    body: JSON.stringify({ userId })
  });
}


