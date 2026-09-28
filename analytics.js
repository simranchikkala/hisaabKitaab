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
const BUDGET        = parseInt(localStorage.getItem('bw_budget')) || 15000
const allCategories = JSON.parse(localStorage.getItem('bw_categories') || '[]')
const catBudgets    = JSON.parse(localStorage.getItem('bw_categoryBudgets') || '{}')
let allTransactions = JSON.parse(localStorage.getItem('bw_transactions') || '[]')

document.getElementById('sidebarWelcome').textContent = 'Welcome, ' + userName.split(' ')[0]

let currentRange    = 'month'
let currentCatChart = 'pie'
let hiddenCategories = new Set()

// ---- FILTER BY TIME RANGE ----
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
      const threeMonthsAgo = new Date(today)
      threeMonthsAgo.setMonth(today.getMonth() - 3)
      return tDate >= threeMonthsAgo
    }
    return true // all time
  })
}

// ---- SET TIME RANGE ----
function setTimeRange(range, btn) {
  currentRange = range
  document.querySelectorAll('.topbar-right .tab').forEach(function(t) {
    t.classList.remove('active-tab')
  })
  btn.classList.add('active-tab')
  renderAll()
}

// ---- SET CATEGORY CHART TYPE ----
function setCatChart(type, btn) {
  currentCatChart = type
  document.querySelectorAll('.small-tabs .tab').forEach(function(t) {
    t.classList.remove('active-tab')
  })
  btn.classList.add('active-tab')

  document.getElementById('pieChartContainer').style.display =
    type === 'pie' ? 'block' : 'none'
  document.getElementById('barChartContainer').style.display =
    type === 'bar' ? 'block' : 'none'
  document.getElementById('pieCategoryToggles').style.display =
    type === 'pie' ? 'flex' : 'none'

  renderCategoryChart(filterByRange(currentRange))
}

// ---- TOGGLE CATEGORY IN PIE ----
function togglePieCategory(cat, btn) {
  if (hiddenCategories.has(cat)) {
    hiddenCategories.delete(cat)
    btn.classList.remove('toggle-hidden')
  } else {
    hiddenCategories.add(cat)
    btn.classList.add('toggle-hidden')
  }
  renderCategoryChart(filterByRange(currentRange))
}

// ---- BUILD CATEGORY TOGGLES ----
function buildCategoryToggles(catTotals) {
  const container = document.getElementById('pieCategoryToggles')
  container.innerHTML = ''

  function getCatColor(name) {
    const cat = allCategories.find(function(c) { return c.name === name })
    return cat ? cat.color : '#FF8C42'
  }

  const sorted = Object.keys(catTotals).sort(function(a, b) {
    return catTotals[b] - catTotals[a]
  })

  sorted.forEach(function(cat) {
    const color  = getCatColor(cat)
    const isHidden = hiddenCategories.has(cat)
    const btn    = document.createElement('button')
    btn.classList.add('pie-toggle-btn')
    if (isHidden) btn.classList.add('toggle-hidden')
    btn.innerHTML = `<span class="pie-toggle-dot" style="background:${color}"></span>${cat}`
    btn.onclick = function() { togglePieCategory(cat, btn) }
    container.appendChild(btn)
  })
}

// ---- RENDER ALL ----
function renderAll() {
  const data = filterByRange(currentRange)
  renderStatCards(data)
  renderCategoryChart(data)
  renderTrendChart()
  renderBudgetVsActual(data)
  renderInsights(data)
}

// ---- STAT CARDS ----
function renderStatCards(data) {
  const total = data.reduce(function(s, t) { return s + t.amount }, 0)

  // Daily average
  const days = currentRange === 'month'   ? 30 :
               currentRange === '3months' ? 90 : 365
  const avg = total > 0 ? Math.round(total / days) : 0

  // Biggest
  const biggest = data.reduce(function(max, t) {
    return t.amount > max.amount ? t : max
  }, { amount: 0, description: '—' })

  // Top category
  const catTotals = {}
  data.forEach(function(t) {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })
  const topCat    = Object.keys(catTotals).sort(function(a,b) {
    return catTotals[b] - catTotals[a]
  })[0] || '—'
  const topAmount = catTotals[topCat] || 0

  document.getElementById('aTotal').textContent =
    '₹' + total.toLocaleString('en-IN')
  document.getElementById('aDailyAvg').textContent =
    '₹' + avg.toLocaleString('en-IN')
  document.getElementById('aBiggest').textContent =
    '₹' + biggest.amount.toLocaleString('en-IN')
  document.getElementById('aBiggestDesc').textContent =
    biggest.description
  document.getElementById('aTopCat').textContent = topCat
  document.getElementById('aTopCatAmount').textContent =
    '₹' + topAmount.toLocaleString('en-IN') + ' total'
}

