import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
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
import Svg, { Text as SvgText, Path } from 'react-native-svg'
import { supabase } from '../../lib/supabase'

// ─── Wordmark ─────────────────────────────────────────────────────────────────

function LineupsWordmark() {
  return (
    <Svg width={95} height={44} viewBox="20 120 360 185">
      <SvgText
        x="200" y="195"
        fontFamily="Georgia, serif"
        fontSize="71" fontWeight="700"
        fill="#E8D5B8" textAnchor="middle" letterSpacing="2"
      >
        Lineups
      </SvgText>
      <Path d="M60 240 Q130 224,200 240 Q270 256,340 240" fill="none" stroke="#3CC4C4" strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M60 262 Q130 246,200 262 Q270 278,340 262" fill="none" stroke="#3CC4C4" strokeWidth="2.9" strokeLinecap="round" opacity="0.6" />
      <Path d="M60 282 Q130 268,200 282 Q270 296,340 282" fill="none" stroke="#3CC4C4" strokeWidth="2.3" strokeLinecap="round" opacity="0.3" />
    </Svg>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function avatarColor(username: string): string {
  const c = (username || 'a').charAt(0).toLowerCase()
  if (c >= 'a' && c <= 'f') return '#1B7A87'
  if (c >= 'g' && c <= 'l') return '#7F77DD'
  if (c >= 'm' && c <= 'r') return '#3A6A70'
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
  created_at: string | null
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

// ─── Shared components ────────────────────────────────────────────────────────

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  )
}

function DotRating({ rating, size = 9 }: { rating: number; size?: number }) {
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

// ─── Break row ────────────────────────────────────────────────────────────────

function BreakRow({ item, rank }: { item: RatedBreak; rank: number }) {
  const b = item.breaks
  if (!b) return null
  const region = regionFromLatLng(b.lat, b.lng)
  return (
    <TouchableOpacity
      style={styles.breakRow}
      activeOpacity={0.6}
      onPress={() => router.push({ pathname: '/break-detail', params: { id: item.break_id, name: b.name } })}
    >
      <Text style={[styles.breakRank, rank <= 2 && styles.breakRankTop]}>{rank}</Text>

      <View style={styles.breakInfo}>
        <Text style={styles.breakName} numberOfLines={1}>{b.name}</Text>
        <Text style={styles.breakRegion}>{region}</Text>
        <View style={styles.breakPills}>
          {b.type && <Pill label={b.type} bg="rgba(83,74,183,0.2)" color="#9B95E8" />}
          {b.direction && <Pill label={b.direction} bg="rgba(15,110,86,0.2)" color="#3CC4C4" />}
        </View>
        {item.sessionCount > 0 && (
          <View style={styles.sessionStatsRow}>
            <Text style={styles.sessionStatText}>{item.sessionCount} sessions</Text>
            {item.avgSessionRating != null && (
              <>
                <Text style={styles.sessionStatText}> · </Text>
                <Text style={styles.sessionAvgText}>{item.avgSessionRating.toFixed(1)} avg</Text>
              </>
            )}
          </View>
        )}
      </View>

      <View style={styles.breakRight}>
        {item.rating != null && item.rating > 0 && (
          <View style={styles.ratingBlock}>
            <Text style={styles.breakRatingLabel}>RATING</Text>
            <DotRating rating={item.rating} />
          </View>
        )}
        {item.is_favorite && (
          <View style={styles.favPill}>
            <Text style={styles.favPillText}>🏄 Favorite</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

// ─── Breaks tab ───────────────────────────────────────────────────────────────

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
          <View style={styles.regionRow}>
            <Text style={styles.regionLabel}>{region.toUpperCase()} · {items.length}</Text>
          </View>
          {items.map((item, idx) => (
            <BreakRow key={item.break_id} item={item} rank={idx + 1} />
          ))}
        </View>
      ))}
    </>
  )
}

// ─── Wishlist tab ─────────────────────────────────────────────────────────────

function WishlistTab({ items }: { items: WishlistBreak[] }) {
  if (items.length === 0) {
    return <Text style={styles.emptyTabText}>Your wishlist is empty. Add breaks from the map.</Text>
  }
  return (
    <>
      {items.map((item, idx) => {
        const b = item.breaks
        if (!b) return null
        return (
          <TouchableOpacity
            key={item.break_id}
            style={styles.breakRow}
            activeOpacity={0.6}
            onPress={() => router.push({ pathname: '/break-detail', params: { id: item.break_id, name: b.name } })}
          >
            <Text style={[styles.breakRank]}>{idx + 1}</Text>
            <View style={styles.breakInfo}>
              <Text style={styles.breakName}>{b.name}</Text>
              <Text style={styles.breakRegion}>{regionFromLatLng(b.lat, b.lng)}</Text>
              <View style={styles.breakPills}>
                {b.type && <Pill label={b.type} bg="rgba(83,74,183,0.2)" color="#9B95E8" />}
                {b.direction && <Pill label={b.direction} bg="rgba(15,110,86,0.2)" color="#3CC4C4" />}
              </View>
            </View>
          </TouchableOpacity>
        )
      })}
    </>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const TABS: TabKey[] = ['breaks', 'wishlist']
type TabKey = 'breaks' | 'wishlist'

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ userId?: string }>()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isOwnProfile,  setIsOwnProfile]  = useState(true)
  const [loading, setLoading]             = useState(true)
  const [activeTab, setActiveTab]         = useState<TabKey>('breaks')

  const [profile,        setProfile]       = useState<Profile | null>(null)
  const [surfCount,      setSurfCount]     = useState(0)
  const [breakCount,     setBreakCount]    = useState(0)
  const [countryCount,   setCountryCount]  = useState(0)
  const [followerCount,  setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount]= useState(0)
  const [ratings,        setRatings]       = useState<RatedBreak[]>([])
  const [wishlist,       setWishlist]      = useState<WishlistBreak[]>([])
  const [isFollowing,    setIsFollowing]   = useState(false)
  const [followLoading,  setFollowLoading] = useState(false)

  // Tab sliding indicator
  const [tabContainerWidth, setTabContainerWidth] = useState(0)
  const indicatorAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (tabContainerWidth === 0) return
    const tabWidth = tabContainerWidth / TABS.length
    Animated.spring(indicatorAnim, {
      toValue: TABS.indexOf(activeTab) * tabWidth,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
  }, [activeTab, tabContainerWidth])

  useEffect(() => { resolveAndFetch() }, [params.userId])

  async function resolveAndFetch() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const selfId = session?.user?.id ?? null
    setCurrentUserId(selfId)

    const targetId = params.userId && params.userId !== selfId ? params.userId : selfId
    const own = !params.userId || params.userId === selfId
    setIsOwnProfile(own)

    if (!targetId) { setLoading(false); return }
    await fetchAll(targetId, selfId, own)
  }

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
        supabase.from('profiles').select('username, display_name, bio, created_at').eq('id', targetId).single(),
        supabase.from('sessions').select('break_id, rating').eq('user_id', targetId),
        supabase.from('break_ratings').select('break_id, rating, approx_sessions, is_favorite, breaks(name, lat, lng, type, direction)').eq('user_id', targetId),
        supabase.from('wishlist').select('break_id, breaks(name, lat, lng, type, direction)').eq('user_id', targetId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
      ])

      if (profileData) setProfile(profileData as Profile)

      const sessions = (sessionData ?? []) as Array<{ break_id: string; rating: number | null }>
      setSurfCount(sessions.length)
      const distinctBreaks = new Set(sessions.map(s => s.break_id).filter(Boolean))
      setBreakCount(distinctBreaks.size)

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

      if (!own && selfId) {
        const { data: followRow } = await supabase
          .from('follows').select('id')
          .eq('follower_id', selfId).eq('following_id', targetId)
          .maybeSingle()
        setIsFollowing(!!followRow)
      }
    } finally {
      setLoading(false)
    }
  }

  async function toggleFollow() {
    if (!currentUserId || !params.userId) return
    setFollowLoading(true)
    const targetId = params.userId
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', targetId)
      setIsFollowing(false)
      setFollowerCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetId })
      setIsFollowing(true)
      setFollowerCount(c => c + 1)
    }
    setFollowLoading(false)
  }

  const username    = profile?.username    ?? ''
  const displayName = profile?.display_name ?? username
  const initial     = displayName.charAt(0).toUpperCase() || '?'
  const tabWidth    = tabContainerWidth > 0 ? tabContainerWidth / TABS.length : 0

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2230" />

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        {/* Left: back button or settings */}
        {!isOwnProfile ? (
          <TouchableOpacity style={styles.topBarSide} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color="#E8D5B8" />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBarSide} />
        )}

        <LineupsWordmark />

        {/* Right: settings (own) or empty */}
        {isOwnProfile ? (
          <TouchableOpacity
            style={[styles.topBarSide, { alignItems: 'flex-end' }]}
            onPress={() => Alert.alert('Coming soon', 'Settings coming soon')}
            hitSlop={10}
          >
            <Ionicons name="settings-outline" size={20} color="#E8D5B8" />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBarSide} />
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3CC4C4" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {/* ── Profile card ── */}
          <View style={styles.card}>

            {/* Username — centered above stats */}
            {!!username && (
              <Text style={styles.usernameTag}>{username}</Text>
            )}

            {/* Avatar + name column alongside stats */}
            <View style={styles.avatarStatsRow}>
              <View style={styles.avatarColumn}>
                <View style={[styles.avatarCircle, { backgroundColor: isOwnProfile ? '#1B7A87' : avatarColor(username) }]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
                <Text style={styles.displayName} numberOfLines={2}>{displayName}</Text>
              </View>
              <View style={styles.statsRow}>
                {([
                  { value: surfCount,    label: 'SURFS' },
                  { value: breakCount,   label: 'BREAKS' },
                  { value: countryCount, label: 'REGIONS' },
                ] as const).map(({ value, label }) => (
                  <View key={label} style={styles.statBlock}>
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Bio + follow counts */}
            <View style={styles.bioSection}>
              {!!profile?.bio?.trim() && (
                <Text style={styles.bioText}>{profile.bio.trim()}</Text>
              )}
              <View style={styles.followRow}>
                <View style={styles.followLeft}>
                  <Text style={styles.followMuted}>
                    <Text style={styles.followNum}>{followerCount}</Text>
                    {' followers'}
                  </Text>
                  <Text style={styles.followMuted}>
                    <Text style={styles.followNum}>{followingCount}</Text>
                    {' following'}
                  </Text>
                </View>
                {!!profile?.created_at && (
                  <Text style={styles.memberSince}>
                    Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </View>
            </View>

            {/* Action buttons */}
            {isOwnProfile ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => Alert.alert('Coming soon', 'Edit profile coming soon')}
                activeOpacity={0.8}
              >
                <Text style={styles.editBtnText}>Edit Profile</Text>
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

          {/* ── Tab strip with sliding indicator ── */}
          <View
            style={styles.tabStrip}
            onLayout={e => setTabContainerWidth(e.nativeEvent.layout.width)}
          >
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab}
                style={styles.tab}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            {tabWidth > 0 && (
              <Animated.View
                style={[styles.tabIndicator, { width: tabWidth, transform: [{ translateX: indicatorAnim }] }]}
              />
            )}
          </View>

          {/* ── Tab content ── */}
          <View style={styles.tabContent}>
            {activeTab === 'breaks'
              ? <BreaksTab ratings={ratings} />
              : <WishlistTab items={wishlist} />
            }
          </View>

          {/* ── Sign out ── */}
          {isOwnProfile && (
            <TouchableOpacity
              style={styles.signOutButton}
              activeOpacity={0.7}
              onPress={async () => {
                await supabase.auth.signOut()
                router.replace('/(auth)/login')
              }}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B2230',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarSide: {
    width: 80,
    justifyContent: 'center',
  },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Profile card
  card: {
    backgroundColor: '#0F2838',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.3)',
  },

  // Avatar + stats
  avatarStatsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 14,
  },
  avatarColumn: {
    alignItems: 'center',
    gap: 8,
    width: 90,
    flexShrink: 0,
    marginLeft: 14,
    marginTop: -25,
  },
  avatarCircle: {
    width: 83,
    height: 83,
    borderRadius: 41.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 29,
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
    fontSize: 22,
    color: '#E8D5B8',
  },
  statLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 1.2,
    marginTop: 2,
  },

  // Bio
  bioSection: {
    marginBottom: 14,
  },
  displayName: {
    fontFamily: 'Georgia',
    fontSize: 20,
    color: '#E8D5B8',
    textAlign: 'center',
  },
  usernameTag: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 26,
    color: '#E8D5B8',
    textAlign: 'center',
    marginBottom: 14,
  },
  bioText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
    lineHeight: 17,
    marginBottom: 8,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  followLeft: {
    flexDirection: 'row',
    gap: 16,
  },
  followNum: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '600',
    fontSize: 14,
    color: '#E8D5B8',
  },
  followMuted: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#4A7A87',
  },
  memberSince: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#4A7A87',
  },

  // Buttons
  editBtn: {
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.5)',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 16,
  },
  editBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#E8D5B8',
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  followBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3CC4C4',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  followBtnActive: {
    backgroundColor: '#1B7A87',
    borderColor: '#1B7A87',
  },
  followBtnText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 13,
    color: '#3CC4C4',
  },
  followBtnTextActive: {
    color: '#E8D5B8',
  },
  messageBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.5)',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  messageBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#E8D5B8',
  },

  // Tab strip
  tabStrip: {
    flexDirection: 'row',
    position: 'relative',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.3)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
  },
  tabLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    letterSpacing: 0.4,
    color: '#4A7A87',
  },
  tabLabelActive: {
    color: '#E8D5B8',
    fontWeight: '500',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -0.5,
    height: 2,
    backgroundColor: '#E8D5B8',
    borderRadius: 1,
  },

  // Tab content
  tabContent: {
    paddingBottom: 8,
  },
  emptyTabText: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 14,
    color: '#4A7A87',
    textAlign: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },

  // Sign out
  signOutButton: {
    marginHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(224,112,112,0.5)',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#E07070',
  },

  // Shared pill
  pill: {
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // Dot rating
  dots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dotFilled: {
    backgroundColor: '#3CC4C4',
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1B5A6A',
  },

  // Region header
  regionRow: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.4)',
  },
  regionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 2.4,
  },

  // Break row
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.2)',
  },
  breakRank: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 22,
    color: '#4A7A87',
    width: 26,
    textAlign: 'center',
    flexShrink: 0,
  },
  breakRankTop: {
    color: '#3CC4C4',
  },
  breakInfo: {
    flex: 1,
    minWidth: 0,
  },
  breakName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 17,
    color: '#E8D5B8',
    marginBottom: 3,
  },
  breakRegion: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  breakPills: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  breakRight: {
    alignItems: 'flex-end',
    gap: 7,
    flexShrink: 0,
  },
  ratingBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  breakRatingLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#4A7A87',
    letterSpacing: 1,
  },
  sessionStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  sessionStatText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
  },
  sessionAvgText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 10,
    color: '#3CC4C4',
  },
  favPill: {
    backgroundColor: 'rgba(127,119,221,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  favPillText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#7F77DD',
    letterSpacing: 0.3,
  },
})
