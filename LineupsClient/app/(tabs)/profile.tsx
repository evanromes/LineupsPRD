import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function avatarColor(username: string): string {
  const c = (username || 'a').charAt(0).toLowerCase()
  if (c >= 'a' && c <= 'f') return '#1B7A87'
  if (c >= 'g' && c <= 'l') return '#7F77DD'
  if (c >= 'm' && c <= 'r') return '#C5A882'
  return '#0F5A65'
}

function regionFromLatLng(lat: number, lng: number): string {
  if (lat >= 32 && lat <= 42 && lng >= -124 && lng <= -114) return 'California, USA'
  if (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154) return 'Hawaii, USA'
  if (lat >= 43 && lat <= 50 && lng >= -127 && lng <= -118) return 'Pacific Northwest'
  if (lat >= 20 && lat <= 32 && lng >= -120 && lng <= -85)  return 'Mexico'
  if (lat >= 7  && lat <= 20 && lng >= -92  && lng <= -77)  return 'Central America'
  if (lat >= -35 && lat <= 5 && lng >= -74 && lng <= -30)   return 'Brazil'
  if (lat >= -56 && lat <= -5 && lng >= -82 && lng <= -65)  return 'South America'
  if (lat >= 43 && lat <= 47 && lng >= -5  && lng <= 3)     return 'Basque Country, Spain'
  if (lat >= 36 && lat <= 44 && lng >= -10 && lng <= -6)    return 'Portugal'
  if (lat >= 49 && lat <= 60 && lng >= -12 && lng <= 2)     return 'UK & Ireland'
  if (lat >= 27 && lat <= 36 && lng >= -14 && lng <= 0)     return 'Morocco'
  if (lat >= 36 && lat <= 47 && lng >= 0   && lng <= 18)    return 'Mediterranean'
  if (lat >= -11 && lat <= -5 && lng >= 105 && lng <= 125)  return 'Indonesia'
  if (lat >= -44 && lat <= -10 && lng >= 113 && lng <= 155) return 'Australia'
  if (lat >= 10  && lat <= 30 && lng >= 120 && lng <= 145)  return 'Philippines'
  if (lat >= 0 && lat <= 90  && lng >= -180 && lng <= -100) return 'North Pacific'
  if (lat >= 0 && lat <= 90  && lng >= -100 && lng <= 0)    return 'North Atlantic'
  return 'Other'
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  username: string
  display_name: string | null
  bio: string | null
}

interface RatedBreak {
  break_id: string
  rating: number | null
  approx_sessions: number | null
  is_favorite: boolean
  breaks: {
    name: string
    lat: number
    lng: number
    type: string | null
    direction: string | null
  } | null
  // enriched from sessions table
  sessionCount: number
  avgSessionRating: number | null
}

interface WishlistBreak {
  break_id: string
  breaks: {
    name: string
    lat: number
    lng: number
    type: string | null
    direction: string | null
  } | null
}

interface RegionGroup {
  region: string
  items: RatedBreak[]
}

// ─── Tiny shared components ───────────────────────────────────────────────────

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  )
}

function DotRating({ rating, size = 5 }: { rating: number; size?: number }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4, 5].map(i => (
        <View
          key={i}
          style={[
            { width: size, height: size, borderRadius: size / 2 },
            i <= rating ? styles.dotFilled : styles.dotEmpty,
          ]}
        />
      ))}
    </View>
  )
}

// ─── Break row (used inside Breaks tab) ───────────────────────────────────────

