import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface BreakResult {
  id: string
  name: string
  lat: number | null
  lng: number | null
  type: string | null
  direction: string | null
  region: string | null
}

interface RatedBreak {
  breakId: string
  name: string
  rating: number
  isFavorite: boolean
}

function breakRatingLabel(r: number): string {
  if (r === 1) return 'Not worth it'
  if (r === 2) return 'Mediocre'
  if (r === 3) return 'Decent spot'
  if (r === 4) return 'Really good'
  if (r === 5) return 'Epic'
  return ''
}

function getLocationLabel(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) return null
  if (lat >= 32 && lat < 35 && lng >= -118 && lng <= -117) return 'San Diego, CA'
  if (lat >= 33 && lat < 34 && lng >= -119 && lng <= -117) return 'Los Angeles, CA'
  if (lat >= 34 && lat < 35 && lng >= -121 && lng <= -119) return 'Santa Barbara, CA'
  if (lat >= 36 && lat < 37 && lng >= -122 && lng <= -121) return 'Santa Cruz, CA'
  if (lat >= 21 && lat < 22 && lng >= -158 && lng <= -157) return 'Oahu, HI'
  if (lat >= 20 && lat < 21 && lng >= -157 && lng <= -155) return 'Maui, HI'
  if (lat >= -18 && lat < -17 && lng >= 177 && lng <= 178) return 'Fiji'
  if (lat >= 38 && lat < 39 && lng >= -9 && lng <= -8) return 'Portugal'
  if (lat >= 17 && lat < 19 && lng >= -104 && lng <= -101) return 'Mexico'
  return `${lat.toFixed(2)}, ${lng.toFixed(2)}`
}

type RegionBounds = { latMin: number; latMax: number; lngMin: number; lngMax: number }

const REGIONS: { keywords: string[]; bounds: RegionBounds }[] = [
  { keywords: ['san diego'], bounds: { latMin: 32.5, latMax: 33.35, lngMin: -118.0, lngMax: -117.0 } },
  { keywords: ['los angeles', 'la', 'south bay', 'malibu'], bounds: { latMin: 33.75, latMax: 34.15, lngMin: -119.1, lngMax: -118.35 } },
  { keywords: ['orange county', 'oc', 'huntington', 'newport', 'laguna', 'dana point'], bounds: { latMin: 33.35, latMax: 33.75, lngMin: -118.15, lngMax: -117.45 } },
  { keywords: ['santa barbara', 'ventura', 'rincon'], bounds: { latMin: 34.15, latMax: 34.55, lngMin: -120.2, lngMax: -118.85 } },
  { keywords: ['santa cruz', 'san francisco', 'sf', 'norcal', 'northern california'], bounds: { latMin: 36.5, latMax: 38.2, lngMin: -122.7, lngMax: -121.8 } },
  { keywords: ['oahu', 'hawaii', 'pipeline', 'north shore'], bounds: { latMin: 21.2, latMax: 21.75, lngMin: -158.2, lngMax: -157.75 } },
  { keywords: ['maui', 'hawaii', 'jaws', 'honolua'], bounds: { latMin: 20.55, latMax: 21.1, lngMin: -156.8, lngMax: -155.9 } },
  { keywords: ['fiji', 'cloudbreak'], bounds: { latMin: -18.1, latMax: -17.7, lngMin: 177.0, lngMax: 177.35 } },
  { keywords: ['portugal', 'lisbon', 'carcavelos'], bounds: { latMin: 38.5, latMax: 38.75, lngMin: -9.5, lngMax: -9.1 } },
  { keywords: ['mexico', 'baja', 'nexpa', 'pascuales'], bounds: { latMin: 17.7, latMax: 18.9, lngMin: -104.1, lngMax: -101.5 } },
  { keywords: ['california', 'ca', 'socal'], bounds: { latMin: 32.5, latMax: 34.55, lngMin: -120.2, lngMax: -117.0 } },
]

