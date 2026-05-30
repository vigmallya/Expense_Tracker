import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/BottomNav'
import AddExpenseModal from '../components/AddExpenseModal'
import ExpenseDetailSheet from '../components/ExpenseDetailSheet'
import { useNavigate, useLocation } from 'react-router-dom'
import QuickAddSheet from '../components/QuickAddSheet'
import AddGroupExpenseModal from '../components/AddGroupExpenseModal'

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
  const symbols = { INR: '₹', EUR: '€', USD: '$' }
  return symbols[code] || code
}

function categoryIcon(cat) {
  const icons = {
    Food: '🍔', Transport: '🚌', Housing: '🏠',
    Shopping: '🛍', Health: '💊', Entertainment: '🎬', Other: '📦'
  }
  return icons[cat] || '📦'
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('default', { day: 'numeric', month: 'short' })
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [expenses, setExpenses]   = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear())
  const [budgets, setBudgets] = useState([])
  const [preferredCurrency, setPreferredCurrency] = useState('EUR')
  const [groupBalances, setGroupBalances] = useState({ owe: 0, owed: 0 })
  const [showQuickAdd, setShowQuickAdd]         = useState(false)
  const [showGroupModal, setShowGroupModal]     = useState(false)
  const [selectedGroup, setSelectedGroup]       = useState(null)
  const [groupMembers, setGroupMembers]         = useState([])

  useEffect(() => {
    fetchExpenses()
    fetchBudgets()
    fetchPreferredCurrency()
    fetchGroupBalances()
  }, [selectedMonth, selectedYear, location.pathname])

  async function fetchGroupMembers(groupId) {
    const { data } = await supabase
      .from('group_members')
      .select(`user_id, profiles(id, name, email)`)
      .eq('group_id', groupId)

    return (data || []).map(row => ({
      id:    row.profiles.id,
      name:  row.profiles.name,
      email: row.profiles.email,
    }))
  }

  async function fetchGroupBalances() {
  // Get all groups I'm in
  const { data: myGroups } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)

  const groupIds = (myGroups || []).map(g => g.group_id)
    if (groupIds.length === 0) {
      setGroupBalances({ owe: 0, owed: 0 })
      return
    }

    // Get all group expenses
    const { data: groupExpenses } = await supabase
      .from('expenses')
      .select('id, paid_by')
      .in('group_id', groupIds)
      .eq('is_personal', false)

    const expenseIds = (groupExpenses || []).map(e => e.id)
    const payerMap   = {}
    ;(groupExpenses || []).forEach(e => { payerMap[e.id] = e.paid_by })

    // Only fetch splits if expenses exist
    let allSplits = []
    if (expenseIds.length > 0) {
      const { data: splitData } = await supabase
        .from('expense_splits')
        .select('user_id, amount_owed, expense_id')
        .in('expense_id', expenseIds)
      allSplits = splitData || []
    }

    // Always fetch settlements even if no expenses exist
    const { data: allSettlements } = await supabase
      .from('settlements')
      .select('from_user, to_user, amount')
      .in('group_id', groupIds)

    // Build per-pair owed map
    const owedMap = {}
    ;(allSplits || []).forEach(split => {
      const paidBy = payerMap[split.expense_id]
      if (!paidBy || paidBy === split.user_id) return

      if (split.user_id === user.id) {
        const key = `${user.id}__${paidBy}`
        owedMap[key] = (owedMap[key] || 0) + parseFloat(split.amount_owed)
      } else if (paidBy === user.id) {
        const key = `${split.user_id}__${user.id}`
        owedMap[key] = (owedMap[key] || 0) + parseFloat(split.amount_owed)
      }
    })

    // Build per-pair paid map from settlements
    const paidMap = {}
    ;(allSettlements || []).forEach(s => {
      const key = `${s.from_user}__${s.to_user}`
      paidMap[key] = (paidMap[key] || 0) + parseFloat(s.amount)
    })

    // Net opposite directions per person pair
    const allPeople = new Set()
    Object.keys(owedMap).forEach(key => {
      const [a, b] = key.split('__')
      allPeople.add(b === user.id ? a : b)
    })

    // Also add people from settlements
    Object.keys(paidMap).forEach(key => {
      const [a, b] = key.split('__')
      if (a === user.id) allPeople.add(b)
      if (b === user.id) allPeople.add(a)
    })
    

    let totalOwe  = 0
    let totalOwed = 0

    allPeople.forEach(personId => {
      const iOweThem  = (owedMap[`${user.id}__${personId}`] || 0) - (paidMap[`${user.id}__${personId}`] || 0)
      const theyOweMe = (owedMap[`${personId}__${user.id}`] || 0) - (paidMap[`${personId}__${user.id}`] || 0)
      const net       = iOweThem - theyOweMe

      if (net > 0.01)       totalOwe  += net
      else if (net < -0.01) totalOwed += Math.abs(net)
    })

    setGroupBalances({
      owe:  Math.max(0, parseFloat(totalOwe.toFixed(2))),
      owed: Math.max(0, parseFloat(totalOwed.toFixed(2))),
    })
  }

  async function fetchExpenses() {
    setLoading(true)

    const startOfMonth = new Date(selectedYear, selectedMonth, 1)
    const endOfMonth   = new Date(selectedYear, selectedMonth + 1, 0)

    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('paid_by', user.id)
      .eq('is_personal', true)
      .gte('date', startOfMonth.toISOString().split('T')[0])
      .lte('date', endOfMonth.toISOString().split('T')[0])
      .order('date', { ascending: false })

    setExpenses(data || [])
    setLoading(false)
  }

  async function fetchPreferredCurrency() {
    const { data } = await supabase
      .from('profiles')
      .select('preferred_currency')
      .eq('id', user.id)
      .single()
    if (data?.preferred_currency) setPreferredCurrency(data.preferred_currency)
  }

    // Fetch budget function 
    async function fetchBudgets() {
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const { data } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', monthKey)
    setBudgets(data || [])
  }

  // Group totals by currency symbol — ₹, €, $ shown separately
  const totalsByCurrency = expenses.reduce((acc, e) => {
    const sym = currencySymbol(e.currency)
    acc[sym] = (acc[sym] || 0) + parseFloat(e.amount)
    return acc
  }, {})

  // Group amounts by category (across all currencies — for the bar breakdown)
  const byCategory = expenses.reduce((acc, e) => {
  const sym = currencySymbol(e.currency)
  const key = `${e.category}__${sym}`
    if (!acc[key]) acc[key] = { category: e.category, symbol: sym, amount: 0 }
    acc[key].amount += parseFloat(e.amount)
    return acc
  }, {})

  const grandTotal = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)

  return (
    <div style={{ paddingBottom: '90px' }}>
      {/* ── Header ── */}
        <div style={{
          padding: '3rem 1.5rem 1.5rem',
          backgroundColor: '#0f172a', color: 'white',
        }}>
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

          <p style={{ fontSize: '13px', opacity: 0.6 }}>Total spent</p>

          {Object.entries(totalsByCurrency).map(([sym, amt]) => (
            <h1 key={sym} style={{ fontSize: '40px', fontWeight: '700', margin: '4px 0 0', lineHeight: 1.1 }}>
              {sym}{amt.toFixed(2)}
            </h1>
          ))}

          {Object.keys(totalsByCurrency).length === 0 && (
            <h1 style={{ fontSize: '40px', fontWeight: '700', margin: '4px 0 0' }}>{currencySymbol(preferredCurrency)}0.00</h1>
          )}

          <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '8px' }}>
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''} this month
          </p>
        </div>
      
      {/* ── Group balances card ── */}     
      {(groupBalances.owe > 0 || groupBalances.owed > 0) && (
        <div style={{ paddingTop: '1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '10px', marginTop: '1.5rem',
        }}>
          <div style={{
            padding: '14px', backgroundColor: 'white',
            borderRadius: '12px',
            border: groupBalances.owe > 0 ? '1px solid #fed7aa' : '1px solid #f1f5f9',
            backgroundColor: groupBalances.owe > 0 ? '#fef9f0' : 'white',
          }}>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
              You owe
            </p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: groupBalances.owe > 0 ? '#dc2626' : '#94a3b8' }}>
              {currencySymbol(preferredCurrency)}{groupBalances.owe.toFixed(2)}
            </p>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              across all groups
            </p>
          </div>
          <div style={{
            padding: '14px',
            borderRadius: '12px',
            border: groupBalances.owed > 0 ? '1px solid #bbf7d0' : '1px solid #f1f5f9',
            backgroundColor: groupBalances.owed > 0 ? '#f0fdf4' : 'white',
          }}>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
              Owed to you
            </p>
            <p style={{ fontSize: '20px', fontWeight: '700', color: groupBalances.owed > 0 ? '#16a34a' : '#94a3b8' }}>
              {currencySymbol(preferredCurrency)}{groupBalances.owed.toFixed(2)}
            </p>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              across all groups
            </p>
          </div>
        </div>
        </div>
      )}
      

      <div style={{ padding: '1.5rem' }}>

        {/* ── Budget card — fixed position, always first ── */}
        <div
          onClick={() => navigate('/budget')}
          style={{
            padding: '14px 16px', backgroundColor: 'white',
            borderRadius: '12px', border: '1px solid #f1f5f9',
            cursor: 'pointer', marginBottom: '1.5rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <div>
            <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
              📊 Monthly budget
            </p>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>
              {budgets.length > 0
                ? `${budgets.length} categor${budgets.length === 1 ? 'y' : 'ies'} · ${currencySymbol(preferredCurrency)}${budgets.reduce((s, b) => s + parseFloat(b.monthly_limit), 0).toFixed(2)} budgeted`
                : 'Tap to set your budgets'
              }
            </p>
          </div>
          <span style={{ fontSize: '18px', color: '#94a3b8' }}>›</span>
        </div>

        {/* ── Category breakdown with budget limits ── */}
        {Object.keys(byCategory).length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>
              By category
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.values(byCategory)
                .sort((a, b) => b.amount - a.amount)
                .map(({ category, symbol, amount }) => {
                  // Only show budget for preferred currency entries
                  const isPreferred = symbol === currencySymbol(preferredCurrency)
                  const budget  = isPreferred ? budgets.find(b => b.category === category) : null
                  const limit   = budget ? parseFloat(budget.monthly_limit) : 0
                  const percent = limit > 0 ? Math.min((amount / limit) * 100, 100) : 0
                  const over    = limit > 0 && amount > limit

                  return (
                    <div key={`${category}__${symbol}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{categoryIcon(category)}</span>
                          {category}
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{symbol}</span>
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: over ? '#dc2626' : '#0f172a' }}>
                          {symbol}{amount.toFixed(2)}
                          {limit > 0 && (
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '400' }}>
                              {' '}/ {symbol}{limit.toFixed(2)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '99px' }}>
                        <div style={{
                          height: '100%',
                          width: limit > 0
                            ? `${percent}%`
                            : grandTotal > 0 ? `${(amount / grandTotal) * 100}%` : '0%',
                          backgroundColor: over ? '#dc2626'
                            : percent >= 80 ? '#f59e0b'
                            : CATEGORY_COLORS[category] || '#94a3b8',
                          borderRadius: '99px',
                          opacity: limit > 0 ? 1 : 0.4,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      {over && (
                        <p style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>
                          Over by {symbol}{(amount - limit).toFixed(2)}
                        </p>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* ── Recent expenses ── */}
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>Recent</h2>

          {loading && <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading...</p>}

          {!loading && expenses.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>💸</p>
              <p style={{ fontSize: '14px' }}>No expenses this month yet</p>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>Tap + to add your first one</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {expenses.slice(0, 10).map(expense => (
              <div
                key={expense.id}
                onClick={() => setSelectedExpense(expense)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', backgroundColor: 'white',
                  borderRadius: '12px', border: '1px solid #f1f5f9',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                  backgroundColor: (CATEGORY_COLORS[expense.category] || '#94a3b8') + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px',
                }}>
                  {categoryIcon(expense.category)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '14px', fontWeight: '500',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {expense.title}
                  </p>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    {expense.category} · {formatDate(expense.date)}
                  </p>
                </div>
                <p style={{ fontSize: '15px', fontWeight: '600', flexShrink: 0 }}>
                  {currencySymbol(expense.currency)}{parseFloat(expense.amount).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {expenses.length > 10 && (
            <p
              style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#3b82f6', cursor: 'pointer' }}
              onClick={() => navigate('/expenses')}
            >
              View all {expenses.length} expenses →
            </p>
          )}
        </div>
      </div>

      {/* ── Floating add button ── */}
      <button
        onClick={() => setShowQuickAdd(true)}
        style={{
          position: 'fixed',
          bottom: '85px',
          right: '50%',
          transform: 'translateX(50%)',
          width: '56px', height: '56px',
          borderRadius: '50%',
          backgroundColor: '#0f172a',
          color: 'white',
          border: 'none',
          fontSize: '28px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99,
        }}
      >
        +
      </button>

      {showModal && (
        <AddExpenseModal
          onClose={() => setShowModal(false)}
          onAdded={fetchExpenses}
        />
      )}

      {selectedExpense && (
        <ExpenseDetailSheet
          expense={selectedExpense}
          onClose={() => setSelectedExpense(null)}
          onDeleted={fetchExpenses}
          onEdited={(expense) => {
            setSelectedExpense(null);
            fetchExpenses()
          }}
        />
      )}
      {showQuickAdd && (
        <QuickAddSheet
          onPersonal={() => { setShowModal(true) }}
          onGroup={async (group) => {
            const members = await fetchGroupMembers(group.id)
            setSelectedGroup(group)
            setGroupMembers(members)
            setShowGroupModal(true)
          }}
          onClose={() => setShowQuickAdd(false)}
        />
      )}

      {showGroupModal && selectedGroup && (
        <AddGroupExpenseModal
          groupId={selectedGroup.id}
          members={groupMembers}
          onClose={() => { setShowGroupModal(false); setSelectedGroup(null) }}
          onAdded={() => { fetchExpenses(); fetchGroupBalances() }}
        />
      )}

      <BottomNav />
    </div>
  )
}
