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
// ---- LOAD DATA ----
const userName      = localStorage.getItem('bw_name') || 'there'
const allCategories = JSON.parse(localStorage.getItem('bw_categories') || '[]')
let allTransactions = JSON.parse(localStorage.getItem('bw_transactions') || '[]')
let filteredData    = []
let currentPage     = 1
let currentSort = 'date-desc'
const ROWS_PER_PAGE = 10

document.getElementById('sidebarWelcome').textContent = 'Welcome, ' + userName.split(' ')[0]

// ---- BUILD CATEGORY MENU ----
function buildCategoryMenu() {
  const menu = document.getElementById('catMenu')
  allCategories.forEach(function(cat) {
    const label = document.createElement('label')
    label.classList.add('filter-menu-item')
    label.innerHTML = `
      <input type="checkbox" value="${cat.name}" onchange="applyFilters()">
      <span style="width:8px;height:8px;border-radius:50%;background:${cat.color};display:inline-block"></span>
      ${cat.name}
    `
    menu.appendChild(label)
  })
}

// ---- TOGGLE DROPDOWN MENU ----
function toggleMenu(menuId, triggerId) {
  const menu = document.getElementById(menuId)
  const allMenus = document.querySelectorAll('.filter-menu')
  allMenus.forEach(function(m) {
    if (m.id !== menuId) m.classList.remove('open')
  })
  menu.classList.toggle('open')
}

// Close menus when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.filter-dropdown')) {
    document.querySelectorAll('.filter-menu').forEach(function(m) {
      m.classList.remove('open')
    })
  }
})

// ---- GET CHECKED VALUES ----
function getChecked(menuId) {
  return Array.from(
    document.querySelectorAll('#' + menuId + ' input[type="checkbox"]:checked')
  ).map(function(cb) { return cb.value })
}

// ---- UPDATE TRIGGER BUTTON ----
function updateTrigger(triggerId, values, label) {
  const btn = document.getElementById(triggerId)
  if (values.length === 0) {
    btn.textContent = label
    btn.classList.remove('has-selection')
  } else {
    btn.textContent = label + ' (' + values.length + ')'
    btn.classList.add('has-selection')
  }
}

// ---- RENDER ACTIVE FILTER PILLS ----
function renderActivePills(cats, payments, months) {
  const container = document.getElementById('activeFilters')
  container.innerHTML = ''

  const monthNames = {
    '2026-01': 'Jan', '2026-02': 'Feb', '2026-03': 'Mar',
    '2026-04': 'Apr', '2026-05': 'May', '2026-06': 'Jun',
    '2026-07': 'Jul', '2026-08': 'Aug', '2026-09': 'Sep',
    '2026-10': 'Oct', '2026-11': 'Nov', '2026-12': 'Dec'
  }

  cats.forEach(function(c) {
    container.appendChild(makePill(c, function() {
      uncheckValue('catMenu', c)
      applyFilters()
    }))
  })

  payments.forEach(function(p) {
    container.appendChild(makePill(p, function() {
      uncheckValue('payMenu', p)
      applyFilters()
    }))
  })

  months.forEach(function(m) {
    container.appendChild(makePill(monthNames[m] + ' 2026', function() {
      uncheckValue('monthMenu', m)
      applyFilters()
    }))
  })
}

function makePill(label, onRemove) {
  const pill = document.createElement('div')
  pill.classList.add('filter-pill')
  pill.innerHTML = `${label} <button onclick="">✕</button>`
  pill.querySelector('button').addEventListener('click', onRemove)
  return pill
}

function uncheckValue(menuId, value) {
  const cb = document.querySelector(
    '#' + menuId + ' input[value="' + value + '"]'
  )
  if (cb) cb.checked = false
}

// ---- SORT ----
function setSort(sortType, clickedEl) {
  currentSort = sortType

  document.querySelectorAll('.sort-option').forEach(function(el) {
    el.classList.remove('active-sort')
  })
  clickedEl.classList.add('active-sort')

  const labels = {
    'date-desc':   'Sort: Newest First',
    'date-asc':    'Sort: Oldest First',
    'amount-desc': 'Sort: High to Low',
    'amount-asc':  'Sort: Low to High'
  }
  document.getElementById('sortTrigger').textContent = labels[sortType]
  document.getElementById('sortMenu').classList.remove('open')

  applyFilters()
}

