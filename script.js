// ---- CHECK AUTH ----
async function checkAuth() {
  const { data: { session } } = await db.auth.getSession()
  if (!session) {
    window.location.href = 'login.html'
    return null
  }
  return session
}

// ---- INIT APP ----
async function initApp() {
  const session = await checkAuth()
  if (!session) return

  const userId = session.user.id

  // Load profile from Supabase
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) {
    window.location.href = 'setup.html'
    return
  }

  // Load categories from Supabase
  const { data: cats } = await db
    .from('categories')
    .select('*')
    .eq('user_id', userId)

  if (cats && cats.length > 0) {
    allCategories = cats.map(function(c) {
      return { name: c.name, color: c.color, budget: c.budget }
    })
  }

  // Load transactions from Supabase
  const { data: txns } = await db
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

 // Only overwrite localStorage if Supabase has data
  if (txns && txns.length > 0) {
    localStorage.setItem('bw_transactions', JSON.stringify(txns.map(function(t) {
      return {
        id:          t.id,
        description: t.description,
        amount:      t.amount,
        category:    t.category,
        catColor:    t.cat_color,
        paymentMode: t.payment_mode,
        date:        t.date,
        dateDisplay: t.date_display
      }
    })))
  }

  // Load goals from Supabase
  const { data: goalData } = await db
    .from('goals')
    .select('*')
    .eq('user_id', userId)

  if (goalData) {
    localStorage.setItem('bw_goals_list', JSON.stringify(goalData.map(function(g) {
      return {
        id:       g.id.toString(),
        name:     g.name,
        target:   g.target,
        saved:    g.saved,
        deadline: g.deadline,
        color:    g.color,
        contributions: []
      }
    })))
  }

  // Set localStorage from profile
  localStorage.setItem('bw_name',   profile.name)
  localStorage.setItem('bw_budget', profile.budget)
  localStorage.setItem('bw_income', profile.income)
  localStorage.setItem('bw_setupDone', 'true')

  // Now run the rest of the dashboard
  runDashboard()
}

initApp()

// ---- LOAD USER DATA ----
const userName       = localStorage.getItem('bw_name') || 'there'
const DEFAULT_BUDGET = parseInt(localStorage.getItem('bw_budget')) || 15000
const userIncome     = parseInt(localStorage.getItem('bw_income')) || 0
let totalSpent       = 0

let allCategories = JSON.parse(localStorage.getItem('bw_categories') || '[]')
if (allCategories.length === 0) {
  allCategories = [
    { name: "Food & Dining",    color: "#FF8C42" },
    { name: "Transport",        color: "#3B82F6" },
    { name: "Rent & Utilities", color: "#F43F5E" },
    { name: "Going Out",        color: "#A78BFA" },
    { name: "Subscriptions",    color: "#F59E0B" },
    { name: "Shopping",         color: "#22C55E" },
    { name: "Health",           color: "#F43F5E" },
    { name: "Entertainment",    color: "#A78BFA" }
  ]
}

const categoryTotals = {}
allCategories.forEach(function(cat) {
  categoryTotals[cat.name] = 0
})

// ---- MONTH & YEAR DATA ----
const months = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
]
const years = [2024, 2025, 2026, 2027, 2028]
let currentMonth = new Date().getMonth()
let currentYear  = new Date().getFullYear()
let liveChartData = {}

// ---- GET MONTH BUDGET ----
function getMonthBudget(month, year) {
  const key      = 'bw_budget_' + year + '_' + month
  const override = localStorage.getItem(key)
  return override ? parseInt(override) : DEFAULT_BUDGET
}

