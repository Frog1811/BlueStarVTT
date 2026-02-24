import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createCampaign,
  fetchCampaigns,
  updateCampaign,
  deleteCampaign,
  type Campaign,
  type User,
} from '../api'
import Navbar from '../components/Navbar/Navbar'
import DndLogo from '../components/DndLogo/DndLogo'
import './CampaignsPage.css'

function CampaignsPage() {
  const navigate = useNavigate()
  const [user] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('bm_user')
      return saved ? (JSON.parse(saved) as User) : null
    } catch {
      return null
    }
  })

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteModalState, setDeleteModalState] = useState<{
    step: 'confirm' | 'type-delete'
    campaignId: string
    campaignName: string
  } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    loadCampaigns()
  }, [user, navigate])

  const loadCampaigns = async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCampaigns(user.id)
      setCampaigns(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCampaign = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user?.id || !newCampaignName.trim()) return

    setError(null)
    try {
      await createCampaign({ name: newCampaignName.trim(), dungeonMasterId: user.id })
      setNewCampaignName('')
      setShowCreateModal(false)
      await loadCampaigns()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const startEditing = (campaign: Campaign) => {
    setEditingId(campaign.id)
    setEditingName(campaign.name)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName('')
  }

  const saveEdit = async (campaignId: string) => {
    if (!editingName.trim()) return

    setError(null)
    try {
      await updateCampaign(campaignId, { name: editingName.trim() })
      setEditingId(null)
      setEditingName('')
      await loadCampaigns()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, campaignId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(campaignId)
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  const startDelete = (campaign: Campaign) => {
    setDeleteModalState({
      step: 'confirm',
      campaignId: campaign.id,
      campaignName: campaign.name
    })
    setDeleteConfirmText('')
  }

  const handleDeleteConfirm = () => {
    if (!deleteModalState) return
    setDeleteModalState({
      ...deleteModalState,
      step: 'type-delete'
    })
  }

  const handleDeleteFinal = async () => {
    if (!deleteModalState || deleteConfirmText !== 'DELETE') return

    setError(null)
    try {
      await deleteCampaign(deleteModalState.campaignId)
      setDeleteModalState(null)
      setDeleteConfirmText('')
      await loadCampaigns()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const cancelDelete = () => {
    setDeleteModalState(null)
    setDeleteConfirmText('')
  }

  if (!user) {
    return null
  }

  return (
    <>
      <Navbar isAuthenticated={true} />
      <div className="campaigns-page">
        <div className="campaigns-container">
          <header className="campaigns-header">
            <h1>My Campaigns</h1>
            <button className="btn btn-primary btn-large" onClick={() => setShowCreateModal(true)}>
              Create Campaign
            </button>
          </header>

          {error && <div className="message error">{error}</div>}

          {loading ? (
            <p className="loading-text">Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <div className="empty-state">
              <p>No campaigns yet.</p>
              <p>Create your first campaign to get started!</p>
            </div>
          ) : (
            <div className="campaigns-grid">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="campaign-card">
                  {editingId === campaign.id ? (
                    <div className="campaign-edit">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, campaign.id)}
                        className="campaign-edit-input"
                        autoFocus
                      />
                      <div className="campaign-edit-actions">
                        <button
                          className="btn btn-small btn-primary"
                          onClick={() => saveEdit(campaign.id)}
                          disabled={!editingName.trim()}
                        >
                          Save
                        </button>
                        <button className="btn btn-small" onClick={cancelEditing}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Link
                        to={`/${encodeURIComponent(campaign.name)}/${campaign.id}`}
                        className="campaign-link"
                      >
                        <div className="campaign-icon">
                          <DndLogo size={56} />
                        </div>
                        <h3 className="campaign-title">{campaign.name}</h3>
                        <p className="campaign-subtitle">Click to enter</p>
                      </Link>
                      <div className="campaign-actions">
                        <button
                          className="btn btn-small btn-ghost"
                          onClick={(e) => { e.stopPropagation(); startEditing(campaign); }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-small btn-danger-ghost"
                          onClick={(e) => { e.stopPropagation(); startDelete(campaign); }}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Campaign</h2>
            <form className="form" onSubmit={handleCreateCampaign}>
              <label>
                Campaign Name
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="Curse of the Azure Blade"
                  required
                  autoFocus
                />
              </label>
              <div className="modal-actions">
                <button className="btn" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={!newCampaignName.trim()}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Campaign Modal */}
      {deleteModalState && (
        <div className="modal-backdrop" onClick={cancelDelete}>
          <div className="modal modal-delete" onClick={(e) => e.stopPropagation()}>
            {deleteModalState.step === 'confirm' ? (
              <>
                <h2>Are you sure?</h2>
                <p className="delete-warning">
                  You are about to delete "<strong>{deleteModalState.campaignName}</strong>".
                  This will permanently delete all maps, tokens, and game data associated with this campaign.
                </p>
                <div className="modal-actions">
                  <button className="btn" onClick={cancelDelete}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" onClick={handleDeleteConfirm}>
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Type DELETE to confirm</h2>
                <p className="delete-instruction">
                  Type <strong>DELETE</strong> (all capitals) to confirm permanent deletion of this campaign.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE here"
                  className="delete-confirm-input"
                  autoFocus
                />
                <div className="modal-actions">
                  <button className="btn" onClick={cancelDelete}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleDeleteFinal}
                    disabled={deleteConfirmText !== 'DELETE'}
                  >
                    Delete Campaign
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default CampaignsPage
