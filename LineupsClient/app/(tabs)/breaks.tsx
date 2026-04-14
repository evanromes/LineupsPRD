import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  SectionList,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = 'All' | 'Visited' | 'Favorites' | 'Wishlist'

interface BreakItem {
  id: string
  name: string
  lat: number
  lng: number
  type: string | null
  direction: string | null
  userRating: number | null   // 1–5
  approxSessions: number
  isFavorite: boolean
  isWishlisted: boolean
  isVisited: boolean
  region: string
}

interface Section {
  title: string
  count: number
  data: BreakItem[]
}

// ─── Region lookup ────────────────────────────────────────────────────────────

function regionFromLatLng(lat: number, lng: number): string {
  // North America
  if (lat >= 32 && lat <= 42 && lng >= -124 && lng <= -114) return 'California, USA'
  if (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154) return 'Hawaii, USA'
  if (lat >= 43 && lat <= 50 && lng >= -127 && lng <= -118) return 'Pacific Northwest'
  if (lat >= 20 && lat <= 32 && lng >= -120 && lng <= -85)  return 'Mexico'
  if (lat >= 7  && lat <= 20 && lng >= -92  && lng <= -77)  return 'Central America'
  // South America
  if (lat >= -35 && lat <= 5 && lng >= -74 && lng <= -30)   return 'Brazil'
  if (lat >= -56 && lat <= -5 && lng >= -82 && lng <= -65)  return 'South America'
  // Europe / Africa
  if (lat >= 43 && lat <= 47 && lng >= -5  && lng <= 3)     return 'Basque Country, Spain'
  if (lat >= 36 && lat <= 44 && lng >= -10 && lng <= -6)    return 'Portugal'
  if (lat >= 49 && lat <= 60 && lng >= -12 && lng <= 2)     return 'UK & Ireland'
  if (lat >= 27 && lat <= 36 && lng >= -14 && lng <= 0)     return 'Morocco'
  if (lat >= 36 && lat <= 47 && lng >= 0   && lng <= 18)    return 'Mediterranean'
  // Asia / Pacific
  if (lat >= -11 && lat <= -5 && lng >= 105 && lng <= 125)  return 'Indonesia'
  if (lat >= -44 && lat <= -25 && lng >= 113 && lng <= 155) return 'Australia'
  if (lat >= -25 && lat <= -10 && lng >= 113 && lng <= 155) return 'North Australia'
  if (lat >= 10 && lat <= 30 && lng >= 120 && lng <= 145)   return 'Philippines'
  // Fallback: bucket by first letter of region cluster
  if (lat >= 0 && lat <= 90 && lng >= -180 && lng <= -100)  return 'North Pacific'
  if (lat >= 0 && lat <= 90 && lng >= -100 && lng <= 0)     return 'North Atlantic'
  if (lat >= -90 && lat <= 0 && lng >= -180 && lng <= 0)    return 'South Atlantic'
  return 'Other'
}

// ─── Dot Rating ───────────────────────────────────────────────────────────────

function DotRating({ rating }: { rating: number }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4, 5].map(i => (
        <View
          key={i}
          style={i <= rating ? styles.dotFilled : styles.dotEmpty}
        />
      ))}
    </View>
  )
}

// ─── Break Card ───────────────────────────────────────────────────────────────

function BreakCard({ item, rank }: { item: BreakItem; rank: number }) {
  const isTop = rank <= 2
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() => router.push({ pathname: '/break-detail', params: { id: item.id, name: item.name } })}
    >
      {/* Rank */}
      <Text style={[styles.rank, isTop && styles.rankTop]}>{rank}</Text>

      {/* Center body */}
      <View style={styles.cardBody}>
        <Text style={styles.breakName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.breakLoc}>{item.region}</Text>
        <View style={styles.pillRow}>
          {item.type && (
            <View style={styles.pillType}>
              <Text style={styles.pillTypeText}>{item.type}</Text>
            </View>
          )}
          {item.direction && (
            <View style={styles.pillDir}>
              <Text style={styles.pillDirText}>{item.direction}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Right side */}
      <View style={styles.cardRight}>
        {item.userRating != null && <DotRating rating={item.userRating} />}
        {item.approxSessions > 0 && (
          <View style={styles.sessionBlock}>
            <Text style={styles.sessionCount}>{item.approxSessions}</Text>
            <Text style={styles.sessionLabel}>surfs</Text>
          </View>
        )}
        {item.isFavorite && <View style={styles.favDot} />}
        {item.isWishlisted && !item.isVisited && <View style={styles.wishDot} />}
      </View>
    </TouchableOpacity>
  )
}

// ─── Region Header ────────────────────────────────────────────────────────────

function RegionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.regionRow}>
      <Text style={styles.regionLabel}>
        {title.toUpperCase()} · {count}
      </Text>
      <View style={styles.regionRule} />
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const FILTERS: FilterTab[] = ['All', 'Visited', 'Favorites', 'Wishlist']