// ---- BUILD CHART DATA ----
function buildChartData() {
  const transactions = JSON.parse(localStorage.getItem('bw_transactions') || '[]')
  const now = new Date()

  // Weekly — last 7 days
  const weekBars   = [0, 0, 0, 0, 0, 0, 0]
  const weekLabels = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    weekLabels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))
  }
  transactions.forEach(function(t) {
    const tDate   = new Date(t.date + 'T00:00:00')
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tDay    = new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate())
    const diff    = Math.round((nowDate - tDay) / (1000 * 60 * 60 * 24))
    if (diff >= 0 && diff <= 6) weekBars[6 - diff] += t.amount
  })

  // Monthly — 4 weeks of selected month
  const monthBars   = [0, 0, 0, 0]
  const monthLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
  transactions.forEach(function(t) {
    const tDate = new Date(t.date + 'T00:00:00')
    if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
      const week = Math.min(Math.floor((tDate.getDate() - 1) / 7), 3)
      monthBars[week] += t.amount
    }
  })

  // Yearly — by quarter
  const yearBars   = [0, 0, 0, 0]
  const yearLabels = ['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec']
  transactions.forEach(function(t) {
    const tDate = new Date(t.date + 'T00:00:00')
    if (tDate.getFullYear() === currentYear) {
      yearBars[Math.floor(tDate.getMonth() / 3)] += t.amount
    }
  })

  function normalize(bars) {
    const max = Math.max(...bars, 1)
    return bars.map(function(b) {
      if (b === 0) return 4
      return Math.max(Math.round((b / max) * 180), 8)
    })
  }

  return {
    weekly:  { bars: normalize(weekBars),  labels: weekLabels,  raw: weekBars  },
    monthly: { bars: normalize(monthBars), labels: monthLabels, raw: monthBars },
    yearly:  { bars: normalize(yearBars),  labels: yearLabels,  raw: yearBars  }
  }
}

// ---- GREETING ----
function setGreeting() {
  const hour     = new Date().getHours()
  const firstName = userName.split(' ')[0]
  let greeting   = 'Good morning'
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon'
  else if (hour >= 17)          greeting = 'Good evening'
  document.getElementById('greeting').textContent       = greeting + ', ' + firstName
  document.getElementById('sidebarWelcome').textContent = 'Welcome, ' + firstName
}

// ---- UPDATE CARDS ----
function updateCards(newTotal, budget) {
  budget = budget || getMonthBudget(currentMonth, currentYear)
  const remaining   = budget - newTotal
  const percentUsed = (newTotal / budget) * 100

  document.getElementById('totalSpent').textContent = '₹' + newTotal.toLocaleString('en-IN')

  const remainingEl = document.getElementById('remaining')
  remainingEl.textContent = '₹' + remaining.toLocaleString('en-IN')
  document.getElementById('remainingPercent').textContent =
    Math.round((remaining / budget) * 100) + '% of budget left'

  remainingEl.classList.toggle('danger', remaining / budget < 0.2)

  const progressBar = document.getElementById('progressBar')
  progressBar.style.width = Math.min(percentUsed, 100) + '%'
  progressBar.classList.toggle('danger', percentUsed >= 80)
}

// ---- GET MONTH TRANSACTIONS ----
function getMonthTransactions() {
  return JSON.parse(localStorage.getItem('bw_transactions') || '[]')
    .filter(function(t) {
      const td = new Date(t.date + 'T00:00:00')
      return td.getMonth() === currentMonth && td.getFullYear() === currentYear
    })
}

