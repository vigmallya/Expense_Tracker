import { useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORY_COLORS = {
  Food:          '#f97316',
  Transport:     '#3b82f6',
  Housing:       '#8b5cf6',
  Shopping:      '#ec4899',
  Health:        '#10b981',
  Entertainment: '#f59e0b',
  Other:         '#94a3b8',
}

function currencySymbol(code) {
  const symbols = { EUR: '€', INR: '₹', USD: '$' }
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)
  const [error, setError]                 = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expense.id)

    setDeleting(false)

    if (error) {
      setError(error.message)
      setConfirmDelete(false)
      return
    }

    onDeleted()  // tell parent to refresh the list
    onClose()    // close the sheet
  }

  const color = CATEGORY_COLORS[expense.category] || '#94a3b8'

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
        width: '100%', maxWidth: '480px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '20px 20px 0 0',
        overflow: 'hidden',
      }}>

        {/* ── Colored header based on category ── */}
        <div style={{
          backgroundColor: color + '15',
          padding: '1.5rem 1.5rem 1.25rem',
          borderBottom: `3px solid ${color}30`,
          position: 'relative',
        }}>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'none', border: 'none',
              fontSize: '20px', color: '#64748b', lineHeight: 1,
            }}
          >
            ✕
          </button>

          {/* Category icon + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '28px' }}>{categoryIcon(expense.category)}</span>
            <span style={{
              fontSize: '12px', fontWeight: '500',
              color: color,
              backgroundColor: color + '20',
              padding: '3px 10px', borderRadius: '99px'
            }}>
              {expense.category}
            </span>
          </div>

          {/* Title */}
          <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px', paddingRight: '2rem' }}>
            {expense.title}
          </h2>

          {/* Amount */}
          <p style={{ fontSize: '32px', fontWeight: '700', color: color }}>
            {currencySymbol(expense.currency)}{parseFloat(expense.amount).toFixed(2)}
          </p>
        </div>

        {/* ── Details ── */}
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

            <DetailRow label="Date"     value={formatFullDate(expense.date)} />
            <DetailRow label="Currency" value={expense.currency} />

            {expense.note && (
              <DetailRow label="Note" value={expense.note} />
            )}

            <DetailRow
              label="Added"
              value={new Date(expense.created_at).toLocaleDateString('default', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
            />
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ padding: '0 1.5rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {error && (
            <p style={{
              padding: '10px 12px', backgroundColor: '#fef2f2',
              color: '#dc2626', borderRadius: '8px', fontSize: '13px'
            }}>
              {error}
            </p>
          )}

          {/* Edit button — foundation for later */}
          <button
            onClick={() => onEdited(expense)}
            style={{
              width: '100%', padding: '13px',
              backgroundColor: '#f8fafc',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
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
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                fontSize: '15px', fontWeight: '500',
              }}
            >
              🗑  Delete expense
            </button>
          ) : (
            <div style={{
              border: '1px solid #fecaca',
              borderRadius: '10px', overflow: 'hidden'
            }}>
              <p style={{
                padding: '12px', textAlign: 'center',
                fontSize: '13px', color: '#dc2626',
                backgroundColor: '#fef2f2',
                borderBottom: '1px solid #fecaca'
              }}>
                Are you sure? This cannot be undone.
              </p>
              <div style={{ display: 'flex' }}>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    flex: 1, padding: '12px',
                    background: 'white', border: 'none',
                    borderRight: '1px solid #fecaca',
                    fontSize: '14px', color: '#64748b',
                    fontWeight: '500',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: '12px',
                    background: 'white', border: 'none',
                    fontSize: '14px', color: '#dc2626',
                    fontWeight: '600',
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Small reusable row for the details section
function DetailRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-start', gap: '1rem',
      padding: '10px 0',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <span style={{ fontSize: '13px', color: '#94a3b8', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: '13px', fontWeight: '500',
        textAlign: 'right', color: '#0f172a'
      }}>
        {value}
      </span>
    </div>
  )
}