function sortData(data) {
  return data.slice().sort(function(a, b) {
    if (currentSort === 'date-desc')   return new Date(b.date) - new Date(a.date)
    if (currentSort === 'date-asc')    return new Date(a.date) - new Date(b.date)
    if (currentSort === 'amount-desc') return b.amount - a.amount
    if (currentSort === 'amount-asc')  return a.amount - b.amount
    return 0
  })
}
// ---- APPLY FILTERS ----
function applyFilters() {
  const search   = document.getElementById('searchInput').value.toLowerCase()
  const cats     = getChecked('catMenu')
  const payments = getChecked('payMenu')
  const months   = getChecked('monthMenu')

  updateTrigger('catTrigger',   cats,     'Category')
  updateTrigger('payTrigger',   payments, 'Payment')
  updateTrigger('monthTrigger', months,   'Month')
  renderActivePills(cats, payments, months)

  filteredData = allTransactions.filter(function(t) {
    const matchSearch  = !search  || t.description.toLowerCase().includes(search) ||
                         t.category.toLowerCase().includes(search)
    const matchCat     = cats.length     === 0 || cats.includes(t.category)
    const matchPayment = payments.length === 0 || payments.includes(t.paymentMode)
    const matchMonth   = months.length   === 0 || months.some(function(m) {
      return t.date.startsWith(m)
    })
    return matchSearch && matchCat && matchPayment && matchMonth
  })
  filteredData = sortData(filteredData)
  currentPage = 1
  renderTable()
  renderSummary()
}

