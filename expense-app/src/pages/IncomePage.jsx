import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/BottomNav'

const SOURCES = ['Salary', 'Freelance', 'Bonus', 'Gift', 'Investment', 'Other']
const symbols = { EUR: '€', INR: '₹', USD: '$' }

function currencySymbol(code) { return symbols[code] || code }

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('default', { day: 'numeric', month: 'short' })
}

function sourceIcon(source) {
  const icons = {
    Salary:     '💼',
    Freelance:  '💻',
    Bonus:      '🎯',
    Gift:       '🎁',
    Investment: '📈',
    Other:      '💰',
  }
  return icons[source] || '💰'
}

export default function IncomePage() {
  const { user }    = useAuth()
  const navigate    = useNavigate()

  const [income, setIncome]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear())

  useEffect(() => { fetchIncome() }, [selectedMonth, selectedYear])

  async function fetchIncome() {
    setLoading(true)
    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
    const endDate   = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0]

    const { data } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    setIncome(data || [])
    setLoading(false)
  }

  // Group income by month for display
  function groupByMonth(items) {
    return items.reduce((groups, item) => {
      const date = new Date(item.date + 'T00:00:00')
      const key  = date.toLocaleString('default', { month: 'long', year: 'numeric' })
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
      return groups
    }, {})
  }

  // Total per currency
  const totalsByCurrency = income.reduce((acc, i) => {
    const sym = currencySymbol(i.currency)
    acc[sym] = (acc[sym] || 0) + parseFloat(i.amount)
    return acc
  }, {})

  const grouped = groupByMonth(income)

  return (
    <div style={{ paddingBottom: '90px' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '3rem 1.5rem 1.5rem',
        backgroundColor: '#0f172a', color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}
          >←</button>
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Income</h1>
        </div>

        {/* Month + Year selectors */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            style={{
              padding: '6px 10px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px', fontSize: '13px',
              color: 'white', outline: 'none',
            }}
          >
            {['January','February','March','April','May','June',
              'July','August','September','October','November','December'
            ].map((m, i) => (
              <option key={m} value={i} style={{ backgroundColor: '#0f172a' }}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{
              padding: '6px 10px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px', fontSize: '13px',
              color: 'white', outline: 'none',
            }}
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y} style={{ backgroundColor: '#0f172a' }}>{y}</option>
            ))}
          </select>
        </div>

        {/* Total this month */}
        <p style={{ fontSize: '13px', opacity: 0.6 }}>Total income</p>
        {Object.entries(totalsByCurrency).map(([sym, amt]) => (
          <h2 key={sym} style={{ fontSize: '36px', fontWeight: '700', margin: '4px 0 0', lineHeight: 1.1 }}>
            {sym}{amt.toFixed(2)}
          </h2>
        ))}
        {Object.keys(totalsByCurrency).length === 0 && (
          <h2 style={{ fontSize: '36px', fontWeight: '700', margin: '4px 0 0' }}>€0.00</h2>
        )}
        <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '6px' }}>
          {income.length} entr{income.length !== 1 ? 'ies' : 'y'} this month
        </p>
      </div>

      <div style={{ padding: '1.5rem' }}>

        {/* Add income button */}
        <button
          onClick={() => setShowModal(true)}
          style={{
            width: '100%', padding: '13px',
            backgroundColor: '#0f172a', color: 'white',
            border: 'none', borderRadius: '10px',
            fontSize: '15px', fontWeight: '500',
            marginBottom: '1.5rem', cursor: 'pointer',
          }}
        >
          + Add income
        </button>

        {loading && <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading...</p>}

        {!loading && income.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>💰</p>
            <p style={{ fontSize: '14px' }}>No income entries this month</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>Tap + Add income to get started</p>
          </div>
        )}

        {/* Grouped by month */}
        {Object.entries(grouped).map(([month, monthIncome]) => {
          const monthTotals = monthIncome.reduce((acc, i) => {
            const sym = currencySymbol(i.currency)
            acc[sym] = (acc[sym] || 0) + parseFloat(i.amount)
            return acc
          }, {})

          return (
            <div key={month} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {month}
                </h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {Object.entries(monthTotals).map(([sym, amt]) => `${sym}${amt.toFixed(2)}`).join(' · ')}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {monthIncome.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setEditingIncome(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px', backgroundColor: 'white',
                      borderRadius: '12px', border: '1px solid #f1f5f9',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      backgroundColor: '#f0fdf4', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '18px',
                    }}>
                      {sourceIcon(item.source)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: '500' }}>{item.source}</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        {item.note || formatDate(item.date)} {item.note ? `· ${formatDate(item.date)}` : ''}
                      </p>
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: '600', color: '#16a34a', flexShrink: 0 }}>
                      +{currencySymbol(item.currency)}{parseFloat(item.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit Modal */}
      {(showModal || editingIncome) && (
        <IncomeModal
          income={editingIncome}
          onClose={() => { setShowModal(false); setEditingIncome(null) }}
          onSaved={() => { setShowModal(false); setEditingIncome(null); fetchIncome() }}
          userId={user.id}
        />
      )}

      <BottomNav />
    </div>
  )
}

