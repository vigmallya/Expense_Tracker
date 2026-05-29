import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/BottomNav'

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Shopping', 'Health', 'Entertainment', 'Other']
const symbols    = { EUR: '€', INR: '₹', USD: '$' }

function currencySymbol(code) { return symbols[code] || code }

function categoryIcon(cat) {
  const icons = {
    Food: '🍔', Transport: '🚌', Housing: '🏠',
    Shopping: '🛍', Health: '💊', Entertainment: '🎬', Other: '📦'
  }
  return icons[cat] || '📦'
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-')
  return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
}

// Generate last 5 months including current
function getLast5Months() {
  const months = []
  const now = new Date()
  for (let i = 0; i < 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(getMonthKey(d))
  }
  return months
}

export default function BudgetPage() {
  const { user }    = useAuth()
  const navigate    = useNavigate()

  const [selectedMonth, setSelectedMonth]       = useState(getMonthKey(new Date()))
  const [budgets, setBudgets]                   = useState([])
  const [fixedExpenses, setFixedExpenses]       = useState([])
  const [spending, setSpending]                 = useState({}) // category -> amount spent
  const [monthlyHistory, setMonthlyHistory]     = useState([])
  const [loading, setLoading]                   = useState(true)

  // Edit/add states
  const [editingBudget, setEditingBudget]       = useState(null) // { category, monthly_limit }
  const [editingFixed, setEditingFixed]         = useState(null) // fixed expense object or 'new'
  const [savingBudget, setSavingBudget]         = useState(false)
  const [savingFixed, setSavingFixed]           = useState(false)

  const months = getLast5Months()

  useEffect(() => { fetchAll() }, [selectedMonth])
  useEffect(() => { fetchHistory() }, [budgets, fixedExpenses])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchBudgets(), fetchFixedExpenses(), fetchSpending()])
    setLoading(false)
  }

  // Fetch variable budgets for selected month
  async function fetchBudgets() {
    const { data } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', selectedMonth)

    setBudgets(data || [])
  }

  // Fetch all active fixed expenses
  async function fetchFixedExpenses() {
    const { data } = await supabase
      .from('fixed_expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    setFixedExpenses(data || [])
  }

  // Fetch actual spending for selected month
  // Personal expenses + your share of group expenses
  async function fetchSpending() {
    const [year, month] = selectedMonth.split('-')
    const startDate = `${year}-${month}-01`
    const endDate   = new Date(year, month, 0).toISOString().split('T')[0]

    // Personal expenses
    const { data: personalData } = await supabase
      .from('expenses')
      .select('amount, category')
      .eq('paid_by', user.id)
      .eq('is_personal', true)
      .gte('date', startDate)
      .lte('date', endDate)

    // Your splits from group expenses
    const { data: splitData } = await supabase
      .from('expense_splits')
      .select('amount_owed, expenses(category, date, is_personal)')
      .eq('user_id', user.id)
      .gte('expenses.date', startDate)
      .lte('expenses.date', endDate)

    // Combine into category totals
    const totals = {}

    ;(personalData || []).forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount)
    })

    ;(splitData || []).filter(s => s.expenses && !s.expenses.is_personal).forEach(s => {
      const cat = s.expenses.category
      totals[cat] = (totals[cat] || 0) + parseFloat(s.amount_owed)
    })

    setSpending(totals)
  }

  // Build last 5 months history
  async function fetchHistory() {
    const history = await Promise.all(
      months.map(async monthKey => {
        const [year, month] = monthKey.split('-')
        const startDate = `${year}-${month}-01`
        const endDate   = new Date(year, month, 0).toISOString().split('T')[0]

        // Variable budgets total for this month
        const { data: budgetData } = await supabase
          .from('budgets')
          .select('monthly_limit')
          .eq('user_id', user.id)
          .eq('month', monthKey)

        const totalBudgeted = (budgetData || [])
          .reduce((sum, b) => sum + parseFloat(b.monthly_limit), 0)

        // Actual spending for this month
        const { data: personalData } = await supabase
          .from('expenses')
          .select('amount')
          .eq('paid_by', user.id)
          .eq('is_personal', true)
          .gte('date', startDate)
          .lte('date', endDate)

        const { data: splitData } = await supabase
          .from('expense_splits')
          .select('amount_owed, expenses(date, is_personal)')
          .eq('user_id', user.id)
          .gte('expenses.date', startDate)
          .lte('expenses.date', endDate)

        const totalSpent =
          (personalData || []).reduce((sum, e) => sum + parseFloat(e.amount), 0) +
          (splitData || [])
            .filter(s => s.expenses && !s.expenses.is_personal)
            .reduce((sum, s) => sum + parseFloat(s.amount_owed), 0)

        // Fixed expenses total
        const totalFixed = fixedExpenses
          .reduce((sum, f) => sum + parseFloat(f.amount), 0)

        return { monthKey, totalBudgeted, totalSpent, totalFixed }
      })
    )
    setMonthlyHistory(history)
  }

  // Save or update a variable budget
  async function saveBudget(category, limit) {
    setSavingBudget(true)

    const parsed = parseFloat(limit)

    // If empty or NaN or zero, delete the budget instead of saving
    if (!limit || isNaN(parsed) || parsed <= 0) {
        await supabase
        .from('budgets')
        .delete()
        .eq('user_id', user.id)
        .eq('category', category)
        .eq('month', selectedMonth)

        await fetchBudgets()
        setSavingBudget(false)
        setEditingBudget(null)
        return
    }

    await supabase
        .from('budgets')
        .upsert({
        user_id:       user.id,
        category,
        monthly_limit: parsed,
        month:         selectedMonth,
        }, { onConflict: 'user_id,category,month' })

    await fetchBudgets()
    setSavingBudget(false)
    setEditingBudget(null)
  }

  // Save fixed expense
  async function saveFixed(data) {
    setSavingFixed(true)
    if (data.id) {
      await supabase
        .from('fixed_expenses')
        .update({ title: data.title, amount: parseFloat(data.amount), currency: data.currency, category: data.category })
        .eq('id', data.id)
    } else {
      await supabase
        .from('fixed_expenses')
        .insert({ ...data, user_id: user.id })
    }
    await fetchFixedExpenses()
    setSavingFixed(false)
    setEditingFixed(null)
  }

  // Delete fixed expense
  async function deleteFixed(id) {
    await supabase.from('fixed_expenses').delete().eq('id', id)
    await fetchFixedExpenses()
  }

  // Totals
  const totalFixed    = fixedExpenses.reduce((sum, f) => sum + parseFloat(f.amount), 0)
  const totalBudgeted = budgets.reduce((sum, b) => sum + parseFloat(b.monthly_limit), 0)
  const totalSpent    = Object.values(spending).reduce((sum, v) => sum + v, 0)

  if (loading) return (
    <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
      Loading...
    </div>
  )

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
          <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Budget</h1>
        </div>

        {/* Month selector */}
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{
            padding: '6px 10px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px', fontSize: '13px',
            color: 'white', outline: 'none',
          }}
        >
          {months.map(m => (
            <option key={m} value={m} style={{ backgroundColor: '#0f172a' }}>
              {getMonthLabel(m)}
            </option>
          ))}
        </select>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '1rem' }}>
          <div style={{
            padding: '12px', backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '10px',
          }}>
            <p style={{ fontSize: '11px', opacity: 0.6, marginBottom: '4px' }}>Fixed committed</p>
            <p style={{ fontSize: '20px', fontWeight: '700' }}>€{totalFixed.toFixed(2)}</p>
          </div>
          <div style={{
            padding: '12px', backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '10px',
          }}>
            <p style={{ fontSize: '11px', opacity: 0.6, marginBottom: '4px' }}>Variable spent</p>
            <p style={{ fontSize: '20px', fontWeight: '700' }}>
              €{totalSpent.toFixed(2)}
              <span style={{ fontSize: '12px', opacity: 0.6 }}> / €{totalBudgeted.toFixed(2)}</span>
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.5rem' }}>

        {/* ── Fixed expenses ── */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600' }}>Fixed expenses</h2>
            <button
              onClick={() => setEditingFixed({ title: '', amount: '', currency: 'EUR', category: 'Housing' })}
              style={{
                padding: '5px 12px', backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0', borderRadius: '8px',
                fontSize: '12px', color: '#64748b',
              }}
            >+ Add</button>
          </div>

          {fixedExpenses.length === 0 && (
            <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>
              No fixed expenses yet
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {fixedExpenses.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', backgroundColor: 'white',
                borderRadius: '12px', border: '1px solid #f1f5f9',
              }}>
                <span style={{ fontSize: '20px' }}>{categoryIcon(f.category)}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: '500' }}>{f.title}</p>
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>{f.category}</p>
                </div>
                <p style={{ fontSize: '15px', fontWeight: '600' }}>
                  {currencySymbol(f.currency)}{parseFloat(f.amount).toFixed(2)}
                </p>
                <button
                  onClick={() => setEditingFixed(f)}
                  style={{
                    background: 'none', border: 'none',
                    fontSize: '16px', color: '#94a3b8', cursor: 'pointer',
                  }}
                >✏️</button>
              </div>
            ))}
          </div>

          {/* Fixed total */}
          {fixedExpenses.length > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '10px 12px', marginTop: '8px',
              backgroundColor: '#f8fafc', borderRadius: '8px',
            }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Total fixed</span>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>€{totalFixed.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* ── Variable budgets ── */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600' }}>Variable budgets</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>{getMonthLabel(selectedMonth)}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {CATEGORIES.map(cat => {
              const budget  = budgets.find(b => b.category === cat)
              const spent   = spending[cat] || 0
              const limit   = budget ? parseFloat(budget.monthly_limit) : 0
              const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
              const over    = limit > 0 && spent > limit

              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{categoryIcon(cat)}</span>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>{cat}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: over ? '#dc2626' : '#64748b' }}>
                        €{spent.toFixed(2)}{limit > 0 ? ` / €${limit.toFixed(2)}` : ''}
                      </span>
                      <button
                        onClick={() => setEditingBudget({ category: cat, monthly_limit: limit || '' })}
                        style={{
                          background: 'none', border: 'none',
                          fontSize: '14px', color: '#94a3b8', cursor: 'pointer',
                        }}
                      >✏️</button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '99px' }}>
                    <div style={{
                      height: '100%',
                      width: limit > 0 ? `${percent}%` : spent > 0 ? '100%' : '0%',
                      backgroundColor: over ? '#dc2626' : percent >= 80 ? '#f59e0b' : '#10b981',
                      borderRadius: '99px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>

                  {/* Over budget warning */}
                  {over && (
                    <p style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                      Over budget by €{(spent - limit).toFixed(2)}
                    </p>
                  )}

                  {/* No budget set */}
                  {!limit && spent > 0 && (
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      No budget set · tap ✏️ to set one
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Variable total */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '10px 12px', marginTop: '16px',
            backgroundColor: '#f8fafc', borderRadius: '8px',
          }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Total variable</span>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>
              €{totalSpent.toFixed(2)} spent · €{totalBudgeted.toFixed(2)} budgeted
            </span>
          </div>
        </div>

        {/* ── Last 5 months history ── */}
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>
            Last 5 months
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {monthlyHistory.map(h => (
              <div
                key={h.monthKey}
                onClick={() => setSelectedMonth(h.monthKey)}
                style={{
                  padding: '12px 14px', backgroundColor: 'white',
                  borderRadius: '12px',
                  border: `1px solid ${h.monthKey === selectedMonth ? '#0f172a' : '#f1f5f9'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600' }}>
                    {getMonthLabel(h.monthKey)}
                  </p>
                  {h.monthKey === selectedMonth && (
                    <span style={{ fontSize: '11px', color: '#0f172a', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '99px' }}>
                      Selected
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>Fixed</p>
                    <p style={{ fontSize: '13px', fontWeight: '500' }}>€{h.totalFixed.toFixed(2)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>Spent</p>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: h.totalSpent > h.totalBudgeted && h.totalBudgeted > 0 ? '#dc2626' : '#0f172a' }}>
                      €{h.totalSpent.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>Budgeted</p>
                    <p style={{ fontSize: '13px', fontWeight: '500' }}>€{h.totalBudgeted.toFixed(2)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', color: '#94a3b8' }}>Total plan</p>
                    <p style={{ fontSize: '13px', fontWeight: '500' }}>
                      €{(h.totalFixed + h.totalBudgeted).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Edit budget modal ── */}
      {editingBudget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setEditingBudget(null) }}
        >
          <div style={{
            width: '100%', maxWidth: '480px', margin: '0 auto',
            backgroundColor: 'white', borderRadius: '20px 20px 0 0',
            padding: '1.5rem 1.5rem 2.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
                {categoryIcon(editingBudget.category)} {editingBudget.category} budget
              </h2>
              <button onClick={() => setEditingBudget(null)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b' }}>✕</button>
            </div>

            <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
              Monthly limit for {getMonthLabel(selectedMonth)}
            </label>
            <input
              type="number" step="0.01" min="0"
              value={editingBudget.monthly_limit}
              onChange={e => setEditingBudget({ ...editingBudget, monthly_limit: e.target.value })}
              autoFocus
              placeholder="0.00"
              style={{
                width: '100%', padding: '12px',
                fontSize: '28px', fontWeight: '600',
                border: '1px solid #e2e8f0', borderRadius: '10px',
                outline: 'none', boxSizing: 'border-box',
                textAlign: 'center', marginBottom: '1.5rem',
              }}
            />

            <button
              onClick={() => saveBudget(editingBudget.category, editingBudget.monthly_limit)}
              disabled={savingBudget}
              style={{
                width: '100%', padding: '13px',
                backgroundColor: '#0f172a', color: 'white',
                border: 'none', borderRadius: '10px',
                fontSize: '15px', fontWeight: '500',
                opacity: savingBudget ? 0.7 : 1,
              }}
            >
              {savingBudget ? 'Saving...' : 'Save budget'}
            </button>
          </div>
        </div>
      )}

      {/* ── Edit fixed expense modal ── */}
      {editingFixed && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setEditingFixed(null) }}
        >
          <div style={{
            width: '100%', maxWidth: '480px', margin: '0 auto',
            backgroundColor: 'white', borderRadius: '20px 20px 0 0',
            padding: '1.5rem 1.5rem 2.5rem',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
                {editingFixed.id ? 'Edit' : 'Add'} fixed expense
              </h2>
              <button onClick={() => setEditingFixed(null)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b' }}>✕</button>
            </div>

            {/* Title */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Name</label>
              <input
                type="text"
                value={editingFixed.title}
                onChange={e => setEditingFixed({ ...editingFixed, title: e.target.value })}
                placeholder="e.g. Rent, Phone bill"
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '15px',
                  border: '1px solid #e2e8f0', borderRadius: '10px',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Amount */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Amount</label>
              <input
                type="number" step="0.01" min="0"
                value={editingFixed.amount}
                onChange={e => setEditingFixed({ ...editingFixed, amount: e.target.value })}
                placeholder="0.00"
                style={{
                  width: '100%', padding: '12px',
                  fontSize: '24px', fontWeight: '600',
                  border: '1px solid #e2e8f0', borderRadius: '10px',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Currency */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Currency</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['EUR', 'INR', 'USD'].map(c => (
                  <button key={c} type="button"
                    onClick={() => setEditingFixed({ ...editingFixed, currency: c })}
                    style={{
                      padding: '6px 18px', borderRadius: '99px', fontSize: '13px',
                      border: '1px solid',
                      borderColor: editingFixed.currency === c ? '#0f172a' : '#e2e8f0',
                      backgroundColor: editingFixed.currency === c ? '#0f172a' : 'white',
                      color: editingFixed.currency === c ? 'white' : '#64748b',
                    }}
                  >{c}</button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>Category</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button key={cat} type="button"
                    onClick={() => setEditingFixed({ ...editingFixed, category: cat })}
                    style={{
                      padding: '6px 14px', borderRadius: '99px', fontSize: '13px',
                      border: '1px solid',
                      borderColor: editingFixed.category === cat ? '#0f172a' : '#e2e8f0',
                      backgroundColor: editingFixed.category === cat ? '#0f172a' : 'white',
                      color: editingFixed.category === cat ? 'white' : '#64748b',
                    }}
                  >{cat}</button>
                ))}
              </div>
            </div>

            <button
              onClick={() => saveFixed(editingFixed)}
              disabled={savingFixed || !editingFixed.title || !editingFixed.amount}
              style={{
                width: '100%', padding: '13px',
                backgroundColor: '#0f172a', color: 'white',
                border: 'none', borderRadius: '10px',
                fontSize: '15px', fontWeight: '500',
                opacity: savingFixed ? 0.7 : 1,
                marginBottom: '10px',
              }}
            >
              {savingFixed ? 'Saving...' : editingFixed.id ? 'Save changes' : 'Add fixed expense'}
            </button>

            {/* Delete button for existing fixed expenses */}
            {editingFixed.id && (
              <button
                onClick={() => deleteFixed(editingFixed.id)}
                style={{
                  width: '100%', padding: '13px',
                  backgroundColor: '#fef2f2', color: '#dc2626',
                  border: '1px solid #fecaca', borderRadius: '10px',
                  fontSize: '14px', fontWeight: '500',
                }}
              >
                🗑 Remove fixed expense
              </button>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}