import { useState } from 'react'
import { supabase } from '../lib/supabase'
import ReceiptUploader from './ReceiptUploader'

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Shopping', 'Health', 'Entertainment', 'Other']
const CATEGORY_COLORS = {
  Food:          '#f97316',
  Transport:     '#3b82f6',
  Housing:       '#8b5cf6',
  Shopping:      '#ec4899',
  Health:        '#10b981',
  Entertainment: '#f59e0b',
  Other:         '#94a3b8',
}
const symbols = { EUR: '€', INR: '₹', USD: '$' }

function currencySymbol(code) {
  return symbols[code] || code
}

function categoryIcon(cat) {
  const icons = {
    Food: '🍔', Transport: '🚌', Housing: '🏠',
    Shopping: '🛍', Health: '💊', Entertainment: '🎬', Other: '📦'
  }
  return icons[cat] || '📦'
}

function formatFullDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('default', {
    weekday: 'long', day: 'numeric',
    month: 'long', year: 'numeric'
  })
}

export default function ExpenseDetailSheet({ expense, onClose, onDeleted, onEdited }) {
  // Two modes — 'view' shows details, 'edit' shows the edit form
  const [mode, setMode]               = useState('view')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  // Edit form state — pre-filled with existing expense values
  const [title, setTitle]       = useState(expense.title)
  const [amount, setAmount]     = useState(expense.amount)
  const [category, setCategory] = useState(expense.category)
  const [currency, setCurrency] = useState(expense.currency)
  const [date, setDate]         = useState(expense.date)
  const [note, setNote]         = useState(expense.note || '')
  const [receiptUrl, setReceiptUrl] = useState(expense.receipt_url || '')

  const color = CATEGORY_COLORS[expense.category] || '#94a3b8'

  // ── Delete ──
  async function handleDelete() {
    setDeleting(true)
    setError('')

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expense.id)

    setDeleting(false)
    if (error) { setError(error.message); setConfirmDelete(false); return }

    onDeleted()
    onClose()
  }

  // ── Save edit ──
  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error } = await supabase
      .from('expenses')
      .update({
        title,
        amount:   parseFloat(amount),
        category,
        currency,
        date,
        note,
        receipt_url: receiptUrl || null,
      })
      .eq('id', expense.id)

    setSaving(false)
    if (error) { setError(error.message); return }

    onEdited()  // tell parent to refresh
    onClose()
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
        overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto',
      }}>

        {/* ── VIEW MODE ── */}
        {mode === 'view' && (
          <>
            {/* Colored header */}
            <div style={{
              backgroundColor: color + '15',
              padding: '1.5rem 1.5rem 1.25rem',
              borderBottom: `3px solid ${color}30`,
              position: 'relative',
            }}>
              <button
                onClick={onClose}
                style={{
                  position: 'absolute', top: '1rem', right: '1rem',
                  background: 'none', border: 'none',
                  fontSize: '20px', color: '#64748b',
                }}
              >✕</button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '28px' }}>{categoryIcon(expense.category)}</span>
                <span style={{
                  fontSize: '12px', fontWeight: '500', color: color,
                  backgroundColor: color + '20', padding: '3px 10px', borderRadius: '99px'
                }}>
                  {expense.category}
                </span>
              </div>

              <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px', paddingRight: '2rem' }}>
                {expense.title}
              </h2>
              <p style={{ fontSize: '32px', fontWeight: '700', color }}>
                {currencySymbol(expense.currency)}{parseFloat(expense.amount).toFixed(2)}
              </p>
            </div>

            {/* Details */}
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <DetailRow label="Date"     value={formatFullDate(expense.date)} />
              <DetailRow label="Currency" value={expense.currency} />
              {expense.note && <DetailRow label="Note" value={expense.note} />}
              <DetailRow
                label="Added"
                value={new Date(expense.created_at).toLocaleDateString('default', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              />
              {/* Receipt preview — only shown if a receipt exists */}
              {expense.receipt_url && (
                <div style={{ marginTop: '12px' }}>
                  <ReceiptUploader
                    receiptUrl={expense.receipt_url}
                    onUploaded={() => {}}
                    onRemoved={() => {}}
                    readOnly={true}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ padding: '0 1.5rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {error && (
                <p style={{
                  padding: '10px 12px', backgroundColor: '#fef2f2',
                  color: '#dc2626', borderRadius: '8px', fontSize: '13px'
                }}>{error}</p>
              )}

              {/* Edit button — switches to edit mode */}
              <button
                onClick={() => setMode('edit')}
                style={{
                  width: '100%', padding: '13px',
                  backgroundColor: '#f8fafc', color: '#0f172a',
                  border: '1px solid #e2e8f0', borderRadius: '10px',
                  fontSize: '15px', fontWeight: '500',
                }}
              >
                ✏️  Edit expense
              </button>

              {/* Delete — two step confirm */}
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    width: '100%', padding: '13px',
                    backgroundColor: '#fef2f2', color: '#dc2626',
                    border: '1px solid #fecaca', borderRadius: '10px',
                    fontSize: '15px', fontWeight: '500',
                  }}
                >
                  🗑  Delete expense
                </button>
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
                    <button
                      onClick={() => setConfirmDelete(false)}
                      style={{
                        flex: 1, padding: '12px', background: 'white',
                        border: 'none', borderRight: '1px solid #fecaca',
                        fontSize: '14px', color: '#64748b', fontWeight: '500',
                      }}
                    >Cancel</button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{
                        flex: 1, padding: '12px', background: 'white',
                        border: 'none', fontSize: '14px',
                        color: '#dc2626', fontWeight: '600',
                        opacity: deleting ? 0.6 : 1,
                      }}
                    >
                      {deleting ? 'Deleting...' : 'Yes, delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── EDIT MODE ── */}
        {mode === 'edit' && (
          <>
            {/* Edit header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <button
                onClick={() => setMode('view')}
                style={{ background: 'none', border: 'none', fontSize: '14px', color: '#64748b' }}
              >
                ← Back
              </button>
              <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Edit expense</h2>
              <div style={{ width: '48px' }} />
            </div>

            <form onSubmit={handleSave} style={{ padding: '1.5rem 1.5rem 2.5rem' }}>

              {/* Amount */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Amount</label>
                <input
                  type="number" step="0.01" min="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px',
                    fontSize: '28px', fontWeight: '600',
                    border: '1px solid #e2e8f0', borderRadius: '10px',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Title */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>What for?</label>
                <input
                  type="text" value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: '15px',
                    border: '1px solid #e2e8f0', borderRadius: '10px',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Category */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Category</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat} type="button" onClick={() => setCategory(cat)}
                      style={{
                        padding: '6px 14px', borderRadius: '99px', fontSize: '13px',
                        border: '1px solid',
                        borderColor: category === cat ? '#0f172a' : '#e2e8f0',
                        backgroundColor: category === cat ? '#0f172a' : 'white',
                        color: category === cat ? 'white' : '#64748b',
                      }}
                    >{cat}</button>
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
                <input
                  type="date" value={date}
                  onChange={e => setDate(e.target.value)}
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
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Any extra details..."
                  rows={2}
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: '14px',
                    border: '1px solid #e2e8f0', borderRadius: '10px',
                    outline: 'none', resize: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <ReceiptUploader
                  receiptUrl={receiptUrl}
                  onUploaded={url => setReceiptUrl(url)}
                  onRemoved={() => setReceiptUrl('')}
                />
              </div>

              {error && (
                <p style={{
                  padding: '10px 12px', backgroundColor: '#fef2f2',
                  color: '#dc2626', borderRadius: '8px',
                  fontSize: '13px', marginBottom: '1rem',
                }}>{error}</p>
              )}

              <button
                type="submit" disabled={saving}
                style={{
                  width: '100%', padding: '13px',
                  backgroundColor: '#0f172a', color: 'white',
                  border: 'none', borderRadius: '10px',
                  fontSize: '15px', fontWeight: '500',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// Reusable detail row
function DetailRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-start', gap: '1rem',
      padding: '10px 0', borderBottom: '1px solid #f1f5f9',
    }}>
      <span style={{ fontSize: '13px', color: '#94a3b8', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: '500', textAlign: 'right' }}>{value}</span>
    </div>
  )
}