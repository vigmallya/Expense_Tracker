import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/BottomNav'
import AddExpenseModal from '../components/AddExpenseModal'
import ExpenseDetailSheet from '../components/ExpenseDetailSheet'
import QuickAddSheet from '../components/QuickAddSheet'
import AddGroupExpenseModal from '../components/AddGroupExpenseModal'

const CATEGORIES = ['All', 'Groceries', 'Food', 'Transport', 'Housing', 'Shopping', 'Health', 'Entertainment', 'Other']

const CATEGORY_COLORS = {
  Groceries:     '#84cc16',
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
    Groceries: '🛒', Food: '🍔', Transport: '🚌', Housing: '🏠',
    Shopping: '🛍', Health: '💊', Entertainment: '🎬', Other: '📦'
  }
  return icons[cat] || '📦'
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ExpensesPage() {
  const { user } = useAuth()
  const [expenses, setExpenses]           = useState([])
  const [filtered, setFiltered]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeCurrency, setActiveCurrency] = useState('All')
  const [sortBy, setSortBy]               = useState('date_desc')
  const [showModal, setShowModal]         = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [showQuickAdd, setShowQuickAdd]     = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [selectedGroup, setSelectedGroup]   = useState(null)
  const [groupMembers, setGroupMembers]     = useState([])

  useEffect(() => { fetchExpenses() }, [])

  useEffect(() => {
    applyFilters()
  }, [expenses, search, activeCategory, activeCurrency, sortBy])

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
  async function fetchExpenses() {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('paid_by', user.id)
      .eq('is_personal', true)
      .order('date', { ascending: false })

    setExpenses(data || [])
    setLoading(false)
  }

  function applyFilters() {
    let result = [...expenses]

    // Search — matches title or note
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.note && e.note.toLowerCase().includes(q))
      )
    }

    // Category filter
    if (activeCategory !== 'All') {
      result = result.filter(e => e.category === activeCategory)
    }

    // Currency filter
    if (activeCurrency !== 'All') {
      result = result.filter(e => e.currency === activeCurrency)
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'date_desc')   return new Date(b.date) - new Date(a.date)
      if (sortBy === 'date_asc')    return new Date(a.date) - new Date(b.date)
      if (sortBy === 'amount_desc') return parseFloat(b.amount) - parseFloat(a.amount)
      if (sortBy === 'amount_asc')  return parseFloat(a.amount) - parseFloat(b.amount)
      return 0
    })

    setFiltered(result)
  }

  // Group expenses by month for display
  function groupByMonth(expenses) {
    return expenses.reduce((groups, expense) => {
      const date = new Date(expense.date + 'T00:00:00')
      const key = date.toLocaleString('default', { month: 'long', year: 'numeric' })
      if (!groups[key]) groups[key] = []
      groups[key].push(expense)
      return groups
    }, {})
  }

  // Total of currently filtered expenses per currency
  const filteredTotals = filtered.reduce((acc, e) => {
    const sym = currencySymbol(e.currency)
    acc[sym] = (acc[sym] || 0) + parseFloat(e.amount)
    return acc
  }, {})

  const grouped = groupByMonth(filtered)

  return (
    <div style={{ paddingBottom: '90px' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '3rem 1.5rem 1rem',
        backgroundColor: '#0f172a',
        color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Expenses</h1>
            <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '2px' }}>
              {filtered.length} of {expenses.length} shown
              {Object.entries(filteredTotals).map(([sym, amt]) => (
                <span key={sym}> · {sym}{amt.toFixed(2)}</span>
              ))}
            </p>
          </div>
          <button
            onClick={() => setShowQuickAdd(true)}
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              backgroundColor: 'white', color: '#0f172a',
              border: 'none', fontSize: '22px', fontWeight: '300',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>

        {/* Search bar */}
        <div style={{ marginTop: '1rem', position: 'relative' }}>
          <span style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', fontSize: '16px'
          }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Search expenses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 38px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px', fontSize: '14px',
              color: 'white', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ backgroundColor: '#0f172a', paddingBottom: '1rem' }}>

        {/* Category pills */}
        <div style={{
          display: 'flex', gap: '8px', overflowX: 'auto',
          padding: '0 1.5rem',
          scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '5px 14px', borderRadius: '99px',
                fontSize: '12px', fontWeight: '500',
                flexShrink: 0, border: '1px solid',
                borderColor: activeCategory === cat ? 'white' : 'rgba(255,255,255,0.2)',
                backgroundColor: activeCategory === cat ? 'white' : 'transparent',
                color: activeCategory === cat ? '#0f172a' : 'rgba(255,255,255,0.7)',
              }}
            >
              {cat === 'All' ? cat : `${categoryIcon(cat)} ${cat}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sort + currency row ── */}
      <div style={{
        display: 'flex', gap: '8px', padding: '12px 1.5rem',
        borderBottom: '1px solid #f1f5f9',
        backgroundColor: 'white',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {/* Sort selector */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: '8px',
            border: '1px solid #e2e8f0', fontSize: '12px',
            backgroundColor: 'white', color: '#0f172a',
            outline: 'none', flexShrink: 0,
          }}
        >
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="amount_desc">Highest amount</option>
          <option value="amount_asc">Lowest amount</option>
        </select>

        {/* Currency filter pills */}
        {['All', 'EUR', 'INR', 'USD'].map(c => (
          <button
            key={c}
            onClick={() => setActiveCurrency(c)}
            style={{
              padding: '5px 12px', borderRadius: '99px',
              fontSize: '12px', fontWeight: '500',
              flexShrink: 0, border: '1px solid',
              borderColor: activeCurrency === c ? '#0f172a' : '#e2e8f0',
              backgroundColor: activeCurrency === c ? '#0f172a' : 'white',
              color: activeCurrency === c ? 'white' : '#64748b',
            }}
          >
            {c === 'All' ? 'All currencies' : c}
          </button>
        ))}
      </div>

      {/* ── Expense list ── */}
      <div style={{ padding: '0 1.5rem' }}>

        {loading && (
          <p style={{ color: '#94a3b8', fontSize: '14px', padding: '2rem 0' }}>Loading...</p>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</p>
            <p style={{ fontSize: '14px' }}>No expenses found</p>
            {(search || activeCategory !== 'All' || activeCurrency !== 'All') && (
              <button
                onClick={() => { setSearch(''); setActiveCategory('All'); setActiveCurrency('All') }}
                style={{
                  marginTop: '12px', padding: '8px 16px',
                  backgroundColor: '#f1f5f9', border: 'none',
                  borderRadius: '8px', fontSize: '13px',
                  color: '#64748b', cursor: 'pointer',
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Grouped by month */}
        {Object.entries(grouped).map(([month, monthExpenses]) => {
          // Total per currency for this month
          const monthTotals = monthExpenses.reduce((acc, e) => {
            const sym = currencySymbol(e.currency)
            acc[sym] = (acc[sym] || 0) + parseFloat(e.amount)
            return acc
          }, {})

          return (
            <div key={month} style={{ marginTop: '1.5rem' }}>

              {/* Month header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', marginBottom: '10px',
              }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {month}
                </h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {Object.entries(monthTotals).map(([sym, amt]) => `${sym}${amt.toFixed(2)}`).join(' · ')}
                </span>
              </div>

              {/* Expense rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {monthExpenses.map(expense => (
                  <div
                    key={expense.id}
                    onClick={() => setSelectedExpense(expense)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px',
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      border: '1px solid #f1f5f9',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: '40px', height: '40px',
                      borderRadius: '10px', flexShrink: 0,
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

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '15px', fontWeight: '600' }}>
                        {currencySymbol(expense.currency)}{parseFloat(expense.amount).toFixed(2)}
                      </p>
                      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {expense.currency}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Bottom padding so last item isn't hidden behind nav */}
        <div style={{ height: '1rem' }} />
      </div>

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
          onEdited={() => {setSelectedExpense(null); fetchExpenses()}}
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