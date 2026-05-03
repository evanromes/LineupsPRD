import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg'
import { supabase } from '../../lib/supabase'

// ─── Wordmark ─────────────────────────────────────────────────────────────────

function LineupsWordmark() {
  return (
    <Svg width={95} height={44} viewBox="20 120 360 185">
      <SvgText x="200" y="195" fontFamily="Georgia, serif" fontSize="71" fontWeight="700"
        fill="#E8D5B8" textAnchor="middle" letterSpacing="2">Lineups</SvgText>
      <Path d="M60 240 Q130 224,200 240 Q270 256,340 240" fill="none" stroke="#3CC4C4" strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M60 262 Q130 246,200 262 Q270 278,340 262" fill="none" stroke="#3CC4C4" strokeWidth="2.9" strokeLinecap="round" opacity="0.6" />
      <Path d="M60 282 Q130 268,200 282 Q270 296,340 282" fill="none" stroke="#3CC4C4" strokeWidth="2.3" strokeLinecap="round" opacity="0.3" />
    </Svg>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_WIDTH  = Dimensions.get('window').width
const FEED_H_PAD    = 16          // horizontal padding of the list
const CARD_WIDTH    = SCREEN_WIDTH - FEED_H_PAD * 2

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedSession {
  id: string
  date: string
  created_at: string
  notes: string | null
  rating: number | null
  swell_size: string | null
  wind: string | null
  board: string | null
  break_id: string | null
  user_id: string
  // joined
  breaks: { name: string; type: string | null; direction: string | null } | null
  profiles: { username: string; display_name: string | null } | null
  photos: string[]   // resolved public URLs
  // local UI state
  liked: boolean
  likeCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarColor(username: string): string {
  const c = (username || 'a').charAt(0).toLowerCase()
  if (c >= 'a' && c <= 'f') return '#1B7A87'
  if (c >= 'g' && c <= 'l') return '#7F77DD'
  if (c >= 'm' && c <= 'r') return '#C5A882'
  return '#0F5A65'
}

function relativeTime(isoString: string): string {
  const now  = Date.now()
  const then = new Date(isoString).getTime()
  const ms   = now - then
  const mins = Math.floor(ms / 60_000)
  if (mins < 60)  return `${Math.max(1, mins)}m ago`
  const hrs = Math.floor(ms / 3_600_000)
  if (hrs  < 24)  return `${hrs}h ago`
  const days = Math.floor(ms / 86_400_000)
  if (days === 1) return 'Yesterday'
  const d = new Date(isoString)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ username, displayName }: { username: string; displayName: string | null }) {
  const initial = (displayName || username || '?').charAt(0).toUpperCase()
  return (
    <View style={[styles.avatar, { backgroundColor: avatarColor(username) }]}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  )
}

function DotRating({ rating }: { rating: number }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={i <= rating ? styles.dotFilled : styles.dotEmpty} />
      ))}
    </View>
  )
}

function Pill({ label, bgColor, textColor }: { label: string; bgColor: string; textColor: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bgColor }]}>
      <Text style={[styles.pillText, { color: textColor }]}>{label}</Text>
    </View>
  )
}

// ─── Empty state wave illustration ───────────────────────────────────────────

function WaveIllustration() {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Circle cx={32} cy={32} r={32} fill="#1B7A87" />
      <Path d="M12 30 Q22 20, 32 30 Q42 40, 52 30" stroke="#E8D5B8" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <Path d="M12 38 Q22 28, 32 38 Q42 48, 52 38" stroke="#E8D5B8" strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.6} />
      <Path d="M16 46 Q26 36, 32 42 Q38 48, 48 42" stroke="#E8D5B8" strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.3} />
    </Svg>
  )
}

// ─── Feed Card ────────────────────────────────────────────────────────────────

