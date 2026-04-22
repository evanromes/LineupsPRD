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
import * as Contacts from 'expo-contacts'
import { supabase } from '../../lib/supabase'

interface SuggestedUser {
  id: string
  display_name: string | null
  username: string | null
  sessionCount: number
  countryCount: number
  isFollowing: boolean
}

interface Section {
  label: string
  data: SuggestedUser[]
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
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#D8C8B0' },
  dotDone: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#3CC4C4' },
  dotActive: { width: 24, height: 9, borderRadius: 4.5, backgroundColor: '#1B7A87' },
  dotUpcoming: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#D8C8B0' },
})

function SearchIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 13 13" fill="none">
      <Circle cx="5.5" cy="5.5" r="4.5" stroke="#4A7A87" strokeWidth="1.2" />
      <Path d="M9.5 9.5L12 12" stroke="#4A7A87" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  )
}

// ── Enrich a raw profile list with session/follow data ─────
async function enrichProfiles(
  profiles: { id: string; display_name: string | null; username: string | null }[],
  currentUserId: string
): Promise<SuggestedUser[]> {
  return Promise.all(
    profiles.map(async (p) => {
      const [{ count: sessionCount }, { count: rawBreakCount }, { data: followRow }] =
        await Promise.all([
          supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', p.id),
          supabase.from('sessions').select('break_id', { count: 'exact', head: true }).eq('user_id', p.id),
          supabase.from('follows').select('follower_id').eq('follower_id', currentUserId).eq('following_id', p.id).maybeSingle(),
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
}

// ── Main screen ────────────────────────────────────────────
export default function OnboardingFriends() {
  const [userId, setUserId] = useState<string | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<SuggestedUser[]>([])
  const [loading, setLoading] = useState(true)
  // Track follow state across all sections
  const [followState, setFollowState] = useState<Map<string, boolean>>(new Map())
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (uid) loadSections(uid)
    })
  }, [])

  async function loadSections(uid: string) {
    // ── 1. Contacts section ──────────────────────────────
    let contactProfiles: { id: string; display_name: string | null; username: string | null }[] = []
    const { status } = await Contacts.getPermissionsAsync()
    if (status === 'granted') {
      const { data: contactData } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails],
      })
      const emails = contactData
        .flatMap((c) => c.emails?.map((e) => e.email?.toLowerCase()) ?? [])
        .filter((e): e is string => Boolean(e))

      if (emails.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('email', emails)
          .neq('id', uid)
          .limit(30)
        contactProfiles = data ?? []
      }
    }

    // ── 2. Same-region section ───────────────────────────
    let regionalProfiles: { id: string; display_name: string | null; username: string | null }[] = []
    const contactIds = new Set(contactProfiles.map((p) => p.id))

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('home_break')
      .eq('id', uid)
      .maybeSingle()

    if (myProfile?.home_break) {
      const { data: homeBreakRow } = await supabase
        .from('breaks')
        .select('region')
        .ilike('name', myProfile.home_break)
        .maybeSingle()

      const homeRegion = homeBreakRow?.region
      if (homeRegion) {
        const { data: regionalBreaks } = await supabase
          .from('breaks')
          .select('name')
          .eq('region', homeRegion)

        const breakNames = (regionalBreaks ?? []).map((b) => b.name)
        if (breakNames.length > 0) {
          const { data } = await supabase
            .from('profiles')
            .select('id, username, display_name')
            .in('home_break', breakNames)
            .neq('id', uid)
            .limit(20)

          regionalProfiles = (data ?? []).filter((p) => !contactIds.has(p.id))
        }
      }
    }

    // ── 3. General suggested (fallback) ─────────────────
    const shownIds = new Set([...contactIds, ...regionalProfiles.map((p) => p.id)])
    const { data: generalData } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .neq('id', uid)
      .order('created_at', { ascending: false })
      .limit(20)

    const generalProfiles = (generalData ?? []).filter((p) => !shownIds.has(p.id))

    // ── Enrich all three groups in parallel ─────────────
    const [contactUsers, regionalUsers, generalUsers] = await Promise.all([
      enrichProfiles(contactProfiles, uid),
      enrichProfiles(regionalProfiles, uid),
      enrichProfiles(generalProfiles, uid),
    ])

    // Seed follow state map
    const followMap = new Map<string, boolean>()
    for (const u of [...contactUsers, ...regionalUsers, ...generalUsers]) {
      followMap.set(u.id, u.isFollowing)
    }
    setFollowState(followMap)

    const built: Section[] = []
    if (contactUsers.length > 0) built.push({ label: 'FROM YOUR CONTACTS', data: contactUsers })
    if (regionalUsers.length > 0) built.push({ label: 'SURFERS NEAR YOUR HOME BREAK', data: regionalUsers })
    if (generalUsers.length > 0) built.push({ label: 'SUGGESTED', data: generalUsers })

    setSections(built)
    setLoading(false)
  }

  // ── Search ─────────────────────────────────────────────
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!searchText.trim()) { setSearchResults([]); return }
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
      const enriched = await enrichProfiles(profiles, userId)
      for (const u of enriched) {
        setFollowState((prev) => {
          const next = new Map(prev)
          if (!next.has(u.id)) next.set(u.id, u.isFollowing)
          return next
        })
      }
      setSearchResults(enriched)
    }, 300)
  }, [searchText, userId])

  // ── Follow / unfollow ──────────────────────────────────
  async function toggleFollow(targetId: string) {
    if (!userId) return
    const currentlyFollowing = followState.get(targetId) ?? false
    setFollowState((prev) => new Map(prev).set(targetId, !currentlyFollowing))

    if (currentlyFollowing) {
      await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId)
    } else {
      await supabase.from('follows').upsert(
        { follower_id: userId, following_id: targetId },
        { onConflict: 'follower_id,following_id' }
      )
    }
  }

  // ── Render helpers ─────────────────────────────────────
  function renderUserRow(item: SuggestedUser, index: number, listLength: number) {
    const bgColor = getAvatarColor(item.username)
    const textColor = getAvatarTextColor(bgColor)
    const initial = getInitials(item.display_name, item.username)
    const isFollowing = followState.get(item.id) ?? false
    const statsLine = [
      item.username ? `@${item.username}` : null,
      `${item.sessionCount} ${item.sessionCount === 1 ? 'break' : 'breaks'}`,
      `${item.countryCount} ${item.countryCount === 1 ? 'country' : 'countries'}`,
    ].filter(Boolean).join(' · ')
    const isLast = index === listLength - 1

    return (
      <View key={item.id} style={[styles.userRow, isLast && styles.userRowLast]}>
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
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={() => toggleFollow(item.id)}
          activeOpacity={0.75}
        >
          <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  const isSearching = searchText.trim().length > 0

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
              placeholderTextColor="#4A7A87"
              value={searchText}
              onChangeText={setSearchText}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator color="#4A7A87" style={styles.loader} />
        ) : isSearching ? (
          searchResults.length === 0 ? (
            <Text style={styles.emptyText}>No surfers found</Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => renderUserRow(item, index, searchResults.length)}
              style={styles.flex}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          )
        ) : sections.length === 0 ? (
          <Text style={styles.emptyText}>No surfers to suggest yet</Text>
        ) : (
          <FlatList
            data={sections}
            keyExtractor={(s) => s.label}
            renderItem={({ item: section }) => (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                {section.data.map((user, i) => renderUserRow(user, i, section.data.length))}
              </View>
            )}
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
  safeArea: { flex: 1, backgroundColor: '#0B2230' },
  flex: { flex: 1 },

  frozenHeader: {
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 0,
    backgroundColor: '#0B2230',
  },
  title: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 38,
    color: '#E8D5B8',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 18,
    color: '#4A7A87',
    textAlign: 'center',
    marginBottom: 16,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0B2230',
    borderWidth: 0.5,
    borderColor: '#E8D5B8',
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
    color: '#E8D5B8',
    padding: 0,
  },

  loader: { marginTop: 32 },
  emptyText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
    textAlign: 'center',
    marginTop: 32,
  },

  // Sections
  listContent: { paddingHorizontal: 24, paddingBottom: 12 },
  section: { marginBottom: 8 },
  sectionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#4A7A87',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 4,
  },

  // User rows
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74, 122, 135, 0.25)',
    gap: 16,
  },
  userRowLast: { borderBottomWidth: 0 },
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
  userInfo: { flex: 1 },
  userName: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 19,
    color: '#E8D5B8',
    marginBottom: 4,
  },
  userStats: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#4A7A87',
  },

  followBtn: {
    borderWidth: 0.5,
    borderColor: '#3CC4C4',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 22,
  },
  followingBtn: { backgroundColor: '#1B7A87', borderColor: '#1B7A87' },
  followBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 15,
    color: '#3CC4C4',
  },
  followingBtnText: { color: '#E8D5B8', fontWeight: '500' },

  fixedBottom: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#0B2230',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(74, 122, 135, 0.3)',
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
    color: '#4A7A87',
    textAlign: 'center',
    marginTop: 10,
  },
})