// ---- REFRESH DASHBOARD ----
function refreshDashboard() {
  const monthTx    = getMonthTransactions()
  const BUDGET     = getMonthBudget(currentMonth, currentYear)
  let monthSpent   = 0
  const monthCatTotals = {}
  allCategories.forEach(function(cat) { monthCatTotals[cat.name] = 0 })

  monthTx.forEach(function(t) {
    monthSpent += t.amount
    monthCatTotals[t.category] = (monthCatTotals[t.category] || 0) + t.amount
  })

  updateCards(monthSpent, BUDGET)
  document.getElementById('budgetDisplay').textContent = BUDGET.toLocaleString('en-IN')

  // Top category
  let topCat = '', topAmount = 0
  for (const cat in monthCatTotals) {
    if (monthCatTotals[cat] > topAmount) {
      topAmount = monthCatTotals[cat]
      topCat    = cat
    }
  }
  if (topCat && topAmount > 0) {
    document.getElementById('topCategory').textContent = topCat
    document.getElementById('topCategoryAmount').textContent =
      '₹' + topAmount.toLocaleString('en-IN') + ' this month'
  } else {
    document.getElementById('topCategory').textContent       = '—'
    document.getElementById('topCategoryAmount').textContent = 'No expenses yet'
  }

  // Saved so far
  const catBudgetsData = JSON.parse(localStorage.getItem('bw_categoryBudgets') || '{}')
  const hasExpenses    = monthTx.length > 0
  let savedSoFar       = 0
  if (hasExpenses) {
    allCategories.forEach(function(cat) {
      const budget = catBudgetsData[cat.name] ? (catBudgetsData[cat.name].budget || 0) : 0
      const spent  = monthCatTotals[cat.name] || 0
      if (budget - spent > 0) savedSoFar += budget - spent
    })
  }
  document.querySelector('.card:last-child h2').textContent =
    '₹' + savedSoFar.toLocaleString('en-IN')

  // Chart label
  document.getElementById('chartMonthLabel').textContent =
    months[currentMonth] + ' ' + currentYear

  // Recent activity
  const transactionList = document.getElementById('transactionList')
  transactionList.innerHTML = ''
  const recentFive = monthTx.slice(0, 5)
  if (recentFive.length === 0) {
    transactionList.innerHTML =
      '<p style="color:#9CA3AF;font-size:13px;text-align:center;padding:16px">No transactions this month</p>'
  } else {
    recentFive.forEach(function(t) {
      const row = document.createElement('div')
      row.classList.add('transaction-row')
      row.innerHTML = `
        <span class="dot" style="background: ${t.catColor}"></span>
        <div class="t-info">
          <p class="t-name">${t.description}</p>
          <p class="t-date">${t.dateDisplay} · ${t.paymentMode} · ${t.category}</p>
        </div>
        <span class="t-amount">-₹${t.amount.toLocaleString('en-IN')}</span>
      `
      transactionList.appendChild(row)
    })
  }

  // Rebuild charts
  liveChartData = buildChartData()
  const activeTab = document.querySelector('.tab.active-tab')
  if (activeTab) {
    const period =
      activeTab.textContent.trim().toLowerCase() === 'weekly'  ? 'weekly'  :
      activeTab.textContent.trim().toLowerCase() === 'monthly' ? 'monthly' : 'yearly'
    changeTab(period, activeTab)
  }
}

// ---- MONTH DISPLAY ----
function updateMonthDisplay() {
  document.getElementById('monthDisplay').childNodes[0].textContent =
    months[currentMonth] + ' ' + currentYear + ' '

  document.querySelectorAll('.month-option').forEach(function(opt, i) {
    opt.classList.toggle('active-month', i === currentMonth)
  })
  document.querySelectorAll('.year-option').forEach(function(opt) {
    opt.classList.toggle('active-month', parseInt(opt.textContent) === currentYear)
  })

  refreshDashboard()
}

function changeMonth(direction) {
  currentMonth += direction
  if (currentMonth < 0)  { currentMonth = 11; currentYear -= 1 }
  if (currentMonth > 11) { currentMonth = 0;  currentYear += 1 }
  updateMonthDisplay()
}

function toggleMonthDropdown() {
  document.getElementById('monthDropdown').classList.toggle('open')
  document.getElementById('yearDropdown').classList.remove('open')
}

function toggleYearDropdown(e) {
  e.stopPropagation()
  document.getElementById('yearDropdown').classList.toggle('open')
  document.getElementById('monthDropdown').classList.remove('open')
}

function selectMonth(index) {
  currentMonth = index
  updateMonthDisplay()
  document.getElementById('monthDropdown').classList.remove('open')
}

function selectYear(year) {
  currentYear = year
  updateMonthDisplay()
  document.getElementById('yearDropdown').classList.remove('open')
}

document.addEventListener('click', function(e) {
  const display = document.getElementById('monthDisplay')
  if (display && !display.contains(e.target)) {
    document.getElementById('monthDropdown').classList.remove('open')
    document.getElementById('yearDropdown').classList.remove('open')
  }
})

// ---- TAB SWITCHING ----
function changeTab(period, clickedButton) {
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.classList.remove('active-tab')
  })
  clickedButton.classList.add('active-tab')

  const data = liveChartData[period]
  if (!data) return

  const bars      = document.querySelectorAll('.bar')
  const labels    = document.querySelectorAll('.bar-label')
  const barGroups = document.querySelectorAll('.bar-group')
  const count     = data.bars.length

  barGroups.forEach(function(g, i) {
    g.style.display = i < count ? 'flex' : 'none'
  })
  for (let i = 0; i < count; i++) {
    if (bars[i])   bars[i].style.height  = (data.bars[i] || 0) + 'px'
    if (labels[i]) labels[i].textContent = data.labels[i]
  }

  buildYAxis(data)
  addBarTooltips(data)
}