// ---- RENDER TABLE ----
function renderTable() {
  const tbody      = document.getElementById('transactionTableBody')
  const emptyState = document.getElementById('emptyState')
  tbody.innerHTML  = ''

  if (filteredData.length === 0) {
    emptyState.style.display = 'block'
    document.getElementById('pagination').innerHTML = ''
    return
  }

  emptyState.style.display = 'none'

  const start    = (currentPage - 1) * ROWS_PER_PAGE
  const end      = Math.min(start + ROWS_PER_PAGE, filteredData.length)
  const pageData = filteredData.slice(start, end)

  pageData.forEach(function(t) {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td class="td-date">${t.dateDisplay}</td>
      <td class="td-desc">${t.description}</td>
      <td>
        <span class="td-category">
          <span style="width:8px;height:8px;border-radius:50%;background:${t.catColor};display:inline-block"></span>
          ${t.category}
        </span>
      </td>
      <td class="td-payment">${t.paymentMode}</td>
      <td class="td-amount">-₹${t.amount.toLocaleString('en-IN')}</span></td>
      <td><button class="delete-btn" onclick="deleteTransaction(${t.id})">✕</button></td>
    `
    tbody.appendChild(row)
  })

  renderPagination(start, end)
}

// ---- RENDER SUMMARY ----
function renderSummary() {
  if (filteredData.length === 0) {
    document.getElementById('stripTotal').textContent   = '₹0'
    document.getElementById('stripCount').textContent   = '0'
    document.getElementById('stripHighest').textContent = '—'
    document.getElementById('stripTopCat').textContent  = '—'
    return
  }

  const total   = filteredData.reduce(function(sum, t) { return sum + t.amount }, 0)
  const highest = Math.max(...filteredData.map(function(t) { return t.amount }))

  const catTotals = {}
  filteredData.forEach(function(t) {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })
  const topCat = Object.keys(catTotals).reduce(function(a, b) {
    return catTotals[a] > catTotals[b] ? a : b
  })

  document.getElementById('stripTotal').textContent   = '₹' + total.toLocaleString('en-IN')
  document.getElementById('stripCount').textContent   = filteredData.length
  document.getElementById('stripHighest').textContent = '₹' + highest.toLocaleString('en-IN')
  document.getElementById('stripTopCat').textContent  = topCat
}

// ---- RENDER PAGINATION ----
function renderPagination(start, end) {
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE)
  const container  = document.getElementById('pagination')

  if (totalPages <= 1) {
    container.innerHTML = `
      <span class="pagination-info">
        Showing ${filteredData.length} of ${filteredData.length} transactions
      </span>
      <div class="pagination-btns"></div>
    `
    return
  }

  let btns = ''
  for (let i = 1; i <= totalPages; i++) {
    btns += `<button class="page-btn ${i === currentPage ? 'active-page' : ''}"
      onclick="goToPage(${i})">${i}</button>`
  }

  container.innerHTML = `
    <span class="pagination-info">Showing ${start + 1}–${end} of ${filteredData.length} transactions</span>
    <div class="pagination-btns">${btns}</div>
  `
}

function goToPage(page) {
  currentPage = page
  renderTable()
}

// ---- DELETE TRANSACTION ----
function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return
  allTransactions = allTransactions.filter(function(t) { return t.id !== id })
  localStorage.setItem('bw_transactions', JSON.stringify(allTransactions))
  filteredData = filteredData.filter(function(t) { return t.id !== id })
  renderTable()
  renderSummary()
}

// ---- CLEAR FILTERS ----
function clearFilters() {
  document.getElementById('searchInput').value = ''
  document.querySelectorAll('.filter-menu input[type="checkbox"]').forEach(function(cb) {
    cb.checked = false
  })
  applyFilters()
}

// ---- EXPORT CSV ----
function exportCSV() {
  if (filteredData.length === 0) {
    alert('No transactions to export!')
    return
  }

  const headers = ['Date', 'Description', 'Category', 'Payment Mode', 'Amount']
  const rows = filteredData.map(function(t) {
    return [
      t.dateDisplay,
      '"' + t.description.replace(/"/g, '""') + '"',
      t.category,
      t.paymentMode,
      t.amount
    ].join(',')
  })

  const csv     = [headers.join(','), ...rows].join('\n')
  const blob    = new Blob([csv], { type: 'text/csv' })
  const url     = URL.createObjectURL(blob)
  const link    = document.createElement('a')
  link.href     = url
  link.download = 'hisaabkitaab_transations_' + new Date().toISOString().split('T')[0] + '.csv'
  link.click()
  URL.revokeObjectURL(url)
}

// ---- EDIT TRANSACTION ----
function openEditModal(id) {
  const t = allTransactions.find(function(t) { return t.id === id })
  if (!t) return

  document.getElementById('editTransactionId').value = id
  document.getElementById('editAmount').value        = t.amount
  document.getElementById('editDescription').value   = t.description
  document.getElementById('editDate').value          = t.date

  // Populate category dropdown
  const select = document.getElementById('editCategory')
  select.innerHTML = ''
  allCategories.forEach(function(cat) {
    const opt = document.createElement('option')
    opt.value       = cat.name
    opt.textContent = cat.name
    if (cat.name === t.category) opt.selected = true
    select.appendChild(opt)
  })

  // Set payment pill
  const pills = document.querySelectorAll('#editPaymentPills .pill')
  pills.forEach(function(pill) {
    pill.classList.remove('active-pill')
    if (pill.textContent === t.paymentMode) pill.classList.add('active-pill')
  })

  document.getElementById('editModal').classList.add('open')
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open')
}

function selectEditPayment(clickedPill) {
  document.querySelectorAll('#editPaymentPills .pill').forEach(function(p) {
    p.classList.remove('active-pill')
  })
  clickedPill.classList.add('active-pill')
}

function saveEditTransaction() {
  const id     = parseInt(document.getElementById('editTransactionId').value)
  const amount = parseInt(document.getElementById('editAmount').value)
  const cat    = document.getElementById('editCategory').value
  const desc   = document.getElementById('editDescription').value
  const date   = document.getElementById('editDate').value

  if (!amount || !cat || !desc) {
    alert('Please fill in all fields!')
    return
  }

  const activePill  = document.querySelector('#editPaymentPills .pill.active-pill')
  const paymentMode = activePill ? activePill.textContent : 'Cash'
  const catData     = allCategories.find(function(c) { return c.name === cat })
  const catColor    = catData ? catData.color : '#FF8C42'
  const dateObj     = new Date(date)

  const idx = allTransactions.findIndex(function(t) { return t.id === id })
  if (idx === -1) return

  allTransactions[idx] = {
    ...allTransactions[idx],
    amount:      amount,
    category:    cat,
    catColor:    catColor,
    description: desc,
    paymentMode: paymentMode,
    date:        date,
    dateDisplay: dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  localStorage.setItem('bw_transactions', JSON.stringify(allTransactions))
  closeEditModal()
  applyFilters()
}
// ---- INIT ----
buildCategoryMenu()
applyFilters()