// ---- DEFAULT CATEGORIES ----
const defaultCategories = [
  { name: "Food & Dining",  color: "#FF8C42" },
  { name: "Transport",      color: "#3B82F6" },
  { name: "Rent & Utilities", color: "#F43F5E" },
  { name: "Going Out",      color: "#A78BFA" },
  { name: "Subscriptions",  color: "#F59E0B" },
  { name: "Shopping",       color: "#22C55E" },
  { name: "Health",         color: "#F43F5E" },
  { name: "Entertainment",  color: "#A78BFA" }
]

let customCategories = []
let selectedColor = '#FF8C42'
let selectedGoals = []

// ---- GOAL SELECTION ----
function selectGoal(card, goal) {
  if (card.classList.contains('selected')) {
    card.classList.remove('selected')
    selectedGoals = selectedGoals.filter(function(g) { return g !== goal })
  } else {
    card.classList.add('selected')
    selectedGoals.push(goal)
  }
}

// ---- COLOR PICKER ----
function selectColor(dot, color) {
  document.querySelectorAll('.color-dot').forEach(function(d) {
    d.classList.remove('selected-color')
  })
  dot.classList.add('selected-color')
  selectedColor = color
}

// ---- ADD CUSTOM CATEGORY ----
function addCustomCategory() {
  const nameInput = document.getElementById('newCatName')
  const name = nameInput.value.trim()

  if (!name) {
    alert('Please enter a category name!')
    return
  }

  // Check for duplicates
  const allNames = defaultCategories.map(c => c.name.toLowerCase())
  customCategories.forEach(c => allNames.push(c.name.toLowerCase()))
  if (allNames.includes(name.toLowerCase())) {
    alert('That category already exists!')
    return
  }

  customCategories.push({ name: name, color: selectedColor })
  nameInput.value = ''
  buildCategoryGrid()
}

// ---- BUILD CATEGORY GRID ----
let selectedCategories = [...defaultCategories.map(c => c.name)]

function removeCategory(name, e) {
  e.stopPropagation()
  const isDefault = defaultCategories.some(function(c) { return c.name === name })
  if (isDefault) {
    // Just deselect default categories, don't delete them
    selectedCategories = selectedCategories.filter(function(c) { return c !== name })
  } else {
    // Actually remove custom categories
    customCategories = customCategories.filter(function(c) { return c.name !== name })
    selectedCategories = selectedCategories.filter(function(c) { return c !== name })
  }
  buildCategoryGrid()
}

function buildCategoryGrid() {
  const savedValues = {}
  document.querySelectorAll('.category-input').forEach(function(input) {
    if (input.value) {
      savedValues[input.id] = input.value
    }
  })

  const grid = document.getElementById('categoryGrid')
  grid.innerHTML = ''

  const allCats = [...defaultCategories, ...customCategories]

  allCats.forEach(function(cat) {
    const safeId = 'cat_' + cat.name.replace(/[^a-zA-Z0-9]/g, '_')
    const isSelected = selectedCategories.includes(cat.name)

    const row = document.createElement('div')
    row.classList.add('category-row')
    if (isSelected) row.classList.add('cat-selected')
    row.innerHTML = `
      <div class="cat-color-bar" style="background: ${cat.color}"></div>
      <span class="category-label" onclick="toggleCategory(this, '${cat.name}')">${cat.name}</span>
      <input
        class="category-input"
        type="number"
        id="${safeId}"
        placeholder="₹0"
        value="${savedValues[safeId] || ''}"
        style="display: ${isSelected ? 'block' : 'none'}"
      >
      <button class="cat-remove-btn" onclick="removeCategory('${cat.name}', event)">✕</button>
    `
    row.querySelector('.cat-color-bar').onclick = function() {
      row.querySelector('.category-label').click()
    }
    grid.appendChild(row)
  })
}

function toggleCategory(labelEl, catName) {
  const row = labelEl.closest('.category-row')
  const input = row.querySelector('.category-input')

  if (selectedCategories.includes(catName)) {
    selectedCategories = selectedCategories.filter(function(c) { return c !== catName })
    row.classList.remove('cat-selected')
    input.style.display = 'none'
  } else {
    selectedCategories.push(catName)
    row.classList.add('cat-selected')
    input.style.display = 'block'
  }
}

