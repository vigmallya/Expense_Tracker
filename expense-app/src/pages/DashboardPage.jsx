import { useAuth } from '../context/AuthContext'

export default function DashboardPage() {
  const { user, signOut } = useAuth()

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <p>Logged in as: {user?.email}</p>
      <button onClick={signOut}>Sign out</button>
    </div>
  )
}