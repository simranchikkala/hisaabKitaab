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
const userName = localStorage.getItem('bw_name') || 'there'
document.getElementById('sidebarWelcome').textContent = 'Welcome, ' + userName.split(' ')[0]

let goals = JSON.parse(localStorage.getItem('bw_goals_list') || '[]')
let selectedGoalColor = '#FF8C42'
let editingGoalId = null
let contribGoalId = null

// ---- SAVE GOALS ----
function saveGoals() {
  localStorage.setItem('bw_goals_list', JSON.stringify(goals))
}

function formatDeadline(deadline) {
  if (!deadline) return ''
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December']
  const parts = deadline.split('-')
  if (parts.length === 2) {
    return monthNames[parseInt(parts[1]) - 1] + ' ' + parts[0]
  }
  // Handle "August 2026" format from settings
  return deadline
}

// ---- RENDER GOALS ----
function renderGoals() {
  const grid  = document.getElementById('goalsGrid')
  const empty = document.getElementById('goalsEmpty')
  grid.innerHTML = ''

  if (goals.length === 0) {
    empty.style.display = 'block'
    grid.style.display  = 'none'
  } else {
    empty.style.display = 'none'
    grid.style.display  = 'grid'
  }

  let totalTarget    = 0
  let totalSaved     = 0
  let completedCount = 0

  goals.forEach(function(goal) {
    totalTarget += goal.target
    totalSaved  += goal.saved
    if (goal.saved >= goal.target) completedCount++

    const pct        = Math.min((goal.saved / goal.target) * 100, 100)
    const remaining  = goal.target - goal.saved
    const isComplete = goal.saved >= goal.target

    // Monthly suggestion
    let monthlyText = ''
    if (goal.deadline && !isComplete) {
      const now        = new Date()
      const deadline   = new Date(goal.deadline + '-01')
      const monthsLeft = Math.max(
        (deadline.getFullYear() - now.getFullYear()) * 12 +
        (deadline.getMonth() - now.getMonth()), 1
      )
      const monthly = Math.ceil(remaining / monthsLeft)
      monthlyText = 'Save <span>₹' + monthly.toLocaleString('en-IN') +
              '/month</span> to reach your goal by ' + formatDeadline(goal.deadline)
    }

    const card = document.createElement('div')
    card.classList.add('goal-card')
    if (isComplete) card.classList.add('completed')
    card.style.borderTopColor = goal.color

    card.innerHTML = `
      <div class="goal-card-header">
        <div>
          <div class="goal-card-title">${goal.name}</div>
          ${isComplete
            ? '<span class="goal-completed-badge">Completed</span>'
            : goal.deadline
            ? '<div class="goal-card-deadline">Target: ' + formatDeadline(goal.deadline) + '</div>'
            : ''
          }
        </div>
        <button class="goal-card-menu" onclick="deleteGoal('${goal.id}')">✕</button>
      </div>

      <div class="goal-amounts">
        <div>
          <div class="goal-saved">₹${goal.saved.toLocaleString('en-IN')}</div>
          <div class="goal-target">of ₹${goal.target.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div>
        <div class="goal-progress-bg">
          <div class="goal-progress-fill"
            style="width: ${pct}%; background: ${goal.color}">
          </div>
        </div>
        <div class="goal-progress-pct">${Math.round(pct)}% saved</div>
      </div>

      ${monthlyText
        ? '<div class="goal-monthly">' + monthlyText + '</div>'
        : ''
      }

      <div class="goal-actions">
        ${!isComplete
          ? `<button class="goal-contribute-btn"
               onclick="openContribModal('${goal.id}')">
               + Add Contribution
             </button>`
          : ''
        }
        <button class="goal-delete-btn" onclick="deleteGoal('${goal.id}')">
          Delete
        </button>
      </div>
    `
    grid.appendChild(card)
  })

  // Update summary strip
  document.getElementById('totalGoals').textContent = goals.filter(function(g) { return g.saved < g.target }).length
  document.getElementById('totalTarget').textContent    = '₹' + totalTarget.toLocaleString('en-IN')
  document.getElementById('totalSaved').textContent     = '₹' + totalSaved.toLocaleString('en-IN')
  document.getElementById('completedGoals').textContent = completedCount
}

// ---- ADD GOAL MODAL ----
function openAddGoal() {
  editingGoalId = null
  document.getElementById('goalModalTitle').textContent = 'Add New Goal'
  document.getElementById('goalName').value     = ''
  document.getElementById('goalTarget').value   = ''
  document.getElementById('goalDeadline').value = ''
  document.getElementById('goalSuggestion').style.display = 'none'
  selectedGoalColor = '#FF8C42'
  document.querySelectorAll('#goalColorPicker .color-dot').forEach(function(d) {
    d.classList.remove('selected-color')
  })
  document.querySelector('#goalColorPicker .color-dot').classList.add('selected-color')
  document.getElementById('goalModal').classList.add('open')
}

function closeGoalModal() {
  document.getElementById('goalModal').classList.remove('open')
}