// ---- CATEGORY CHART ----
function renderCategoryChart(data) {
  const catTotals = {}
  data.forEach(function(t) {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })

  // Build toggles based on all categories (before hiding)
  buildCategoryToggles(catTotals)

  // Filter out hidden categories for pie only
  const visibleTotals = {}
  Object.keys(catTotals).forEach(function(cat) {
    if (!hiddenCategories.has(cat)) visibleTotals[cat] = catTotals[cat]
  })

  const total   = Object.values(visibleTotals).reduce(function(s, v) { return s + v }, 0)
  const sorted  = Object.keys(visibleTotals).sort(function(a, b) {
    return visibleTotals[b] - visibleTotals[a]
  })

  if (sorted.length === 0) {
    document.getElementById('pieChart').innerHTML =
      '<text x="100" y="105" text-anchor="middle" fill="#9CA3AF" font-size="14">No data</text>'
    document.getElementById('pieLegend').innerHTML = ''
    document.getElementById('hBarList').innerHTML =
      '<p class="analytics-empty">No transactions in this period</p>'
    return
  }

  // Get colors
  function getCatColor(name) {
    const cat = allCategories.find(function(c) { return c.name === name })
    return cat ? cat.color : '#FF8C42'
  }

  // PIE CHART
  const svg    = document.getElementById('pieChart')
  const legend = document.getElementById('pieLegend')
  svg.innerHTML    = ''
  legend.innerHTML = ''

  let startAngle = -Math.PI / 2
  const cx = 100
  const cy = 100
  const r  = 80

  sorted.forEach(function(cat) {
    const pct   = visibleTotals[cat] / total
    const angle = pct * 2 * Math.PI
    const end   = startAngle + angle
    const x1    = cx + r * Math.cos(startAngle)
    const y1    = cy + r * Math.sin(startAngle)
    const x2    = cx + r * Math.cos(end)
    const y2    = cy + r * Math.sin(end)
    const large = angle > Math.PI ? 1 : 0
    const color = getCatColor(cat)

    const path  = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d',
      `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`)
    path.setAttribute('fill', color)
    path.setAttribute('stroke', 'white')
    path.setAttribute('stroke-width', '2')
    svg.appendChild(path)

    // Legend item
    const item = document.createElement('div')
    item.classList.add('legend-item')
    item.innerHTML = `
      <div class="legend-dot" style="background: ${color}"></div>
      <span>${cat}</span>
      <span class="legend-pct">${Math.round(pct * 100)}%</span>
    `
    legend.appendChild(item)

    startAngle = end
  })

  // HORIZONTAL BAR CHART — uses all catTotals (not filtered)
  const allSorted = Object.keys(catTotals).sort(function(a, b) {
    return catTotals[b] - catTotals[a]
  })
  const hList  = document.getElementById('hBarList')
  hList.innerHTML = ''
  const maxVal = catTotals[allSorted[0]]

  allSorted.forEach(function(cat) {
    const pct   = (catTotals[cat] / maxVal) * 100
    const color = getCatColor(cat)
    const row   = document.createElement('div')
    row.classList.add('h-bar-row')
    row.innerHTML = `
      <div class="h-bar-top">
        <span>${cat}</span>
        <span class="h-bar-amount">₹${catTotals[cat].toLocaleString('en-IN')}</span>
      </div>
      <div class="h-bar-bg">
        <div class="h-bar-fill" style="width: ${pct}%; background: ${color}"></div>
      </div>
    `
    hList.appendChild(row)
  })
}

// ---- TREND CHART ----
function renderTrendChart() {
  const now    = new Date()
  const months = []
  const labels = []
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun',
                      'Jul','Aug','Sep','Oct','Nov','Dec']

  const count = currentRange === 'month'   ? 6 :
                currentRange === '3months' ? 3 : 12

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() })
    labels.push(monthNames[d.getMonth()])
  }

  const totals = months.map(function(m) {
    return allTransactions
      .filter(function(t) {
        const td = new Date(t.date + 'T00:00:00')
        return td.getFullYear() === m.year && td.getMonth() === m.month
      })
      .reduce(function(s, t) { return s + t.amount }, 0)
  })

  const maxVal = Math.max(...totals, 1)
  const chart  = document.getElementById('trendChart')
  const lbls   = document.getElementById('trendLabels')
  chart.innerHTML = ''
  lbls.innerHTML  = ''

  totals.forEach(function(val, i) {
    const height    = Math.max(Math.round((val / maxVal) * 130), 4)
    const isCurrent = i === totals.length - 1
    const bar       = document.createElement('div')
    bar.classList.add('trend-bar-group')
    bar.innerHTML = `
      <div class="trend-bar ${isCurrent ? 'current' : 'past'}"
        style="height: ${height}px"
        title="₹${val.toLocaleString('en-IN')}">
      </div>
    `
    chart.appendChild(bar)

    const lbl = document.createElement('div')
    lbl.classList.add('trend-label')
    lbl.textContent = labels[i]
    lbls.appendChild(lbl)
  })
}

