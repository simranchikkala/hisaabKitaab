// ---- CHECK AUTH ----
async function checkAuth() {
  const { data: { session } } = await db.auth.getSession()
  if (!session) {
    window.location.href = 'login.html'
    return null
  }
  return session
}

checkAuth()

async function loadDataFromSupabase() {
  try {
    const { data: authData } = await db.auth.getSession()
    const session = authData ? authData.session : null
    if (!session) return

    const userId = session.user.id

    const [{ data: txns }, { data: cats }] = await Promise.all([
      db.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
      db.from('categories').select('*').eq('user_id', userId)
    ])

    if (txns && txns.length > 0) {
      localStorage.setItem('bw_transactions', JSON.stringify(
        txns.map(function(t) {
          return {
            id: t.id, description: t.description,
            amount: t.amount, category: t.category,
            catColor: t.cat_color, paymentMode: t.payment_mode,
            date: t.date, dateDisplay: t.date_display
          }
        })
      ))
    }

    if (cats && cats.length > 0) {
      localStorage.setItem('bw_categories', JSON.stringify(
        cats.map(function(c) {
          return { name: c.name, color: c.color, budget: c.budget }
        })
      ))
      const catBudgets = {}
      cats.forEach(function(c) {
        catBudgets[c.name] = { budget: c.budget, color: c.color }
      })
      localStorage.setItem('bw_categoryBudgets', JSON.stringify(catBudgets))
    }
  } catch (err) {
    console.log('Supabase load error:', err)
  }
}

// ---- LOAD DATA ----
const userName      = localStorage.getItem('bw_name') || 'there'
const allCategories = JSON.parse(localStorage.getItem('bw_categories') || '[]')
const catBudgets    = JSON.parse(localStorage.getItem('bw_categoryBudgets') || '{}')
let allTransactions = JSON.parse(localStorage.getItem('bw_transactions') || '[]')

document.getElementById('sidebarWelcome').textContent = 'Welcome, ' + userName.split(' ')[0]

let currentRange = 'month'

// ---- FILTER BY RANGE ----
function filterByRange(range) {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return allTransactions.filter(function(t) {
    const tDate = new Date(t.date + 'T00:00:00')
    if (range === 'month') {
      return tDate.getMonth()    === today.getMonth() &&
             tDate.getFullYear() === today.getFullYear()
    }
    if (range === '3months') {
      const ago = new Date(today)
      ago.setMonth(today.getMonth() - 3)
      return tDate >= ago
    }
    return true
  })
}

// ---- SET RANGE ----
function setRange(range, btn) {
  currentRange = range
  document.querySelectorAll('.topbar-right .tab').forEach(function(t) {
    t.classList.remove('active-tab')
  })
  btn.classList.add('active-tab')
  renderAll()
}

// ---- CALCULATE SAVINGS ----
// Formula: category budget - actual spent = saved per category
// Total saved = sum of all positive differences
function calcSavings(transactions) {
  const catSpent = {}
  transactions.forEach(function(t) {
    catSpent[t.category] = (catSpent[t.category] || 0) + t.amount
  })

  const results = []
  let totalLimit   = 0
  let totalSpent   = 0
  let totalSaved   = 0

  allCategories.forEach(function(cat) {
    const budget = catBudgets[cat.name]
      ? (catBudgets[cat.name].budget || 0) : 0
    const spent  = catSpent[cat.name] || 0

    if (budget === 0 && spent === 0) return

    const saved = budget - spent
    totalLimit += budget
    totalSpent += spent
    if (saved > 0) totalSaved += saved

    results.push({
      name:   cat.name,
      color:  cat.color,
      budget: budget,
      spent:  spent,
      saved:  saved
    })
  })

  return { results, totalLimit, totalSpent, totalSaved }
}

// ---- RENDER ALL ----
function renderAll() {
  const transactions = filterByRange(currentRange)
  const { results, totalLimit, totalSpent, totalSaved } = calcSavings(transactions)

  // Summary strip
  const savingsRate = totalLimit > 0
    ? Math.round((totalSaved / totalLimit) * 100) : 0

  document.getElementById('totalSaved').textContent =
    '₹' + totalSaved.toLocaleString('en-IN')
  document.getElementById('totalLimit').textContent =
    '₹' + totalLimit.toLocaleString('en-IN')
  document.getElementById('totalSpentSavings').textContent =
    '₹' + totalSpent.toLocaleString('en-IN')
  document.getElementById('savingsRate').textContent =
    savingsRate + '%'

  const savedEl = document.getElementById('totalSaved')
  savedEl.classList.toggle('positive', totalSaved > 0)
  savedEl.classList.toggle('negative', totalSaved < 0)

  renderCatSavings(results)
  renderTrend()
  renderTips(results, totalSaved, totalLimit)
}

