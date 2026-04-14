import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface BreakDetails {
  name: string
  lat: number
  lng: number
  type: string | null
  direction: string | null
}

interface UserRating {
  rating: number | null
  approx_sessions: number | null
  is_favorite: boolean
}

interface SessionPhoto {
  url: string
}

interface Session {
  id: string
  date: string
  notes: string | null
  rating: number | null
  swell_size: string | null
  wind: string | null
  board: string | null
  is_public: boolean
  user_id: string
  photos: SessionPhoto[]
  isOwn: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function coordLabel(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}`
  const lngStr = `${Math.abs(lng).toFixed(3)}° ${lng >= 0 ? 'E' : 'W'}`
  return `${latStr}, ${lngStr}`
}

// ─── Dot Rating ───────────────────────────────────────────────────────────────

function DotRating({ rating, size = 7 }: { rating: number; size?: number }) {
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

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({
  label,
  bgColor,
  textColor,
}: {
  label: string
  bgColor: string
  textColor: string
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bgColor }]}>
      <Text style={[styles.pillText, { color: textColor }]}>{label}</Text>
    </View>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: Session }) {
  const chips = [
    session.swell_size && `${session.swell_size}`,
    session.wind,
    session.board,
  ].filter(Boolean) as string[]

  return (
    <View style={[styles.sessionCard, !session.is_public && session.isOwn && styles.sessionCardPrivate]}>
      {/* Top row: date + privacy badge */}
      <View style={styles.sessionTop}>
        <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
        {session.isOwn && (
          <View style={[
            styles.privacyBadge,
            session.is_public ? styles.privacyPublic : styles.privacyPrivate,
          ]}>
            <Text style={[
              styles.privacyText,
              session.is_public ? styles.privacyPublicText : styles.privacyPrivateText,
            ]}>
              {session.is_public ? '● Public' : '◆ Private'}
            </Text>
          </View>
        )}
      </View>

      {/* Conditions chips */}
      {chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsRow}
        >
          {chips.map((chip, i) => (
            <View key={i} style={styles.condChip}>
              <Text style={styles.condChipText}>{chip}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Rating dots */}
      {session.rating != null && session.rating > 0 && (
        <View style={styles.sessionRatingRow}>
          <DotRating rating={session.rating} size={7} />
        </View>
      )}

      {/* Journal excerpt */}
      {!!session.notes?.trim() && (
        <Text style={styles.excerpt} numberOfLines={3}>
          &ldquo;{session.notes.trim()}&rdquo;
        </Text>
      )}

      {/* Photo strip */}
      {session.photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoScroll}
          contentContainerStyle={styles.photoRow}
        >
          {session.photos.map((p, i) => (
            <Image
              key={i}
              source={{ uri: p.url }}
              style={styles.photo}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BreakDetailScreen() {
  const insets = useSafeAreaInsets()
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>()

  const [loading, setLoading]         = useState(true)
  const [details, setDetails]         = useState<BreakDetails | null>(null)
  const [userRating, setUserRating]   = useState<UserRating | null>(null)
  const [sessions, setSessions]       = useState<Session[]>([])
  const [communityCount, setCommunityCount] = useState(0)
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)

  useEffect(() => {
    if (id) fetchAll(id)
  }, [id])

  // ─── Data fetching ──────────────────────────────────────────────────────────

  async function fetchAll(breakId: string) {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const userId = authSession?.user?.id ?? null
      setCurrentUserId(userId)

      // Parallel: break details + user rating + sessions
      const [
        { data: breakData },
        { data: ratingData },
        { data: sessionData },
      ] = await Promise.all([
        supabase
          .from('breaks')
          .select('name, lat, lng, type, direction')
          .eq('id', breakId)
          .single(),
        userId
          ? supabase
              .from('break_ratings')
              .select('rating, approx_sessions, is_favorite')
              .eq('break_id', breakId)
              .eq('user_id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('sessions')
          .select('id, date, notes, rating, swell_size, wind, board, is_public, user_id')
          .eq('break_id', breakId)
          .or(userId ? `is_public.eq.true,user_id.eq.${userId}` : 'is_public.eq.true')
          .order('date', { ascending: false }),
      ])

      if (breakData) setDetails(breakData as BreakDetails)
      if (ratingData) setUserRating(ratingData as UserRating)

      const rawSessions = (sessionData ?? []) as Array<{
        id: string
        date: string
        notes: string | null
        rating: number | null
        swell_size: string | null
        wind: string | null
        board: string | null
        is_public: boolean
        user_id: string
      }>

      // Community count = distinct public sessions
      setCommunityCount(rawSessions.filter(s => s.is_public).length)

      if (rawSessions.length === 0) {
        setSessions([])
        return
      }

      // Fetch photos for all sessions
      const sessionIds = rawSessions.map(s => s.id)
      const { data: photoData } = await supabase
        .from('session_photos')
        .select('session_id, storage_path')
        .in('session_id', sessionIds)

      // Build photo URL map
      const photoMap = new Map<string, SessionPhoto[]>()
      for (const p of photoData ?? []) {
        const { data: { publicUrl } } = supabase.storage
          .from('session-photos')
          .getPublicUrl(p.storage_path)
        const list = photoMap.get(p.session_id) ?? []
        list.push({ url: publicUrl })
        photoMap.set(p.session_id, list)
      }

      const built: Session[] = rawSessions.map(s => ({
        ...s,
        photos: photoMap.get(s.id) ?? [],
        isOwn: s.user_id === userId,
      }))

      setSessions(built)
    } finally {
      setLoading(false)
    }
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function goBack() {
    router.back()
  }

  function openLogSession() {
    router.push({
      pathname: '/log-session',
      params: { break_id: id, break_name: details?.name ?? name },
    })
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const breakName = details?.name ?? name ?? 'Break'
  const isVisited = userRating != null
  const isFavorite = userRating?.is_favorite ?? false

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EDE0" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color="#1B7A87" />
          <Text style={styles.backLabel}>Breaks</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={2}>{breakName}</Text>

        {details && (
          <Text style={styles.headerCoords}>{coordLabel(details.lat, details.lng)}</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#1B7A87" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        >
          {/* ── Stats row ── */}
          <View style={styles.statsRow}>
            {/* Sessions */}
            <View style={styles.statTile}>
              <Text style={styles.statValue}>
                {userRating?.approx_sessions != null ? String(userRating.approx_sessions) : '—'}
              </Text>
              <Text style={styles.statLabel}>MY SURFS</Text>
            </View>

            {/* Rating */}
            <View style={styles.statTile}>
              {userRating?.rating != null ? (
                <>
                  <DotRating rating={userRating.rating} size={8} />
                  <Text style={[styles.statLabel, { marginTop: 6 }]}>MY RATING</Text>
                </>
              ) : (
                <>
                  <Text style={styles.statValue}>—</Text>
                  <Text style={styles.statLabel}>MY RATING</Text>
                </>
              )}
            </View>

            {/* Community */}
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{communityCount}</Text>
              <Text style={styles.statLabel}>TOTAL SURFS</Text>
            </View>
          </View>

          {/* ── Pills row ── */}
          <View style={styles.pillsRow}>
            {details?.type && (
              <Pill label={details.type} bgColor="#EEEDFE" textColor="#534AB7" />
            )}
            {details?.direction && (
              <Pill label={details.direction} bgColor="#E1F5EE" textColor="#0F6E56" />
            )}
            {isVisited && (
              <Pill label="Visited" bgColor="#0F5A65" textColor="#3CC4C4" />
            )}
            {isFavorite && (
              <Pill label="Favorite" bgColor="#534AB7" textColor="#EEEDFE" />
            )}
          </View>

          {/* ── Log session CTA ── */}
          <TouchableOpacity style={styles.ctaBtn} onPress={openLogSession} activeOpacity={0.8}>
            <Text style={styles.ctaText}>Log a new session here</Text>
          </TouchableOpacity>

          {/* ── Sessions divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>SESSIONS</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Sessions list ── */}
          {sessions.length === 0 ? (
            <>
              <Text style={styles.emptyText}>No sessions logged here yet.</Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={openLogSession} activeOpacity={0.8}>
                <Text style={styles.ctaText}>Be the first to log one</Text>
              </TouchableOpacity>
            </>
          ) : (
            sessions.map(s => <SessionCard key={s.id} session={s} />)
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
    backgroundColor: '#F5EDE0',
  },

  // Header
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D8C8B0',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  backLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#1B7A87',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 22,
    color: '#2A1A08',
    textAlign: 'center',
    marginBottom: 3,
  },
  headerCoords: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#A8845A',
    textAlign: 'center',
  },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    paddingTop: 16,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  statTile: {
    flex: 1,
    backgroundColor: '#FEFAF5',
    borderWidth: 0.5,
    borderColor: '#D8C8B0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 22,
    color: '#1B7A87',
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#A8845A',
    letterSpacing: 1,
  },

  // Dots
  dots: {
    flexDirection: 'row',
    gap: 3,
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

  // Pills row
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  pill: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // CTA button
  ctaBtn: {
    marginHorizontal: 16,
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  ctaText: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 14,
    color: '#E8D5B8',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 14,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: '#D8C8B0',
  },
  dividerLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#A8845A',
    letterSpacing: 2,
  },

  // Empty state
  emptyText: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 14,
    color: '#A8845A',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 18,
  },

  // Session card
  sessionCard: {
    backgroundColor: '#FEFAF5',
    borderWidth: 0.5,
    borderColor: '#D8C8B0',
    borderStyle: 'solid',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  sessionCardPrivate: {
    borderStyle: 'dashed',
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionDate: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 13,
    color: '#2A1A08',
  },
  privacyBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  privacyPublic: {
    backgroundColor: '#E1F5EE',
  },
  privacyPrivate: {
    backgroundColor: '#F0E4D0',
  },
  privacyText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    letterSpacing: 0.3,
  },
  privacyPublicText: {
    color: '#0F6E56',
  },
  privacyPrivateText: {
    color: '#7A4E2A',
  },

  // Conditions chips
  chipsScroll: {
    marginBottom: 8,
  },
  chipsRow: {
    gap: 6,
    paddingRight: 4,
  },
  condChip: {
    backgroundColor: '#F0E4D0',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  condChipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#7A4E2A',
    letterSpacing: 0.3,
  },

  // Session rating
  sessionRatingRow: {
    marginBottom: 6,
  },

  // Journal excerpt
  excerpt: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 12,
    color: '#6B4E2A',
    lineHeight: 18,
    marginBottom: 8,
  },

  // Photo strip
  photoScroll: {
    marginTop: 4,
  },
  photoRow: {
    gap: 5,
    paddingRight: 4,
  },
  photo: {
    width: 52,
    height: 52,
    borderRadius: 7,
    backgroundColor: '#D8C8B0',
  },
})
