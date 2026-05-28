import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/BottomNav'

const symbols = { EUR: '€', INR: '₹', USD: '$' }

export default function ProfilePage() {
  const { user, signOut } = useAuth()

  const [profile, setProfile]             = useState(null)
  const [name, setName]                   = useState('')
  const [preferredCurrency, setPreferredCurrency] = useState('EUR')
  const [editing, setEditing]             = useState(false)
  const [saving, setSaving]               = useState(false)
  const [stats, setStats]                 = useState({ expenses: 0, groups: 0, totalSpent: {} })
  const [loading, setLoading]             = useState(true)
  const [saveSuccess, setSaveSuccess]     = useState(false)

  useEffect(() => { fetchProfile(); fetchStats() }, [])

  async function fetchProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setName(data.name || '')
      setPreferredCurrency(data.preferred_currency || 'EUR')
    }
    setLoading(false)
  }

  async function fetchStats() {
    // Total personal expenses count
    const { count: expenseCount } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('paid_by', user.id)
      .eq('is_personal', true)

    // Total groups count
    const { count: groupCount } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Total spent per currency (personal only)
    const { data: expenseData } = await supabase
      .from('expenses')
      .select('amount, currency')
      .eq('paid_by', user.id)
      .eq('is_personal', true)

    const totalSpent = (expenseData || []).reduce((acc, e) => {
      const sym = symbols[e.currency] || e.currency
      acc[sym] = (acc[sym] || 0) + parseFloat(e.amount)
      return acc
    }, {})

    setStats({
      expenses: expenseCount || 0,
      groups:   groupCount || 0,
      totalSpent,
    })
  }

  async function handleSave() {
    setSaving(true)
    setSaveSuccess(false)

    const { error } = await supabase
      .from('profiles')
      .update({
        name,
        preferred_currency: preferredCurrency,
      })
      .eq('id', user.id)

    setSaving(false)

    if (!error) {
      setEditing(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      fetchProfile()
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '90px' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '3rem 1.5rem 2rem',
        backgroundColor: '#0f172a', color: 'white',
        textAlign: 'center',
      }}>
        {/* Avatar with initials */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px', fontWeight: '700',
          margin: '0 auto 12px',
        }}>
          {name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: '700' }}>
          {name || 'No name set'}
        </h1>
        <p style={{ fontSize: '13px', opacity: 0.5, marginTop: '4px' }}>
          {user.email}
        </p>
      </div>

      <div style={{ padding: '1.5rem' }}>

        {/* ── Stats ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '10px', marginBottom: '1.5rem',
        }}>
          <div style={{
            padding: '16px', backgroundColor: 'white',
            borderRadius: '12px', border: '1px solid #f1f5f9',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '28px', fontWeight: '700' }}>{stats.expenses}</p>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Personal expenses</p>
          </div>
          <div style={{
            padding: '16px', backgroundColor: 'white',
            borderRadius: '12px', border: '1px solid #f1f5f9',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '28px', fontWeight: '700' }}>{stats.groups}</p>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Groups</p>
          </div>
        </div>

        {/* Total spent per currency */}
        {Object.keys(stats.totalSpent).length > 0 && (
          <div style={{
            padding: '16px', backgroundColor: 'white',
            borderRadius: '12px', border: '1px solid #f1f5f9',
            marginBottom: '1.5rem',
          }}>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '10px' }}>
              All time personal spending
            </p>
            {Object.entries(stats.totalSpent).map(([sym, amt]) => (
              <p key={sym} style={{ fontSize: '22px', fontWeight: '700', lineHeight: 1.3 }}>
                {sym}{amt.toFixed(2)}
              </p>
            ))}
          </div>
        )}

        {/* ── Edit profile ── */}
        <div style={{
          padding: '16px', backgroundColor: 'white',
          borderRadius: '12px', border: '1px solid #f1f5f9',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600' }}>Profile</h2>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '5px 14px', fontSize: '12px', fontWeight: '500',
                  backgroundColor: '#f1f5f9', border: 'none',
                  borderRadius: '99px', color: '#64748b',
                }}
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => { setEditing(false); setName(profile?.name || '') }}
                style={{
                  padding: '5px 14px', fontSize: '12px',
                  backgroundColor: 'none', border: 'none',
                  color: '#94a3b8',
                }}
              >
                Cancel
              </button>
            )}
          </div>

          {/* Name */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Display name
            </label>
            {editing ? (
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '14px',
                  border: '1px solid #e2e8f0', borderRadius: '8px',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            ) : (
              <p style={{ fontSize: '14px', color: '#0f172a' }}>{name || '—'}</p>
            )}
          </div>

          {/* Email — read only */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Email
            </label>
            <p style={{ fontSize: '14px', color: '#64748b' }}>{user.email}</p>
          </div>

          {/* Preferred currency */}
          <div style={{ marginBottom: editing ? '16px' : '0' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Preferred currency
            </label>
            {editing ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                {['EUR', 'INR', 'USD'].map(c => (
                  <button
                    key={c}
                    onClick={() => setPreferredCurrency(c)}
                    style={{
                      padding: '6px 18px', borderRadius: '99px', fontSize: '13px',
                      border: '1px solid',
                      borderColor: preferredCurrency === c ? '#0f172a' : '#e2e8f0',
                      backgroundColor: preferredCurrency === c ? '#0f172a' : 'white',
                      color: preferredCurrency === c ? 'white' : '#64748b',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: '#0f172a' }}>{preferredCurrency}</p>
            )}
          </div>

          {/* Save button */}
          {editing && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '11px',
                backgroundColor: '#0f172a', color: 'white',
                border: 'none', borderRadius: '10px',
                fontSize: '14px', fontWeight: '500',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          )}

          {saveSuccess && (
            <p style={{ fontSize: '13px', color: '#16a34a', textAlign: 'center', marginTop: '8px' }}>
              ✓ Profile updated
            </p>
          )}
        </div>

        {/* ── Sign out ── */}
        <button
          onClick={signOut}
          style={{
            width: '100%', padding: '13px',
            backgroundColor: '#fef2f2', color: '#dc2626',
            border: '1px solid #fecaca', borderRadius: '10px',
            fontSize: '14px', fontWeight: '500',
          }}
        >
          Sign out
        </button>
      </div>

      <BottomNav />
    </div>
  )
}