function matchRegionBounds(term: string): RegionBounds[] {
  const lower = term.toLowerCase()
  const matched: RegionBounds[] = []
  for (const r of REGIONS) {
    if (r.keywords.some((k) => k.includes(lower) || lower.includes(k))) {
      if (!matched.some((b) => b.latMin === r.bounds.latMin && b.lngMin === r.bounds.lngMin)) {
        matched.push(r.bounds)
      }
    }
  }
  return matched
}

// ── Progress dots ──────────────────────────────────────────
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
              isActive ? dotStyles.dotActive : isDone ? dotStyles.dotDone : null,
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
    gap: 5,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1B5A6A',
  },
  dotActive: {
    width: 23,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8D5B8',
  },
  dotDone: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3CC4C4',
  },
})

// ── Rating dots (inline on added rows) ────────────────────
function InlineDots({ value }: { value: number }) {
  return (
    <View style={inlineStyles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[inlineStyles.dot, i <= value && inlineStyles.dotFilled]} />
      ))}
    </View>
  )
}

const inlineStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3, marginTop: 5 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(74, 122, 135, 0.4)',
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#3CC4C4', borderColor: '#3CC4C4' },
})

// ── Bottom-sheet dot rating ────────────────────────────────
function DotRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={ratingStyles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} style={ratingStyles.dotWrap}>
          <View style={[ratingStyles.dot, i <= value && ratingStyles.dotFilled]} />
        </TouchableOpacity>
      ))}
    </View>
  )
}

const ratingStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  dotWrap: { padding: 4 },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#4A7A87',
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#1B7A87', borderColor: '#1B7A87' },
})

function groupByRegion(
  breaks: BreakResult[],
  homeRegion: string | null
): { region: string; breaks: BreakResult[] }[] {
  const map = new Map<string, BreakResult[]>()
  for (const b of breaks) {
    const region = b.region ?? getLocationLabel(b.lat, b.lng) ?? 'Other'
    if (!map.has(region)) map.set(region, [])
    map.get(region)!.push(b)
  }
  const sections = Array.from(map.entries()).map(([region, data]) => ({ region, breaks: data }))
  sections.sort((a, b) => {
    if (homeRegion) {
      if (a.region === homeRegion) return -1
      if (b.region === homeRegion) return 1
    }
    if (a.region === 'Other') return 1
    if (b.region === 'Other') return -1
    return a.region.localeCompare(b.region)
  })
  return sections
}