export default function BreaksScreen() {
  const insets = useSafeAreaInsets()
  const [allBreaks, setAllBreaks] = useState<BreakItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All')
  const [query, setQuery]         = useState('')

  // ─── Fetch ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      // Always fetch all breaks
      const { data: breaks, error } = await supabase
        .from('breaks')
        .select('id, name, lat, lng, type, direction')

      if (error || !breaks) return

      // User-specific data (skip if not logged in)
      let ratingMap: Map<string, { rating: number | null; sessions: number; isFavorite: boolean }> = new Map()
      let wishlistSet: Set<string> = new Set()

      if (userId) {
        const [{ data: ratings }, { data: wishlist }, { data: sessions }] = await Promise.all([
          supabase.from('break_ratings').select('break_id, rating, is_favorite').eq('user_id', userId),
          supabase.from('wishlist').select('break_id').eq('user_id', userId),
          supabase.from('sessions').select('break_id').eq('user_id', userId),
        ])

        // Build session count per break
        const sessionCounts = new Map<string, number>()
        for (const s of sessions ?? []) {
          sessionCounts.set(s.break_id, (sessionCounts.get(s.break_id) ?? 0) + 1)
        }

        for (const r of ratings ?? []) {
          ratingMap.set(r.break_id, {
            rating: r.rating ?? null,
            sessions: sessionCounts.get(r.break_id) ?? 0,
            isFavorite: r.is_favorite ?? false,
          })
        }

        // Also capture sessions for visited breaks that have no rating row yet
        for (const [breakId, count] of sessionCounts.entries()) {
          if (!ratingMap.has(breakId)) {
            ratingMap.set(breakId, { rating: null, sessions: count, isFavorite: false })
          }
        }

        for (const w of wishlist ?? []) wishlistSet.add(w.break_id)
      }

      const items: BreakItem[] = breaks.map(b => {
        const rData = ratingMap.get(b.id)
        return {
          id: b.id,
          name: b.name,
          lat: b.lat,
          lng: b.lng,
          type: b.type,
          direction: b.direction,
          userRating: rData?.rating ?? null,
          approxSessions: rData?.sessions ?? 0,
          isFavorite: rData?.isFavorite ?? false,
          isWishlisted: wishlistSet.has(b.id),
          isVisited: ratingMap.has(b.id),
          region: regionFromLatLng(b.lat, b.lng),
        }
      })

      setAllBreaks(items)
    } finally {
      setLoading(false)
    }
  }

  // ─── Filter + group ───────────────────────────────────────────────────────

  const sections: Section[] = useMemo(() => {
    // 1. Filter by tab
    let filtered = allBreaks.filter(b => {
      if (activeFilter === 'Visited')   return b.isVisited
      if (activeFilter === 'Favorites') return b.isFavorite
      if (activeFilter === 'Wishlist')  return b.isWishlisted
      return true
    })

    // 2. Filter by search query
    const q = query.trim().toLowerCase()
    if (q) filtered = filtered.filter(b => b.name.toLowerCase().includes(q))

    // 3. Group by region
    const groups = new Map<string, BreakItem[]>()
    for (const b of filtered) {
      const list = groups.get(b.region) ?? []
      list.push(b)
      groups.set(b.region, list)
    }

    // 4. Sort within each group: rating desc, then sessions desc, then name
    const sortFn = (a: BreakItem, b: BreakItem) => {
      const rA = a.userRating ?? -1
      const rB = b.userRating ?? -1
      if (rB !== rA) return rB - rA
      if (b.approxSessions !== a.approxSessions) return b.approxSessions - a.approxSessions
      return a.name.localeCompare(b.name)
    }

    // 5. Build sections, sort regions alphabetically
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([region, items]) => ({
        title: region,
        count: items.length,
        data: items.sort(sortFn),
      }))
  }, [allBreaks, activeFilter, query])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EDE0" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Breaks</Text>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, activeFilter === f && styles.chipActive]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, activeFilter === f && styles.chipTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={13} color="#A8845A" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search breaks..."
            placeholderTextColor="#C5A882"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#1B7A87" />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No breaks found</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 96 },
          ]}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <RegionHeader title={section.title} count={section.count} />
          )}
          renderItem={({ item, index }) => (
            <BreakCard item={item} rank={index + 1} />
          )}
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
    backgroundColor: '#F5EDE0',
    borderBottomWidth: 0.5,
    borderBottomColor: '#D8C8B0',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 24,
    color: '#2A1A08',
    marginBottom: 12,
  },

  // Filter chips
  filterScroll: {
    marginBottom: 10,
  },
  filterContent: {
    gap: 6,
    paddingRight: 4,
  },
  chip: {
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
  },
  chipActive: {
    backgroundColor: '#1B7A87',
    borderColor: '#1B7A87',
  },
  chipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#7A4E2A',
  },
  chipTextActive: {
    color: '#E8D5B8',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#2A1A08',
    padding: 0,
  },

  // List
  listContent: {
    paddingTop: 4,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#A8845A',
  },

  // Region header
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 8,
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

  // Break card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEFAF5',
    borderWidth: 0.5,
    borderColor: '#D8C8B0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 18,
    marginBottom: 8,
  },
  rank: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 18,
    color: '#C5A882',
    width: 22,
    textAlign: 'center',
    flexShrink: 0,
  },
  rankTop: {
    color: '#1B7A87',
  },

  // Card body
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  breakName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 14,
    color: '#2A1A08',
    marginBottom: 2,
  },
  breakLoc: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#A8845A',
    letterSpacing: 0.3,
    marginBottom: 5,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  pillType: {
    backgroundColor: '#EEEDFE',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillTypeText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 8,
    letterSpacing: 0.5,
    color: '#534AB7',
  },
  pillDir: {
    backgroundColor: '#E1F5EE',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillDirText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 8,
    letterSpacing: 0.5,
    color: '#0F6E56',
  },

  // Card right
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  dots: {
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
  sessionBlock: {
    alignItems: 'flex-end',
  },
  sessionCount: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 13,
    color: '#2A1A08',
  },
  sessionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 8,
    color: '#A8845A',
    letterSpacing: 0.3,
    marginTop: -1,
  },
  favDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#7F77DD',
  },
  wishDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#C5A882',
  },
})
