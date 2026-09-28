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

    const { data: cats } = await db
      .from('categories')
      .select('*')
      .eq('user_id', userId)

    if (cats && cats.length > 0) {
      categories = cats.map(function(c) {
        return { name: c.name, color: c.color, budget: c.budget }
      })
      localStorage.setItem('bw_categories', JSON.stringify(categories))
    }

    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profile) {
      localStorage.setItem('bw_name',   profile.name)
      localStorage.setItem('bw_budget', profile.budget)
      localStorage.setItem('bw_income', profile.income)
    }
  } catch (err) {
    console.log('Supabase load error:', err)
  }
}

// ---- LOAD DATA ----
const userName = localStorage.getItem('bw_name') || 'there'
document.getElementById('sidebarWelcome').textContent = 'Welcome, ' + userName.split(' ')[0]

let categories = JSON.parse(localStorage.getItem('bw_categories') || '[]')
let selectedColor = '#FF8C42'

// ---- POPULATE FIELDS ON LOAD ----
function loadSettings() {
  document.getElementById('settingName').value =
    localStorage.getItem('bw_name') || ''
  document.getElementById('settingIncome').value =
    localStorage.getItem('bw_income') || ''
  document.getElementById('settingBudget').value =
    localStorage.getItem('bw_budget') || ''
  document.getElementById('settingGoalName').value =
    localStorage.getItem('bw_goalName') || ''
  document.getElementById('settingGoalAmount').value =
    localStorage.getItem('bw_goalAmount') || ''

  const savedMonth = localStorage.getItem('bw_goalMonth') || ''
  const monthSelect = document.getElementById('settingGoalMonth')
  Array.from(monthSelect.options).forEach(function(opt) {
    if (opt.value === savedMonth) opt.selected = true
  })

  update5030Tip()
  // Sync categoryBudgets into categories array on load
  const storedBudgets = JSON.parse(localStorage.getItem('bw_categoryBudgets') || '{}')
  categories.forEach(function(cat) {
    if (!cat.budget && storedBudgets[cat.name]) {
      cat.budget = storedBudgets[cat.name].budget || 0
    }
  })
  buildCatList()
}

// ---- 50-30-20 TIP ----
function update5030Tip() {
  const income = parseInt(document.getElementById('settingIncome').value)
  if (!income) return
  document.getElementById('sNeeds').textContent =
    '₹' + Math.round(income * 0.5).toLocaleString('en-IN')
  document.getElementById('sWants').textContent =
    '₹' + Math.round(income * 0.3).toLocaleString('en-IN')
  document.getElementById('sSavings').textContent =
    '₹' + Math.round(income * 0.2).toLocaleString('en-IN')
}

document.getElementById('settingIncome').addEventListener('input', update5030Tip)

// ---- BUILD CATEGORY LIST ----
function buildCatList() {
  const list = document.getElementById('catSettingsList')
  if (!list) return
  list.innerHTML = ''

  categories.forEach(function(cat, index) {
    const row = document.createElement('div')
    row.classList.add('cat-settings-row')
    row.innerHTML = `
      <div class="cat-color-circle"
        style="background: ${cat.color}"
        onclick="openColorPicker(${index}, this)">
      </div>
      <span class="cat-settings-name">${cat.name}</span>
      <div class="cat-color-picker-inline hidden" id="colorpick_${index}">
        <div class="color-dot" style="background:#FF8C42" onclick="setCatColor(${index},'#FF8C42',event)"></div>
        <div class="color-dot" style="background:#22C55E" onclick="setCatColor(${index},'#22C55E',event)"></div>
        <div class="color-dot" style="background:#3B82F6" onclick="setCatColor(${index},'#3B82F6',event)"></div>
        <div class="color-dot" style="background:#A78BFA" onclick="setCatColor(${index},'#A78BFA',event)"></div>
        <div class="color-dot" style="background:#F43F5E" onclick="setCatColor(${index},'#F43F5E',event)"></div>
        <div class="color-dot" style="background:#F59E0B" onclick="setCatColor(${index},'#F59E0B',event)"></div>
        <div class="color-dot" style="background:#06B6D4" onclick="setCatColor(${index},'#06B6D4',event)"></div>
        <div class="color-dot" style="background:#EC4899" onclick="setCatColor(${index},'#EC4899',event)"></div>
        <div class="color-dot" style="background:#14B8A6" onclick="setCatColor(${index},'#14B8A6',event)"></div>
        <div class="color-dot" style="background:#8B5CF6" onclick="setCatColor(${index},'#8B5CF6',event)"></div>
        <div class="color-dot" style="background:#EF4444" onclick="setCatColor(${index},'#EF4444',event)"></div>
        <div class="color-dot" style="background:#64748B" onclick="setCatColor(${index},'#64748B',event)"></div>
      </div>
      <input
        class="cat-budget-input"
        type="number"
        id="catbudget_${index}"
        placeholder="₹ budget"
        value="${cat.budget || ''}"
      >
      <button class="cat-delete-btn" onclick="deleteCategory(${index})">✕</button>
    `
    list.appendChild(row)
  })
}

