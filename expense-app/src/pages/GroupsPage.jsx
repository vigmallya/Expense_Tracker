import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/BottomNav'
import CreateGroupModal from '../components/CreateGroupModal'

export default function GroupsPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [groups, setGroups]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetchGroups() }, [])

  async function fetchGroups() {
    setLoading(true)

    // Fetch all groups the current user is a member of
    const { data } = await supabase
      .from('group_members')
      .select(`
        group_id,
        role,
        groups (
          id,
          name,
          description,
          created_at
        )
      `)
      .eq('user_id', user.id)

    // Flatten the nested structure
    const grouped = (data || []).map(row => ({
      ...row.groups,
      role: row.role,
    }))

    setGroups(grouped)
    setLoading(false)
  }

  return (
    <div style={{ paddingBottom: '90px' }}>

      {/* Header */}
      <div style={{
        padding: '3rem 1.5rem 1.5rem',
        backgroundColor: '#0f172a', color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Groups</h1>
            <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '2px' }}>
              {groups.length} group{groups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              backgroundColor: 'white', color: '#0f172a',
              border: 'none', fontSize: '22px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            +
          </button>
        </div>
      </div>

      <div style={{ padding: '1.5rem' }}>
        {loading && (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading...</p>
        )}

        {!loading && groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>👥</p>
            <p style={{ fontSize: '14px' }}>No groups yet</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              Create one to start splitting expenses
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                marginTop: '1.5rem', padding: '10px 24px',
                backgroundColor: '#0f172a', color: 'white',
                border: 'none', borderRadius: '10px',
                fontSize: '14px', fontWeight: '500',
              }}
            >
              Create your first group
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {groups.map(group => (
            <div
              key={group.id}
              onClick={() => navigate(`/groups/${group.id}`)}
              style={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #f1f5f9',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '16px', fontWeight: '600' }}>{group.name}</p>
                  {group.description && (
                    <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '3px' }}>
                      {group.description}
                    </p>
                  )}
                  <p style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '6px' }}>
                    Created {new Date(group.created_at).toLocaleDateString('default', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
                <span style={{ fontSize: '20px' }}>›</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <CreateGroupModal
          onClose={() => setShowModal(false)}
          onCreated={fetchGroups}
        />
      )}

      <BottomNav />
    </div>
  )
}