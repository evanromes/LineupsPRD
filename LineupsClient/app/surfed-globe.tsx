// Dedicated full-screen view for the interactive globe.
// Re-queries the viewed user's sessions so it works for both self and
// other-user profiles without needing to thread state through navigation.

import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import ProfileGlobe from '../components/ProfileGlobe'

export default function SurfedGlobeScreen() {
  const insets = useSafeAreaInsets()
  const { userId } = useLocalSearchParams<{ userId: string }>()

  const [loading, setLoading] = useState(true)
  const [surfedAdmin1s, setSurfedAdmin1s] = useState<string[]>([])
  const [surfedCountries, setSurfedCountries] = useState<string[]>([])

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('sessions')
        .select('breaks(country, admin1)')
        .eq('user_id', userId)

      if (cancelled) return

      const admin1Set = new Set<string>()
      const countrySet = new Set<string>()
      for (const s of (data ?? []) as any[]) {
        if (s.breaks?.admin1) admin1Set.add(s.breaks.admin1)
        if (s.breaks?.country) countrySet.add(s.breaks.country)
      }
      setSurfedAdmin1s([...admin1Set])
      setSurfedCountries([...countrySet])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2230" />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color="#E8D5B8" />
          <Text style={styles.backLabel}>Profile</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Travels</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3CC4C4" />
        </View>
      ) : (
        <View style={styles.globeWrap}>
          <ProfileGlobe
            surfedAdmin1s={surfedAdmin1s}
            surfedCountries={surfedCountries}
            size={320}
          />
          <Text style={styles.hint}>
            Drag to rotate · pinch to zoom
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B2230',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.3)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 100,
  },
  backLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 16,
    color: '#E8D5B8',
    letterSpacing: 0.4,
    marginLeft: -2,
  },
  title: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 18,
    color: '#E8D5B8',
  },
  headerSpacer: {
    width: 100,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 18,
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
    letterSpacing: 0.4,
  },
})