// ---- ADD NEW CATEGORY ----
function addNewCategory() {
  const name = document.getElementById('newCatName').value.trim()
  if (!name) {
    alert('Please enter a category name!')
    return
  }
  const exists = categories.some(function(c) {
    return c.name.toLowerCase() === name.toLowerCase()
  })
  if (exists) {
    alert('That category already exists!')
    return
  }
  categories.push({ name: name, color: selectedColor })
  document.getElementById('newCatName').value = ''
  buildCatList()
}

// ---- DELETE CATEGORY ----
function deleteCategory(index) {
  if (!confirm('Delete this category? Existing transactions keep their label.')) return
  categories.splice(index, 1)
  buildCatList()
}

// ---- CHANGE CATEGORY COLOR ----
function openColorPicker(index, el) {
  // Close all other pickers first
  document.querySelectorAll('.cat-color-picker-inline').forEach(function(p) {
    p.classList.add('hidden')
  })
  const picker = document.getElementById('colorpick_' + index)
  picker.classList.toggle('hidden')
}

function setCatColor(index, color, e) {
  e.stopPropagation()
  categories[index].color = color
  document.getElementById('colorpick_' + index).classList.add('hidden')
  buildCatList()
}

// ---- COLOR PICKER ----
function selectColor(dot, color) {
  document.querySelectorAll('.color-dot').forEach(function(d) {
    d.classList.remove('selected-color')
  })
  dot.classList.add('selected-color')
  selectedColor = color
}

// ---- SAVE ALL SETTINGS ----
async function saveAllSettings() {
  const name   = document.getElementById('settingName').value.trim()
  const income = document.getElementById('settingIncome').value
  const budget = document.getElementById('settingBudget').value

  if (!name || !income || !budget) {
    alert('Please fill in name, income and budget!')
    return
  }

  localStorage.setItem('bw_name',       name)
  localStorage.setItem('bw_income',     income)
  localStorage.setItem('bw_budget',     budget)
  localStorage.setItem('bw_goalName',   document.getElementById('settingGoalName').value)
  localStorage.setItem('bw_goalAmount', document.getElementById('settingGoalAmount').value)
  localStorage.setItem('bw_goalMonth',  document.getElementById('settingGoalMonth').value)

  categories.forEach(function(cat, index) {
    const input = document.getElementById('catbudget_' + index)
    if (input) cat.budget = parseInt(input.value) || 0
  })
  localStorage.setItem('bw_categories', JSON.stringify(categories))

  const catBudgets = {}
  categories.forEach(function(cat) {
    catBudgets[cat.name] = { budget: cat.budget || 0, color: cat.color }
  })
  localStorage.setItem('bw_categoryBudgets', JSON.stringify(catBudgets))

  // Sync categories to Supabase
  try {
    const { data: authData } = await db.auth.getSession()
    const session = authData ? authData.session : null
    if (session) {
      // Delete existing categories for this user, then re-insert
      await db.from('categories').delete().eq('user_id', session.user.id)

      const rows = categories.map(function(cat) {
        return {
          user_id: session.user.id,
          name:    cat.name,
          color:   cat.color,
          budget:  cat.budget || 0
        }
      })

      const { error } = await db.from('categories').insert(rows)
      if (error) console.error('Categories sync error:', error)
    }
  } catch (err) {
    console.error('Categories save failed:', err)
  }

  // Also update profile in Supabase
  try {
    const { data: authData } = await db.auth.getSession()
    const session = authData ? authData.session : null
    if (session) {
      const { error } = await db.from('profiles')
        .update({ name, income: parseInt(income), budget: parseInt(budget) })
        .eq('id', session.user.id)
      if (error) console.error('Profile update error:', error)
    }
  } catch (err) {
    console.error('Profile save failed:', err)
  }

  showToast('Settings saved!')
}

// ---- DANGER ZONE ----
function clearTransactions() {
  if (!confirm('Delete ALL transactions? This cannot be undone.')) return
  localStorage.removeItem('bw_transactions')
  showToast('All transactions cleared')
}

function resetApp() {
  if (!confirm('Reset everything? You will lose all data.')) return
  localStorage.clear()
  window.location.href = 'setup.html'
}

// ---- TOAST ----
function showToast(message) {
  let toast = document.getElementById('toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.id = 'toast'
    toast.classList.add('toast')
    document.body.appendChild(toast)
  }
  toast.textContent = message
  toast.classList.add('show')
  setTimeout(function() {
    toast.classList.remove('show')
  }, 2500)
}

// ---- INIT ----
loadDataFromSupabase().then(function() {
  loadSettings()
})