// ── Income Modal (add + edit + delete) ──
function IncomeModal({ income, onClose, onSaved, userId }) {
  const { user } = { user: { id: userId } }
  const isEdit   = !!income

  const [amount, setAmount]   = useState(income?.amount || '')
  const [source, setSource]   = useState(income?.source || 'Salary')
  const [currency, setCurrency] = useState(income?.currency || 'EUR')
  const [date, setDate]       = useState(income?.date || new Date().toISOString().split('T')[0])
  const [note, setNote]       = useState(income?.note || '')
  const [saving, setSaving]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]     = useState('')

  const { user: authUser } = useAuth()

  async function handleSave(e) {
    e.preventDefault()
    if (!amount) return
    setSaving(true)
    setError('')

    try {
      if (isEdit) {
        const { error } = await supabase
          .from('income')
          .update({ amount: parseFloat(amount), source, currency, date, note })
          .eq('id', income.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('income')
          .insert({ amount: parseFloat(amount), source, currency, date, note, user_id: authUser.id })
        if (error) throw error
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('income').delete().eq('id', income.id)
    setDeleting(false)
    if (error) { setError(error.message); return }
    onSaved()
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
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
            {isEdit ? 'Edit income' : 'Add income'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b' }}>✕</button>
        </div>

        <form onSubmit={handleSave}>

          {/* Amount */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Amount</label>
            <input
              type="number" step="0.01" min="0"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" required autoFocus
              style={{
                width: '100%', padding: '12px',
                fontSize: '28px', fontWeight: '600',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Source */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Source</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {SOURCES.map(s => (
                <button key={s} type="button" onClick={() => setSource(s)}
                  style={{
                    padding: '6px 14px', borderRadius: '99px', fontSize: '13px',
                    border: '1px solid',
                    borderColor: source === s ? '#0f172a' : '#e2e8f0',
                    backgroundColor: source === s ? '#0f172a' : 'white',
                    color: source === s ? 'white' : '#64748b',
                  }}
                >
                  {sourceIcon(s)} {s}
                </button>
              ))}
            </div>
          </div>

          {/* Currency */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Currency</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['EUR', 'INR', 'USD'].map(c => (
                <button key={c} type="button" onClick={() => setCurrency(c)}
                  style={{
                    padding: '6px 18px', borderRadius: '99px', fontSize: '13px',
                    border: '1px solid',
                    borderColor: currency === c ? '#0f172a' : '#e2e8f0',
                    backgroundColor: currency === c ? '#0f172a' : 'white',
                    color: currency === c ? 'white' : '#64748b',
                  }}
                >{c}</button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Note */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Note (optional)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. March salary, Client project..."
              rows={2}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none', resize: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>

          {error && (
            <p style={{
              padding: '10px 12px', backgroundColor: '#fef2f2',
              color: '#dc2626', borderRadius: '8px',
              fontSize: '13px', marginBottom: '1rem',
            }}>{error}</p>
          )}

          <button type="submit" disabled={saving}
            style={{
              width: '100%', padding: '13px',
              backgroundColor: '#0f172a', color: 'white',
              border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: '500',
              opacity: saving ? 0.7 : 1, marginBottom: '10px',
            }}
          >
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add income'}
          </button>

          {/* Delete — edit mode only */}
          {isEdit && (
            !confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                style={{
                  width: '100%', padding: '13px',
                  backgroundColor: '#fef2f2', color: '#dc2626',
                  border: '1px solid #fecaca', borderRadius: '10px',
                  fontSize: '14px', fontWeight: '500',
                }}
              >🗑 Delete</button>
            ) : (
              <div style={{ border: '1px solid #fecaca', borderRadius: '10px', overflow: 'hidden' }}>
                <p style={{
                  padding: '12px', textAlign: 'center', fontSize: '13px',
                  color: '#dc2626', backgroundColor: '#fef2f2',
                  borderBottom: '1px solid #fecaca',
                }}>
                  Are you sure? This cannot be undone.
                </p>
                <div style={{ display: 'flex' }}>
                  <button type="button" onClick={() => setConfirmDelete(false)}
                    style={{ flex: 1, padding: '12px', background: 'white', border: 'none', borderRight: '1px solid #fecaca', fontSize: '14px', color: '#64748b', fontWeight: '500' }}
                  >Cancel</button>
                  <button type="button" onClick={handleDelete} disabled={deleting}
                    style={{ flex: 1, padding: '12px', background: 'white', border: 'none', fontSize: '14px', color: '#dc2626', fontWeight: '600', opacity: deleting ? 0.6 : 1 }}
                  >{deleting ? 'Deleting...' : 'Yes, delete'}</button>
                </div>
              </div>
            )
          )}
        </form>
      </div>
    </div>
  )
}