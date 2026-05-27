import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/BottomNav'
export default function ProfilePage() {
  const { user, signOut } = useAuth()
  return (
    <div style={{ padding: '3rem 1.5rem' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Profile</h1>
      <p style={{ color: '#64748b', marginTop: '8px', fontSize: '14px' }}>{user?.email}</p>
      <button
        onClick={signOut}
        style={{
          marginTop: '2rem', padding: '10px 20px',
          backgroundColor: '#fef2f2', color: '#dc2626',
          border: '1px solid #fecaca', borderRadius: '8px',
          fontSize: '14px', fontWeight: '500',
        }}
      >
        Sign out
      </button>
      <BottomNav />
    </div>
  )
}