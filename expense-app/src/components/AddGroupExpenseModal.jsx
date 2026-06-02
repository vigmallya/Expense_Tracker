import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calculateEqualSplit, validateCustomSplit } from '../utils/splitCalculator'
import ReceiptUploader from './ReceiptUploader'

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Shopping', 'Health', 'Entertainment', 'Other']
const symbols = { EUR: '€', INR: '₹', USD: '$' }

export default function AddGroupExpenseModal({ groupId, members, onClose, onAdded }) {
  const { user } = useAuth()

  const [title, setTitle]         = useState('')
  const [amount, setAmount]       = useState('')
  const [category, setCategory]   = useState('Food')
  const [currency, setCurrency]   = useState('EUR')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [paidBy, setPaidBy]       = useState(user.id)
  const [splitType, setSplitType] = useState('equal') // 'equal' or 'custom'
  const [customSplits, setCustomSplits] = useState(
    // Initialise one input per member
    members.reduce((acc, m) => ({ ...acc, [m.id]: '' }), {})
  )
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [note, setNote] = useState('')

  // Update a single custom split amount
  function updateCustomSplit(userId, value) {
    setCustomSplits(prev => ({ ...prev, [userId]: value }))
  }

  // How much is left to assign in custom split mode
  function remaining() {
    const assigned = Object.values(customSplits)
      .reduce((sum, v) => sum + parseFloat(v || 0), 0)
    return parseFloat((parseFloat(amount || 0) - assigned).toFixed(2))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title || !amount) return
    setError('')

    // Validate custom split sums to total
    if (splitType === 'custom') {
      const splits = members.map(m => ({
        userId: m.id,
        amountOwed: parseFloat(customSplits[m.id] || 0)
      }))
      const { valid, diff } = validateCustomSplit(parseFloat(amount), splits)
      if (!valid) {
        setError(`Amounts don't add up. ${diff > 0 ? `${symbols[currency]}${diff} remaining` : `${symbols[currency]}${Math.abs(diff)} over`}`)
        return
      }
    }

    setLoading(true)

    try {
      // 1. Insert the expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          title,
          amount: parseFloat(amount),
          category,
          currency,
          date,
          note,
          paid_by: paidBy,
          group_id: groupId,
          is_personal: false,
          receipt_url: receiptUrl || null,
        })
        .select()
        .single()

      if (expenseError) throw expenseError

      // 2. Calculate splits
      const splits = splitType === 'equal'
        ? calculateEqualSplit(parseFloat(amount), paidBy, members.map(m => m.id))
        : members.map(m => ({
            userId: m.id,
            amountOwed: parseFloat(customSplits[m.id] || 0),
            isSettled: m.id === paidBy,
          }))

      // 3. Insert expense_splits rows
      const splitRows = splits.map(s => ({
        expense_id:   expense.id,
        user_id:      s.userId,
        amount_owed:  s.amountOwed,
        is_settled:   s.isSettled,
      }))

      const { error: splitError } = await supabase
        .from('expense_splits')
        .insert(splitRows)

      if (splitError) throw splitError

      onAdded()
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
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Add group expense</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Amount */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Amount</label>
            <input
              type="number" step="0.01" min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00" required autoFocus
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
              placeholder="e.g. Dinner, Hotel, Petrol"
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
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Paid by */}
          <div style={{ marginBottom: '1rem' }}>
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

          {/* Split type toggle */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Split</label>
            <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              {['equal', 'custom'].map(type => (
                <button key={type} type="button" onClick={() => setSplitType(type)}
                  style={{
                    flex: 1, padding: '10px',
                    border: 'none', fontSize: '13px', fontWeight: '500',
                    backgroundColor: splitType === type ? '#0f172a' : 'white',
                    color: splitType === type ? 'white' : '#64748b',
                    textTransform: 'capitalize',
                  }}
                >{type} split</button>
              ))}
            </div>
          </div>

          {/* Custom split inputs */}
          {splitType === 'custom' && (
            <div style={{ marginBottom: '1rem', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Assign amounts</span>
                <span style={{
                  fontSize: '13px', fontWeight: '500',
                  color: remaining() === 0 ? '#10b981' : remaining() < 0 ? '#dc2626' : '#f59e0b'
                }}>
                  {remaining() === 0 ? '✓ Balanced' : `${symbols[currency]}${Math.abs(remaining())} ${remaining() > 0 ? 'remaining' : 'over'}`}
                </span>
              </div>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', flex: 1 }}>{m.name}</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={customSplits[m.id]}
                    onChange={e => updateCustomSplit(m.id, e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: '100px', padding: '8px 10px', fontSize: '14px',
                      border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none',
                      textAlign: 'right',
                    }}
                  />
                </div>
              ))}
            </div>
          )}

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
            <p style={{
              padding: '10px 12px', backgroundColor: '#fef2f2',
              color: '#dc2626', borderRadius: '8px',
              fontSize: '13px', marginBottom: '1rem'
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
            {loading ? 'Saving...' : 'Add expense'}
          </button>
        </form>
      </div>
    </div>
  )
}