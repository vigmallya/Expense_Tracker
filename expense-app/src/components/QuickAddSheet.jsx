import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function QuickAddSheet({ onPersonal, onGroup, onClose }) {
  const { user }          = useAuth()
  const [groups, setGroups] = useState([])
  const [showGroups, setShowGroups] = useState(false)
  const [loading, setLoading]       = useState(false)

  useEffect(() => { fetchGroups() }, [])

  async function fetchGroups() {
    setLoading(true)
    const { data } = await supabase
      .from('group_members')
      .select(`role, groups(id, name)`)
      .eq('user_id', user.id)
    setGroups((data || []).map(d => d.groups))
    setLoading(false)
  }

  // Get last used group from localStorage
  function getLastUsedGroup() {
    const id = localStorage.getItem('lastUsedGroupId')
    return groups.find(g => g.id === id) || groups[0] || null
  }

  function handleGroupTap() {
    if (groups.length === 0) return
    // Always show group list — never skip straight to modal
    setShowGroups(true)
    }

    // Sort groups — last used first
    const sortedGroups = [...groups].sort((a, b) => {
    const lastId = localStorage.getItem('lastUsedGroupId')
    if (a.id === lastId) return -1
    if (b.id === lastId) return 1
    return 0
    })

  function handleSelectGroup(group) {
    localStorage.setItem('lastUsedGroupId', group.id)
    onGroup(group)
    onClose()
  }

  const lastUsed = getLastUsedGroup()

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
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
            {showGroups ? 'Choose group' : 'Add expense'}
          </h2>
          <button
            onClick={showGroups ? () => setShowGroups(false) : onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b', cursor: 'pointer' }}
          >
            {showGroups ? '←' : '✕'}
          </button>
        </div>

        {!showGroups ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Personal */}
            <button
              onClick={() => { onPersonal(); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '16px', backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0', borderRadius: '12px',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                backgroundColor: '#0f172a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0,
              }}>
                👤
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>Personal</p>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
                  Track for yourself only
                </p>
              </div>
              <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '18px' }}>›</span>
            </button>

            {/* Group */}
            <button
              onClick={handleGroupTap}
              disabled={groups.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '16px', backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0', borderRadius: '12px',
                cursor: groups.length === 0 ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                opacity: groups.length === 0 ? 0.5 : 1,
              }}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                backgroundColor: '#0f172a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', flexShrink: 0,
              }}>
                👥
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>Group</p>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
                    {loading ? 'Loading...'
                        : groups.length === 0 ? 'No groups yet — create one first'
                        : lastUsed ? `Last used: ${lastUsed.name} · tap to change`
                        : 'Split with friends'}
                </p>
              </div>
              <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '18px' }}>›</span>
            </button>

          </div>
        ) : (
          // Group list
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedGroups.map(group => (
                <button
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', backgroundColor: '#f8fafc',
                    border: `1px solid ${lastUsed?.id === group.id ? '#0f172a' : '#e2e8f0'}`,
                    borderRadius: '12px', cursor: 'pointer',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>👥</span>
                    <div style={{ textAlign: 'left' }}>
                        <p style={{ fontSize: '14px', fontWeight: '500', color: '#0f172a' }}>{group.name}</p>
                        {lastUsed?.id === group.id && (
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Last used</p>
                        )}
                    </div>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '18px' }}>›</span>
                </button>
                ))}
          </div>
        )}
      </div>
    </div>
  )
}