function BreakRow({ item, rank }: { item: RatedBreak; rank: number }) {
  const b = item.breaks
  if (!b) return null
  return (
    <TouchableOpacity
      style={styles.breakRow}
      activeOpacity={0.75}
      onPress={() => router.push({ pathname: '/break-detail', params: { id: item.break_id, name: b.name } })}
    >
      <Text style={[styles.breakRank, rank <= 2 && styles.breakRankTop]}>{rank}</Text>

      {/* Center body */}
      <View style={styles.breakInfo}>
        <Text style={styles.breakName} numberOfLines={1}>{b.name}</Text>
        <View style={styles.breakPills}>
          {b.type && <Pill label={b.type} bg="#EEEDFE" color="#534AB7" />}
          {b.direction && <Pill label={b.direction} bg="#E1F5EE" color="#0F6E56" />}
        </View>
        {item.sessionCount > 0 && (
          <View style={styles.sessionStatsRow}>
            <Text style={styles.sessionStatText}>{item.sessionCount} sessions</Text>
            {item.avgSessionRating != null && (
              <>
                <Text style={styles.sessionStatText}> · </Text>
                <Text style={styles.sessionAvgText}>
                  {item.avgSessionRating.toFixed(1)} avg
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* Right side */}
      <View style={styles.breakRight}>
        {item.rating != null && item.rating > 0 && (
          <View style={styles.ratingBlock}>
            <Text style={styles.breakRatingLabel}>BREAK</Text>
            <DotRating rating={item.rating} />
          </View>
        )}
        {item.is_favorite && <View style={styles.favDot} />}
      </View>
    </TouchableOpacity>
  )
}

// ─── Breaks tab content ───────────────────────────────────────────────────────

function BreaksTab({ ratings }: { ratings: RatedBreak[] }) {
  const groups: RegionGroup[] = useMemo(() => {
    const map = new Map<string, RatedBreak[]>()
    for (const r of ratings) {
      if (!r.breaks) continue
      const region = regionFromLatLng(r.breaks.lat, r.breaks.lng)
      const list = map.get(region) ?? []
      list.push(r)
      map.set(region, list)
    }
    const sortFn = (a: RatedBreak, b: RatedBreak) => {
      const rA = a.rating ?? -1, rB = b.rating ?? -1
      if (rB !== rA) return rB - rA
      return b.sessionCount - a.sessionCount
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([region, items]) => ({ region, items: items.sort(sortFn) }))
  }, [ratings])

  if (ratings.length === 0) {
    return <Text style={styles.emptyTabText}>No breaks logged yet.</Text>
  }

  return (
    <>
      {groups.map(({ region, items }) => (
        <View key={region}>
          {/* Region header */}
          <View style={styles.regionRow}>
            <Text style={styles.regionLabel}>{region.toUpperCase()} · {items.length}</Text>
            <View style={styles.regionRule} />
          </View>
          {items.map((item, idx) => (
            <BreakRow key={item.break_id} item={item} rank={idx + 1} />
          ))}
        </View>
      ))}
    </>
  )
}

// ─── Wishlist tab content ─────────────────────────────────────────────────────

function WishlistTab({ items }: { items: WishlistBreak[] }) {
  if (items.length === 0) {
    return (
      <Text style={styles.emptyTabText}>
        Your wishlist is empty. Add breaks from the map.
      </Text>
    )
  }
  return (
    <>
      {items.map((item, idx) => {
        const b = item.breaks
        if (!b) return null
        return (
          <TouchableOpacity
            key={item.break_id}
            style={styles.wishRow}
            activeOpacity={0.75}
            onPress={() => router.push({ pathname: '/break-detail', params: { id: item.break_id, name: b.name } })}
          >
            <Text style={styles.wishNum}>{idx + 1}</Text>
            <View style={styles.wishInfo}>
              <Text style={styles.wishName}>{b.name}</Text>
              <Text style={styles.wishLoc}>{regionFromLatLng(b.lat, b.lng)}</Text>
              <View style={styles.wishPills}>
                {b.type && <Pill label={b.type} bg="#EEEDFE" color="#534AB7" />}
                {b.direction && <Pill label={b.direction} bg="#E1F5EE" color="#0F6E56" />}
              </View>
            </View>
          </TouchableOpacity>
        )
      })}
    </>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type TabKey = 'breaks' | 'wishlist'

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ userId?: string }>()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isOwnProfile,  setIsOwnProfile]  = useState(true)
  const [loading, setLoading]             = useState(true)
  const [activeTab, setActiveTab]         = useState<TabKey>('breaks')

  // Profile data
  const [profile,       setProfile]       = useState<Profile | null>(null)
  const [surfCount,     setSurfCount]      = useState(0)
  const [breakCount,    setBreakCount]     = useState(0)
  const [countryCount,  setCountryCount]  = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [ratings,       setRatings]       = useState<RatedBreak[]>([])
  const [wishlist,      setWishlist]       = useState<WishlistBreak[]>([])
  const [isFollowing,   setIsFollowing]   = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  // ─── Resolve target user ──────────────────────────────────────────────────

  useEffect(() => {
    resolveAndFetch()
  }, [params.userId])

  async function resolveAndFetch() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const selfId = session?.user?.id ?? null
    setCurrentUserId(selfId)

    const targetId = params.userId && params.userId !== selfId
      ? params.userId
      : selfId

    const own = !params.userId || params.userId === selfId
    setIsOwnProfile(own)

    if (!targetId) { setLoading(false); return }
    await fetchAll(targetId, selfId, own)
  }

  // ─── Data fetch ───────────────────────────────────────────────────────────

  async function fetchAll(targetId: string, selfId: string | null, own: boolean) {
    try {
      const [
        { data: profileData },
        { data: sessionData },
        { data: ratingData },
        { data: wishlistData },
        { count: followerCnt },
        { count: followingCnt },
      ] = await Promise.all([
        supabase.from('profiles')
          .select('username, display_name, bio')
          .eq('id', targetId)
          .single(),

        supabase.from('sessions')
          .select('break_id, rating')
          .eq('user_id', targetId),

        supabase.from('break_ratings')
          .select('break_id, rating, approx_sessions, is_favorite, breaks(name, lat, lng, type, direction)')
          .eq('user_id', targetId),

        supabase.from('wishlist')
          .select('break_id, breaks(name, lat, lng, type, direction)')
          .eq('user_id', targetId),

        supabase.from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', targetId),

        supabase.from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', targetId),
      ])

      if (profileData) setProfile(profileData as Profile)

      // Session stats
      const sessions = (sessionData ?? []) as Array<{ break_id: string; rating: number | null }>
      setSurfCount(sessions.length)
      const distinctBreaks = new Set(sessions.map(s => s.break_id).filter(Boolean))
      setBreakCount(distinctBreaks.size)

      // Build per-break session count + avg rating
      const sessionCountMap = new Map<string, number>()
      const sessionRatingSumMap = new Map<string, number>()
      const sessionRatingCountMap = new Map<string, number>()
      for (const s of sessions) {
        if (!s.break_id) continue
        sessionCountMap.set(s.break_id, (sessionCountMap.get(s.break_id) ?? 0) + 1)
        if (s.rating != null && s.rating > 0) {
          sessionRatingSumMap.set(s.break_id, (sessionRatingSumMap.get(s.break_id) ?? 0) + s.rating)
          sessionRatingCountMap.set(s.break_id, (sessionRatingCountMap.get(s.break_id) ?? 0) + 1)
        }
      }

      // Countries: distinct regions derived from rated break lat/lng
      const ratedRows = ((ratingData ?? []) as unknown as RatedBreak[]).map(r => {
        const count = sessionCountMap.get(r.break_id) ?? 0
        const rCount = sessionRatingCountMap.get(r.break_id) ?? 0
        const rSum = sessionRatingSumMap.get(r.break_id) ?? 0
        return {
          ...r,
          sessionCount: count,
          avgSessionRating: count >= 3 && rCount > 0 ? rSum / rCount : null,
        }
      })
      const regions = new Set(ratedRows.map(r => r.breaks ? regionFromLatLng(r.breaks.lat, r.breaks.lng) : null).filter(Boolean))
      setCountryCount(regions.size || Math.ceil(distinctBreaks.size / 3) || 0)

      setRatings(ratedRows)
      setWishlist((wishlistData ?? []) as unknown as WishlistBreak[])
      setFollowerCount(followerCnt ?? 0)
      setFollowingCount(followingCnt ?? 0)

      // Check if self is following this user (other profile only)
      if (!own && selfId) {
        const { data: followRow } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', selfId)
          .eq('following_id', targetId)
          .maybeSingle()
        setIsFollowing(!!followRow)
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Follow toggle ────────────────────────────────────────────────────────

  async function toggleFollow() {
    if (!currentUserId || !params.userId) return
    setFollowLoading(true)
    const targetId = params.userId

    if (isFollowing) {
      await supabase.from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetId)
      setIsFollowing(false)
      setFollowerCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('follows')
        .insert({ follower_id: currentUserId, following_id: targetId })
      setIsFollowing(true)
      setFollowerCount(c => c + 1)
    }
    setFollowLoading(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const username    = profile?.username    ?? ''
  const displayName = profile?.display_name ?? username
  const initial     = displayName.charAt(0).toUpperCase() || '?'

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EDE0" />

      {/* Header */}
      <View style={styles.header}>
        {isOwnProfile ? (
          <>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Coming soon', 'Settings coming soon')}
              hitSlop={10}
            >
              <Ionicons name="settings-outline" size={22} color="#1B7A87" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={18} color="#1B7A87" />
            </TouchableOpacity>
            <Text style={styles.headerTitleCentered} numberOfLines={1}>
              {displayName || 'Profile'}
            </Text>
            <View style={{ width: 34 }} />
          </>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#1B7A87" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {/* ── Card section (sand background) ── */}
          <View style={styles.card}>

            {/* Avatar + stats */}
            <View style={styles.avatarStatsRow}>
              <View style={[
                styles.avatarCircle,
                { backgroundColor: isOwnProfile ? '#1B7A87' : avatarColor(username) },
              ]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
              <View style={styles.statsRow}>
                {([
                  { value: surfCount,    label: 'SURFS' },
                  { value: breakCount,   label: 'BREAKS' },
                  { value: countryCount, label: 'COUNTRIES' },
                ] as const).map(({ value, label }) => (
                  <View key={label} style={styles.statBlock}>
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Bio */}
            <View style={styles.bioSection}>
              <Text style={styles.displayName}>{displayName}</Text>
              {!!profile?.bio?.trim() && (
                <Text style={styles.bioText}>{profile.bio.trim()}</Text>
              )}
              <View style={styles.followRow}>
                <Text style={styles.followText}>
                  <Text style={styles.followNum}>{followerCount}</Text>
                  <Text style={styles.followMuted}> followers</Text>
                </Text>
                <Text style={styles.followText}>
                  <Text style={styles.followNum}>{followingCount}</Text>
                  <Text style={styles.followMuted}> following</Text>
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            {isOwnProfile ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => Alert.alert('Coming soon', 'Edit profile coming soon')}
                activeOpacity={0.8}
              >
                <Text style={styles.editBtnText}>Edit profile</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionBtns}>
                <TouchableOpacity
                  style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                  onPress={toggleFollow}
                  disabled={followLoading}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.messageBtn}
                  onPress={() => Alert.alert('Coming soon', 'Messaging coming soon')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.messageBtnText}>Message</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Tab bar ── */}
          <View style={styles.tabBar}>
            {(['breaks', 'wishlist'] as TabKey[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Tab content ── */}
          <View style={styles.tabContent}>
            {activeTab === 'breaks'
              ? <BreaksTab ratings={ratings} />
              : <WishlistTab items={wishlist} />
            }
          </View>
        </ScrollView>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDE0',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D8C8B0',
    backgroundColor: '#F5EDE0',
  },
  headerTitle: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 24,
    color: '#2A1A08',
  },
  headerTitleCentered: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 20,
    color: '#2A1A08',
    flex: 1,
    textAlign: 'center',
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Profile card area (sand bg)
  card: {
    backgroundColor: '#F2E8D8',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },

  // Avatar + stats
  avatarStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 22,
    color: '#E8D5B8',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 20,
    color: '#2A1A08',
  },
  statLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#A8845A',
    letterSpacing: 0.8,
    marginTop: 2,
  },

  // Bio
  bioSection: {
    marginBottom: 12,
  },
  displayName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 16,
    color: '#2A1A08',
    marginBottom: 2,
  },
  bioText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#A8845A',
    lineHeight: 14,
    marginTop: 2,
    marginBottom: 8,
  },
  followRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  followText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
  },
  followNum: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    fontWeight: '500',
    color: '#2A1A08',
  },
  followMuted: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#A8845A',
  },

  // Action buttons
  editBtn: {
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  editBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#7A4E2A',
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  followBtn: {
    flex: 1,
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#1B7A87',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  followBtnActive: {
    backgroundColor: '#1B7A87',
    borderColor: '#1B7A87',
  },
  followBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    fontWeight: '500',
    color: '#1B7A87',
  },
  followBtnTextActive: {
    color: '#E8D5B8',
  },
  messageBtn: {
    flex: 1,
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  messageBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#7A4E2A',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F2E8D8',
    borderBottomWidth: 0.5,
    borderBottomColor: '#D8C8B0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#1B7A87',
  },
  tabLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#A8845A',
  },
  tabLabelActive: {
    color: '#1B7A87',
  },

  // Tab content wrapper
  tabContent: {
    paddingBottom: 8,
  },

  // Empty tab state
  emptyTabText: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 14,
    color: '#A8845A',
    textAlign: 'center',
    paddingVertical: 32,
    paddingHorizontal: 18,
  },

  // Shared pill
  pill: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 8,
    letterSpacing: 0.4,
  },

  // Dot rating
  dots: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  dotFilled: {
    backgroundColor: '#1B7A87',
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C5A882',
  },

  // Region header
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
  },
  regionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#A8845A',
    letterSpacing: 2,
    flexShrink: 0,
  },
  regionRule: {
    flex: 1,
    height: 0.5,
    backgroundColor: '#D8C8B0',
  },

  // Break row
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0E4D0',
  },
  breakRank: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 18,
    color: '#C5A882',
    width: 22,
    textAlign: 'center',
    flexShrink: 0,
  },
  breakRankTop: {
    color: '#1B7A87',
  },
  breakInfo: {
    flex: 1,
    minWidth: 0,
  },
  breakName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 12,
    color: '#2A1A08',
    marginBottom: 3,
  },
  breakPills: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  breakRight: {
    alignItems: 'flex-end',
    gap: 5,
    flexShrink: 0,
  },
  ratingBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  breakRatingLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 7,
    color: '#A8845A',
    letterSpacing: 1,
  },
  sessionStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sessionStatText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 8,
    color: '#A8845A',
  },
  sessionAvgText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 8,
    color: '#1B7A87',
  },
  favDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#7F77DD',
  },

  // Wishlist row
  wishRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0E4D0',
  },
  wishNum: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#C5A882',
    width: 18,
    marginTop: 2,
  },
  wishInfo: {
    flex: 1,
  },
  wishName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 12,
    color: '#2A1A08',
    marginBottom: 2,
  },
  wishLoc: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#A8845A',
    marginBottom: 3,
  },
  wishPills: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
})
