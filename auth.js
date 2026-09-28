// ---- SIGN UP ----
async function signUp() {
  const email    = document.getElementById('signupEmail').value
  const password = document.getElementById('signupPassword').value

  if (!email || !password) {
    showAuthError('Please fill in all fields')
    return
  }

  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters')
    return
  }

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + '/login.html'
    }
  })

  if (error) {
    showAuthError(error.message)
    return
  }

  document.getElementById('authSuccess').style.display = 'block'
  document.getElementById('authSuccess').textContent =
    'Account created!'
}

// ---- SIGN IN ----
async function signIn() {
  const email    = document.getElementById('loginEmail').value
  const password = document.getElementById('loginPassword').value

  if (!email || !password) {
    showAuthError('Please fill in all fields')
    return
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password })

  if (error) {
    showAuthError(error.message)
    return
  }

  // Check if user has done setup
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (!profile) {
    window.location.href = 'setup.html'
  } else {
    window.location.href = 'index.html'
  }
}

// ---- SIGN OUT ----
async function signOut() {
  await db.auth.signOut()
  window.location.href = 'login.html'
}

// ---- ERROR DISPLAY ----
function showAuthError(msg) {
  const el = document.getElementById('authError')
  if (el) {
    el.style.display = 'block'
    el.textContent = msg
  }
}

// ---- CHECK SESSION ON LOAD ----
async function checkSession() {
  const { data: { session } } = await db.auth.getSession()
  return session
}