function selectGoalColor(dot, color) {
  document.querySelectorAll('#goalColorPicker .color-dot').forEach(function(d) {
    d.classList.remove('selected-color')
  })
  dot.classList.add('selected-color')
  selectedGoalColor = color
}

// Update monthly suggestion in modal
document.getElementById('goalTarget').addEventListener('input', updateGoalSuggestion)
document.getElementById('goalDeadline').addEventListener('change', updateGoalSuggestion)

function updateGoalSuggestion() {
  const target   = parseInt(document.getElementById('goalTarget').value)
  const deadline = document.getElementById('goalDeadline').value
  const sug      = document.getElementById('goalSuggestion')

  if (!target || !deadline) {
    sug.style.display = 'none'
    return
  }

  const now        = new Date()
  const end        = new Date(deadline + '-01')
  const monthsLeft = Math.max(
    (end.getFullYear() - now.getFullYear()) * 12 +
    (end.getMonth() - now.getMonth()), 1
  )
  const monthly = Math.ceil(target / monthsLeft)

  sug.style.display  = 'block'
  sug.textContent    = 'You need to save ₹' +
    monthly.toLocaleString('en-IN') + '/month to reach this goal by ' + deadline
}

// ---- SAVE GOAL ----
async function saveGoal() {
  const name     = document.getElementById('goalName').value.trim()
  const target   = parseInt(document.getElementById('goalTarget').value)
  const deadline = document.getElementById('goalDeadline').value

  if (!name || !target) {
    alert('Please fill in goal name and target amount!')
    return
  }

  const goal = {
    id:            Date.now().toString(),
    name:          name,
    target:        target,
    saved:         0,
    deadline:      deadline,
    color:         selectedGoalColor,
    contributions: []
  }

  // Do this immediately — no waiting
  goals.unshift(goal)
  saveGoals()
  renderGoals()
  closeGoalModal()

  // Sync to Supabase in background — don't await
  db.auth.getSession().then(function(authData) {
    const session = authData.data ? authData.data.session : null
    if (session) {
      db.from('goals').insert({
        user_id:  session.user.id,
        name:     name,
        target:   target,
        saved:    0,
        deadline: deadline,
        color:    selectedGoalColor
      }).then(function(result) {
        if (result.error) console.error('Goals insert error:', result.error)
      })
    }
  })
}

// ---- DELETE GOAL ----
function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return
  goals = goals.filter(function(g) { return g.id !== id })
  saveGoals()
  renderGoals()
}

// ---- CONTRIBUTION MODAL ----
function openContribModal(goalId) {
  contribGoalId = goalId
  const goal    = goals.find(function(g) { return g.id === goalId })
  document.getElementById('contribTitle').textContent =
    'Add to: ' + goal.name
  document.getElementById('contribAmount').value = ''
  document.getElementById('contribNote').value   = ''
  document.getElementById('contribDate').value   =
    new Date().toISOString().split('T')[0]
  document.getElementById('contribModal').classList.add('open')
}

function closeContribModal() {
  document.getElementById('contribModal').classList.remove('open')
}

async function saveContribution() {
  const amount = parseInt(document.getElementById('contribAmount').value)
  const date   = document.getElementById('contribDate').value
  const note   = document.getElementById('contribNote').value.trim()

  if (!amount) { alert('Please enter an amount!'); return }

  const goal = goals.find(function(g) { return g.id === contribGoalId })
  if (!goal) return

  goal.saved += amount
  goal.contributions.push({ amount, date, note })
  saveGoals()

  // Update saved amount in Supabase
  try {
    const { data: authData } = await db.auth.getSession()
    const session = authData ? authData.session : null
    if (session) {
      const { error } = await db.from('goals')
        .update({ saved: goal.saved })
        .eq('user_id', session.user.id)
        .eq('name', goal.name)
      if (error) console.error('Contribution update error:', error)
    }
  } catch (err) {
    console.error('Contribution save failed:', err)
  }

  renderGoals()
  closeContribModal()
}

// Import onboarding goal into goals list if not already done
const onboardingGoalName   = localStorage.getItem('bw_goalName')
const onboardingGoalAmount = parseInt(localStorage.getItem('bw_goalAmount'))
const onboardingGoalMonth  = localStorage.getItem('bw_goalMonth')
const alreadyImported      = localStorage.getItem('bw_onboardingGoalImported')

if (onboardingGoalName && onboardingGoalAmount && !alreadyImported) {
  const importedGoal = {
    id:            'onboarding_' + Date.now(),
    name:          onboardingGoalName,
    target:        onboardingGoalAmount,
    saved:         0,
    deadline: (function() {
      if (!onboardingGoalMonth) return ''
      const monthNames = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December']
      const parts = onboardingGoalMonth.split(' ')
      if (parts.length === 2) {
        const monthIdx = monthNames.indexOf(parts[0])
        if (monthIdx !== -1) {
          return parts[1] + '-' + String(monthIdx + 1).padStart(2, '0')
        }
      }
      return onboardingGoalMonth
    })(),
    color:         '#FF8C42',
    contributions: []
  }
  goals.unshift(importedGoal)
  saveGoals()
  localStorage.setItem('bw_onboardingGoalImported', 'true')
}
// ---- INIT ----
renderGoals()