// ---- 50-30-20 TIP ----
document.getElementById('userIncome').addEventListener('input', function() {
  const income = parseInt(this.value)
  const tip = document.getElementById('tipCard')
  if (!income) {
    tip.style.display = 'none'
    return
  }
  tip.style.display = 'block'
  document.getElementById('needs').textContent   = '₹' + Math.round(income * 0.5).toLocaleString('en-IN')
  document.getElementById('wants').textContent   = '₹' + Math.round(income * 0.3).toLocaleString('en-IN')
  document.getElementById('savings').textContent = '₹' + Math.round(income * 0.2).toLocaleString('en-IN')
})
// ---- SAVINGS SUGGESTION ----
function updateSavingsSuggestion() {
  const goalAmount = parseInt(document.getElementById('goalAmount').value)
  const goalMonth  = document.getElementById('goalMonth').value
  const suggestion = document.getElementById('savingsSuggestion')

  if (!goalAmount || !goalMonth) {
    suggestion.style.display = 'none'
    return
  }

  const monthsLeft = 6
  const monthly = Math.ceil(goalAmount / monthsLeft)
  suggestion.style.display = 'block'
  suggestion.textContent =
    'To reach ₹' + goalAmount.toLocaleString('en-IN') +
    ' by ' + goalMonth + ', you need to save ₹' +
    monthly.toLocaleString('en-IN') + ' per month'
}

document.getElementById('goalAmount').addEventListener('input', updateSavingsSuggestion)
document.getElementById('goalMonth').addEventListener('change', updateSavingsSuggestion)

// ---- SCREEN NAVIGATION ----
function goToScreen(num) {

  // Validate before moving forward
 if (num === 2 && selectedGoals.length === 0) {
    alert('Please select at least one goal to continue!')
    return
  }

  if (num === 3) {
    const name   = document.getElementById('userName').value.trim()
    const income = document.getElementById('userIncome').value
    const budget = document.getElementById('userBudget').value
    if (!name || !income || !budget) {
      alert('Please fill in all fields!')
      return
    }
  }

  // Hide all screens
  document.querySelectorAll('.setup-screen').forEach(function(s) {
    s.classList.add('hidden')
  })

  // Show target screen
  document.getElementById('screen' + num).classList.remove('hidden')

  // Scroll to top
  window.scrollTo(0, 0)
}

// ---- FINISH SETUP ----
async function finishSetup() {

  // Save personal info to localStorage
  localStorage.setItem('bw_name',   document.getElementById('userName').value.trim() || 'there')
  localStorage.setItem('bw_income', document.getElementById('userIncome').value || 0)
  localStorage.setItem('bw_budget', document.getElementById('userBudget').value || 15000)
  localStorage.setItem('bw_goals',  JSON.stringify(selectedGoals))

  // Save category budgets
  const allCats = [...defaultCategories, ...customCategories]
    .filter(function(cat) { return selectedCategories.includes(cat.name) })

  allCats.forEach(function(cat) {
    const safeId = 'cat_' + cat.name.replace(/[^a-zA-Z0-9]/g, '_')
    const el     = document.getElementById(safeId)
    cat.budget   = parseInt(el ? el.value : 0) || 0
  })

  const catBudgets = {}
  allCats.forEach(function(cat) {
    catBudgets[cat.name] = { budget: cat.budget, color: cat.color }
  })

  localStorage.setItem('bw_categoryBudgets', JSON.stringify(catBudgets))
  localStorage.setItem('bw_categories',      JSON.stringify(allCats))

  // Save savings goal
  localStorage.setItem('bw_goalName',   document.getElementById('goalName').value   || '')
  localStorage.setItem('bw_goalAmount', document.getElementById('goalAmount').value || 0)
  localStorage.setItem('bw_goalMonth',  document.getElementById('goalMonth').value  || '')

  // Save to Supabase
  const { data: authData } = await db.auth.getSession()
  const setupSession = authData ? authData.session : null

  if (setupSession) {
    const userId = setupSession.user.id

    // Save profile
    await db.from('profiles').upsert({
      id:     userId,
      name:   localStorage.getItem('bw_name'),
      income: parseInt(localStorage.getItem('bw_income')) || 0,
      budget: parseInt(localStorage.getItem('bw_budget')) || 0
    })

    // Save categories
    const catRows = allCats.map(function(cat) {
      return {
        user_id: userId,
        name:    cat.name,
        color:   cat.color,
        budget:  cat.budget || 0
      }
    })
    if (catRows.length > 0) {
      await db.from('categories').insert(catRows)
    }

    // Save savings goal if set
    const goalName   = document.getElementById('goalName').value.trim()
    const goalAmount = parseInt(document.getElementById('goalAmount').value)
    const goalMonth  = document.getElementById('goalMonth').value

    if (goalName && goalAmount) {
      await db.from('goals').insert({
        user_id:  userId,
        name:     goalName,
        target:   goalAmount,
        saved:    0,
        deadline: goalMonth,
        color:    '#FF8C42'
      })
    }
  }

  // Mark setup complete and show all set screen
  localStorage.setItem('bw_setupDone', 'true')
  const name = document.getElementById('userName').value.trim()
  document.getElementById('allsetTitle').textContent = "You're ready, " + name + "!"
  goToScreen(5)
}

// ---- INIT ----
buildCategoryGrid()