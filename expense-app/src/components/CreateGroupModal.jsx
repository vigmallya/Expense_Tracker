import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function CreateGroupModal({ onClose, onCreated }) {
  const { user } = useAuth()
  const [name, setName]       = useState('')
  const [desc, setDesc]       = useState('')
  const [emails, setEmails]   = useState(['']) // list of invite email inputs
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Add another email input field
  function addEmailField() {
    setEmails([...emails, ''])
  }

  // Update a specific email field
  function updateEmail(index, value) {
    const updated = [...emails]
    updated[index] = value
    setEmails(updated)
  }

  // Remove an email field
  function removeEmail(index) {
    setEmails(emails.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!name.trim()) return
    setLoading(true)
    setError('')
  

    try {
      // 1. Create the group
      // Use security definer function to bypass RLS for group creation
        const { data, error: groupError } = await supabase
        .rpc('create_group', {
            group_name: name.trim(),
            group_description: desc.trim()
        })

        if (groupError) throw groupError

        // Parse the returned group object
        const group = typeof data === 'string' ? JSON.parse(data) : data

      // 3. Process each invite email
      const validEmails = emails.filter(e => e.trim() && e.includes('@'))

      for (const email of validEmails) {
        const trimmedEmail = email.trim().toLowerCase()

        // Check if this email already has an account
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', trimmedEmail)
          .single()

        if (existingProfile) {
          // User exists — add them directly as a member
          await supabase.from('group_members').insert({
            group_id: group.id,
            user_id:  existingProfile.id,
            role:     'member',
          })
        } else {
          // User doesn't exist — create a pending invitation
          await supabase.from('invitations').insert({
            group_id:   group.id,
            invited_by: user.id,
            email:      trimmedEmail,
          })
          // Note: in a real production app you'd send an email here
          // via Supabase Edge Functions or a service like Resend.
          // For now the invitation is stored and they'll see it on signup.
        }
      }

      onCreated(group)
      onClose()

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
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
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Create group</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Group name */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
              Group name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Goa Trip, Flat expenses"
              required
              autoFocus
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                fontSize: '15px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
              Description (optional)
            </label>
            <input
              type="text"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What is this group for?"
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                fontSize: '14px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Invite friends */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
              Invite friends by email
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {emails.map((email, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => updateEmail(index, e.target.value)}
                    placeholder="friend@example.com"
                    style={{
                      flex: 1, padding: '10px 12px',
                      border: '1px solid #e2e8f0', borderRadius: '10px',
                      fontSize: '14px', outline: 'none',
                    }}
                  />
                  {emails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmail(index)}
                      style={{
                        padding: '0 12px', border: '1px solid #fecaca',
                        borderRadius: '10px', backgroundColor: '#fef2f2',
                        color: '#dc2626', fontSize: '16px',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addEmailField}
              style={{
                marginTop: '8px', padding: '8px 14px',
                backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: '8px', fontSize: '13px', color: '#64748b',
              }}
            >
              + Add another
            </button>
          </div>

          {error && (
            <p style={{
              padding: '10px 12px', backgroundColor: '#fef2f2',
              color: '#dc2626', borderRadius: '8px',
              fontSize: '13px', marginBottom: '1rem'
            }}>
              {error}
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
            {loading ? 'Creating...' : 'Create group'}
          </button>
        </form>
      </div>
    </div>
  )
}