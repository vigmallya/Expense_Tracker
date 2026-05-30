import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AddGroupExpenseModal from '../components/AddGroupExpenseModal'
import { getNetBalances, simplifyDebts } from '../utils/splitCalculator'
import InviteMemberModal from '../components/InviteMemberModal'
import EditGroupExpenseModal from '../components/EditGroupExpenseModal'
import SettleModal from '../components/SettleModal'

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

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('default', { day: 'numeric', month: 'short' })
}

function ViewReceiptButton({ url }) {
  const [lightbox, setLightbox] = useState(false)

  return (
    <>
      <div
        onClick={e => { e.stopPropagation(); setLightbox(true) }}
        style={{
          marginTop: '8px',
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 10px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '99px', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '14px' }}>🧾</span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>View receipt</span>
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <button
            onClick={() => setLightbox(false)}
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'none', border: 'none',
              color: 'white', fontSize: '28px', cursor: 'pointer',
            }}
          >✕</button>
          <img
            src={url}
            alt="Receipt"
            style={{
              maxWidth: '100%', maxHeight: '90vh',
              borderRadius: '8px', objectFit: 'contain',
            }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

export default function GroupDetailPage() {
  const { id: groupId }   = useParams()
  const { user }          = useAuth()
  const navigate          = useNavigate()

  const [group, setGroup]           = useState(null)
  const [members, setMembers]       = useState([])
  const [expenses, setExpenses]     = useState([])
  const [splits, setSplits]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [activeTab, setActiveTab]   = useState('expenses') // 'expenses' | 'balances' | 'members'
  const [showInvite, setShowInvite] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [settlements, setSettlements] = useState([])
  const [paidByFilter, setPaidByFilter] = useState('all')
  const [settleTarget, setSettleTarget] = useState(null) // { from, to, amount }

  useEffect(() => { fetchAll() }, [groupId])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchGroup(), fetchMembers(), fetchExpenses(), fetchSettlements()])
    setLoading(false)
  }

  // Fetch group details
  async function fetchGroup() {
    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single()
    setGroup(data)
  }

  // Fetch settlement details
  async function fetchSettlements() {
    const { data } = await supabase
      .from('settlements')
      .select('*')
      .eq('group_id', groupId)
      .order('settled_at', { ascending: false })

    setSettlements(data || [])
  }
  // Fetch all members with their profile info
  async function fetchMembers() {
    const { data } = await supabase
      .from('group_members')
      .select(`
        role,
        user_id,
        profiles (
          id,
          name,
          email
        )
      `)
      .eq('group_id', groupId)

    const memberList = (data || []).map(row => ({
      id:    row.profiles.id,
      name:  row.profiles.name,
      email: row.profiles.email,
      role:  row.role,
    }))
    setMembers(memberList)
  }

  // Fetch all group expenses with their splits
  async function fetchExpenses() {
    const { data: expenseData } = await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('date', { ascending: false })

    setExpenses(expenseData || [])

    // Fetch splits for all expenses in this group
    if (expenseData && expenseData.length > 0) {
      const expenseIds = expenseData.map(e => e.id)
      const { data: splitData } = await supabase
        .from('expense_splits')
        .select('*, expenses(paid_by)')
        .in('expense_id', expenseIds)

      setSplits(splitData || [])
    }else {
    // No expenses left — clear splits too
    setSplits([])
  }
  }

  // Delete group — only available to creator
  async function handleDeleteGroup() {
    setDeleting(true)
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)

    if (error) {
      alert(error.message)
      setDeleting(false)
      return
    }

    navigate('/groups')
  }

  // Settle a debt — mark relevant splits as settled
  // Mark settled — just insert a settlement record
  // Splits are NEVER touched
  async function handleSettle(fromUserId, toUserId, amount) {
    try {
      const { error } = await supabase
        .from('settlements')
        .insert({
          group_id:  groupId,
          from_user: fromUserId,
          to_user:   toUserId,
          amount,
        })

      if (error) throw error

      await fetchSettlements()

    } catch (err) {
      alert(err.message)
    }
  }

  // Undo — just delete that specific settlement record
  // Splits are NEVER touched
  async function handleUndoSettle(settlementId) {
    try {
      const { error } = await supabase
        .from('settlements')
        .delete()
        .eq('id', settlementId)

      if (error) throw error

      await fetchSettlements()

    } catch (err) {
      alert(err.message)
    }
  }

  // Get member name by ID
  function getMemberName(id) {
    const member = members.find(m => m.id === id)
    return member?.name || 'Unknown'
  }

  // ─────────────────────────────────────────────────────────
  // BALANCE CALCULATION
  // Step 1 — What each person owes from splits
  const owedMap = {}
  splits.forEach(split => {
    const paidBy = split.expenses?.paid_by
    if (!paidBy || paidBy === split.user_id) return
    const key = `${split.user_id}__${paidBy}`
    owedMap[key] = (owedMap[key] || 0) + parseFloat(split.amount_owed)
  })

  // Step 2 — Total paid per direction from settlements
  const paidMap = {}
  settlements.forEach(s => {
    const key = `${s.from_user}__${s.to_user}`
    paidMap[key] = (paidMap[key] || 0) + parseFloat(s.amount)
  })

  // Step 3 — Last settlement per pair (for settled section + undo)
  const lastSettlementMap = {}
  settlements.forEach(s => {
    const key = `${s.from_user}__${s.to_user}`
    if (
      !lastSettlementMap[key] ||
      new Date(s.settled_at) > new Date(lastSettlementMap[key].settled_at)
    ) {
      lastSettlementMap[key] = s
    }
  })

  // Step 4 — Net opposite directions and build outstanding/settled lists
  const personPairs = new Set()
  const allKeys = new Set([...Object.keys(owedMap), ...Object.keys(paidMap)])
  allKeys.forEach(key => {
    const [a, b] = key.split('__')
    personPairs.add([a, b].sort().join('__'))
  })

  const outstanding = []
  const settledList = []

  personPairs.forEach(pairKey => {
  const [p1, p2] = pairKey.split('__')

  const p1OwesP2 = (owedMap[`${p1}__${p2}`] || 0) - (paidMap[`${p1}__${p2}`] || 0)
  const p2OwesP1 = (owedMap[`${p2}__${p1}`] || 0) - (paidMap[`${p2}__${p1}`] || 0)
  const net      = parseFloat((p1OwesP2 - p2OwesP1).toFixed(2))

  // Find last settlement for this pair (either direction)
  const lastP1toP2 = lastSettlementMap[`${p1}__${p2}`]
  const lastP2toP1 = lastSettlementMap[`${p2}__${p1}`]
  const lastSettlement = !lastP1toP2 ? lastP2toP1
    : !lastP2toP1 ? lastP1toP2
    : new Date(lastP1toP2.settled_at) > new Date(lastP2toP1.settled_at)
      ? lastP1toP2 : lastP2toP1

  if (net > 0.01) {
    // Still outstanding — but also show last settlement if any payments made
    outstanding.push({ from: p1, to: p2, amount: net })

    // Show last settlement below outstanding if payments have been made
    if (lastSettlement) {
      settledList.push({
        from:         lastSettlement.from_user,
        to:           lastSettlement.to_user,
        amount:       parseFloat(lastSettlement.amount),
        settlementId: lastSettlement.id,
      })
    }

  } else if (net < -0.01) {
    outstanding.push({ from: p2, to: p1, amount: Math.abs(net) })

    if (lastSettlement) {
      settledList.push({
        from:         lastSettlement.from_user,
        to:           lastSettlement.to_user,
        amount:       parseFloat(lastSettlement.amount),
        settlementId: lastSettlement.id,
      })
    }

  } else {
    // Fully settled
    if (lastSettlement) {
      settledList.push({
        from:         lastSettlement.from_user,
        to:           lastSettlement.to_user,
        amount:       parseFloat(lastSettlement.amount),
        settlementId: lastSettlement.id,
      })
    }
  }
})
      

  // Is current user the group creator/admin
  const isAdmin = group?.created_by === user.id

  if (loading) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading...
      </div>
    )
  }

  if (!group) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
        Group not found.
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '2rem' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '3rem 1.5rem 0',
        backgroundColor: '#0f172a', color: 'white',
      }}>
        {/* Back button + group name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <button
            onClick={() => navigate('/groups')}
            style={{
              background: 'none', border: 'none', color: 'white',
              fontSize: '20px', padding: '0', cursor: 'pointer',
            }}
          >
            ←
          </button>
          <h1 style={{ fontSize: '22px', fontWeight: '700' }}>{group.name}</h1>
        </div>

        {group.description && (
          <p style={{ fontSize: '13px', opacity: 0.5, marginBottom: '4px', paddingLeft: '32px' }}>
            {group.description}
          </p>
        )}

        {/* Member count + add expense button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
          <p style={{ fontSize: '12px', opacity: 0.5 }}>
            {members.length} member{members.length !== 1 ? 's' : ''} · {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'white', color: '#0f172a',
              border: 'none', borderRadius: '99px',
              fontSize: '13px', fontWeight: '600',
            }}
          >
            + Add expense
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginTop: '4px' }}>
          {['expenses', 'balances', 'history', 'members'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '10px 0',
                background: 'none', border: 'none',
                borderBottom: activeTab === tab ? '2px solid white' : '2px solid transparent',
                color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
                fontSize: '12px', fontWeight: '500',
                textTransform: 'capitalize', cursor: 'pointer',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: '1.5rem' }}>

        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <div>
            {/* Paid by filter pills */}
            {members.length > 1 && (
              <div style={{
                display: 'flex', gap: '8px', overflowX: 'auto',
                scrollbarWidth: 'none', marginBottom: '1rem',
                paddingBottom: '4px',
              }}>
                <button
                  onClick={() => setPaidByFilter('all')}
                  style={{
                    padding: '5px 14px', borderRadius: '99px',
                    fontSize: '12px', fontWeight: '500', flexShrink: 0,
                    border: '1px solid',
                    borderColor: paidByFilter === 'all' ? '#0f172a' : '#e2e8f0',
                    backgroundColor: paidByFilter === 'all' ? '#0f172a' : 'white',
                    color: paidByFilter === 'all' ? 'white' : '#64748b',
                  }}
                >
                  Everyone
                </button>
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPaidByFilter(m.id)}
                    style={{
                      padding: '5px 14px', borderRadius: '99px',
                      fontSize: '12px', fontWeight: '500', flexShrink: 0,
                      border: '1px solid',
                      borderColor: paidByFilter === m.id ? '#0f172a' : '#e2e8f0',
                      backgroundColor: paidByFilter === m.id ? '#0f172a' : 'white',
                      color: paidByFilter === m.id ? 'white' : '#64748b',
                    }}
                  >
                    {m.id === user.id ? 'Me' : m.name}
                  </button>
                ))}
              </div>
            )}

            {/* Filtered expenses */}
            {expenses
              .filter(e => paidByFilter === 'all' || e.paid_by === paidByFilter)
              .length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>💸</p>
                <p style={{ fontSize: '14px' }}>No expenses found</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {expenses
                .filter(e => paidByFilter === 'all' || e.paid_by === paidByFilter)
                .map(expense => {
                  const expSplits = splits.filter(s => s.expense_id === expense.id)
                  return (
                    <div key={expense.id} style={{
                      padding: '14px', backgroundColor: 'white',
                      borderRadius: '12px', border: '1px solid #f1f5f9',
                    }}>
                      {/* Top row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ fontSize: '20px' }}>{categoryIcon(expense.category)}</span>
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: '600' }}>{expense.title}</p>
                            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                              Paid by {getMemberName(expense.paid_by)} · {formatDate(expense.date)}
                            </p>
                          </div>
                        </div>
                        <p style={{ fontSize: '16px', fontWeight: '700' }}>
                          {currencySymbol(expense.currency)}{parseFloat(expense.amount).toFixed(2)}
                        </p>
                      </div>

                      {/* Split tags + edit button */}
                      <div style={{
                        marginTop: '10px', paddingTop: '10px',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                          {expSplits.map(split => (
                            <span key={split.id} style={{
                              fontSize: '11px', padding: '2px 8px',
                              borderRadius: '99px', backgroundColor: '#f1f5f9', color: '#64748b',
                            }}>
                              {getMemberName(split.user_id)} {currencySymbol(expense.currency)}{parseFloat(split.amount_owed).toFixed(2)}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => setEditingExpense(expense)}
                          style={{
                            padding: '4px 12px', flexShrink: 0,
                            backgroundColor: 'white', border: '1px solid #e2e8f0',
                            borderRadius: '8px', fontSize: '12px', color: '#64748b',
                            marginLeft: '8px',
                          }}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                      {/* Receipt thumbnail if exists */}
                      {expense.receipt_url && (
                        <ViewReceiptButton url={expense.receipt_url} />
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* BALANCES TAB */}
        {activeTab === 'balances' && (
          <div>
            {/* ── Your personal summary ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '10px', marginBottom: '1.5rem',
            }}>
              <div style={{
                padding: '14px', backgroundColor: '#fef9f0',
                borderRadius: '12px', border: '1px solid #fed7aa',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>You owe</p>
                <p style={{ fontSize: '22px', fontWeight: '700', color: '#dc2626' }}>
                  {outstanding
                    .filter(t => t.from === user.id)
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toFixed(2)}
                </p>
              </div>
              <div style={{
                padding: '14px', backgroundColor: '#f0fdf4',
                borderRadius: '12px', border: '1px solid #bbf7d0',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Owed to you</p>
                <p style={{ fontSize: '22px', fontWeight: '700', color: '#16a34a' }}>
                  {outstanding
                    .filter(t => t.to === user.id)
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toFixed(2)}
                </p>
              </div>
            </div>

            {outstanding.length === 0 && settledList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</p>
                <p style={{ fontSize: '14px' }}>All settled up!</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>No outstanding balances</p>
              </div>
            )}

            {/* ── Outstanding ── */}
            {outstanding.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{
                  fontSize: '12px', fontWeight: '600', color: '#94a3b8',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px'
                }}>
                  Outstanding
                </p>
                {outstanding.map((t, i) => {
                  const isCurrentUser = t.from === user.id
                  const isReceiver    = t.to === user.id
                  return (
                    <div key={i} style={{
                      padding: '14px', marginBottom: '8px',
                      backgroundColor: isCurrentUser ? '#fef9f0' : isReceiver ? '#f0fdf4' : 'white',
                      borderRadius: '12px',
                      border: `1px solid ${isCurrentUser ? '#fed7aa' : isReceiver ? '#bbf7d0' : '#f1f5f9'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: '500' }}>
                            <span style={{ color: '#dc2626' }}>{getMemberName(t.from)}</span>
                            {' → '}
                            <span style={{ color: '#16a34a' }}>{getMemberName(t.to)}</span>
                          </p>
                          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                            {isCurrentUser ? 'You need to pay'
                              : isReceiver ? 'Needs to pay you'
                              : 'Outstanding'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '18px', fontWeight: '700' }}>
                            {t.amount.toFixed(2)}
                          </p>
                          {(isCurrentUser || isReceiver) && (
                            <button
                              onClick={() => setSettleTarget({ from: t.from, to: t.to, amount: t.amount })}
                              style={{
                                marginTop: '6px', padding: '4px 12px',
                                backgroundColor: '#0f172a', color: 'white',
                                border: 'none', borderRadius: '99px',
                                fontSize: '12px', cursor: 'pointer',
                              }}
                            >
                              {isCurrentUser ? 'Mark settled' : 'Mark as received'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Settled ── */}
            {settledList.length > 0 && (
              <div>
                <p style={{
                  fontSize: '12px', fontWeight: '600', color: '#94a3b8',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px'
                }}>
                  Last payment
                </p>
                {settledList.map((s, i) => (
                  <div key={i} style={{
                    padding: '14px', marginBottom: '8px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '12px', border: '1px solid #bbf7d0',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: '500', color: '#16a34a' }}>
                          {getMemberName(s.from)} → {getMemberName(s.to)}
                        </p>
                        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                          ✓ Last payment
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '16px', fontWeight: '700', color: '#16a34a' }}>
                          {s.amount.toFixed(2)}
                        </p>
                        {(s.from === user.id || s.to === user.id) && (
                          <button
                            onClick={() => handleUndoSettle(s.settlementId)}
                            style={{
                              marginTop: '6px', padding: '4px 12px',
                              backgroundColor: 'white', color: '#dc2626',
                              border: '1px solid #fecaca', borderRadius: '99px',
                              fontSize: '12px', cursor: 'pointer',
                            }}
                          >
                            Undo last
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}

        {/* MEMBERS TAB */}
        {activeTab === 'members' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem' }}>
              {members.map(member => (
                <div key={member.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', backgroundColor: 'white',
                  borderRadius: '12px', border: '1px solid #f1f5f9',
                }}>
                  {/* Avatar circle with initials */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    backgroundColor: '#e2e8f0', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '15px', fontWeight: '600', color: '#475569',
                  }}>
                    {member.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: '500' }}>
                      {member.name}
                      {member.id === user.id ? ' (you)' : ''}
                    </p>
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>{member.email}</p>
                  </div>
                  {member.role === 'admin' && (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px',
                      backgroundColor: '#f1f5f9', borderRadius: '99px', color: '#64748b'
                    }}>
                      admin
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Invite member button */}
            <button
              onClick={() => setShowInvite(true)}
              style={{
                width: '100%', padding: '13px',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '14px', fontWeight: '500',
              }}
            >
              + Invite member
            </button>

            {/* Delete group — admin only */}
            {isAdmin && (
              <div style={{ marginTop: '2rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                {!showDelete ? (
                  <button
                    onClick={() => setShowDelete(true)}
                    style={{
                      width: '100%', padding: '13px',
                      backgroundColor: '#fef2f2', color: '#dc2626',
                      border: '1px solid #fecaca', borderRadius: '10px',
                      fontSize: '14px', fontWeight: '500',
                    }}
                  >
                    🗑 Delete group
                  </button>
                ) : (
                  <div style={{ border: '1px solid #fecaca', borderRadius: '10px', overflow: 'hidden' }}>
                    <p style={{
                      padding: '12px', textAlign: 'center', fontSize: '13px',
                      color: '#dc2626', backgroundColor: '#fef2f2',
                      borderBottom: '1px solid #fecaca',
                    }}>
                      This will delete all expenses and splits. Cannot be undone.
                    </p>
                    <div style={{ display: 'flex' }}>
                      <button
                        onClick={() => setShowDelete(false)}
                        style={{
                          flex: 1, padding: '12px', background: 'white',
                          border: 'none', borderRight: '1px solid #fecaca',
                          fontSize: '14px', color: '#64748b', fontWeight: '500',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteGroup}
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
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div>
            {settlements.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>📋</p>
                <p style={{ fontSize: '14px' }}>No settlement history yet</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>
                  Settled payments will appear here
                </p>
              </div>
            )}

            {settlements.length > 0 && (() => {
              // Group settlements by month
              const grouped = settlements.reduce((acc, s) => {
                const date = new Date(s.settled_at)
                const key  = date.toLocaleString('default', { month: 'long', year: 'numeric' })
                if (!acc[key]) acc[key] = []
                acc[key].push(s)
                return acc
              }, {})

              return Object.entries(grouped).map(([month, monthSettlements]) => {
                // Total settled this month
                const monthTotal = monthSettlements
                  .reduce((sum, s) => sum + parseFloat(s.amount), 0)
                  .toFixed(2)

                return (
                  <div key={month} style={{ marginBottom: '1.5rem' }}>

                    {/* Month header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'baseline', marginBottom: '10px',
                    }}>
                      <p style={{
                        fontSize: '12px', fontWeight: '600',
                        color: '#94a3b8', textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {month}
                      </p>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {monthSettlements.length} payment{monthSettlements.length !== 1 ? 's' : ''} · {monthTotal}
                      </p>
                    </div>

                    {/* Settlement rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {monthSettlements.map((s, i) => {
                        const isCurrentUserPayer    = s.from_user === user.id
                        const isCurrentUserReceiver = s.to_user === user.id

                        return (
                          <div key={i} style={{
                            padding: '14px', backgroundColor: 'white',
                            borderRadius: '12px',
                            border: '1px solid #f1f5f9',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                              {/* Left — who paid whom */}
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: '14px', fontWeight: '500' }}>
                                  <span style={{
                                    color: isCurrentUserPayer ? '#dc2626' : '#0f172a',
                                    fontWeight: isCurrentUserPayer ? '600' : '500',
                                  }}>
                                    {isCurrentUserPayer ? 'You' : getMemberName(s.from_user)}
                                  </span>
                                  {' paid '}
                                  <span style={{
                                    color: isCurrentUserReceiver ? '#16a34a' : '#0f172a',
                                    fontWeight: isCurrentUserReceiver ? '600' : '500',
                                  }}>
                                    {isCurrentUserReceiver ? 'you' : getMemberName(s.to_user)}
                                  </span>
                                </p>

                                {/* Date + time */}
                                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                                  {new Date(s.settled_at).toLocaleDateString('default', {
                                    day: 'numeric', month: 'short',
                                  })}
                                  {' · '}
                                  {new Date(s.settled_at).toLocaleTimeString('default', {
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              </div>

                              {/* Right — amount + badge */}
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <p style={{
                                  fontSize: '16px', fontWeight: '700',
                                  color: isCurrentUserReceiver ? '#16a34a' : isCurrentUserPayer ? '#dc2626' : '#0f172a',
                                }}>
                                  {isCurrentUserReceiver ? '+' : isCurrentUserPayer ? '-' : ''}
                                  {parseFloat(s.amount).toFixed(2)}
                                </p>
                                <span style={{
                                  fontSize: '10px', padding: '2px 8px',
                                  borderRadius: '99px', marginTop: '4px',
                                  display: 'inline-block',
                                  backgroundColor: '#f0fdf4', color: '#16a34a',
                                }}>
                                  ✓ Settled
                                </span>
                              </div>

                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>

      {showModal && (
        <AddGroupExpenseModal
          groupId={groupId}
          members={members}
          onClose={() => setShowModal(false)}
          onAdded={fetchExpenses}
        />
      )}
      {showInvite && (
        <InviteMemberModal
          groupId={groupId}
          onClose={() => setShowInvite(false)}
          onAdded={fetchMembers}
        />
      )}
      {editingExpense && (
        <EditGroupExpenseModal
          expense={editingExpense}
          members={members}
          onClose={() => setEditingExpense(null)}
          onEdited={() => { setEditingExpense(null); fetchExpenses() }}
        />
      )}
      {settleTarget && (
        <SettleModal
          from={settleTarget.from}
          to={settleTarget.to}
          amount={settleTarget.amount}
          getMemberName={getMemberName}
          onClose={() => setSettleTarget(null)}
          onConfirm={(amount) => {
            handleSettle(settleTarget.from, settleTarget.to, amount)
            setSettleTarget(null)
          }}
        />
      )}
      {editingExpense && (
        <EditGroupExpenseModal
          expense={editingExpense}
          members={members}
          onClose={() => setEditingExpense(null)}
          onEdited={() => { setEditingExpense(null); fetchExpenses() }}
          onDeleted={() => { setEditingExpense(null); fetchExpenses() }}
        />
      )}
    </div>
  )
}