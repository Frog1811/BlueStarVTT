import { useEffect, useMemo, useState } from 'react';
import {
  presenceStreamUrl,
  type PresenceRole,
  type PresenceUser
} from '../api';

export type PresenceIdentity = {
  id?: string;
  name: string;
  role: PresenceRole;
};

export type TokenUpdateEvent = {
  type: 'token_update';
  mapId: string;
  mapToken: any;
  timestamp: number;
};

export function usePresence(sessionId: string | undefined, identity: PresenceIdentity | null, campaignId?: string) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [tokenUpdate, setTokenUpdate] = useState<TokenUpdateEvent | null>(null);

  const streamUrl = useMemo(() => {
    if (!sessionId || !identity || !identity.name || !identity.role) {
      return null;
    }
    return presenceStreamUrl(sessionId, {
      userId: identity.id,
      name: identity.name,
      role: identity.role
    }, campaignId);
  }, [sessionId, identity, campaignId]);

  const isActive = Boolean(sessionId && identity && identity.name && identity.role && streamUrl);

  useEffect(() => {
    if (!isActive || !streamUrl) {
      setUsers([]);
      setConnected(false);
      return;
    }

    let isMounted = true;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        if (isMounted) {
          setConnected(true);
        }
      };

      eventSource.onmessage = (event) => {
        if (!isMounted) {
          return;
        }
        try {
          const payload = JSON.parse(event.data);

          // Handle presence updates
          if (payload.sessionId === sessionId && payload.users) {
            setUsers(payload.users);
          }

          // Handle token updates
          if (payload.type === 'token_update') {
            setTokenUpdate(payload);
          }
        } catch (error) {
          // Error parsing SSE message
        }
      };

      eventSource.onerror = () => {
        if (isMounted) {
          setConnected(false);
        }
      };
    } catch (error) {
      setConnected(false);
    }

    return () => {
      isMounted = false;
      if (eventSource) {
        try {
          eventSource.close();
        } catch (error) {
          // Error closing EventSource
        }
      }
    };
  }, [isActive, sessionId, streamUrl]);

  return {
    users: isActive ? users : [],
    connected: isActive ? connected : false,
    tokenUpdate: isActive ? tokenUpdate : null
  };
}