function FeedCard({
  session,
  onToggleLike,
}: {
  session: FeedSession
  onToggleLike: (id: string) => void
}) {
  const username    = session.profiles?.username    ?? 'surfer'
  const displayName = session.profiles?.display_name ?? username
  const breakName   = session.breaks?.name           ?? 'Unknown break'
  const chips       = [session.swell_size, session.wind, session.board].filter(Boolean) as string[]

  function goToBreak() {
    if (!session.break_id) return
    router.push({ pathname: '/break-detail', params: { id: session.break_id, name: breakName } })
  }

  return (
    <View style={styles.card}>

      {/* 1. Author row */}
      <View style={styles.authorRow}>
        <TouchableOpacity
          style={styles.authorLeft}
          activeOpacity={0.75}
          onPress={() =>
            router.push({ pathname: '/(tabs)/profile', params: { userId: session.user_id } })
          }
        >
          <Avatar username={username} displayName={displayName} />
          <View>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.usernameText}>@{username}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.timestamp}>{relativeTime(session.created_at)}</Text>
      </View>

      {/* 2. Break name + pills */}
      <View style={styles.breakRow}>
        <Text style={styles.breakName} numberOfLines={1}>{breakName}</Text>
        <View style={styles.pillRow}>
          {session.breaks?.type && (
            <Pill label={session.breaks.type} bgColor="rgba(83,74,183,0.2)" textColor="#9B95E8" />
          )}
          {session.breaks?.direction && (
            <Pill label={session.breaks.direction} bgColor="rgba(15,110,86,0.2)" textColor="#3CC4C4" />
          )}
        </View>
      </View>

      {/* 3. Rating + conditions */}
      {(session.rating != null || chips.length > 0) && (
        <View style={styles.condRow}>
          {session.rating != null && session.rating > 0 && (
            <DotRating rating={session.rating} />
          )}
          {chips.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {chips.map((chip, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{chip}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* 4. Photo strip */}
      {session.photos.length > 0 && (
        <ScrollView
          horizontal
          pagingEnabled={session.photos.length > 1}
          showsHorizontalScrollIndicator={false}
          style={styles.photoStrip}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH - 32}  // card inner width (16px padding each side)
          snapToAlignment="start"
        >
          {session.photos.map((url, i) => (
            <Image
              key={i}
              source={{ uri: url }}
              style={[
                styles.feedPhoto,
                { width: session.photos.length > 1 ? CARD_WIDTH - 40 : '100%' },
              ]}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}

      {/* 5. Journal excerpt */}
      {!!session.notes?.trim() && (
        <Text style={styles.excerpt} numberOfLines={3}>
          &ldquo;{session.notes.trim()}&rdquo;
        </Text>
      )}

      {/* 6. Bottom action row */}
      <View style={styles.actionRow}>
        <View style={styles.actionLeft}>
          {/* Like */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onToggleLike(session.id)}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Ionicons
              name={session.liked ? 'heart' : 'heart-outline'}
              size={16}
              color={session.liked ? '#3CC4C4' : '#4A7A87'}
            />
            <Text style={[styles.actionText, session.liked && styles.actionTextLiked]}>
              {session.likeCount}
            </Text>
          </TouchableOpacity>

          {/* Comments */}
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} hitSlop={8}>
            <Ionicons name="chatbubble-outline" size={15} color="#4A7A87" />
            <Text style={styles.actionText}>0</Text>
          </TouchableOpacity>
        </View>

        {/* View break */}
        {session.break_id && (
          <TouchableOpacity onPress={goToBreak} hitSlop={8}>
            <Text style={styles.viewBreak}>View break →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type FeedState = 'loading' | 'not-following' | 'empty' | 'ready'

export default function FeedScreen() {
  const insets = useSafeAreaInsets()
  const [sessions, setSessions]   = useState<FeedSession[]>([])
  const [feedState, setFeedState] = useState<FeedState>('loading')
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(useCallback(() => { load() }, []))

  // ─── Data fetching ──────────────────────────────────────────────────────────

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setFeedState('loading')

    try {
      const { data: { session: auth } } = await supabase.auth.getSession()
      const userId = auth?.user?.id
      if (!userId) { setFeedState('not-following'); return }

      // 1. Whom does the user follow?
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)

      const followingIds = (follows ?? []).map((f: any) => f.following_id)

      if (followingIds.length === 0) {
        setFeedState('not-following')
        setSessions([])
        return
      }

      // 2. Fetch public sessions from followed users + joined break + profile
      const { data: rows, error } = await supabase
        .from('sessions')
        .select([
          'id', 'date', 'created_at', 'notes', 'rating',
          'swell_size', 'wind', 'board', 'break_id', 'user_id',
          'breaks(name, type, direction)',
          'profiles(username, display_name)',
        ].join(', '))
        .in('user_id', followingIds)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (error || !rows || rows.length === 0) {
        setFeedState(rows?.length === 0 ? 'empty' : 'empty')
        setSessions([])
        return
      }

      // 3. Photos
      const ids = rows.map((r: any) => r.id)
      const { data: photoRows } = await supabase
        .from('session_photos')
        .select('session_id, storage_path')
        .in('session_id', ids)

      const photoMap = new Map<string, string[]>()
      for (const p of photoRows ?? []) {
        const { data: { publicUrl } } = supabase.storage
          .from('session-photos')
          .getPublicUrl(p.storage_path)
        const list = photoMap.get(p.session_id) ?? []
        list.push(publicUrl)
        photoMap.set(p.session_id, list)
      }

      // 4. Build feed items
      const built: FeedSession[] = rows.map((r: any) => ({
        ...r,
        photos: photoMap.get(r.id) ?? [],
        liked: false,
        likeCount: 0,
      }))

      setSessions(built)
      setFeedState(built.length === 0 ? 'empty' : 'ready')
    } finally {
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => load(true), [])

  function toggleLike(id: string) {
    setSessions(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, liked: !s.liked, likeCount: s.liked ? s.likeCount - 1 : s.likeCount + 1 }
          : s
      )
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2230" />

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topBarSide} />
        <LineupsWordmark />
        <TouchableOpacity
          style={[styles.topBarSide, { alignItems: 'flex-end' }]}
          onPress={() => Alert.alert('Coming soon', 'Find friends coming soon')}
          hitSlop={10}
        >
          <Ionicons name="people-outline" size={20} color="#E8D5B8" />
        </TouchableOpacity>
      </View>

      {/* Body */}
      {feedState === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B7A87" />
        </View>

      ) : feedState === 'not-following' ? (
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3CC4C4" />}
        >
          <WaveIllustration />
          <Text style={styles.emptyTitle}>Your feed is empty</Text>
          <Text style={styles.emptySubtitle}>
            Follow other surfers to see their sessions here
          </Text>
          <TouchableOpacity
            style={styles.findBtn}
            onPress={() => Alert.alert('Coming soon', 'Find friends coming soon')}
            activeOpacity={0.8}
          >
            <Text style={styles.findBtnText}>Find surfers →</Text>
          </TouchableOpacity>
        </ScrollView>

      ) : feedState === 'empty' ? (
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3CC4C4" />}
        >
          <Text style={styles.emptyQuote}>
            Nothing yet — check back after the next swell.
          </Text>
        </ScrollView>

      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3CC4C4" />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FeedCard session={item} onToggleLike={toggleLike} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
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

  // Loader / empty
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 18,
    color: '#E8D5B8',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyQuote: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 14,
    color: '#4A7A87',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  findBtn: {
    marginTop: 4,
    backgroundColor: '#1B7A87',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  findBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#E8D5B8',
    letterSpacing: 0.3,
  },

  // Feed list
  listContent: {
    paddingHorizontal: FEED_H_PAD,
    paddingTop: 14,
  },

  // Card
  card: {
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },

  // 1. Author row
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  authorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 14,
    color: '#E8D5B8',
  },
  displayName: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    fontWeight: '500',
    color: '#E8D5B8',
  },
  usernameText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    marginTop: 1,
  },
  timestamp: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    flexShrink: 0,
    marginLeft: 8,
  },

  // 2. Break name + pills
  breakRow: {
    marginBottom: 8,
    gap: 5,
  },
  breakName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 15,
    color: '#E8D5B8',
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
  },
  pill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    letterSpacing: 0.4,
  },

  // 3. Rating + conditions
  condRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    flexShrink: 0,
  },
  dotFilled: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3CC4C4',
  },
  dotEmpty: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1B5A6A',
  },
  chipsRow: {
    gap: 6,
    paddingRight: 4,
  },
  chip: {
    backgroundColor: 'rgba(74,122,135,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    letterSpacing: 0.2,
  },

  // 4. Photo strip
  photoStrip: {
    marginTop: 8,
    marginHorizontal: -16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  feedPhoto: {
    height: 200,
    borderRadius: 10,
    backgroundColor: '#0B2230',
    marginHorizontal: 4,
  },

  // 5. Journal excerpt
  excerpt: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 13,
    color: '#4A7A87',
    lineHeight: 20.8,
    marginTop: 8,
  },

  // 6. Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(74,122,135,0.25)',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
  },
  actionTextLiked: {
    color: '#3CC4C4',
  },
  viewBreak: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#3CC4C4',
    letterSpacing: 0.2,
  },
})
