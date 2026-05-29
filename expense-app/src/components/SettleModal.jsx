import { useState } from 'react'

const symbols = { EUR: '€', INR: '₹', USD: '$' }

export default function SettleModal({ from, to, amount, getMemberName, onConfirm, onClose }) {
  const [payAmount, setPayAmount] = useState(amount.toFixed(2))
  const [error, setError]         = useState('')

  function handleConfirm() {
    const parsed = parseFloat(payAmount)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount')
      return
    }
    if (parsed > amount + 0.01) {
      setError(`Cannot exceed outstanding amount of ${amount.toFixed(2)}`)
      return
    }
    onConfirm(parsed)
  }

  const remaining = parseFloat((amount - parseFloat(payAmount || 0)).toFixed(2))

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
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Settle payment</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b' }}
          >✕</button>
        </div>

        {/* Who pays whom */}
        <div style={{
          padding: '12px', backgroundColor: '#f8fafc',
          borderRadius: '10px', marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            <span style={{ fontWeight: '600', color: '#dc2626' }}>
              {getMemberName(from)}
            </span>
            {' pays '}
            <span style={{ fontWeight: '600', color: '#16a34a' }}>
              {getMemberName(to)}
            </span>
          </p>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            Total outstanding: {amount.toFixed(2)}
          </p>
        </div>

        {/* Amount input */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            Amount paying now
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={amount}
            value={payAmount}
            onChange={e => { setPayAmount(e.target.value); setError('') }}
            autoFocus
            style={{
              width: '100%', padding: '12px',
              fontSize: '28px', fontWeight: '600',
              border: '1px solid #e2e8f0', borderRadius: '10px',
              outline: 'none', boxSizing: 'border-box',
              textAlign: 'center',
            }}
          />
        </div>

        {/* Remaining after this payment */}
        {remaining > 0.01 && (
          <div style={{
            padding: '10px 12px', backgroundColor: '#fef9f0',
            borderRadius: '8px', marginBottom: '1rem',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '13px', color: '#92400e' }}>Remaining after this</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#92400e' }}>
              {remaining.toFixed(2)}
            </span>
          </div>
        )}

        {remaining < -0.01 && (
          <div style={{
            padding: '10px 12px', backgroundColor: '#fef2f2',
            borderRadius: '8px', marginBottom: '1rem',
          }}>
            <span style={{ fontSize: '13px', color: '#dc2626' }}>
              Cannot exceed outstanding amount
            </span>
          </div>
        )}

        {remaining <= 0.01 && remaining >= -0.01 && parseFloat(payAmount) > 0 && (
          <div style={{
            padding: '10px 12px', backgroundColor: '#f0fdf4',
            borderRadius: '8px', marginBottom: '1rem',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '13px', color: '#16a34a' }}>Full amount — all settled! 🎉</span>
          </div>
        )}

        {error && (
          <p style={{
            padding: '10px 12px', backgroundColor: '#fef2f2',
            color: '#dc2626', borderRadius: '8px',
            fontSize: '13px', marginBottom: '1rem',
          }}>{error}</p>
        )}

        {/* Quick amount buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
          {[0.25, 0.5, 0.75, 1].map(fraction => {
            const val = parseFloat((amount * fraction).toFixed(2))
            return (
              <button
                key={fraction}
                onClick={() => { setPayAmount(val.toFixed(2)); setError('') }}
                style={{
                  flex: 1, padding: '8px 0',
                  backgroundColor: parseFloat(payAmount) === val ? '#0f172a' : '#f8fafc',
                  color: parseFloat(payAmount) === val ? 'white' : '#64748b',
                  border: '1px solid #e2e8f0', borderRadius: '8px',
                  fontSize: '12px', fontWeight: '500',
                }}
              >
                {fraction === 1 ? 'Full' : `${fraction * 100}%`}
              </button>
            )
          })}
        </div>

        <button
          onClick={handleConfirm}
          disabled={remaining < -0.01 || parseFloat(payAmount) <= 0}
          style={{
            width: '100%', padding: '13px',
            backgroundColor: '#0f172a', color: 'white',
            border: 'none', borderRadius: '10px',
            fontSize: '15px', fontWeight: '500',
            opacity: remaining < -0.01 ? 0.5 : 1,
          }}
        >
          Confirm payment of {parseFloat(payAmount || 0).toFixed(2)}
        </button>
      </div>
    </div>
  )
}