// ─────────────────────────────────────────────
// splitCalculator.js
// All debt math lives here — pure functions,
// no Supabase calls, easy to test independently
// ─────────────────────────────────────────────

/**
 * Calculate equal split amounts for an expense.
 * Handles rounding — remainder goes to the first person
 * so total always equals the original amount exactly.
 *
 * @param {number} amount - Total expense amount
 * @param {string} paidBy - User ID of who paid
 * @param {string[]} memberIds - All member IDs including payer
 * @returns {Object[]} Array of { userId, amountOwed }
 */
export function calculateEqualSplit(amount, paidBy, memberIds) {
  const count     = memberIds.length
  const base      = Math.floor((amount / count) * 100) / 100  // round down to 2dp
  const remainder = parseFloat((amount - base * count).toFixed(2))

  return memberIds.map((userId, index) => ({
    userId,
    // First person absorbs the rounding remainder
    amountOwed: index === 0
      ? parseFloat((base + remainder).toFixed(2))
      : base,
    // Payer owes nothing to themselves — already settled
    isSettled: userId === paidBy,
  }))
}

/**
 * Validate a custom split.
 * Checks that all custom amounts sum to the total expense amount.
 *
 * @param {number} total - Total expense amount
 * @param {Object[]} splits - Array of { userId, amountOwed }
 * @returns {{ valid: boolean, diff: number }}
 */
export function validateCustomSplit(total, splits) {
  const sum  = splits.reduce((acc, s) => acc + parseFloat(s.amountOwed || 0), 0)
  const diff = parseFloat((total - sum).toFixed(2))
  return { valid: diff === 0, diff }
}

/**
 * Calculate net balance per user across all unsettled splits.
 * Positive = they are owed money
 * Negative = they owe money
 *
 * @param {Object[]} splits - expense_splits rows with expense joined
 * @returns {Object} { userId: netAmount }
 */
export function getNetBalances(splits) {
  const balance = {}

  splits.forEach(split => {
    const paidBy = split.expenses?.paid_by
    const owedBy = split.user_id
    const amount = parseFloat(split.amount_owed)

    if (!paidBy || split.is_settled) return

    // Payer is owed this amount
    balance[paidBy] = (balance[paidBy] || 0) + amount
    // Person who owes subtracts it
    balance[owedBy] = (balance[owedBy] || 0) - amount
  })

  return balance
}

/**
 * Simplify debts using a greedy algorithm.
 * Reduces the number of transactions needed to settle up.
 * e.g. A owes B €10, B owes C €10 → becomes A owes C €10
 *
 * @param {Object} balances - { userId: netAmount } from getNetBalances
 * @returns {Object[]} Array of { from, to, amount }
 */
export function simplifyDebts(balances) {
  // Split into creditors (owed money) and debtors (owe money)
  const creditors = []
  const debtors   = []

  Object.entries(balances).forEach(([id, amt]) => {
    if (amt > 0.01)       creditors.push({ id, amt })
    else if (amt < -0.01) debtors.push({ id, amt: Math.abs(amt) })
  })

  const transactions = []
  let i = 0
  let j = 0

  while (i < creditors.length && j < debtors.length) {
    const pay = Math.min(creditors[i].amt, debtors[j].amt)

    transactions.push({
      from:   debtors[j].id,
      to:     creditors[i].id,
      amount: parseFloat(pay.toFixed(2)),
    })

    creditors[i].amt -= pay
    debtors[j].amt   -= pay

    // Move to next creditor/debtor when fully settled
    if (creditors[i].amt < 0.01) i++
    if (debtors[j].amt < 0.01)   j++
  }

  return transactions
}