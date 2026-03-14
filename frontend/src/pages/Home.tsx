import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  loginUser,
  registerUser,
  type User,
  fetchUserById
} from '../api'
import Navbar from '../components/Navbar/Navbar'
import './Home.css'

function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('bm_user')
      return saved ? (JSON.parse(saved) as User) : null
    } catch {
      return null
    }
  })

  console.log("TEST")

  const isAuthed = Boolean(user)

  useEffect(() => {
    if (user) {
      localStorage.setItem('bm_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('bm_user')
    }
  }, [user])

  useEffect(() => {
    // Refresh role if missing in stored user
    let mounted = true
    const refresh = async () => {
      if (user && !user.role) {
        try {
          const fresh = await fetchUserById(user.id)
          if (!mounted) return
          setUser(fresh)
          try { localStorage.setItem('bm_user', JSON.stringify(fresh)) } catch {}
        } catch (err) {
          // ignore
        }
      }
    }
    void refresh()
    return () => { mounted = false }
  }, [user])

  const canSubmitAuth = useMemo(() => {
    if (mode === 'register') {
      return Boolean(form.username && form.email && form.password)
    }
    return Boolean(form.email && form.password)
  }, [mode, form])

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password
      }

      const result =
        mode === 'register'
          ? await registerUser(payload)
          : await loginUser({ email: payload.email, password: payload.password })

      setUser(result)
      setForm({ username: '', email: '', password: '' })
      setShowAuthModal(false)
    } catch (error) {
      setAuthError((error as Error).message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    setUser(null)
    setAuthError(null)
    localStorage.removeItem('bm_user')
  }

  return (
    <>
      <Navbar isAuthenticated={isAuthed} />
      <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Blue Star VTT</h1>
          <p className="hero-tagline">Epic Adventures Await</p>
          <p className="hero-description">
            A powerful virtual tabletop for Dungeons &amp; Dragons. Create immersive campaigns,
            manage dynamic maps, and bring your adventures to life.
          </p>

          <div className="hero-actions">
            {!isAuthed ? (
              <>
                <button
                  className="btn btn-hero btn-primary"
                  onClick={() => { setMode('register'); setShowAuthModal(true); }}
                >
                  Start Your Quest
                </button>
                <button
                  className="btn btn-hero btn-secondary"
                  onClick={() => { setMode('login'); setShowAuthModal(true); }}
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-hero btn-primary"
                  onClick={() => navigate('/campaigns')}
                >
                  My Campaigns
                </button>
                <button
                  className="btn btn-hero btn-secondary"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {isAuthed && (
            <div className="welcome-message">
              <span className="welcome-icon">⚔️</span>
              <span>Welcome back, <strong>{user?.username}</strong>!</span>
            </div>
          )}
        </div>
      </section>

        {/* Features Section */}
        <section className="features-section">
          <h2 className="features-title">Master Your Campaign</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🗺️</div>
              <h3>Dynamic Maps</h3>
              <p>Upload and manage battle maps with customizable grid overlay</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎭</div>
              <h3>Token Management</h3>
              <p>Organize custom tokens and NPCs with drag-and-drop simplicity</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚔️</div>
              <h3>Initiative Tracker</h3>
              <p>Keep combat flowing with built-in initiative tracking</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Player Stats</h3>
              <p>Track HP, AC, and character stats for your entire party</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3>Multiplayer</h3>
              <p>DM and players collaborate in real-time</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📝</div>
              <h3>Campaign Notes</h3>
              <p>Keep track of story details and important information</p>
            </div>
          </div>
        </section>

        <footer className="home-footer">
          <p>&copy; 2026 Blue Star VTT. All rights reserved.</p>
        </footer>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal-backdrop" onClick={() => setShowAuthModal(false)}>
          <div className="modal auth-modal" onClick={(event) => event.stopPropagation()}>
            <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>

            <div className="toggle">
              <button
                className={mode === 'login' ? 'active' : ''}
                type="button"
                onClick={() => setMode('login')}
              >
                Login
              </button>
              <button
                className={mode === 'register' ? 'active' : ''}
                type="button"
                onClick={() => setMode('register')}
              >
                Create Account
              </button>
            </div>

            <form className="form" onSubmit={handleAuthSubmit}>
              {mode === 'register' && (
                <label>
                  Username
                  <input
                    type="text"
                    value={form.username}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, username: event.target.value }))
                    }
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
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder="••••••••"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                />
              </label>
              {authError && <div className="message error">{authError}</div>}
              <button className="btn btn-primary btn-large" type="submit" disabled={!canSubmitAuth || authLoading}>
                {authLoading ? 'Working...' : mode === 'register' ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default Home