// ---- CATEGORY SAVINGS ----
function renderCatSavings(results) {
  const list = document.getElementById('catSavingsList')
  list.innerHTML = ''

  if (results.length === 0) {
    list.innerHTML = '<p style="color:#9CA3AF;font-size:13px;text-align:center;padding:20px">No data for this period</p>'
    return
  }

  // Sort — biggest savers first
  results.sort(function(a, b) { return b.saved - a.saved })

  const maxAbs = Math.max(...results.map(function(r) {
    return Math.abs(r.saved)
  }), 1)

  results.forEach(function(r) {
    const isPositive = r.saved >= 0
    const barPct     = Math.min((Math.abs(r.saved) / maxAbs) * 100, 100)

    const row = document.createElement('div')
    row.classList.add('cat-savings-row')
    row.innerHTML = `
      <div class="cat-savings-top">
        <div class="cat-savings-name">
          <div style="width:10px;height:10px;border-radius:50%;background:${r.color}"></div>
          ${r.name}
        </div>
        <div class="cat-savings-amounts">
          <span style="color:#6B7280">
            ₹${r.budget.toLocaleString('en-IN')} budget —
            ₹${r.spent.toLocaleString('en-IN')} spent =
          </span>
          <span class="saved-amount ${isPositive ? 'positive' : 'negative'}">
            ${isPositive ? '+' : ''}₹${r.saved.toLocaleString('en-IN')}
          </span>
        </div>
      </div>
      <div class="cat-savings-bar-bg">
        <div class="cat-savings-bar-fill ${isPositive ? 'positive' : 'negative'}"
          style="width: ${barPct}%">
        </div>
      </div>
    `
    list.appendChild(row)
  })
}

// ---- SAVINGS TREND ----
function renderTrend() {
  const now        = new Date()
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun',
                      'Jul','Aug','Sep','Oct','Nov','Dec']
  const count      = 6
  const months     = []
  const labels     = []

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() })
    labels.push(monthNames[d.getMonth()])
  }

  const monthlySavings = months.map(function(m) {
    const monthTx = allTransactions.filter(function(t) {
      const td = new Date(t.date + 'T00:00:00')
      return td.getFullYear() === m.year && td.getMonth() === m.month
    })
    const { totalSaved } = calcSavings(monthTx)
    return totalSaved
  })

  const maxVal = Math.max(...monthlySavings.map(Math.abs), 1)
  const chart  = document.getElementById('savingsTrend')
  const lbls   = document.getElementById('savingsTrendLabels')
  chart.innerHTML = ''
  lbls.innerHTML  = ''

  monthlySavings.forEach(function(val, i) {
    const height = Math.max(Math.round((Math.abs(val) / maxVal) * 90), 4)
    const isPos  = val >= 0

    const group = document.createElement('div')
    group.classList.add('trend-bar-group')
    group.innerHTML = `
      <div class="trend-bar ${isPos ? 'savings-positive' : 'savings-negative'}"
        style="height: ${height}px"
        title="${isPos ? '+' : ''}₹${val.toLocaleString('en-IN')}">
      </div>
    `
    chart.appendChild(group)

    const lbl = document.createElement('div')
    lbl.classList.add('trend-label')
    lbl.textContent = labels[i]
    lbls.appendChild(lbl)
  })
}

// ---- SAVINGS TIPS ----
function renderTips(results, totalSaved, totalLimit) {
  const tips = []
  const list = document.getElementById('savingsTips')
  list.innerHTML = ''

  // Tip 1 — overall rate
  if (totalLimit > 0) {
    const rate = Math.round((totalSaved / totalLimit) * 100)
    if (rate >= 20) {
      tips.push({
        type: 'good',
        title: 'Great savings rate of ' + rate + '%',
        desc: 'You are saving more than 20% of your category budgets — keep it up!'
      })
    } else if (rate > 0) {
      tips.push({
        type: 'warning',
        title: 'Savings rate is ' + rate + '%',
        desc: 'Try to save at least 20% of your budget. Small cuts add up fast.'
      })
    }
  }

  // Tip 2 — biggest overspend
  const overspent = results.filter(function(r) { return r.saved < 0 })
    .sort(function(a, b) { return a.saved - b.saved })
  if (overspent.length > 0) {
    const worst = overspent[0]
    tips.push({
      type: 'warning',
      title: 'Cut back on ' + worst.name,
      desc: 'You overspent by ₹' + Math.abs(worst.saved).toLocaleString('en-IN') +
            ' in ' + worst.name + '. Reducing this would boost your savings directly.'
    })
  }

  // Tip 3 — biggest saver
  const savers = results.filter(function(r) { return r.saved > 0 })
    .sort(function(a, b) { return b.saved - a.saved })
  if (savers.length > 0) {
    tips.push({
      type: 'good',
      title: savers[0].name + ' is your best category',
      desc: 'You saved ₹' + savers[0].saved.toLocaleString('en-IN') +
            ' under budget here. Maintain this habit!'
    })
  }

  // Tip 4 — no budget set
  const noBudget = results.filter(function(r) { return r.budget === 0 && r.spent > 0 })
  if (noBudget.length > 0) {
    tips.push({
      type: 'warning',
      title: 'Set budgets for ' + noBudget.length + ' categories',
      desc: noBudget.map(function(r) { return r.name }).join(', ') +
            ' have no budget set. Adding limits will help track savings.'
    })
  }

  if (tips.length === 0) {
    tips.push({
      type: 'good',
      title: 'Start tracking to see tips',
      desc: 'Add expenses and set category budgets to get personalised saving tips.'
    })
  }

  tips.forEach(function(tip, i) {
    const item = document.createElement('div')
    item.classList.add('tip-item', tip.type)
    item.innerHTML = `
      <div class="tip-number">${i + 1}</div>
      <div class="tip-content">
        <p>${tip.title}</p>
        <span>${tip.desc}</span>
      </div>
    `
    list.appendChild(item)
  })
}

// ---- INIT ----
loadDataFromSupabase().then(function() {
  allTransactions = JSON.parse(localStorage.getItem('bw_transactions') || '[]')
  renderAll()
})