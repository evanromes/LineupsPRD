import { router } from 'expo-router'
import { supabase } from './supabase'

export async function routeAfterAuth(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (data) {
    router.replace('/(tabs)/feed')
  } else {
    router.replace('/onboarding/profile')
  }
}
