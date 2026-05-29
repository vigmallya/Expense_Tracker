import { useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Shopping', 'Health', 'Entertainment', 'Other']
const symbols = { EUR: '€', INR: '₹', USD: '$' }

export default function EditGroupExpenseModal({ expense, members, onClose, onEdited, onDeleted }) {
  const [title, setTitle]       = useState(expense.title)
  const [amount, setAmount]     = useState(expense.amount)
  const [category, setCategory] = useState(expense.category)
  const [currency, setCurrency] = useState(expense.currency)
  const [date, setDate]         = useState(expense.date)
  const [paidBy, setPaidBy]     = useState(expense.paid_by)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expense.id)

    setDeleting(false)
    if (error) { setError(error.message); return }
    onDeleted()
    onClose()
  }

  async function handleSave(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Update the expense
      const { error: expenseError } = await supabase
        .from('expenses')
        .update({ title, amount: parseFloat(amount), category, currency, date, paid_by: paidBy })
        .eq('id', expense.id)

      if (expenseError) throw expenseError

      // Recalculate equal splits with new amount
      const perPerson = parseFloat((parseFloat(amount) / members.length).toFixed(2))
      const remainder = parseFloat((parseFloat(amount) - perPerson * members.length).toFixed(2))

      for (let i = 0; i < members.length; i++) {
        const member = members[i]
        const splitAmount = i === 0 ? perPerson + remainder : perPerson

        await supabase
          .from('expense_splits')
          .update({
            amount_owed: splitAmount,
            is_settled:  member.id === paidBy,
          })
          .eq('expense_id', expense.id)
          .eq('user_id', member.id)
      }

      onEdited()
      onClose()

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Edit expense</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b' }}>✕</button>
        </div>

        <form onSubmit={handleSave}>

          {/* Amount */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Amount</label>
            <input
              type="number" step="0.01" min="0"
              value={amount} onChange={e => setAmount(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px', fontSize: '28px', fontWeight: '600',
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
              onChange={e => setTitle(e.target.value)} required
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
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Paid by */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Paid by</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {members.map(m => (
                <button key={m.id} type="button" onClick={() => setPaidBy(m.id)}
                  style={{
                    padding: '6px 14px', borderRadius: '99px', fontSize: '13px',
                    border: '1px solid',
                    borderColor: paidBy === m.id ? '#0f172a' : '#e2e8f0',
                    backgroundColor: paidBy === m.id ? '#0f172a' : 'white',
                    color: paidBy === m.id ? 'white' : '#64748b',
                  }}
                >{m.name}</button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{
              padding: '10px 12px', backgroundColor: '#fef2f2',
              color: '#dc2626', borderRadius: '8px',
              fontSize: '13px', marginBottom: '1rem',
            }}>{error}</p>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '13px',
              backgroundColor: '#0f172a', color: 'white',
              border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: '500',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Save changes'}
            </button>
            {/* Delete expense — two step confirm */}
            <div style={{ marginTop: '10px' }}>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    width: '100%', padding: '13px',
                    backgroundColor: '#fef2f2', color: '#dc2626',
                    border: '1px solid #fecaca', borderRadius: '10px',
                    fontSize: '14px', fontWeight: '500',
                  }}
                >
                  🗑 Delete expense
                </button>
              ) : (
                <div style={{ border: '1px solid #fecaca', borderRadius: '10px', overflow: 'hidden' }}>
                  <p style={{
                    padding: '12px', textAlign: 'center', fontSize: '13px',
                    color: '#dc2626', backgroundColor: '#fef2f2',
                    borderBottom: '1px solid #fecaca',
                  }}>
                    This will delete the expense and all its splits. Cannot be undone.
                  </p>
                  <div style={{ display: 'flex' }}>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      style={{
                        flex: 1, padding: '12px', background: 'white',
                        border: 'none', borderRight: '1px solid #fecaca',
                        fontSize: '14px', color: '#64748b', fontWeight: '500',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
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
        </form>
      </div>
    </div>
  )
}