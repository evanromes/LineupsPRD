import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { router } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase } from '../lib/supabase'
import { routeAfterAuth } from '../lib/routeAfterAuth'

export default function RootLayout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        routeAfterAuth(session.user.id)
      } else {
        router.replace('/(auth)/splash')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        routeAfterAuth(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/splash')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen
          name="log-session"
          options={{
            presentation: 'transparentModal',
            cardStyle: { backgroundColor: 'transparent' },
            cardOverlayEnabled: false,
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  )
}