// ---- BUDGET VS ACTUAL ----
function renderBudgetVsActual(data) {
  const catTotals = {}
  data.forEach(function(t) {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })

  const list = document.getElementById('budgetVsList')
  list.innerHTML = ''

  allCategories.forEach(function(cat) {
    const spent  = catTotals[cat.name] || 0
    const budget = catBudgets[cat.name]
      ? (catBudgets[cat.name].budget || 0)
      : 0

    if (budget === 0 && spent === 0) return

    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
    const fillClass = budget === 0 ? 'good' :
                  pct >= 100   ? 'over' :
                  pct >= 80    ? 'warning' : 'good'
    const row = document.createElement('div')
    row.classList.add('bva-row')
    row.innerHTML = `
      <div class="bva-top">
        <div class="bva-cat">
          <div style="width:10px;height:10px;border-radius:50%;background:${cat.color}"></div>
          ${cat.name}
        </div>
        <div class="bva-amounts">
          <span>₹${spent.toLocaleString('en-IN')}</span>
          ${budget > 0 ? ' / ₹' + budget.toLocaleString('en-IN') : ' (no budget set)'}
        </div>
      </div>
      <div class="bva-bar-bg">
        <div class="bva-bar-fill ${fillClass}" style="width: ${pct}%"></div>
      </div>
    `
    list.appendChild(row)
  })

  if (list.innerHTML === '') {
    list.innerHTML = '<p class="analytics-empty">Add expenses to see budget comparison</p>'
  }
}

// ---- INSIGHTS ----
function renderInsights(data) {
  const list = document.getElementById('insightsList')
  list.innerHTML = ''
  const insights = []

  if (data.length === 0) {
    list.innerHTML = '<p class="analytics-empty">Add expenses to see insights</p>'
    return
  }

  const total = data.reduce(function(s, t) { return s + t.amount }, 0)

  // Category totals
  const catTotals = {}
  data.forEach(function(t) {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })

  const sorted = Object.keys(catTotals).sort(function(a, b) {
    return catTotals[b] - catTotals[a]
  })

  // Insight 1 — top category
  if (sorted[0]) {
    const topPct = Math.round((catTotals[sorted[0]] / total) * 100)
    insights.push({
      type:  topPct > 50 ? 'warning' : 'good',
      title: sorted[0] + ' is your top spend',
      text:  topPct + '% of your total spending goes to ' +
             sorted[0] + ' — ₹' + catTotals[sorted[0]].toLocaleString('en-IN')
    })
  }

  // Insight 2 — budget check
  const remaining = BUDGET - total
  if (remaining < 0) {
    insights.push({
      type:  'danger',
      title: 'Over budget!',
      text:  'You have exceeded your monthly budget by ₹' +
             Math.abs(remaining).toLocaleString('en-IN')
    })
  } else if (remaining / BUDGET < 0.2) {
    insights.push({
      type:  'warning',
      title: 'Almost at your limit',
      text:  'Only ₹' + remaining.toLocaleString('en-IN') +
             ' left in your budget (' +
             Math.round((remaining / BUDGET) * 100) + '%)'
    })
  } else {
    insights.push({
      type:  'good',
      title: 'On track',
      text:  'You have ₹' + remaining.toLocaleString('en-IN') +
             ' remaining — ' +
             Math.round((remaining / BUDGET) * 100) + '% of budget left'
    })
  }

  // Insight 3 — category over budget
  allCategories.forEach(function(cat) {
    const spent  = catTotals[cat.name] || 0
    const budget = catBudgets[cat.name]
      ? (catBudgets[cat.name].budget || 0) : 0
    if (budget > 0 && spent > budget) {
      insights.push({
        type:  'danger',
        title: cat.name + ' over budget',
        text:  'You spent ₹' + spent.toLocaleString('en-IN') +
               ' against a budget of ₹' + budget.toLocaleString('en-IN')
      })
    }
  })

  // Insight 4 — payment mode breakdown
  const modeTotals = {}
  data.forEach(function(t) {
    modeTotals[t.paymentMode] = (modeTotals[t.paymentMode] || 0) + t.amount
  })
  const topMode = Object.keys(modeTotals).sort(function(a, b) {
    return modeTotals[b] - modeTotals[a]
  })[0]
  if (topMode) {
    const modePct = Math.round((modeTotals[topMode] / total) * 100)
    insights.push({
      type:  'good',
      title: topMode + ' is your main payment method',
      text:  modePct + '% of spending done via ' + topMode +
             ' — ₹' + modeTotals[topMode].toLocaleString('en-IN')
    })
  }

  // Render max 4 insights
  insights.slice(0, 4).forEach(function(ins) {
    const card = document.createElement('div')
    card.classList.add('insight-card', ins.type)
    card.innerHTML = `
      <p class="insight-title">${ins.title}</p>
      <p class="insight-text">${ins.text}</p>
    `
    list.appendChild(card)
  })
}

// ---- INIT ----
loadDataFromSupabase().then(function() {
  allTransactions = JSON.parse(localStorage.getItem('bw_transactions') || '[]')
  renderAll()
})