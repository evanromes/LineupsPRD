import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

interface SuggestedUser {
  id: string
  display_name: string | null
  username: string | null
  sessionCount: number
  countryCount: number
  isFollowing: boolean
}

function getAvatarColor(username: string | null): string {
  const c = (username?.[0] ?? '').toLowerCase()
  if (c >= 'a' && c <= 'f') return '#1B7A87'
  if (c >= 'g' && c <= 'l') return '#7F77DD'
  if (c >= 'm' && c <= 'r') return '#C5A882'
  if (c >= 's' && c <= 'z') return '#0F5A65'
  return '#1B7A87'
}

function getAvatarTextColor(bg: string): string {
  if (bg === '#7F77DD') return '#EEEDFE'
  if (bg === '#C5A882') return '#4A2D0E'
  return '#E8D5B8'
}

function getInitials(displayName: string | null, username: string | null): string {
  const name = displayName ?? username ?? ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return '?'
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i + 1 === current
        const isDone = i + 1 < current
        return (
          <View
            key={i}
            style={[
              dotStyles.dot,
              isActive ? dotStyles.dotActive : isDone ? dotStyles.dotDone : dotStyles.dotUpcoming,
            ]}
          />
        )
      })}
    </View>
  )
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#D8C8B0',
  },
  dotDone: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#3CC4C4',
  },
  dotActive: {
    width: 24,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#1B7A87',
  },
  dotUpcoming: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#D8C8B0',
  },
})

function SearchIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 13 13" fill="none">
      <Circle cx="5.5" cy="5.5" r="4.5" stroke="#A8845A" strokeWidth="1.2" />
      <Path d="M9.5 9.5L12 12" stroke="#A8845A" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  )
}