// ---- Y AXIS ----
function buildYAxis(data) {
  const yAxis = document.getElementById('yAxis')
  if (!yAxis) return

  const activeTab = document.querySelector('.tab.active-tab')
  const period    = activeTab
    ? activeTab.textContent.trim().toLowerCase() === 'weekly'  ? 'weekly'
    : activeTab.textContent.trim().toLowerCase() === 'monthly' ? 'monthly'
    : 'yearly'
    : 'monthly'

  const rawBars = liveChartData[period] ? (liveChartData[period].raw || []) : []
  const maxVal  = Math.max(...rawBars, 1)

  yAxis.innerHTML = ''
  const steps = [maxVal, Math.round(maxVal * 0.75), Math.round(maxVal * 0.5), Math.round(maxVal * 0.25), 0]
  steps.forEach(function(val) {
    const lbl = document.createElement('div')
    lbl.classList.add('y-axis-label')
    lbl.textContent = val >= 1000
      ? '₹' + (val / 1000).toFixed(1) + 'k'
      : '₹' + val
    yAxis.appendChild(lbl)
  })
}

// ---- TOOLTIPS ----
function addBarTooltips(data) {
  const barGroups = document.querySelectorAll('.bar-group')
  const tooltip   = document.getElementById('chartTooltip')
  if (!tooltip) return

  const activeTab = document.querySelector('.tab.active-tab')
  const period    = activeTab
    ? activeTab.textContent.trim().toLowerCase() === 'weekly'  ? 'weekly'
    : activeTab.textContent.trim().toLowerCase() === 'monthly' ? 'monthly'
    : 'yearly'
    : 'monthly'

  const rawData = liveChartData[period] ? (liveChartData[period].raw || []) : []

  barGroups.forEach(function(group, i) {
    if (i >= data.bars.length) return
    const rawVal = rawData[i] || 0
    const label  = data.labels[i] || ''

    group.addEventListener('mouseenter', function() {
      tooltip.textContent = label + ': ₹' + rawVal.toLocaleString('en-IN')
      tooltip.classList.add('visible')
    })
    group.addEventListener('mousemove', function(e) {
      const chartCard = document.querySelector('.chart-card.large')
      const rect      = chartCard.getBoundingClientRect()
      tooltip.style.left = (e.clientX - rect.left + 12) + 'px'
      tooltip.style.top  = (e.clientY - rect.top  - 36) + 'px'
    })
    group.addEventListener('mouseleave', function() {
      tooltip.classList.remove('visible')
    })
  })
}

// ---- MODAL ----
function openModal() {
  document.getElementById('modalOverlay').classList.add('open')
  document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0]
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open')
  document.getElementById('expenseAmount').value      = ''
  document.getElementById('expenseCategory').value    = ''
  document.getElementById('expenseDescription').value = ''
  document.getElementById('expenseDate').value        = ''
  const allPills = document.querySelectorAll('.pill')
  allPills.forEach(function(p) { p.classList.remove('active-pill') })
  allPills[0].classList.add('active-pill')
}

function selectPayment(clickedPill) {
  document.querySelectorAll('.pill').forEach(function(p) { p.classList.remove('active-pill') })
  clickedPill.classList.add('active-pill')
}

