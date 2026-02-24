import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getBugReports,
  createBugReport,
  deleteBugReport,
  type User,
  type BugReport,
  fetchUserById
} from '../api'
import Navbar from '../components/Navbar/Navbar'
import './BugReports.css'

function BugReports() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('bm_user')
      return saved ? (JSON.parse(saved) as User) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    // If we have a user but no role stored (old localStorage), fetch fresh profile
    let mounted = true
    const refreshRole = async () => {
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
    void refreshRole()
    return () => { mounted = false }
  }, [user])

  const [reports, setReports] = useState<BugReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [bugContent, setBugContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isAuthed = Boolean(user)
  const isAdmin = String(user?.role || 'user').toLowerCase() === 'admin'
  const roleLabel = String(user?.role || 'unknown').toLowerCase()

  useEffect(() => {
    if (!isAuthed) {
      navigate('/')
      return
    }

    fetchBugReports()
  }, [isAuthed, navigate])

  const fetchBugReports = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getBugReports()
      setReports(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitBug = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!bugContent.trim()) {
      setSubmitError('Please enter a bug report')
      return
    }

    if (!user) {
      setSubmitError('User not found')
      return
    }

    try {
      setSubmitting(true)
      setSubmitError(null)

      const newReport = await createBugReport(user.id, user.username, bugContent.trim())

      // Add the new report to the top of the list
      setReports([newReport, ...reports])

      // Close modal and reset form
      setBugContent('')
      setShowModal(false)
    } catch (err) {
      setSubmitError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (!user) return

    if (!window.confirm('Are you sure you want to delete this bug report?')) {
      return
    }

    try {
      await deleteBugReport(reportId, user.id)
      setReports(reports.filter(r => r.id !== reportId))
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`)
    }
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('bm_user')
    navigate('/')
  }

  return (
    <>
      <Navbar isAuthenticated={isAuthed} />
      <div className="bug-reports-container">
        <div className="bug-reports-header">
          <div className="bug-reports-title-section">
            <h1 className="bug-reports-title">Bug Reports</h1>
            <p className="bug-reports-subtitle">Help us improve Blue Star VTT</p>
          </div>
          <div className="bug-reports-actions">
            <button
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
              disabled={!isAuthed}
            >
              Submit an Issue
            </button>
            {isAuthed && (
              <div className="user-info">
                <span className="username">{user?.username}</span>
                <span className={`user-role ${isAdmin ? 'admin' : 'user'}`}>
                  {roleLabel}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Submit Bug Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Submit a Bug Report</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowModal(false)}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleSubmitBug} className="bug-form">
                <textarea
                  className="bug-textarea"
                  placeholder="Describe the bug you encountered..."
                  value={bugContent}
                  onChange={(e) => setBugContent(e.target.value)}
                  rows={6}
                  disabled={submitting}
                />
                {submitError && (
                  <div className="error-message">{submitError}</div>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || !bugContent.trim()}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bug Reports List */}
        <div className="bug-reports-content">
          {loading ? (
            <div className="loading-state">Loading bug reports...</div>
          ) : error ? (
            <div className="error-state">Error: {error}</div>
          ) : reports.length === 0 ? (
            <div className="empty-state">
              <p>No bug reports yet. Be the first to report an issue!</p>
            </div>
          ) : (
            <div className="bug-reports-grid">
              {reports.map((report) => (
                <div key={report.id} className="bug-report-card">
                  <div className="bug-report-content">
                    <p className="bug-report-text">{report.content}</p>
                  </div>
                  <div className="bug-report-footer">
                    <span className="bug-report-author">Reported by: {report.username}</span>
                    <span className="bug-report-date">
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                    {user && (isAdmin || user.id === report.user_id) && (
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteReport(report.id)}
                        title="Delete this report"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default BugReports
