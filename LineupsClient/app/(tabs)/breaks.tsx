import { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import {
  Animated,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Text as SvgText, Path } from 'react-native-svg'
import { supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = 'Visited' | 'Favorites' | 'Wishlist'

interface BreakItem {
  id: string
  name: string
  lat: number
  lng: number
  type: string | null
  direction: string | null
  userRating: number | null
  sessionCount: number
  avgSessionRating: number | null
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

const FILTERS: FilterTab[] = ['Visited', 'Favorites', 'Wishlist']

// ─── Region lookup ────────────────────────────────────────────────────────────

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

// ─── Wordmark ─────────────────────────────────────────────────────────────────

function LineupsWordmark() {
  return (
    <Svg width={95} height={44} viewBox="20 120 360 185">
      <SvgText
        x="200"
        y="195"
        fontFamily="Georgia, serif"
        fontSize="71"
        fontWeight="700"
        fill="#E8D5B8"
        textAnchor="middle"
        letterSpacing="2"
      >
        Lineups
      </SvgText>
      <Path
        d="M60 240 Q130 224,200 240 Q270 256,340 240"
        fill="none"
        stroke="#3CC4C4"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <Path
        d="M60 262 Q130 246,200 262 Q270 278,340 262"
        fill="none"
        stroke="#3CC4C4"
        strokeWidth="2.9"
        strokeLinecap="round"
        opacity="0.6"
      />
      <Path
        d="M60 282 Q130 268,200 282 Q270 296,340 282"
        fill="none"
        stroke="#3CC4C4"
        strokeWidth="2.3"
        strokeLinecap="round"
        opacity="0.3"
      />
    </Svg>
  )
}

// ─── Dot Rating ───────────────────────────────────────────────────────────────

function DotRating({ rating }: { rating: number }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={i <= rating ? styles.dotFilled : styles.dotEmpty} />
      ))}
    </View>
  )
}

// ─── Break Row ────────────────────────────────────────────────────────────────

