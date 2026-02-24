import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header/Header';
import { usePresence } from '../hooks/usePresence';
import { fetchCampaign, loginUser, registerUser, type Campaign, type User } from '../api';
import DMView from './DMView';
import PlayerView from './PlayerView';
import './CampaignScreen.css';

function CampaignScreen() {
  const { campaignName, sessionID } = useParams();
  const [isDM, setIsDM] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('bm_user');
      if (stored) {
        const parsedUser = JSON.parse(stored) as User;
        if (parsedUser?.username && parsedUser?.id) {
          return parsedUser;
        }
      }
    } catch (error) {
    }
    return null;
  });

  // Check if user is logged in on mount
  useEffect(() => {
    if (!user) {
      setShowAuthModal(true);
      setIsCheckingAuth(false);
    }
  }, [user]);

  const identity = useMemo(() => {
    if (user) {
      return { id: user.id, name: user.username, role: 'player' as const };
    }
    // Guest fallback (shouldn't reach here with modal)
    return { name: 'Player', role: 'player' as const };
  }, [user]);

  // Check if the current user is the DM
  useEffect(() => {
    let isMounted = true;

    const checkDMStatus = async () => {
      if (!sessionID || !user) {
        if (isMounted) {
          setIsDM(false);
          setIsCheckingAuth(false);
        }
        return;
      }

      try {
        const campaign: Campaign = await fetchCampaign(sessionID);

        if (!isMounted) return;

        const userIsDM = Boolean(identity.id && campaign.DungeonMaster === identity.id);
        setIsDM(userIsDM);
      } catch (error) {
        if (!isMounted) return;
        setIsDM(false);
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    void checkDMStatus();

    return () => {
      isMounted = false;
    };
  }, [sessionID, identity.id, user]);

  // Update identity role based on DM status
  const finalIdentity = useMemo(() => {
    if (isDM === null) return null; // Don't connect until we know the role
    return {
      ...identity,
      role: isDM ? ('dm' as const) : ('player' as const)
    };
  }, [identity, isDM]);

  const { users, connected, tokenUpdate } = usePresence(sessionID, finalIdentity, sessionID);

  const sortedUsers = useMemo(() => {
    const list = [...users];
    list.sort((a, b) => {
      if (a.role === b.role) {
        return a.name.localeCompare(b.name);
      }
      return a.role === 'dm' ? -1 : 1;
    });
    return list;
  }, [users, connected]);

  useEffect(() => {
    if (campaignName) {
      document.title = campaignName;
    }
  }, [campaignName]);

  useEffect(() => {
  }, [isDM, finalIdentity, users]);

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const payload = {
        username: authForm.username.trim(),
        email: authForm.email.trim(),
        password: authForm.password
      };

      const result =
        authMode === 'register'
          ? await registerUser(payload)
          : await loginUser({ email: payload.email, password: payload.password });

      setUser(result);
      localStorage.setItem('bm_user', JSON.stringify(result));
      setShowAuthModal(false);
      setAuthForm({ username: '', email: '', password: '' });
      setAuthError(null);
    } catch (error) {
      setAuthError((error as Error).message);
    } finally {
      setAuthLoading(false);
    }
  };

  const canSubmitAuth = useMemo(() => {
    if (authMode === 'register') {
      return Boolean(authForm.username && authForm.email && authForm.password);
    }
    return Boolean(authForm.email && authForm.password);
  }, [authMode, authForm]);


  // Show auth modal if not logged in
  if (showAuthModal) {
    return (
      <div className="campaign-screen-wrapper player-mode">
        <header>
          <Header />
        </header>
        <div className="auth-modal-overlay">
          <div className="auth-modal-content">
            <h2>Login Required</h2>
            <p>You must be logged in to access this campaign.</p>

            <div className="auth-toggle">
              <button
                className={authMode === 'login' ? 'active' : ''}
                type="button"
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                className={authMode === 'register' ? 'active' : ''}
                type="button"
                onClick={() => setAuthMode('register')}
              >
                Create Account
              </button>
            </div>

            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <label>
                  Username
                  <input
                    type="text"
                    value={authForm.username}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="DungeonMaster42"
                    autoComplete="username"
                    required
                  />
                </label>
              )}
              <label>
                Email
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  required
                />
              </label>
              {authError && <div className="auth-error">{authError}</div>}
              <button className="auth-submit" type="submit" disabled={!canSubmitAuth || authLoading}>
                {authLoading ? 'Working...' : authMode === 'register' ? 'Create Account' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (isCheckingAuth) {
    return (
      <div className="campaign-screen-wrapper player-mode">
        <header>
          <Header username={user?.username} />
        </header>
        <div className="player-screen">
          <p style={{ color: '#ffffff', padding: '2rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`campaign-screen-wrapper ${isDM ? 'dm-mode' : 'player-mode'}`}>
      <header>
        <Header username={user?.username} />
      </header>

      {isDM ? (
        <DMView sortedUsers={sortedUsers} connected={connected} tokenUpdate={tokenUpdate} />
      ) : (
        <PlayerView sortedUsers={sortedUsers} connected={connected} tokenUpdate={tokenUpdate} />
      )}
    </div>
  );
}

export default CampaignScreen;

