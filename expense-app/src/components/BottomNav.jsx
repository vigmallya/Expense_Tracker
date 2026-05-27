import { useNavigate, useLocation } from 'react-router-dom'

const tabs = [
  { path: '/dashboard', icon: '⊞', label: 'Home' },
  { path: '/expenses',  icon: '↕', label: 'Expenses' },
  { path: '/groups',    icon: '⊕', label: 'Groups' },
  { path: '/profile',   icon: '◯', label: 'Profile' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '480px',
      backgroundColor: 'white',
      borderTop: '1px solid #e2e8f0',
      display: 'flex',
      padding: '8px 0 20px',
      zIndex: 100,
    }}>
      {tabs.map(tab => {
        const isActive = location.pathname === tab.path
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              padding: '4px 0',
              color: isActive ? '#0f172a' : '#94a3b8',
            }}
          >
            <span style={{ fontSize: '20px' }}>{tab.icon}</span>
            <span style={{
              fontSize: '11px',
              fontWeight: isActive ? '600' : '400'
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}