function BreakCard({ item, rank }: { item: BreakItem; rank: number }) {
  const isTop = rank <= 2
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.6}
      onPress={() => router.push({ pathname: '/break-detail', params: { id: item.id, name: item.name } })}
    >
      <Text style={[styles.rank, isTop && styles.rankTop]}>{rank}</Text>

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
        {item.sessionCount > 0 && (
          <View style={styles.sessionStatsRow}>
            <Text style={styles.sessionStatText}>
              {item.sessionCount} {item.sessionCount === 1 ? 'Session' : 'Sessions'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardRight}>
        {item.userRating != null && (
          <View style={styles.ratingBlock}>
            <Text style={styles.breakRatingLabel}>RATING</Text>
            <DotRating rating={item.userRating} />
          </View>
        )}
        {item.isFavorite && (
          <View style={styles.favPill}>
            <Text style={styles.favPillText}>🏄 Favorite</Text>
          </View>
        )}
        {item.isWishlisted && !item.isVisited && <View style={styles.wishDot} />}
        {item.sessionCount > 0 && item.avgSessionRating != null && (
          <Text style={styles.avgSessionRightText}>
            Average Session: {item.avgSessionRating.toFixed(1)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

// ─── Region Header ────────────────────────────────────────────────────────────

function RegionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.regionRow}>
      <Text style={styles.regionLabel}>{title.toUpperCase()} · {count}</Text>
    </View>
  )
}

// ─── Filter types ─────────────────────────────────────────────────────────────

interface ActiveFilters {
  minRating: number | null
  sessionRange: string | null   // '1-5' | '6-15' | '16-50' | '50+'
  breakType: string | null
  direction: string | null
}

const DEFAULT_FILTERS: ActiveFilters = {
  minRating: null, sessionRange: null, breakType: null, direction: null,
}

function activeFilterCount(f: ActiveFilters) {
  return Object.values(f).filter(v => v !== null).length
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

const SESSION_RANGES = ['1-5', '6-15', '16-50', '50+']

const DIRECTION_OPTIONS = ['Left', 'Right', 'Both']

type ChipVariant = 'default' | 'type' | 'direction'

function FilterChip({
  label, active, onPress, variant = 'default',
}: { label: string; active: boolean; onPress: () => void; variant?: ChipVariant }) {
  const activeBg =
    variant === 'type'      ? 'rgba(83,74,183,0.2)'  :
    variant === 'direction' ? 'rgba(15,110,86,0.2)'  : '#1B7A87'
  const activeText =
    variant === 'type'      ? '#9B95E8' :
    variant === 'direction' ? '#3CC4C4' : '#E8D5B8'
  const activeBorder =
    variant === 'type'      ? 'rgba(83,74,183,0.5)'  :
    variant === 'direction' ? 'rgba(15,110,86,0.5)'  : '#1B7A87'

  return (
    <TouchableOpacity
      style={[
        fs.chip,
        active && { backgroundColor: activeBg, borderColor: activeBorder },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[fs.chipText, active && { color: activeText }]}>{label}</Text>
    </TouchableOpacity>
  )
}

function RatingDotsFilter({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <View style={fs.ratingDotsRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity
          key={i}
          onPress={() => onChange(value === i ? null : i)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <View style={value != null && i <= value ? fs.ratingDotFilled : fs.ratingDotEmpty} />
        </TouchableOpacity>
      ))}
    </View>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={fs.section}>
      <Text style={fs.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fs.chipRow}>
        {children}
      </ScrollView>
    </View>
  )
}

function PlainFilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={fs.section}>
      <Text style={fs.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

interface FilterSheetProps {
  visible: boolean
  current: ActiveFilters
  breakTypes: string[]
  onApply: (f: ActiveFilters) => void
  onClose: () => void
}

function FilterSheet({ visible, current, breakTypes, onApply, onClose }: FilterSheetProps) {
  const [draft, setDraft] = useState<ActiveFilters>(current)

  useEffect(() => {
    if (visible) setDraft(current)
  }, [visible])

  function toggle<K extends keyof ActiveFilters>(key: K, value: ActiveFilters[K]) {
    setDraft(d => ({ ...d, [key]: d[key] === value ? null : value }))
  }

  function clearAll() { setDraft(DEFAULT_FILTERS) }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={fs.overlay} onPress={onClose} />
      <View style={fs.sheet}>
        {/* Handle */}
        <View style={fs.handle} />

        {/* Header */}
        <View style={fs.header}>
          <Text style={fs.headerTitle}>Filter</Text>
          <TouchableOpacity onPress={clearAll} activeOpacity={0.7}>
            <Text style={fs.clearText}>Clear all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={fs.body} showsVerticalScrollIndicator={false}>

          {/* Min rating — interactive dots */}
          <PlainFilterSection title="MIN RATING">
            <RatingDotsFilter
              value={draft.minRating}
              onChange={v => setDraft(d => ({ ...d, minRating: v }))}
            />
          </PlainFilterSection>

          {/* Sessions */}
          <FilterSection title="SESSIONS LOGGED">
            {SESSION_RANGES.map(r => (
              <FilterChip
                key={r}
                label={r}
                active={draft.sessionRange === r}
                onPress={() => setDraft(d => ({ ...d, sessionRange: d.sessionRange === r ? null : r }))}
              />
            ))}
          </FilterSection>

          {/* Break type */}
          <FilterSection title="BREAK TYPE">
            {breakTypes.map(t => (
              <FilterChip key={t} label={t} variant="type" active={draft.breakType === t} onPress={() => toggle('breakType', t)} />
            ))}
          </FilterSection>

          {/* Direction */}
          <FilterSection title="WAVE DIRECTION">
            {DIRECTION_OPTIONS.map(d => (
              <FilterChip key={d} label={d} variant="direction" active={draft.direction === d} onPress={() => toggle('direction', d)} />
            ))}
          </FilterSection>

        </ScrollView>

        {/* Apply */}
        <TouchableOpacity style={fs.applyBtn} onPress={() => { onApply(draft); onClose() }} activeOpacity={0.85}>
          <Text style={fs.applyText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const fs = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#0F2838',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(74,122,135,0.5)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.3)',
  },
  headerTitle: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 20,
    color: '#E8D5B8',
  },
  clearText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
  },
  body: { paddingHorizontal: 20 },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.2)',
  },
  sectionTitle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    letterSpacing: 2,
    color: '#4A7A87',
    marginBottom: 10,
  },
  chipRow: { gap: 8, paddingRight: 4 },
  ratingDotsRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingVertical: 4,
  },
  ratingDotFilled: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3CC4C4',
  },
  ratingDotEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#1B5A6A',
  },
  chip: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#0B2230',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.4)',
  },
  chipActive: {
    backgroundColor: '#1B7A87',
    borderColor: '#1B7A87',
  },
  chipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
  },
  chipTextActive: {
    color: '#E8D5B8',
  },
  applyBtn: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 16,
    alignItems: 'center',
  },
  applyText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 15,
    color: '#E8D5B8',
  },
})

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BreaksScreen() {
  const insets = useSafeAreaInsets()
  const [allBreaks, setAllBreaks] = useState<BreakItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('Visited')
  const [query, setQuery]         = useState('')
  const [username, setUsername]   = useState('')
  const [tabContainerWidth, setTabContainerWidth] = useState(0)
  const indicatorAnim = useRef(new Animated.Value(0)).current
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState<ActiveFilters>(DEFAULT_FILTERS)

  // Animate tab indicator when active tab changes
  useEffect(() => {
    if (tabContainerWidth === 0) return
    const tabWidth = tabContainerWidth / FILTERS.length
    const toValue = FILTERS.indexOf(activeFilter) * tabWidth
    Animated.spring(indicatorAnim, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
  }, [activeFilter, tabContainerWidth])

  useFocusEffect(useCallback(() => { fetchData() }, []))

  async function fetchData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      const { data: breaks, error } = await supabase
        .from('breaks')
        .select('id, name, lat, lng, type, direction')

      if (error || !breaks) return

      let ratingMap: Map<string, { rating: number | null; sessions: number; isFavorite: boolean }> = new Map()
      let wishlistSet: Set<string> = new Set()

      if (userId) {
        const [{ data: profile }, { data: ratings }, { data: wishlist }, { data: sessions }] = await Promise.all([
          supabase.from('profiles').select('username').eq('id', userId).single(),
          supabase.from('break_ratings').select('break_id, rating, is_favorite').eq('user_id', userId),
          supabase.from('wishlist').select('break_id').eq('user_id', userId),
          supabase.from('sessions').select('break_id, rating').eq('user_id', userId),
        ])

        if (profile?.username) setUsername(profile.username)

        const sessionCounts = new Map<string, number>()
        const sessionRatingSum = new Map<string, number>()
        const sessionRatingCount = new Map<string, number>()
        for (const s of sessions ?? []) {
          sessionCounts.set(s.break_id, (sessionCounts.get(s.break_id) ?? 0) + 1)
          if (s.rating != null && s.rating > 0) {
            sessionRatingSum.set(s.break_id, (sessionRatingSum.get(s.break_id) ?? 0) + s.rating)
            sessionRatingCount.set(s.break_id, (sessionRatingCount.get(s.break_id) ?? 0) + 1)
          }
        }

        for (const r of ratings ?? []) {
          ratingMap.set(r.break_id, {
            rating: r.rating ?? null,
            sessions: sessionCounts.get(r.break_id) ?? 0,
            isFavorite: r.is_favorite ?? false,
          })
        }

        for (const [breakId, count] of sessionCounts.entries()) {
          if (!ratingMap.has(breakId)) {
            ratingMap.set(breakId, { rating: null, sessions: count, isFavorite: false })
          }
        }

        for (const w of wishlist ?? []) wishlistSet.add(w.break_id)

        for (const [breakId, entry] of ratingMap.entries()) {
          const count = sessionCounts.get(breakId) ?? 0
          const rCount = sessionRatingCount.get(breakId) ?? 0
          const rSum = sessionRatingSum.get(breakId) ?? 0
          ;(entry as any).avgSessionRating =
            count >= 3 && rCount > 0 ? rSum / rCount : null
        }
      }

      const items: BreakItem[] = breaks.map(b => {
        const rData = ratingMap.get(b.id) as any
        return {
          id: b.id,
          name: b.name,
          lat: b.lat,
          lng: b.lng,
          type: b.type,
          direction: b.direction,
          userRating: rData?.rating ?? null,
          sessionCount: rData?.sessions ?? 0,
          avgSessionRating: rData?.avgSessionRating ?? null,
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

  const availableTypes = useMemo(() =>
    [...new Set(allBreaks.map(b => b.type).filter(Boolean) as string[])].sort(), [allBreaks])

  const sections: Section[] = useMemo(() => {
    let filtered = allBreaks.filter(b => {
      if (activeFilter === 'Visited')   return b.isVisited
      if (activeFilter === 'Favorites') return b.isFavorite
      if (activeFilter === 'Wishlist')  return b.isWishlisted
      return false
    })

    const q = query.trim().toLowerCase()
    if (q) filtered = filtered.filter(b =>
      b.name.toLowerCase().includes(q) || b.region.toLowerCase().includes(q))

    // Apply sheet filters
    const { minRating, sessionRange, breakType, direction } = appliedFilters
    if (minRating) filtered = filtered.filter(b => b.userRating != null && b.userRating >= minRating)
    if (sessionRange) filtered = filtered.filter(b => {
      const s = b.sessionCount
      if (sessionRange === '1-5')   return s >= 1 && s <= 5
      if (sessionRange === '6-15')  return s >= 6 && s <= 15
      if (sessionRange === '16-50') return s >= 16 && s <= 50
      if (sessionRange === '50+')   return s >= 50
      return true
    })
    if (breakType)  filtered = filtered.filter(b => b.type === breakType)
    if (direction)  filtered = filtered.filter(b =>
      b.direction?.toLowerCase().includes(direction.toLowerCase()))

    const groups = new Map<string, BreakItem[]>()
    for (const b of filtered) {
      const list = groups.get(b.region) ?? []
      list.push(b)
      groups.set(b.region, list)
    }

    const sortFn = (a: BreakItem, b: BreakItem) => {
      const rA = a.userRating ?? -1
      const rB = b.userRating ?? -1
      if (rB !== rA) return rB - rA
      if (b.sessionCount !== a.sessionCount) return b.sessionCount - a.sessionCount
      return a.name.localeCompare(b.name)
    }

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([region, items]) => ({
        title: region,
        count: items.length,
        data: items.sort(sortFn),
      }))
  }, [allBreaks, activeFilter, query, appliedFilters])

  const filterCount = activeFilterCount(appliedFilters)

  const tabWidth = tabContainerWidth > 0 ? tabContainerWidth / FILTERS.length : 0

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2230" />

      {/* ── Top bar: username | wordmark | share ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.usernameText}>
          {username ? `@${username}` : ''}
        </Text>
        <LineupsWordmark />
        <TouchableOpacity style={styles.shareBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={20} color="#E8D5B8" />
        </TouchableOpacity>
      </View>

      {/* ── Page title ── */}
      <Text style={styles.pageTitle}>My Breaks</Text>

      {/* ── Tab strip ── */}
      <View
        style={styles.tabStrip}
        onLayout={e => setTabContainerWidth(e.nativeEvent.layout.width)}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={styles.tab}
            onPress={() => setActiveFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeFilter === f && styles.tabLabelActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Sliding indicator */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.tabIndicator,
              { width: tabWidth, transform: [{ translateX: indicatorAnim }] },
            ]}
          />
        )}
      </View>

      {/* ── Search + filter ── */}
      <View style={styles.searchWrap}>
        {/* Filter button */}
        <TouchableOpacity
          style={[styles.filterBtn, filterCount > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilterSheet(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={16} color={filterCount > 0 ? '#E8D5B8' : '#4A7A87'} />
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Search input */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={13} color="#4A7A87" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search breaks..."
            placeholderTextColor="#4A7A87"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <FilterSheet
        visible={showFilterSheet}
        current={appliedFilters}
        breakTypes={availableTypes}
        onApply={setAppliedFilters}
        onClose={() => setShowFilterSheet(false)}
      />

      {/* ── List ── */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color="#3CC4C4" />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No breaks found</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 96 }]}
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
  usernameText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#E8D5B8',
    width: 80,
  },
  shareBtn: {
    width: 80,
    alignItems: 'flex-end',
  },

  // Page title
  pageTitle: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 28,
    color: '#E8D5B8',
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 20,
  },

  // Tab strip
  tabStrip: {
    flexDirection: 'row',
    position: 'relative',
    marginHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74, 122, 135, 0.3)',
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
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

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74, 122, 135, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filterBtnActive: {
    backgroundColor: '#1B7A87',
    borderColor: '#1B7A87',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3CC4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '700',
    fontSize: 9,
    color: '#0B2230',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74, 122, 135, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#E8D5B8',
    padding: 0,
  },

  // List
  listContent: { paddingTop: 4 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'Helvetica Neue', fontSize: 13, color: '#4A7A87' },

  // Region header
  regionRow: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74, 122, 135, 0.4)',
  },
  regionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 2.4,
  },

  // Break row — flat, separated by a thin bottom line
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74, 122, 135, 0.2)',
  },
  rank: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 22,
    color: '#4A7A87',
    width: 26,
    textAlign: 'center',
    flexShrink: 0,
  },
  rankTop: { color: '#3CC4C4' },

  cardBody: { flex: 1, minWidth: 0 },
  breakName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 17,
    color: '#E8D5B8',
    marginBottom: 3,
  },
  breakLoc: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  pillRow: { flexDirection: 'row', gap: 5, alignItems: 'center', flexWrap: 'wrap' },
  pillType: {
    backgroundColor: 'rgba(83, 74, 183, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillTypeText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#9B95E8',
  },
  pillDir: {
    backgroundColor: 'rgba(15, 110, 86, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillDirText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#3CC4C4',
  },

  cardRight: { alignItems: 'flex-end', gap: 7, flexShrink: 0 },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dotFilled: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#3CC4C4' },
  dotEmpty: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1B5A6A',
  },

  sessionStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  sessionStatText: { fontFamily: 'Helvetica Neue', fontSize: 10, color: '#4A7A87' },

  ratingBlock: { alignItems: 'flex-end', gap: 4 },
  breakRatingLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#4A7A87',
    letterSpacing: 1,
  },

  favPill: {
    backgroundColor: 'rgba(127,119,221,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  favPillText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#7F77DD',
    letterSpacing: 0.3,
  },
  wishDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#4A7A87' },

  avgSessionRightText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 9,
    color: '#3CC4C4',
    letterSpacing: 0.2,
  },
})
