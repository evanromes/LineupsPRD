import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

interface Stats {
  surfs: number
  breaks: number
  countries: number
}

export default function OnboardingDone() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) { setStats({ surfs: 0, breaks: 0, countries: 0 }); return }

    const [
      { count: surfCount },
      { count: ratingCount },
    ] = await Promise.all([
      supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('break_ratings').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    ])

    const surfs = surfCount ?? 0
    const breaks = ratingCount ?? 0
    const countries = breaks > 0 ? Math.max(1, Math.floor(breaks / 3)) : 0

    setStats({ surfs, breaks, countries })
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>

        {/* Top: copy */}
        <View style={styles.topSection}>
          <Text style={styles.heading}>You're in the lineup!</Text>
          <Text style={styles.body}>
            Start logging your sessions, exploring breaks, and building your list.
          </Text>
        </View>

        {/* Bottom: stats + CTA */}
        <View style={styles.bottomSection}>
          {stats === null ? (
            <ActivityIndicator color="#3CC4C4" style={styles.loader} />
          ) : (
            <View style={styles.statsPill}>
              <View style={styles.statBlock}>
                <Text style={styles.statNumber}>{stats.surfs}</Text>
                <Text style={styles.statLabel}>SURFS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Text style={styles.statNumber}>{stats.breaks}</Text>
                <Text style={styles.statLabel}>BREAKS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Text style={styles.statNumber}>{stats.countries}</Text>
                <Text style={styles.statLabel}>COUNTRIES</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/feed')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Open Lineups</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F3A4A',
  },
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingBottom: 32,
  },

  topSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 40,
    color: '#E8D5B8',
    textAlign: 'center',
    lineHeight: 50,
    marginBottom: 14,
  },
  body: {
    fontFamily: 'Helvetica Neue',
    fontSize: 20,
    color: '#7AABB8',
    textAlign: 'center',
    lineHeight: 30,
  },

  loader: { marginBottom: 16 },

  bottomSection: {
    width: '100%',
    gap: 14,
  },
  statsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    width: '100%',
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 30,
    color: '#3CC4C4',
  },
  statLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#7AABB8',
    letterSpacing: 1,
    marginTop: 4,
  },
  statDivider: {
    width: 0.5,
    height: 37,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
  },

  primaryButton: {
    backgroundColor: '#E8D5B8',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 17,
    color: '#0F3A4A',
  },
})
