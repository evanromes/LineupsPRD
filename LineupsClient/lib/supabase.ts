import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yztxxqfnckvjvhpucifx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dHh4cWZuY2t2anZocHVjaWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTYyMjQsImV4cCI6MjA5MDg5MjIyNH0.69TJD_nLWLp351_7HZktEzRjcyq1GrRGw9Eqv9K7Pik'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})