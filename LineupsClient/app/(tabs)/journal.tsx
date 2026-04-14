import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Svg, { Path, Rect } from 'react-native-svg'
import { supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string
  date: string
  notes: string | null
  rating: number | null
  swell_size: string | null
  wind: string | null
  board: string | null
  is_public: boolean
  break_id: string | null
  breaks: { name: string; lat: number; lng: number } | null
  photos: PhotoItem[]
}

interface PhotoItem {
  url: string
}

interface Section {
  title: string      // e.g. "APRIL 2026"
  count: number
  data: SessionRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
}

function formatCardDate(dateStr: string): string {
  // "Sunday, April 6"
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function coordLabel(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`
}

// ─── Lineups Logo (empty state) ───────────────────────────────────────────────

function LineupsLogo({ size = 48 }: { size?: number }) {
  // Mirrors the design/lineups_final_b_icon.svg icon tile exactly,
  // using viewBox="180 58 140 140" to crop to just the icon.
  return (
    <Svg width={size} height={size} viewBox="180 58 140 140">
      <Rect x={180} y={58}  width={140} height={140} rx={32} fill="#1B7A87" />
      <Rect x={200} y={78}  width={100} height={100} rx={18} fill="#0F5A65" />
      <Path
        d="M213 112 Q235 98, 250 112 Q265 126, 287 112"
        stroke="#E8D5B8" strokeWidth={3} fill="none" strokeLinecap="round"
      />
      <Path
        d="M213 128 Q235 114, 250 128 Q265 142, 287 128"
        stroke="#E8D5B8" strokeWidth={2.2} fill="none" strokeLinecap="round"
        opacity={0.6}
      />
      <Path
        d="M213 144 Q235 130, 250 144 Q265 158, 287 144"
        stroke="#E8D5B8" strokeWidth={1.4} fill="none" strokeLinecap="round"
        opacity={0.3}
      />
    </Svg>
  )
}

// ─── Dot Rating ───────────────────────────────────────────────────────────────

function DotRating({ rating }: { rating: number }) {
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={i <= rating ? styles.dotFilled : styles.dotEmpty} />
      ))}
    </View>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: SessionRow }) {
  const chips = [session.swell_size, session.wind, session.board].filter(Boolean) as string[]
  const breakName = session.breaks?.name ?? 'Unknown break'
  const coords    = session.breaks ? coordLabel(session.breaks.lat, session.breaks.lng) : null

  function goToBreak() {
    if (!session.break_id) return
    router.push({
      pathname: '/break-detail',
      params: { id: session.break_id, name: breakName },
    })
  }

  return (
    <TouchableOpacity
      style={[styles.card, !session.is_public && styles.cardPrivate]}
      activeOpacity={0.75}
      onPress={goToBreak}
    >
      {/* 1. Top row: break name + privacy badge */}
      <View style={styles.cardTop}>
        <Text style={styles.cardBreakName} numberOfLines={1}>{breakName}</Text>
        <View style={session.is_public ? styles.badgePublic : styles.badgePrivate}>
          <Text style={session.is_public ? styles.badgePublicText : styles.badgePrivateText}>
            {session.is_public ? 'Public' : 'Private'}
          </Text>
        </View>
      </View>

      {/* 2. Date + location row */}
      <Text style={styles.cardMeta}>
        {formatCardDate(session.date)}
        {coords ? `  ·  ${coords}` : ''}
      </Text>

      {/* 3. Rating dots */}
      {session.rating != null && session.rating > 0 && (
        <View style={styles.cardRating}>
          <DotRating rating={session.rating} />
        </View>
      )}

      {/* 4. Conditions chips */}
      {chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsRow}
        >
          {chips.map((chip, i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* 5. Journal excerpt */}
      {!!session.notes?.trim() && (
        <Text style={styles.excerpt} numberOfLines={3}>
          &ldquo;{session.notes.trim()}&rdquo;
        </Text>
      )}

      {/* 6. Photo strip */}
      {session.photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoScroll}
          contentContainerStyle={styles.photoRow}
        >
          {session.photos.map((p, i) => (
            <Image key={i} source={{ uri: p.url }} style={styles.photo} resizeMode="cover" />
          ))}
        </ScrollView>
      )}

      {/* 7. Bottom "View break" link */}
      {session.break_id && (
        <TouchableOpacity
          style={styles.viewBreakRow}
          onPress={goToBreak}
          hitSlop={8}
        >
          <Text style={styles.viewBreakText}>View break →</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

// ─── Month Section Header ─────────────────────────────────────────────────────

function MonthHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.monthRow}>
      <Text style={styles.monthLabel}>{title} · {count}</Text>
      <View style={styles.monthRule} />
    </View>
  )
}

// ─── Log Session Button ───────────────────────────────────────────────────────

function LogSessionBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.logBtn} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.logBtnText}>+ Log session</Text>
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function JournalScreen() {
  const insets = useSafeAreaInsets()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    load()
  }, [])

  // ─── Data fetching ──────────────────────────────────────────────────────────

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const userId = authSession?.user?.id
      if (!userId) {
        setSessions([])
        return
      }

      // Fetch sessions + break name/coords in one query via FK join
      const { data: rows, error } = await supabase
        .from('sessions')
        .select('id, date, notes, rating, swell_size, wind, board, is_public, break_id, breaks(name, lat, lng)')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (error || !rows) return

      // Fetch photos for all sessions
      const ids = rows.map((r: any) => r.id)
      const photoMap = new Map<string, PhotoItem[]>()

      if (ids.length > 0) {
        const { data: photoRows } = await supabase
          .from('session_photos')
          .select('session_id, storage_path')
          .in('session_id', ids)

        for (const p of photoRows ?? []) {
          const { data: { publicUrl } } = supabase.storage
            .from('session-photos')
            .getPublicUrl(p.storage_path)
          const list = photoMap.get(p.session_id) ?? []
          list.push({ url: publicUrl })
          photoMap.set(p.session_id, list)
        }
      }

      const built: SessionRow[] = rows.map((r: any) => ({
        ...r,
        photos: photoMap.get(r.id) ?? [],
      }))

      setSessions(built)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = useCallback(() => load(true), [])

  function openLogSession() {
    router.push({ pathname: '/log-session', params: {} })
  }

  // ─── Group sessions by month ─────────────────────────────────────────────────

  const sections: Section[] = useMemo(() => {
    const groups = new Map<string, SessionRow[]>()
    for (const s of sessions) {
      const key = monthKey(s.date)
      const list = groups.get(key) ?? []
      list.push(s)
      groups.set(key, list)
    }
    // Map preserves insertion order (already date-desc from Supabase)
    return [...groups.entries()].map(([title, data]) => ({
      title,
      count: data.length,
      data,
    }))
  }, [sessions])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EDE0" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Journal</Text>
        <LogSessionBtn onPress={openLogSession} />
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B7A87" />
        </View>
      ) : sessions.length === 0 ? (
        /* Empty state */
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B7A87" />
          }
        >
          <LineupsLogo size={64} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySubtitle}>Tap + Log session to record your first surf</Text>
          <LogSessionBtn onPress={openLogSession} />
        </ScrollView>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          stickySectionHeadersEnabled
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B7A87" />
          }
          renderSectionHeader={({ section }) => (
            <MonthHeader title={section.title} count={section.count} />
          )}
          renderItem={({ item }) => <SessionCard session={item} />}
        />
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
  },
  headerTitle: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 24,
    color: '#2A1A08',
  },

  // Log session button
  logBtn: {
    backgroundColor: '#1B7A87',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  logBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#E8D5B8',
    letterSpacing: 0.3,
  },

  // Loader / empty
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
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
    color: '#2A1A08',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#A8845A',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
  },

  // Month header
  listContent: {
    paddingTop: 4,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
    backgroundColor: '#F5EDE0',  // opaque so sticky header occludes cards
  },
  monthLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#A8845A',
    letterSpacing: 2,
    flexShrink: 0,
  },
  monthRule: {
    flex: 1,
    height: 0.5,
    backgroundColor: '#D8C8B0',
  },

  // Session card
  card: {
    backgroundColor: '#FEFAF5',
    borderWidth: 0.5,
    borderColor: '#D8C8B0',
    borderStyle: 'solid',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  cardPrivate: {
    borderStyle: 'dashed',
  },

  // 1. Top row
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 10,
  },
  cardBreakName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 15,
    color: '#2A1A08',
    flex: 1,
  },
  badgePublic: {
    backgroundColor: '#E1F5EE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgePrivate: {
    backgroundColor: '#F0E4D0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgePublicText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#0F6E56',
  },
  badgePrivateText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#7A4E2A',
  },

  // 2. Date + location
  cardMeta: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#A8845A',
    marginBottom: 6,
    letterSpacing: 0.2,
  },

  // 3. Rating dots
  cardRating: {
    marginBottom: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  dotFilled: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#1B7A87',
  },
  dotEmpty: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C5A882',
  },

  // 4. Conditions chips
  chipsScroll: {
    marginBottom: 8,
  },
  chipsRow: {
    gap: 6,
    paddingRight: 4,
  },
  chip: {
    backgroundColor: '#F0E4D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#7A4E2A',
    letterSpacing: 0.3,
  },

  // 5. Journal excerpt
  excerpt: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 13,
    color: '#6B4E2A',
    lineHeight: 20.8,   // 13 * 1.6
    marginTop: 8,
    marginBottom: 4,
  },

  // 6. Photo strip
  photoScroll: {
    marginTop: 10,
  },
  photoRow: {
    gap: 6,
    paddingRight: 4,
  },
  photo: {
    width: 52,
    height: 52,
    borderRadius: 7,
    backgroundColor: '#D8C8B0',
  },

  // 7. View break row
  viewBreakRow: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  viewBreakText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#1B7A87',
    letterSpacing: 0.3,
  },
})
