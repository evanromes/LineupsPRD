import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function OnboardingDone() {
  const [breaksCount, setBreaksCount] = useState<number | null>(null)
  const [friendsCount, setFriendsCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) {
      setLoading(false)
      return
    }

    const [ratingsResult, followsResult] = await Promise.all([
      supabase.from('break_ratings').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
    ])

    setBreaksCount(ratingsResult.count ?? 0)
    setFriendsCount(followsResult.count ?? 0)
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.wordmark}>LINEUPS</Text>
        <Text style={styles.wordmarkSub}>SURF JOURNAL</Text>

        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>

        <Text style={styles.headline}>You're all set!</Text>
        <Text style={styles.tagline}>every break, remembered</Text>

        {loading ? (
          <ActivityIndicator color="#1B7A87" style={{ marginTop: 32 }} />
        ) : (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{breaksCount ?? 0}</Text>
              <Text style={styles.statLabel}>Breaks rated</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{friendsCount ?? 0}</Text>
              <Text style={styles.statLabel}>Surfers followed</Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.replace('/(tabs)/feed')}
      >
        <Text style={styles.primaryButtonText}>Open Lineups</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDE0',
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 28,
    color: '#2A1A08',
    letterSpacing: 4,
    marginBottom: 4,
  },
  wordmarkSub: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 10,
    color: '#8A7055',
    letterSpacing: 5,
    marginBottom: 40,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1B7A87',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  checkMark: {
    color: '#E8D5B8',
    fontSize: 36,
    fontWeight: 'bold',
  },
  headline: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 30,
    color: '#2A1A08',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 15,
    color: '#8A7055',
    marginBottom: 40,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
    gap: 32,
  },
  statItem: { alignItems: 'center' },
  statNumber: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 28,
    color: '#1B7A87',
  },
  statLabel: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 12,
    color: '#8A7055',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E0D0BC',
  },
  primaryButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#E8D5B8',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
  },
})