// ── Main screen ────────────────────────────────────────────
export default function OnboardingHistory() {
  const [userId, setUserId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [groupedBreaks, setGroupedBreaks] = useState<{ region: string; breaks: BreakResult[] }[]>([])
  const [initialBreaks, setInitialBreaks] = useState<BreakResult[]>([])
  const [searchResults, setSearchResults] = useState<BreakResult[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [ratedBreaks, setRatedBreaks] = useState<Map<string, RatedBreak>>(new Map())
  const [sheetVisible, setSheetVisible] = useState(false)
  const [sheetBreak, setSheetBreak] = useState<BreakResult | null>(null)
  const [sheetRating, setSheetRating] = useState(0)
  const [sheetFavorite, setSheetFavorite] = useState(false)
  const [saving, setSaving] = useState(false)
  const sheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      const uid = authData.user?.id ?? null
      setUserId(uid)

      // Fetch profile to get home_break name
      let homeRegion: string | null = null
      if (uid) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('home_break')
          .eq('id', uid)
          .maybeSingle()
        if (profile?.home_break) {
          const { data: homeBreakRow } = await supabase
            .from('breaks')
            .select('region, lat, lng')
            .ilike('name', profile.home_break)
            .maybeSingle()
          if (homeBreakRow) {
            homeRegion = homeBreakRow.region ?? getLocationLabel(homeBreakRow.lat, homeBreakRow.lng)
          }
        }
      }

      // Fetch a broad set of breaks to fill all regions
      const { data: breaks } = await supabase
        .from('breaks')
        .select('id, name, lat, lng, type, direction, region')
        .eq('is_custom', false)
        .order('name', { ascending: true })
        .limit(150)

      const all = breaks ?? []
      setInitialBreaks(all)
      setGroupedBreaks(groupByRegion(all, homeRegion))
      setLoadingInitial(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!searchText.trim()) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      const term = searchText.trim()
      const regionBounds = matchRegionBounds(term)

      const queries: Promise<{ data: BreakResult[] | null }>[] = [
        supabase
          .from('breaks')
          .select('id, name, lat, lng, type, direction, region')
          .ilike('name', `%${term}%`)
          .eq('is_custom', false)
          .order('name', { ascending: true })
          .limit(30) as unknown as Promise<{ data: BreakResult[] | null }>,
        ...regionBounds.map((b) =>
          supabase
            .from('breaks')
            .select('id, name, lat, lng, type, direction, region')
            .eq('is_custom', false)
            .gte('lat', b.latMin).lte('lat', b.latMax)
            .gte('lng', b.lngMin).lte('lng', b.lngMax)
            .order('name', { ascending: true })
            .limit(30) as unknown as Promise<{ data: BreakResult[] | null }>
        ),
      ]

      const results = await Promise.all(queries)
      const seen = new Set<string>()
      const merged: BreakResult[] = []
      for (const r of results) {
        for (const item of r.data ?? []) {
          if (!seen.has(item.id)) { seen.add(item.id); merged.push(item) }
        }
      }
      merged.sort((a, b) => a.name.localeCompare(b.name))
      setSearchResults(merged)
    }, 300)
  }, [searchText])

  function openSheet(breakItem: BreakResult) {
    const existing = ratedBreaks.get(breakItem.id)
    setSheetBreak(breakItem)
    setSheetRating(existing?.rating ?? 0)
    setSheetFavorite(existing?.isFavorite ?? false)
    setSheetVisible(true)
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start()
  }

  function closeSheet() {
    Animated.timing(sheetY, { toValue: SCREEN_HEIGHT, useNativeDriver: true, duration: 260 }).start(
      () => setSheetVisible(false)
    )
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) sheetY.setValue(gs.dy) },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) closeSheet()
        else Animated.spring(sheetY, { toValue: 0, useNativeDriver: true }).start()
      },
    })
  ).current

  async function confirmBreak() {
    if (!userId || !sheetBreak || sheetRating === 0) return
    setSaving(true)

    const { error } = await supabase.from('break_ratings').upsert(
      { user_id: userId, break_id: sheetBreak.id, rating: sheetRating, is_favorite: sheetFavorite },
      { onConflict: 'user_id,break_id' }
    )

    setSaving(false)

    if (error) {
      console.error('break_ratings upsert failed:', error.message)
      return
    }

    setRatedBreaks((prev) => {
      const next = new Map(prev)
      next.set(sheetBreak.id, { breakId: sheetBreak.id, name: sheetBreak.name, rating: sheetRating, isFavorite: sheetFavorite })
      return next
    })

    closeSheet()
  }

  const isAdded = (id: string) => ratedBreaks.has(id)
  const isSearching = searchText.trim().length > 0

  function renderBreakRow(b: BreakResult) {
    const added = isAdded(b.id)
    const rated = ratedBreaks.get(b.id)
    const typeCapped = b.type ? b.type.charAt(0).toUpperCase() + b.type.slice(1) : null
    const dirCapped = b.direction ? b.direction.charAt(0).toUpperCase() + b.direction.slice(1) : null
    const regionLabel = b.region ?? getLocationLabel(b.lat, b.lng)
    return (
      <View key={b.id} style={[styles.breakRow, added && styles.breakRowAdded]}>
        <View style={styles.breakRowLeft}>
          <Text style={styles.breakName}>{b.name}</Text>
          {regionLabel && <Text style={styles.breakMeta}>{regionLabel}</Text>}
          {(typeCapped || dirCapped) && (
            <View style={styles.pillRow}>
              {typeCapped && <View style={styles.typePill}><Text style={styles.typePillText}>{typeCapped}</Text></View>}
              {dirCapped && <View style={styles.dirPill}><Text style={styles.dirPillText}>{dirCapped}</Text></View>}
            </View>
          )}
          {added && rated && <InlineDots value={rated.rating} />}
          {added && rated?.isFavorite && (
            <View style={styles.favBadge}>
              <View style={styles.favBadgeDot} />
              <Text style={styles.favBadgeText}>Favourite</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={added ? styles.addedBtn : styles.addBtn}
          onPress={() => openSheet(b)}
        >
          <Text style={added ? styles.addedBtnText : styles.addBtnText}>
            {added ? '✓ Added' : '+ Add'}
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
          <ProgressDots total={5} current={3} />
          <Text style={styles.title}>Log your surf history</Text>
          <Text style={styles.subtitle}>Add breaks you've already surfed</Text>

          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by break name or region..."
              placeholderTextColor="#4A7A87"
              value={searchText}
              onChangeText={setSearchText}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Scrollable list */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Results */}
          {loadingInitial ? (
            <ActivityIndicator color="#4A7A87" style={styles.loader} />
          ) : isSearching ? (
            searchResults.length === 0 ? (
              <Text style={styles.emptyText}>No breaks found</Text>
            ) : (
              <View style={styles.resultsList}>
                {searchResults.map((b) => renderBreakRow(b))}
              </View>
            )
          ) : (
            groupedBreaks.map((section) => (
              <View key={section.region} style={styles.regionSection}>
                <Text style={styles.regionHeader}>{section.region}</Text>
                <View style={styles.resultsList}>
                  {section.breaks.map((b) => renderBreakRow(b))}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Fixed bottom — never scrolls */}
        <View style={styles.fixedBottom}>
          <View style={styles.callout}>
            <Text style={styles.calloutLine1}>Not seeing a break you've surfed?</Text>
            <Text style={styles.calloutLine2}>Drop a custom pin on the map after signing in →</Text>
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.replace('/onboarding/done')}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => router.replace('/onboarding/done')}
          >
            <Text style={styles.skipText}>Skip — I'll add as I go</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* Rating bottom sheet */}
      {sheetVisible && (
        <>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={styles.sheetHandle} {...panResponder.panHandlers} />
            <View>
              <Text style={styles.sheetTitle}>{sheetBreak?.name}</Text>
              {sheetBreak && (sheetBreak.region ?? getLocationLabel(sheetBreak.lat, sheetBreak.lng)) && (
                <Text style={styles.sheetRegion}>
                  {sheetBreak.region ?? getLocationLabel(sheetBreak.lat, sheetBreak.lng)}
                </Text>
              )}
            </View>
            <View style={styles.sheetRatingHeader}>
              <Text style={styles.sheetLabel}>MY RATING</Text>
              {sheetRating > 0 && (
                <Text style={styles.sheetRatingLabel}>{breakRatingLabel(sheetRating)}</Text>
              )}
            </View>
            <DotRating value={sheetRating} onChange={setSheetRating} />
            <TouchableOpacity style={styles.favRow} onPress={() => setSheetFavorite((f) => !f)}>
              <View style={[styles.favCheck, sheetFavorite && styles.favCheckActive]}>
                {sheetFavorite && <Text style={styles.favCheckMark}>✓</Text>}
              </View>
              <Text style={styles.favLabel}>Mark as favourite</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, (sheetRating === 0 || saving) && styles.disabled]}
              onPress={confirmBreak}
              disabled={sheetRating === 0 || saving}
            >
              {saving ? (
                <ActivityIndicator color="#E8D5B8" />
              ) : (
                <Text style={styles.confirmButtonText}>Add Break</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B2230',
  },
  flex: { flex: 1 },
  frozenHeader: {
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 8,
    backgroundColor: '#0B2230',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },

  // Header
  title: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 31,
    color: '#E8D5B8',
    textAlign: 'center',
    lineHeight: 37,
    marginBottom: 5,
  },
  subtitle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
    textAlign: 'center',
    marginBottom: 16,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B2230',
    borderWidth: 0.5,
    borderColor: '#E8D5B8',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 18,
    color: '#4A7A87',
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Helvetica Neue',
    fontSize: 16,
    color: '#E8D5B8',
    padding: 0,
  },

  // Loading / empty
  loader: { marginVertical: 24 },
  emptyText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    textAlign: 'center',
    marginVertical: 16,
  },

  // Region sections
  regionSection: {
    marginBottom: 20,
  },
  regionHeader: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 10,
    letterSpacing: 2,
    color: '#4A7A87',
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  // Break rows
  resultsList: { gap: 10, marginBottom: 12 },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(11, 34, 48, 0.6)',
    borderWidth: 0.5,
    borderColor: 'rgba(74, 122, 135, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 72,
  },
  breakRowAdded: {
    backgroundColor: '#0F4E63',
    borderColor: '#3CC4C4',
  },
  breakRowLeft: { flex: 1, marginRight: 12 },
  breakName: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 15,
    color: '#E8D5B8',
  },
  breakMeta: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    marginTop: 2,
  },
  pillRow: { flexDirection: 'row', gap: 4, marginTop: 5 },
  typePill: {
    backgroundColor: 'rgba(83, 74, 183, 0.2)',
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  typePillText: { fontFamily: 'Helvetica Neue', fontSize: 9, color: '#9B95E8' },
  dirPill: {
    backgroundColor: 'rgba(15, 110, 86, 0.2)',
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  dirPillText: { fontFamily: 'Helvetica Neue', fontSize: 9, color: '#3CC4C4' },
  addBtn: {
    backgroundColor: '#1B7A87',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  addBtnText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 12,
    color: '#E8D5B8',
  },
  addedBtn: {
    backgroundColor: 'rgba(60, 196, 196, 0.2)',
    borderWidth: 0.5,
    borderColor: '#3CC4C4',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  addedBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#3CC4C4',
  },
  favBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  favBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#7F77DD',
  },
  favBadgeText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#7F77DD',
  },

  // Fixed bottom section
  fixedBottom: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#0B2230',
  },
  callout: {
    backgroundColor: 'rgba(27, 90, 106, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(60, 196, 196, 0.25)',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 3,
  },
  calloutLine1: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
  },
  calloutLine2: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
  },
  continueButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  continueButtonText: {
    color: '#E8D5B8',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Helvetica Neue',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(74, 122, 135, 0.4)',
    borderRadius: 10,
  },
  skipText: {
    color: '#4A7A87',
    fontSize: 12,
    fontFamily: 'Helvetica Neue',
  },

  // Bottom sheet
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F2838',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 52,
    paddingTop: 12,
    gap: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(74, 122, 135, 0.4)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 20,
    color: '#E8D5B8',
  },
  sheetRegion: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 13,
    color: '#4A7A87',
    marginTop: 3,
  },
  sheetRatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetLabel: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 10,
    letterSpacing: 2,
    color: '#4A7A87',
  },
  sheetRatingLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#3CC4C4',
  },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  favCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(74, 122, 135, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favCheckActive: { backgroundColor: '#7F77DD', borderColor: '#7F77DD' },
  favCheckMark: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  favLabel: { fontFamily: 'Helvetica Neue', fontSize: 14, color: '#E8D5B8' },
  confirmButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmButtonText: {
    color: '#E8D5B8',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
  },
  disabled: { opacity: 0.5 },
})
