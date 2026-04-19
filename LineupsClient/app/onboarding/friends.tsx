import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

interface SuggestedUser {
  id: string
  display_name: string | null
  username: string | null
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export default function OnboardingFriends() {
  const [userId, setUserId] = useState<string | null>(null)
  const [suggested, setSuggested] = useState<SuggestedUser[]>([])
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (uid) fetchSuggested(uid)
    })
  }, [])

  async function fetchSuggested(uid: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username')
      .neq('id', uid)
      .limit(12)

    setSuggested(data ?? [])
    setLoading(false)
  }

  function toggleFollow(targetId: string) {
    setFollowed((prev) => {
      const next = new Set(prev)
      if (next.has(targetId)) next.delete(targetId)
      else next.add(targetId)
      return next
    })
  }

  async function handleContinue() {
    if (!userId || followed.size === 0) {
      router.replace('/onboarding/done')
      return
    }
    setSaving(true)
    const rows = Array.from(followed).map((fid) => ({
      follower_id: userId,
      following_id: fid,
    }))
    await supabase.from('follows').upsert(rows, { onConflict: 'follower_id,following_id' })
    setSaving(false)
    router.replace('/onboarding/done')
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.stepRow}>
          <Text style={styles.stepText}>4 / 5</Text>
        </View>

        <Text style={styles.title}>Find Surfers</Text>
        <Text style={styles.subtitle}>Follow surfers to see their sessions</Text>

        {loading ? (
          <ActivityIndicator color="#1B7A87" style={{ marginTop: 40 }} />
        ) : suggested.length === 0 ? (
          <Text style={styles.emptyText}>No surfers to suggest yet — check back later.</Text>
        ) : (
          <View style={styles.userList}>
            {suggested.map((user) => {
              const isFollowing = followed.has(user.id)
              return (
                <View key={user.id} style={styles.userRow}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{getInitials(user.display_name)}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.display_name ?? 'Surfer'}</Text>
                    {user.username && (
                      <Text style={styles.userHandle}>@{user.username}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.followButton, isFollowing && styles.followingButton]}
                    onPress={() => toggleFollow(user.id)}
                  >
                    <Text style={[styles.followText, isFollowing && styles.followingText]}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabled]}
          onPress={handleContinue}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#E8D5B8" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {followed.size > 0 ? `Follow ${followed.size} & Continue` : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/onboarding/done')}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5EDE0' },
  container: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 120,
  },
  stepRow: { alignSelf: 'flex-end', marginBottom: 24 },
  stepText: { fontFamily: 'Helvetica Neue', fontSize: 13, color: '#A89070' },
  title: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 38,
    color: '#2A1A08',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 18,
    color: '#8A7055',
    textAlign: 'center',
    marginBottom: 28,
  },
  emptyText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#A89070',
    textAlign: 'center',
    marginTop: 40,
  },
  userList: { gap: 12 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F2D3A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#3CC4C4',
  },
  userInfo: { flex: 1 },
  userName: { fontFamily: 'Georgia', fontSize: 15, color: '#2A1A08' },
  userHandle: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 12,
    color: '#8A7055',
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1B7A87',
  },
  followingButton: {
    backgroundColor: '#1B7A87',
    borderColor: '#1B7A87',
  },
  followText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#1B7A87',
  },
  followingText: {
    color: '#E8D5B8',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F5EDE0',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0D0BC',
  },
  primaryButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#E8D5B8',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
  },
  disabled: { opacity: 0.6 },
  skipButton: { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: '#A89070', fontSize: 14, fontFamily: 'Helvetica Neue' },
})