export default function OnboardingFriends() {
  const [userId, setUserId] = useState<string | null>(null)
  const [suggested, setSuggested] = useState<SuggestedUser[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<SuggestedUser[]>([])
  const [loading, setLoading] = useState(true)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (uid) fetchSuggested(uid)
    })
  }, [])

  async function fetchSuggested(uid: string) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .neq('id', uid)
      .order('created_at', { ascending: false })
      .limit(15)

    if (!profiles) { setLoading(false); return }

    const enriched = await Promise.all(
      profiles.map(async (p) => {
        const [{ count: sessionCount }, { count: rawBreakCount }, { data: followRow }] =
          await Promise.all([
            supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', p.id),
            supabase.from('sessions').select('break_id', { count: 'exact', head: true }).eq('user_id', p.id),
            supabase.from('follows').select('follower_id').eq('follower_id', uid).eq('following_id', p.id).maybeSingle(),
          ])
        const sessions = sessionCount ?? 0
        const countryCount = sessions > 0 ? Math.max(1, Math.floor((rawBreakCount ?? 0) / 3)) : 0
        return {
          id: p.id,
          display_name: p.display_name,
          username: p.username,
          sessionCount: sessions,
          countryCount,
          isFollowing: followRow !== null,
        }
      })
    )

    setSuggested(enriched)
    setLoading(false)
  }

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!searchText.trim()) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      if (!userId) return
      const term = `%${searchText.trim()}%`
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .neq('id', userId)
        .or(`username.ilike.${term},display_name.ilike.${term}`)
        .limit(20)

      if (!profiles) { setSearchResults([]); return }

      const enriched = await Promise.all(
        profiles.map(async (p) => {
          const [{ count: sessionCount }, { count: rawBreakCount }, { data: followRow }] =
            await Promise.all([
              supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', p.id),
              supabase.from('sessions').select('break_id', { count: 'exact', head: true }).eq('user_id', p.id),
              supabase.from('follows').select('follower_id').eq('follower_id', userId).eq('following_id', p.id).maybeSingle(),
            ])
          const sessions = sessionCount ?? 0
          const countryCount = sessions > 0 ? Math.max(1, Math.floor((rawBreakCount ?? 0) / 3)) : 0
          return {
            id: p.id,
            display_name: p.display_name,
            username: p.username,
            sessionCount: sessions,
            countryCount,
            isFollowing: followRow !== null,
          }
        })
      )
      setSearchResults(enriched)
    }, 300)
  }, [searchText, userId])

  async function toggleFollow(target: SuggestedUser) {
    if (!userId) return

    const updateList = (list: SuggestedUser[]) =>
      list.map((u) => u.id === target.id ? { ...u, isFollowing: !u.isFollowing } : u)

    setSuggested(updateList)
    setSearchResults(updateList)

    if (target.isFollowing) {
      await supabase.from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', target.id)
    } else {
      await supabase.from('follows')
        .upsert({ follower_id: userId, following_id: target.id }, { onConflict: 'follower_id,following_id' })
    }
  }

  const displayList = searchText.trim() ? searchResults : suggested

  function renderItem({ item, index }: { item: SuggestedUser; index: number }) {
    const bgColor = getAvatarColor(item.username)
    const textColor = getAvatarTextColor(bgColor)
    const initial = getInitials(item.display_name, item.username)
    const statsLine = [
      item.username ? `@${item.username}` : null,
      `${item.sessionCount} ${item.sessionCount === 1 ? 'break' : 'breaks'}`,
      `${item.countryCount} ${item.countryCount === 1 ? 'country' : 'countries'}`,
    ].filter(Boolean).join(' · ')
    const isLast = index === displayList.length - 1

    return (
      <View style={[styles.userRow, isLast && styles.userRowLast]}>
        <View style={[styles.avatarCircle, { backgroundColor: bgColor }]}>
          <Text style={[styles.avatarText, { color: textColor }]}>{initial}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.display_name ?? item.username ?? 'Surfer'}
          </Text>
          <Text style={styles.userStats} numberOfLines={1}>{statsLine}</Text>
        </View>
        <TouchableOpacity
          style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
          onPress={() => toggleFollow(item)}
          activeOpacity={0.75}
        >
          <Text style={[styles.followBtnText, item.isFollowing && styles.followingBtnText]}>
            {item.isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.flex}>

        {/* Frozen header */}
        <View style={styles.frozenHeader}>
          <ProgressDots total={5} current={4} />
          <Text style={styles.title}>Find your crew</Text>
          <Text style={styles.subtitle}>Follow surfers you know</Text>

          <View style={styles.searchBar}>
            <SearchIcon />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or username..."
              placeholderTextColor="#C5A882"
              value={searchText}
              onChangeText={setSearchText}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.sectionLabel}>SUGGESTED</Text>
        </View>

        {/* Scrollable user list */}
        {loading ? (
          <ActivityIndicator color="#1B7A87" style={styles.loader} />
        ) : displayList.length === 0 ? (
          <Text style={styles.emptyText}>
            {searchText.trim() ? 'No surfers found' : 'No surfers to suggest yet'}
          </Text>
        ) : (
          <FlatList
            data={displayList}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.flex}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Fixed bottom */}
        <View style={styles.fixedBottom}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.push('/onboarding/history')}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/onboarding/history')} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5EDE0',
  },
  flex: { flex: 1 },

  // Frozen header
  frozenHeader: {
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 0,
    backgroundColor: '#F5EDE0',
  },
  title: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 38,
    color: '#2A1A08',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 18,
    color: '#A8845A',
    textAlign: 'center',
    marginBottom: 16,
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    height: 46,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#2A1A08',
    padding: 0,
  },

  // Section label
  sectionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#A8845A',
    letterSpacing: 2,
    marginBottom: 10,
  },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  loader: { marginTop: 32 },
  emptyText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#A8845A',
    textAlign: 'center',
    marginTop: 32,
  },

  // User rows
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0E4D0',
    gap: 16,
  },
  userRowLast: {
    borderBottomWidth: 0,
  },
  avatarCircle: {
    width: 57,
    height: 57,
    borderRadius: 28.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 22,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 19,
    color: '#2A1A08',
    marginBottom: 4,
  },
  userStats: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#A8845A',
  },

  // Follow button
  followBtn: {
    borderWidth: 0.5,
    borderColor: '#1B7A87',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 22,
  },
  followingBtn: {
    backgroundColor: '#1B7A87',
    borderColor: '#1B7A87',
  },
  followBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 15,
    color: '#1B7A87',
  },
  followingBtnText: {
    color: '#E8D5B8',
    fontWeight: '500',
  },

  // Fixed bottom
  fixedBottom: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#F5EDE0',
    borderTopWidth: 0.5,
    borderTopColor: '#D8C8B0',
  },
  continueButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 14,
    color: '#E8D5B8',
  },
  skipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#A8845A',
    textAlign: 'center',
    marginTop: 10,
  },
})
