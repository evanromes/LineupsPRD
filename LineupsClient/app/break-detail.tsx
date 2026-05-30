import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import Svg, { Path } from 'react-native-svg'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { RateBreakModal } from '../components/RateBreakModal'

// ─── Map constants ────────────────────────────────────────────────────────────

const SCREEN_HEIGHT = Dimensions.get('window').height
const BANNER_HEIGHT = Math.round(SCREEN_HEIGHT * 0.33)

const DARK_MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#0d1f2d' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#4A7A87' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0B2230' }] },
  { featureType: 'water', elementType: 'geometry',           stylers: [{ color: '#060F14' }] },
  { featureType: 'water', elementType: 'labels.text.fill',   stylers: [{ color: '#1B5A6A' }] },
  { featureType: 'road',  elementType: 'geometry',           stylers: [{ color: '#0F2D3A' }] },
  { featureType: 'road',  elementType: 'geometry.stroke',    stylers: [{ color: '#0B2230' }] },
  { featureType: 'road',  elementType: 'labels.text.fill',   stylers: [{ color: '#2A5A65' }] },
  { featureType: 'road.highway', elementType: 'geometry',    stylers: [{ color: '#1B3A45' }] },
  { featureType: 'landscape',    elementType: 'geometry',    stylers: [{ color: '#0F2D3A' }] },
  { featureType: 'poi',          stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',      stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1B3A45' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#2A5A65' }] },
]

// ─── Break Pin (static, single instance) ──────────────────────────────────────

function BreakPin() {
  return (
    <View style={styles.pinWrapper}>
      <View style={styles.pinCircle}>
        <Svg width={14} height={8} viewBox="2 4 20 12">
          <Path
            d="M4 10 Q8 5, 12 10 Q16 15, 20 10"
            stroke="#E8D5B8"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={styles.pinTailLine} />
      <View style={styles.pinTailDot} />
    </View>
  )
}

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

interface TaggedUser {
  id: string
  displayName: string
  avatarUrl: string | null
}

