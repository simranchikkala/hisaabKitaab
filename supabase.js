// ---- SUPABASE CONFIG ----
const SUPABASE_URL = 'https://icnkpouqsvayngbeszcs.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imljbmtwb3Vxc3ZheW5nYmVzemNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjUxMzMsImV4cCI6MjA5MzEwMTEzM30.lyhLFW1E18e3rXxgfldqic8OT5nrV6r-_Aktwmod9ZU'

// Load Supabase client
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)