// ---- SAVE EXPENSE ----
async function saveExpense() {
  document.getElementById('saveExpenseBtn').textContent = 'Saving...'
  document.getElementById('saveExpenseBtn').disabled = true
  const amount       = parseInt(document.getElementById('expenseAmount').value)
  const category     = document.getElementById('expenseCategory').value
  const description  = document.getElementById('expenseDescription').value
  const selectedDate = document.getElementById('expenseDate').value

  if (!amount || !category || !description) {
    alert('Please fill in all fields!')
    return
  }

  const activePill  = document.querySelector('.pill.active-pill')
  const paymentMode = activePill ? activePill.textContent : 'Cash'
  const catData     = allCategories.find(function(c) { return c.name === category })
  const catColor    = catData ? catData.color : '#FF8C42'
  const dateObj     = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date()

  const transaction = {
    id:          new Date().getTime(),
    description: description,
    amount:      amount,
    category:    category,
    cat_color:    catColor,
    paymentMode: paymentMode,
    date:        selectedDate || new Date().toISOString().split('T')[0],
    dateDisplay: dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  // Save to localStorage first — always works
  const existing = JSON.parse(localStorage.getItem('bw_transactions') || '[]')
  existing.unshift(transaction)
  localStorage.setItem('bw_transactions', JSON.stringify(existing))

  // Try saving to Supabase — don't block UI if it fails
  try {
    const { data: authData } = await db.auth.getSession()
    const session = authData ? authData.session : null
    if (session) {
      const { data, error } = await db.from('transactions').insert({
        user_id:      session.user.id,
        description:  description,
        amount:       amount,
        category:     category,
        cat_color:    catColor,        
        payment_mode: paymentMode,
        date:         transaction.date,
        date_display: transaction.dateDisplay
      })
      console.log('Supabase insert result:', data, error)
    } else {
      console.log('No session found')
    }
  } catch (err) {
    console.log('Supabase save failed:', err)
  }

  // Always refresh dashboard regardless
  refreshDashboard()
  document.getElementById('saveExpenseBtn').textContent = 'Save Expense'
  document.getElementById('saveExpenseBtn').disabled = false
  closeModal()
}

// ---- POPULATE DROPDOWNS ----
function populateCategoryDropdown() {
  const select = document.getElementById('expenseCategory')
  select.innerHTML = '<option value="">Select a category</option>'
  allCategories.forEach(function(cat) {
    const opt = document.createElement('option')
    opt.value = opt.textContent = cat.name
    select.appendChild(opt)
  })
}

function buildYearDropdown() {
  const container = document.getElementById('yearDropdown')
  container.innerHTML = ''
  years.forEach(function(year) {
    const div = document.createElement('div')
    div.classList.add('year-option', 'month-option')
    if (year === currentYear) div.classList.add('active-month')
    div.textContent = year
    div.onclick = function(e) { e.stopPropagation(); selectYear(year) }
    container.appendChild(div)
  })
}

// ---- BUDGET MODAL ----
function openBudgetModal() {
  const monthName = months[currentMonth] + ' ' + currentYear
  document.getElementById('budgetModalTitle').textContent     = 'Edit Budget'
  document.getElementById('budgetModalLabel').textContent     = 'Budget for ' + monthName + ' (₹)'
  document.getElementById('defaultBudgetDisplay').textContent = DEFAULT_BUDGET.toLocaleString('en-IN')
  const current = getMonthBudget(currentMonth, currentYear)
  document.getElementById('budgetModalInput').value = current
  document.getElementById('budgetModal').classList.add('open')
}

function closeBudgetModal() {
  document.getElementById('budgetModal').classList.remove('open')
}

function saveMonthBudget() {
  const val = parseInt(document.getElementById('budgetModalInput').value)
  if (!val || val <= 0) {
    alert('Please enter a valid budget!')
    return
  }
  const key = 'bw_budget_' + currentYear + '_' + currentMonth
  localStorage.setItem(key, val)
  closeBudgetModal()
  refreshDashboard()
}

function resetMonthBudget() {
  const key = 'bw_budget_' + currentYear + '_' + currentMonth
  localStorage.removeItem(key)
  closeBudgetModal()
  refreshDashboard()
}

// ---- RUN ON LOAD ----
function runDashboard() {
  currentMonth = new Date().getMonth()   
  currentYear  = new Date().getFullYear()
  setGreeting()
  buildYearDropdown()
  populateCategoryDropdown()

  const savedTransactions = JSON.parse(localStorage.getItem('bw_transactions') || '[]')
  savedTransactions.forEach(function(t) {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount
  })

  const goalsList = JSON.parse(localStorage.getItem('bw_goals_list') || '[]')
  const totalGoalTarget = goalsList.reduce(function(s, g) { return s + g.target }, 0)
  document.getElementById('goalDisplay').textContent =
    totalGoalTarget > 0 ? totalGoalTarget.toLocaleString('en-IN') : 'Not set'
  document.getElementById('budgetDisplay').textContent =
    getMonthBudget(currentMonth, currentYear).toLocaleString('en-IN')

  liveChartData = buildChartData()
  updateMonthDisplay()
}