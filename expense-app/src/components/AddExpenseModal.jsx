import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ReceiptUploader from './ReceiptUploader'

const CATEGORIES = [
  'Groceries','Food', 'Transport', 'Housing',
  'Shopping', 'Health', 'Entertainment', 'Other'
]

const CURRENCIES = ['EUR', 'INR', 'USD']

export default function AddExpenseModal({ onClose, onAdded }) {
  const { user } = useAuth()
  const [title, setTitle]       = useState('')
  const [amount, setAmount]     = useState('')
  const [category, setCategory] = useState('Groceries')
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0])
  const [currency, setCurrency] = useState('EUR')
  const [note, setNote]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title || !amount) return
    setLoading(true)
    setError('')


    const { error } = await supabase.from('expenses').insert({
      title,
      amount: parseFloat(amount),
      category,
      currency,
      date,
      note,
      paid_by: user.id,
      is_personal: true,
      receipt_url: receiptUrl || null,
    })

    setLoading(false)
    if (error) { setError(error.message); return }
    onAdded()   // tell the parent to refresh
    onClose()   // close the modal
  }

  return (
    <div style={{
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
        padding: '1.5rem 1.5rem 2.5rem',
         maxHeight: '90vh', overflowY: 'auto', 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Add expense</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Amount — big and prominent, first thing you fill in */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              required
              autoFocus
              style={{
                width: '100%', padding: '12px',
                fontSize: '28px', fontWeight: '600',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none',
              }}
            />
          </div>

          {/* Title */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>What for?</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Dinner, Uber, Groceries"
              required
              style={{
                width: '100%', padding: '10px 12px',
                fontSize: '15px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none',
              }}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Category</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '6px 14px', borderRadius: '99px', fontSize: '13px',
                    border: '1px solid',
                    borderColor: category === cat ? '#0f172a' : '#e2e8f0',
                    backgroundColor: category === cat ? '#0f172a' : 'white',
                    color: category === cat ? 'white' : '#64748b',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Currency */}
            <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Currency</label>
            <div style={{ display: 'flex', gap: '8px' }}>
                {CURRENCIES.map(c => (
                <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    style={{
                    padding: '6px 18px', borderRadius: '99px', fontSize: '13px',
                    border: '1px solid',
                    borderColor: currency === c ? '#0f172a' : '#e2e8f0',
                    backgroundColor: currency === c ? '#0f172a' : 'white',
                    color: currency === c ? 'white' : '#64748b',
                    }}
                >
                    {c}
                </button>
                ))}
            </div>
            </div>

          {/* Date */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none',
              }}
            />
          </div>

          {/* Note */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Any extra details..."
              rows={2}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none', resize: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Receipt */}
          <div style={{ marginBottom: '1.5rem' }}>
            <ReceiptUploader
              receiptUrl={receiptUrl}
              onUploaded={url => setReceiptUrl(url)}
              onRemoved={() => setReceiptUrl('')}
            />
          </div>

          {error && (
            <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '1rem' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              backgroundColor: '#0f172a', color: 'white',
              border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: '500',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Save expense'}
          </button>
        </form>
      </div>
    </div>
  )
}