interface Session {
  id: string
  date: string
  notes: string | null
  rating: number | null
  swell_size: string | null
  wind: string | null
  crowd_factor: string | null
  board: string | null
  duration_minutes: number | null
  is_public: boolean
  user_id: string
  photos: SessionPhoto[]
  taggedUsers: TaggedUser[]
  isOwn: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function breakRatingLabel(r: number): string {
  if (r === 1) return 'Not worth it'
  if (r === 2) return 'Mediocre'
  if (r === 3) return 'Decent spot'
  if (r === 4) return 'Really good'
  if (r === 5) return 'Epic'
  return ''
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
  if (lat >= -44 && lat <= -25 && lng >= 113 && lng <= 155) return 'Australia'
  if (lat >= -25 && lat <= -10 && lng >= 113 && lng <= 155) return 'North Australia'
  if (lat >= 10 && lat <= 30 && lng >= 120 && lng <= 145)   return 'Philippines'
  if (lat >= 0 && lat <= 90 && lng >= -180 && lng <= -100)  return 'North Pacific'
  if (lat >= 0 && lat <= 90 && lng >= -100 && lng <= 0)     return 'North Atlantic'
  if (lat >= -90 && lat <= 0 && lng >= -180 && lng <= 0)    return 'South Atlantic'
  return 'Other'
}

// ─── Dot Rating ───────────────────────────────────────────────────────────────

function DotRating({ rating, size = 7 }: { rating: number; size?: number }) {
  const gap = Math.max(3, Math.round(size * 0.32))
  return (
    <View style={[styles.dots, { gap }]}>
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

// ─── Action Icon ──────────────────────────────────────────────────────────────

function ActionIcon({
  icon,
  onPress,
  active,
  disabled,
  activeColor,
}: {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  active: boolean
  disabled?: boolean
  activeColor?: { bg: string; border: string; icon: string }
}) {
  const iconColor = disabled
    ? '#4A7A87'
    : active
      ? (activeColor?.icon ?? '#3CC4C4')
      : '#7AABB8'
  const activeOverride = active && activeColor
    ? { backgroundColor: activeColor.bg, borderColor: activeColor.border }
    : null
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.7}
      disabled={disabled}
      hitSlop={6}
    >
      <View
        style={[
          styles.actionIconCircle,
          active && !activeColor && styles.actionIconCircleActive,
          activeOverride,
        ]}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
    </TouchableOpacity>
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

const SWELL_TO_RELATIVE: Record<string, string> = {
  '0–1ft':   'Ankle high',
  '1–2ft':   'Ankle to knee',
  '2–3ft':   'Knee to waist',
  '3–4ft':   'Waist to chest',
  '4–6ft':   'Chest to overhead',
  '6–9ft':   'Overhead to 1.5× overhead',
  '9–12ft':  '1.5× to 2× overhead',
  '12–15ft': '2× to 3× overhead',
  '15–20ft': '3× to 4× overhead',
  '20ft+':   'XL',
}

function formatCrowd(c: string | null): string | null {
  if (!c) return null
  if (c === 'empty')    return 'Empty'
  if (c === 'moderate') return 'Moderate'
  if (c === 'crowded')  return 'Crowded'
  if (c === 'zoo')      return 'Zoo'
  return c.charAt(0).toUpperCase() + c.slice(1)
}

function formatDuration(mins: number | null): string | null {
  if (mins == null || mins <= 0) return null
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function SessionCard({ session }: { session: Session }) {
  const stats: { label: string; value: string; sub?: string }[] = []
  if (session.swell_size) {
    stats.push({
      label: 'SWELL',
      value: session.swell_size,
      sub: SWELL_TO_RELATIVE[session.swell_size],
    })
  }
  if (session.wind)         stats.push({ label: 'WIND',   value: session.wind })
  if (session.crowd_factor) stats.push({ label: 'CROWD',  value: formatCrowd(session.crowd_factor) ?? '' })
  if (session.board)        stats.push({ label: 'BOARD',  value: session.board })
  const duration = formatDuration(session.duration_minutes)
  if (duration) stats.push({ label: 'TIME', value: duration })

  return (
    <View style={[styles.sessionCard, !session.is_public && session.isOwn && styles.sessionCardPrivate]}>
      {/* Header: Date + Privacy */}
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

      {/* Session rating (0-10 scale) */}
      {session.rating != null && session.rating > 0 && (
        <View style={styles.sessionRatingBlock}>
          <Text style={styles.sessionRatingLabel}>SESSION RATING</Text>
          <View style={styles.sessionRatingScore}>
            <Text style={styles.sessionRatingValue}>{session.rating}</Text>
            <Text style={styles.sessionRatingMax}>/10</Text>
          </View>
        </View>
      )}

      {/* Stats grid */}
      {stats.length > 0 && (
        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statTile}>
              <Text style={styles.statTileLabel}>{s.label}</Text>
              <Text style={styles.statTileValue} numberOfLines={2}>{s.value}</Text>
              {s.sub && (
                <Text style={styles.statTileSub} numberOfLines={1}>{s.sub}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Surfed with */}
      {session.taggedUsers.length > 0 && (
        <View style={styles.taggedBlock}>
          <Text style={styles.taggedLabel}>SURFED WITH</Text>
          <View style={styles.taggedList}>
            {session.taggedUsers.map(u => (
              <View key={u.id} style={styles.taggedItem}>
                {u.avatarUrl ? (
                  <Image source={{ uri: u.avatarUrl }} style={styles.taggedAvatar} />
                ) : (
                  <View style={[styles.taggedAvatar, styles.taggedAvatarFallback]}>
                    <Text style={styles.taggedAvatarLetter}>
                      {u.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.taggedName} numberOfLines={1}>{u.displayName}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Journal excerpt */}
      {!!session.notes?.trim() && (
        <Text style={styles.excerpt} numberOfLines={4}>
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
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [sessions, setSessions]       = useState<Session[]>([])
  const [communityCount, setCommunityCount] = useState(0)
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)

  // Rate break modal state
  const [showRateModal, setShowRateModal] = useState(false)

  // Sessions list expansion
  const [showAllSessions, setShowAllSessions] = useState(false)

  useEffect(() => {
    if (id) fetchAll(id)
  }, [id])

  // ─── Data fetching ──────────────────────────────────────────────────────────

  async function fetchAll(breakId: string) {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const userId = authSession?.user?.id ?? null
      setCurrentUserId(userId)

      // Parallel: break details + user rating + wishlist + sessions
      const [
        { data: breakData },
        { data: ratingData },
        { data: wishlistData },
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
        userId
          ? supabase
              .from('wishlist')
              .select('break_id')
              .eq('break_id', breakId)
              .eq('user_id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('sessions')
          .select('id, date, notes, rating, swell_size, wind, crowd_factor, board, duration_minutes, is_public, user_id, tagged_user_ids')
          .eq('break_id', breakId)
          .or(userId ? `is_public.eq.true,user_id.eq.${userId}` : 'is_public.eq.true')
          .order('date', { ascending: false }),
      ])

      if (breakData) setDetails(breakData as BreakDetails)
      if (ratingData) setUserRating(ratingData as UserRating)
      setIsWishlisted(!!wishlistData)

      const rawSessions = (sessionData ?? []) as Array<{
        id: string
        date: string
        notes: string | null
        rating: number | null
        swell_size: string | null
        wind: string | null
        crowd_factor: string | null
        board: string | null
        duration_minutes: number | null
        is_public: boolean
        user_id: string
        tagged_user_ids: string[] | null
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

      // Fetch tagged-user profiles in one batch
      const allTaggedIds = Array.from(
        new Set(rawSessions.flatMap(s => s.tagged_user_ids ?? []))
      )
      const profileMap = new Map<string, TaggedUser>()
      if (allTaggedIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', allTaggedIds)
        for (const p of profileData ?? []) {
          profileMap.set(p.id, {
            id: p.id,
            displayName: p.display_name || p.username || 'Surfer',
            avatarUrl: p.avatar_url ?? null,
          })
        }
      }

      const built: Session[] = rawSessions.map(s => ({
        ...s,
        photos: photoMap.get(s.id) ?? [],
        taggedUsers: (s.tagged_user_ids ?? [])
          .map(id => profileMap.get(id))
          .filter((u): u is TaggedUser => !!u),
        isOwn: s.user_id === userId,
      }))

      setSessions(built)
    } finally {
      setLoading(false)
    }
  }

  // ─── Save break rating ──────────────────────────────────────────────────────

  async function saveBreakRating(rating: number, isFavorite: boolean) {
    if (!id || !currentUserId || rating === 0) return
    await supabase
      .from('break_ratings')
      .upsert(
        { user_id: currentUserId, break_id: id, rating, is_favorite: isFavorite },
        { onConflict: 'user_id,break_id' }
      )
    setUserRating(prev =>
      prev
        ? { ...prev, rating, is_favorite: isFavorite }
        : { rating, approx_sessions: null, is_favorite: isFavorite }
    )
  }

  // ─── Toggle wishlist / favorite ─────────────────────────────────────────────

  async function toggleWishlist() {
    if (!id || !currentUserId) return
    const next = !isWishlisted
    setIsWishlisted(next) // optimistic
    try {
      if (next) {
        await supabase.from('wishlist').insert({ user_id: currentUserId, break_id: id })
      } else {
        await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', currentUserId)
          .eq('break_id', id)
      }
    } catch {
      setIsWishlisted(!next) // revert
    }
  }

  async function toggleFavorite() {
    if (!id || !currentUserId) return
    const next = !(userRating?.is_favorite ?? false)
    setUserRating(prev =>
      prev
        ? { ...prev, is_favorite: next }
        : { rating: null, approx_sessions: null, is_favorite: next }
    )
    try {
      await supabase.from('break_ratings').upsert(
        {
          user_id: currentUserId,
          break_id: id,
          rating: userRating?.rating ?? null,
          is_favorite: next,
        },
        { onConflict: 'user_id,break_id' }
      )
    } catch {
      setUserRating(prev => (prev ? { ...prev, is_favorite: !next } : prev))
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

  // Derived stats from fetched sessions
  const ownSessions = sessions.filter(s => s.isOwn)
  const ownSessionCount = ownSessions.length
  const ratedSessions = ownSessions.filter(s => s.rating != null && s.rating > 0)
  const avgSessionRating =
    ratedSessions.length > 0
      ? ratedSessions.reduce((sum, s) => sum + (s.rating ?? 0), 0) / ratedSessions.length
      : null

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2230" />

      {/* ── Map banner ── */}
      <View style={styles.mapBanner}>
        {details && (
          <MapView
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
            initialRegion={{
              latitude: details.lat,
              longitude: details.lng,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
            customMapStyle={DARK_MAP_STYLE}
            mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            showsCompass={false}
            showsScale={false}
            showsPointsOfInterest={false}
            showsBuildings={false}
            showsUserLocation={false}
            toolbarEnabled={false}
          >
            <Marker
              coordinate={{ latitude: details.lat, longitude: details.lng }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
            >
              <BreakPin />
            </Marker>
          </MapView>
        )}

        <View style={styles.mapOverlay} pointerEvents="none" />

        <View style={[styles.bannerContent, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#E8D5B8" />
            <Text style={styles.backLabel}>Breaks</Text>
          </TouchableOpacity>

          <View style={styles.bannerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={2}>{breakName}</Text>
            {details && (details.type || details.direction || isFavorite) && (
              <Text style={styles.headerMeta} numberOfLines={1}>
                {[details.type, details.direction].filter(Boolean).join(' · ')}
                {isFavorite && (
                  <>
                    {(details.type || details.direction) && (
                      <Text style={styles.headerMeta}>{' · '}</Text>
                    )}
                    <Text style={styles.headerMetaFav}>🏄 Favorite</Text>
                  </>
                )}
              </Text>
            )}
            {details && (
              <Text style={styles.headerCoords}>{regionFromLatLng(details.lat, details.lng)}</Text>
            )}
          </View>
        </View>

        {/* Action icons stacked at bottom-right */}
        <View style={styles.actionIconsStack} pointerEvents="box-none">
          {(userRating?.rating ?? 0) > 0 ? (
            <TouchableOpacity
              style={styles.rerateChip}
              onPress={() => {
                if (!currentUserId) return
                setShowRateModal(true)
              }}
              activeOpacity={0.75}
              disabled={!currentUserId}
              hitSlop={6}
            >
              <Text style={styles.rerateChipText}>Re-Rate</Text>
            </TouchableOpacity>
          ) : (
            <ActionIcon
              icon="add"
              active={false}
              onPress={() => {
                if (!currentUserId) return
                setShowRateModal(true)
              }}
              disabled={!currentUserId}
            />
          )}
          <ActionIcon
            icon={
              (userRating?.rating ?? 0) > 0 || isWishlisted
                ? 'checkmark'
                : 'bookmark-outline'
            }
            active={(userRating?.rating ?? 0) > 0 || isWishlisted}
            activeColor={{
              bg: 'rgba(46, 197, 138, 0.22)',
              border: '#3CC99B',
              icon: '#3CC99B',
            }}
            onPress={toggleWishlist}
            disabled={!currentUserId}
          />
          <ActionIcon
            icon={userRating?.is_favorite ? 'heart' : 'heart-outline'}
            active={!!userRating?.is_favorite}
            activeColor={{
              bg: 'rgba(127, 119, 221, 0.45)',
              border: '#CECBF6',
              icon: '#E8E5FA',
            }}
            onPress={toggleFavorite}
            disabled={!currentUserId}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3CC4C4" />
        </View>
      ) : showAllSessions ? (
        <>
          <TouchableOpacity
            style={styles.backToInfoBtn}
            onPress={() => setShowAllSessions(false)}
            activeOpacity={0.7}
            hitSlop={6}
          >
            <Ionicons name="chevron-back" size={16} color="#3CC4C4" />
            <Text style={styles.backToInfoText}>Back to break info</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>ALL SESSIONS ({sessions.length})</Text>
            <View style={styles.dividerLine} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          >
            {sessions.map(s => <SessionCard key={s.id} session={s} />)}
          </ScrollView>
        </>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        >
          {/* ── Stats card ── */}
          <View style={styles.statsCard}>
            {/* Top: My Break Rating */}
            <View style={styles.statsTopSection}>
              <Text style={styles.statsTopLabel}>MY BREAK RATING</Text>
              <View style={styles.statsTopRatingRow}>
                {userRating?.rating != null && userRating.rating > 0 ? (
                  <DotRating rating={userRating.rating} size={38} />
                ) : (
                  <Text style={styles.statsTopPlaceholder}>Not yet rated</Text>
                )}
              </View>
              {userRating?.rating != null && userRating.rating > 0 && (
                <Text style={styles.statsTopDescriptor}>
                  {breakRatingLabel(userRating.rating)}
                </Text>
              )}
            </View>

            <View style={styles.statsCardDivider} />

            {/* Bottom: Avg Session + # Sessions */}
            <View style={styles.statsBottomRow}>
              <View style={styles.statsBottomTile}>
                <Text style={styles.statValue}>
                  {avgSessionRating != null ? avgSessionRating.toFixed(1) : '—'}
                </Text>
                <Text style={styles.statLabel}>AVG SESSION</Text>
              </View>
              <View style={styles.statsBottomVDivider} />
              <View style={styles.statsBottomTile}>
                <Text style={styles.statValue}>{ownSessionCount > 0 ? String(ownSessionCount) : '—'}</Text>
                <Text style={styles.statLabel}># SESSIONS</Text>
              </View>
            </View>
          </View>

          {/* ── Log session CTA ── */}
          <TouchableOpacity style={styles.ctaBtn} onPress={openLogSession} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Log session</Text>
          </TouchableOpacity>

          {/* ── Sessions divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>MOST RECENT SESSION</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Sessions list ── */}
          {sessions.length === 0 ? (
            <>
              <Text style={styles.emptyText}>No sessions logged here yet.</Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={openLogSession} activeOpacity={0.85}>
                <Text style={styles.ctaText}>Log session</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <SessionCard session={sessions[0]} />
              {sessions.length > 1 && (
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() => setShowAllSessions(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewAllText}>
                    View all sessions ({sessions.length})
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#3CC4C4" />
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}

      <RateBreakModal
        visible={showRateModal}
        breakName={breakName}
        initialRating={userRating?.rating ?? 0}
        initialFavorite={userRating?.is_favorite ?? false}
        onClose={() => setShowRateModal(false)}
        onLogSession={async (rating, isFav) => {
          await saveBreakRating(rating, isFav)
          setShowRateModal(false)
          router.push({
            pathname: '/log-session',
            params: { break_id: id, break_name: breakName },
          })
        }}
        onRateOnly={async (rating, isFav) => {
          await saveBreakRating(rating, isFav)
          setShowRateModal(false)
        }}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B2230',
  },

  // Map banner
  mapBanner: {
    height: BANNER_HEIGHT,
    backgroundColor: '#0B2230',
    overflow: 'hidden',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74, 122, 135, 0.3)',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 34, 48, 0.55)',
  },
  bannerContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  bannerTitleWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    marginRight: 78,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginBottom: 10,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  backLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 16,
    color: '#E8D5B8',
    letterSpacing: 0.5,
    marginLeft: -2,
  },
  headerTitle: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 37,
    color: '#E8D5B8',
    textAlign: 'left',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  headerMeta: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#3CC4C4',
    textAlign: 'left',
    marginTop: 2,
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerMetaFav: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#CECBF6',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerCoords: {
    fontFamily: 'Helvetica Neue',
    fontSize: 17,
    color: '#C5A882',
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Static break pin
  pinWrapper: {
    alignItems: 'center',
  },
  pinCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3CC4C4',
    borderColor: '#E8D5B8',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTailLine: {
    width: 2,
    height: 7,
    backgroundColor: '#E8D5B8',
  },
  pinTailDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8D5B8',
  },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    paddingTop: 16,
  },

  // Stats card
  statsCard: {
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74, 122, 135, 0.4)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  statsTopSection: {
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
  },

  // Action icons stack (bottom-right of map banner)
  actionIconsStack: {
    position: 'absolute',
    right: 8,
    bottom: 14,
    alignItems: 'flex-end',
    gap: 12,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(11, 34, 48, 0.55)',
    borderWidth: 2,
    borderColor: 'rgba(122, 171, 184, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconCircleActive: {
    backgroundColor: 'rgba(60, 196, 196, 0.25)',
    borderColor: '#3CC4C4',
  },

  // Re-rate pill (replaces + icon when rated)
  rerateChip: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: 'rgba(60, 196, 196, 0.25)',
    borderWidth: 2,
    borderColor: '#3CC4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rerateChipText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '600',
    fontSize: 13,
    color: '#3CC4C4',
    letterSpacing: 0.4,
  },
  statsTopLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 17,
    color: '#E8D5B8',
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  statsTopRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
  },
  statsTopPlaceholder: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 15,
    color: '#4A7A87',
  },
  statsTopDescriptor: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 15,
    color: '#3CC4C4',
    textAlign: 'center',
    marginTop: 12,
  },
  statsCardDivider: {
    height: 0.5,
    backgroundColor: 'rgba(74, 122, 135, 0.4)',
  },
  statsBottomRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statsBottomTile: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  statsBottomVDivider: {
    width: 0.5,
    backgroundColor: 'rgba(74, 122, 135, 0.4)',
  },
  statValue: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 26,
    color: '#3CC4C4',
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 1,
  },

  // Dots
  dots: {
    flexDirection: 'row',
    gap: 3,
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
    marginHorizontal: 18,
    backgroundColor: '#1B7A87',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(60, 196, 196, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  ctaText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '600',
    fontSize: 17,
    color: '#E8D5B8',
    letterSpacing: 0.6,
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
    backgroundColor: 'rgba(74, 122, 135, 0.3)',
  },
  dividerLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#4A7A87',
    letterSpacing: 2,
  },

  // Back to break info button (top-left of all-sessions view)
  backToInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 4,
    marginTop: 10,
    marginBottom: 4,
  },
  backToInfoText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 13,
    color: '#3CC4C4',
    letterSpacing: 0.4,
  },

  // View all sessions button
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 18,
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(60, 196, 196, 0.4)',
    backgroundColor: 'rgba(60, 196, 196, 0.08)',
  },
  viewAllText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 13,
    color: '#3CC4C4',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyText: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 14,
    color: '#4A7A87',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 18,
  },

  // Session card
  sessionCard: {
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74, 122, 135, 0.4)',
    borderStyle: 'solid',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 12,
  },
  sessionCardPrivate: {
    borderStyle: 'dashed',
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sessionDate: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 16,
    color: '#E8D5B8',
  },
  privacyBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  privacyPublic: {
    backgroundColor: 'rgba(15, 110, 86, 0.22)',
  },
  privacyPrivate: {
    backgroundColor: 'rgba(127, 119, 221, 0.18)',
  },
  privacyText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    letterSpacing: 0.3,
  },
  privacyPublicText: {
    color: '#3CC4C4',
  },
  privacyPrivateText: {
    color: '#9B95E8',
  },

  // Session rating block
  sessionRatingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74, 122, 135, 0.25)',
  },
  sessionRatingLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    letterSpacing: 1.2,
  },
  sessionRatingScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sessionRatingValue: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 22,
    color: '#3CC4C4',
  },
  sessionRatingMax: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
    marginLeft: 1,
  },

  // Stats grid (labeled tiles)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  statTile: {
    width: '50%',
    paddingVertical: 6,
    paddingRight: 8,
  },
  statTileLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#4A7A87',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  statTileValue: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 13,
    color: '#E8D5B8',
    letterSpacing: 0.2,
  },
  statTileSub: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 11,
    color: '#7AABB8',
    marginTop: 2,
  },

  // Surfed with
  taggedBlock: {
    marginBottom: 12,
  },
  taggedLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#4A7A87',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  taggedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taggedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74, 122, 135, 0.18)',
    borderRadius: 16,
    paddingLeft: 3,
    paddingRight: 10,
    paddingVertical: 3,
  },
  taggedAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1B3A45',
  },
  taggedAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  taggedAvatarLetter: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 11,
    color: '#E8D5B8',
  },
  taggedName: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 12,
    color: '#E8D5B8',
    letterSpacing: 0.2,
    maxWidth: 140,
  },

  // Journal excerpt
  excerpt: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 13,
    color: '#C5A882',
    lineHeight: 19,
    marginBottom: 12,
  },

  // Photo strip
  photoScroll: {
    marginTop: 2,
  },
  photoRow: {
    gap: 8,
    paddingRight: 4,
  },
  photo: {
    width: 110,
    height: 110,
    borderRadius: 10,
    backgroundColor: '#0B2230',
  },
})
