import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AddGroupExpenseModal from '../components/AddGroupExpenseModal'
import { getNetBalances, simplifyDebts } from '../utils/splitCalculator'
import InviteMemberModal from '../components/InviteMemberModal'
import EditGroupExpenseModal from '../components/EditGroupExpenseModal'

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

  useEffect(() => { fetchAll() }, [groupId])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchGroup(), fetchMembers(), fetchExpenses()])
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
  async function handleSettle(fromUserId, toUserId, amount) {
      try {
        // Insert settlement record
        const { error: settlementError } = await supabase
          .from('settlements')
          .insert({
            group_id:  groupId,
            from_user: fromUserId,
            to_user:   toUserId,
            amount,
          })

        if (settlementError) throw settlementError

        // Mark splits as settled where:
        // - the person who owes (from_user) has unsettled splits
        // - in expenses paid by the person they owe (to_user)
        const expensesPaidByCreditor = expenses
          .filter(e => e.paid_by === toUserId)
          .map(e => e.id)

        if (expensesPaidByCreditor.length > 0) {
          const { error: splitError } = await supabase
            .from('expense_splits')
            .update({ is_settled: true })
            .eq('user_id', fromUserId)
            .eq('is_settled', false)
            .in('expense_id', expensesPaidByCreditor)

          if (splitError) throw splitError
        }

        // Refresh everything
        await fetchExpenses()

      } catch (err) {
        alert(err.message)
      }
    }

  // Get member name by ID
  function getMemberName(id) {
    const member = members.find(m => m.id === id)
    return member?.name || 'Unknown'
  }

  // Calculate debts from splits
  const balances      = getNetBalances(splits)
  const transactions  = simplifyDebts(balances)

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
          {['expenses', 'balances', 'members'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '10px 0',
                background: 'none', border: 'none',
                borderBottom: activeTab === tab ? '2px solid white' : '2px solid transparent',
                color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
                fontSize: '13px', fontWeight: '500',
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
            {expenses.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>💸</p>
                <p style={{ fontSize: '14px' }}>No expenses yet</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Tap "Add expense" to get started</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {expenses.map(expense => {
                // Get splits for this expense
                const expSplits = splits.filter(s => s.expense_id === expense.id)
                const settledCount = expSplits.filter(s => s.is_settled).length

                return (
                  <div key={expense.id} style={{
                    padding: '14px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '1px solid #f1f5f9',
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

                    {/* Split summary */}
                    <div style={{
                      marginTop: '10px', paddingTop: '10px',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {expSplits.map(split => (
                          <span key={split.id} style={{
                            fontSize: '11px', padding: '2px 8px',
                            borderRadius: '99px',
                            backgroundColor: split.is_settled ? '#f0fdf4' : '#fef9f0',
                            color: split.is_settled ? '#16a34a' : '#92400e',
                          }}>
                            {getMemberName(split.user_id)} {currencySymbol(expense.currency)}{parseFloat(split.amount_owed).toFixed(2)}
                            {split.is_settled ? ' ✓' : ''}
                          </span>
                        ))}
                      </div>
                      <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0, marginLeft: '8px' }}>
                        {settledCount}/{expSplits.length} settled
                      </span>
                    </div>
                    {/* Edit button — only visible to group members */}
                      <button
                        onClick={() => setEditingExpense(expense)}
                        style={{
                          marginTop: '8px', padding: '6px 14px',
                          backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                          borderRadius: '8px', fontSize: '12px', color: '#64748b',
                        }}
                      >
                        ✏️ Edit
                      </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* BALANCES TAB */}
        {activeTab === 'balances' && (
          <div>
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</p>
                <p style={{ fontSize: '14px' }}>All settled up!</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>No outstanding balances</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {transactions.map((t, i) => {
                  const isCurrentUser = t.from === user.id
                  return (
                    <div key={i} style={{
                      padding: '14px',
                      backgroundColor: isCurrentUser ? '#fef9f0' : 'white',
                      borderRadius: '12px',
                      border: `1px solid ${isCurrentUser ? '#fed7aa' : '#f1f5f9'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: '500' }}>
                            <span style={{ color: isCurrentUser ? '#dc2626' : '#0f172a' }}>
                              {getMemberName(t.from)}
                            </span>
                            {' → '}
                            <span style={{ color: '#16a34a' }}>
                              {getMemberName(t.to)}
                            </span>
                          </p>
                          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                            {isCurrentUser ? 'You need to pay' : 'Needs to pay you'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '18px', fontWeight: '700' }}>
                            {t.amount.toFixed(2)}
                          </p>
                          {isCurrentUser && (
                            <button
                              onClick={() => handleSettle(t.from, t.to, t.amount)}
                              style={{
                                marginTop: '6px', padding: '4px 12px',
                                backgroundColor: '#0f172a', color: 'white',
                                border: 'none', borderRadius: '99px',
                                fontSize: '12px', cursor: 'pointer',
                              }}
                            >
                              Mark settled
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
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
    </div>
  )
}