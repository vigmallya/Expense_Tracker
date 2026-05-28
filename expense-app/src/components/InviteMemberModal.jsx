import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function InviteMemberModal({ groupId, onClose, onAdded }) {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')

    const { data, error } = await supabase.rpc('add_group_member', {
      p_group_id: groupId,
      p_email:    email.trim().toLowerCase(),
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(data.message)

    // If they were added directly (not just invited), refresh members list
    if (data.status === 'added') {
      setTimeout(() => {
        onAdded()
        onClose()
      }, 1000)
    }

    // If just invited, show success and let them close manually
    if (data.status === 'invited') {
      setEmail('')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: '480px', margin: '0 auto',
        backgroundColor: 'white', borderRadius: '20px 20px 0 0',
        padding: '1.5rem 1.5rem 2.5rem',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Invite member</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="friend@example.com"
              required
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', fontSize: '15px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* How it works note */}
          <div style={{
            padding: '10px 12px', backgroundColor: '#f8fafc',
            borderRadius: '8px', marginBottom: '1rem',
            fontSize: '12px', color: '#64748b', lineHeight: '1.6',
          }}>
            <p>✓ If they already have an account they'll be added instantly.</p>
            <p>✓ If not, they'll be added automatically when they sign up.</p>
          </div>

          {error && (
            <p style={{
              padding: '10px 12px', backgroundColor: '#fef2f2',
              color: '#dc2626', borderRadius: '8px',
              fontSize: '13px', marginBottom: '1rem',
            }}>
              {error}
            </p>
          )}

          {success && (
            <p style={{
              padding: '10px 12px', backgroundColor: '#f0fdf4',
              color: '#16a34a', borderRadius: '8px',
              fontSize: '13px', marginBottom: '1rem',
            }}>
              ✓ {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              backgroundColor: '#0f172a', color: 'white',
              border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: '500',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Adding...' : 'Add member'}
          </button>
        </form>
      </div>
    </div>
  )
}