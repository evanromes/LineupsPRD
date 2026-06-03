import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Text as SvgText, Path } from 'react-native-svg'
import { supabase } from '../../lib/supabase'
import { BoardIcon, type BoardValue } from '../onboarding/board'
import SpinningGlobe from '../../components/SpinningGlobe'

// Display alias for verbose Natural Earth country names.
const COUNTRY_ALIAS: Record<string, string> = {
  'United States of America': 'USA',
  'Russian Federation': 'Russia',
  'United Kingdom': 'UK',
  'Republic of Korea': 'South Korea',
  'Democratic Republic of the Congo': 'DR Congo',
}

function aliasCountry(name: string): string {
  return COUNTRY_ALIAS[name] ?? name
}

function regionLabel(b: { admin1: string | null; country: string | null }): string {
  if (b.admin1) return b.admin1
  if (b.country) return aliasCountry(b.country)
  return 'Unknown'
}

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


// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  username: string
  display_name: string | null
  bio: string | null
  created_at: string | null
  stance: 'regular' | 'goofy' | null
  preferred_board: BoardValue
  home_break: string | null
}

function humanizeBoard(value: BoardValue): string {
  switch (value) {
    case 'shortboard': return 'Shortboard'
    case 'mid-length': return 'Mid-Length'
    case 'longboard':  return 'Longboard'
    case 'gun':        return 'Gun'
    case 'sup':        return 'SUP'
    case 'foil':       return 'Foil'
    default:           return ''
  }
}

function humanizeStance(value: 'regular' | 'goofy' | null | undefined): string {
  if (value === 'regular') return 'Regular'
  if (value === 'goofy')   return 'Goofy'
  return ''
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
    country: string | null
    admin1: string | null
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
    country: string | null
    admin1: string | null
  } | null
}

interface SessionRow {
  id: string
  date: string
  rating: number | null
  swell_size: string | null
  duration_minutes: number | null
  board: string | null
  break_id: string
  breaks: {
    name: string
    lat: number
    lng: number
    country: string | null
    admin1: string | null
  } | null
}

interface RegionGroup {
  region: string
  items: RatedBreak[]
}

interface SessionMonthGroup {
  label: string  // e.g. "MAY 2026"
  items: SessionRow[]
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
  return (
    <TouchableOpacity
      style={styles.breakRow}
      activeOpacity={0.6}
      onPress={() => router.push({ pathname: '/break-detail', params: { id: item.break_id, name: b.name } })}
    >
      <Text style={[styles.breakRank, rank <= 2 && styles.breakRankTop]}>{rank}</Text>

      <View style={styles.breakInfo}>
        <Text style={styles.breakName} numberOfLines={1}>{b.name}</Text>
        <Text style={styles.breakRegion}>{regionLabel(b)}</Text>
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

interface BreakFilterState {
  minRating: number | null
  regions: string[]
  types: string[]
  directions: string[]
}

const EMPTY_FILTER: BreakFilterState = { minRating: null, regions: [], types: [], directions: [] }

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

function matchesBreakFilter(r: RatedBreak, f: BreakFilterState): boolean {
  if (!r.breaks) return false
  if (f.minRating != null && (r.rating ?? 0) < f.minRating) return false
  if (f.regions.length > 0 && !f.regions.includes(regionLabel(r.breaks))) return false
  if (f.types.length > 0 && (!r.breaks.type || !f.types.includes(r.breaks.type))) return false
  if (f.directions.length > 0 && (!r.breaks.direction || !f.directions.includes(r.breaks.direction))) return false
  return true
}

function countActiveFilters(f: BreakFilterState): number {
  let n = 0
  if (f.minRating != null) n++
  if (f.regions.length > 0) n++
  if (f.types.length > 0) n++
  if (f.directions.length > 0) n++
  return n
}

function BreaksTab({ ratings }: { ratings: RatedBreak[] }) {
  const [applied, setApplied] = useState<BreakFilterState>(EMPTY_FILTER)
  const [draft, setDraft]     = useState<BreakFilterState>(EMPTY_FILTER)
  const [menuOpen, setMenuOpen] = useState(false)

  // Available filter options derived from the user's rated breaks.
  const { availableRegions, availableTypes, availableDirections } = useMemo(() => {
    const regs = new Set<string>(), types = new Set<string>(), dirs = new Set<string>()
    for (const r of ratings) {
      if (!r.breaks) continue
      regs.add(regionLabel(r.breaks))
      if (r.breaks.type) types.add(r.breaks.type)
      if (r.breaks.direction) dirs.add(r.breaks.direction)
    }
    return {
      availableRegions: [...regs].sort(),
      availableTypes: [...types].sort(),
      availableDirections: [...dirs].sort(),
    }
  }, [ratings])

  const filtered = useMemo(
    () => ratings.filter(r => matchesBreakFilter(r, applied)),
    [ratings, applied]
  )

  const groups: RegionGroup[] = useMemo(() => {
    const map = new Map<string, RatedBreak[]>()
    for (const r of filtered) {
      if (!r.breaks) continue
      const region = regionLabel(r.breaks)
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
  }, [filtered])

  if (ratings.length === 0) {
    return <Text style={styles.emptyTabText}>No breaks logged yet.</Text>
  }

  const activeCount = countActiveFilters(applied)
  const draftCount  = countActiveFilters(draft)
  const buttonValue = activeCount > 0 ? `${activeCount} active` : 'All'

  const filterButton = (
    <TouchableOpacity
      style={styles.inlineSortButton}
      onPress={() => { setDraft(applied); setMenuOpen(true) }}
      activeOpacity={0.7}
      hitSlop={6}
    >
      <Text style={styles.inlineSortLabel}>Filter</Text>
      <Text style={styles.inlineSortValue}>{buttonValue}</Text>
      <Ionicons name="chevron-down" size={12} color="#E8D5B8" />
    </TouchableOpacity>
  )

  return (
    <>
      {filtered.length === 0 ? (
        <>
          <View style={[styles.regionRow, styles.regionRowFirst]}>
            <Text style={styles.regionLabel}>NO MATCHES</Text>
            {filterButton}
          </View>
          <Text style={styles.emptyTabText}>No breaks match the current filters.</Text>
        </>
      ) : (
        groups.map(({ region, items }, gidx) => (
          <View key={region}>
            <View style={[styles.regionRow, gidx === 0 && styles.regionRowFirst]}>
              <Text style={styles.regionLabel}>{region.toUpperCase()} · {items.length}</Text>
              {gidx === 0 && filterButton}
            </View>
            {items.map((item, idx) => (
              <BreakRow key={item.break_id} item={item} rank={idx + 1} />
            ))}
          </View>
        ))
      )}

      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
          <View style={styles.filterBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.filterSheet}>
                <View style={styles.filterHandle} />
                <Text style={styles.filterSheetTitle}>FILTER BREAKS</Text>

                <ScrollView
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={{ paddingBottom: 8 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Min rating */}
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionLabel}>MIN RATING</Text>
                    <View style={styles.filterRatingRow}>
                      {[1, 2, 3, 4, 5].map(n => {
                        const on = (draft.minRating ?? 0) >= n
                        return (
                          <TouchableOpacity
                            key={n}
                            activeOpacity={0.7}
                            hitSlop={6}
                            onPress={() =>
                              setDraft({
                                ...draft,
                                minRating: draft.minRating === n ? null : n,
                              })
                            }
                          >
                            <View
                              style={[
                                styles.filterRatingDot,
                                on ? styles.filterRatingDotFilled : styles.filterRatingDotEmpty,
                              ]}
                            />
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  </View>

                  {/* Region */}
                  {availableRegions.length > 0 && (
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionLabel}>REGION</Text>
                      <View style={styles.filterPills}>
                        {availableRegions.map(r => {
                          const on = draft.regions.includes(r)
                          return (
                            <TouchableOpacity
                              key={r}
                              activeOpacity={0.7}
                              onPress={() => setDraft({ ...draft, regions: toggle(draft.regions, r) })}
                              style={[
                                styles.filterPill,
                                on ? styles.filterPillRegionOn : styles.filterPillOff,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.filterPillText,
                                  on ? styles.filterPillRegionTextOn : styles.filterPillTextOff,
                                ]}
                              >
                                {r}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </View>
                  )}

                  {/* Break type */}
                  {availableTypes.length > 0 && (
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionLabel}>BREAK TYPE</Text>
                      <View style={styles.filterPills}>
                        {availableTypes.map(t => {
                          const on = draft.types.includes(t)
                          return (
                            <TouchableOpacity
                              key={t}
                              activeOpacity={0.7}
                              onPress={() => setDraft({ ...draft, types: toggle(draft.types, t) })}
                              style={[
                                styles.filterPill,
                                on ? styles.filterPillTypeOn : styles.filterPillOff,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.filterPillText,
                                  on ? styles.filterPillTypeTextOn : styles.filterPillTextOff,
                                ]}
                              >
                                {t}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </View>
                  )}

                  {/* Direction */}
                  {availableDirections.length > 0 && (
                    <View style={styles.filterSection}>
                      <Text style={styles.filterSectionLabel}>DIRECTION</Text>
                      <View style={styles.filterPills}>
                        {availableDirections.map(d => {
                          const on = draft.directions.includes(d)
                          return (
                            <TouchableOpacity
                              key={d}
                              activeOpacity={0.7}
                              onPress={() => setDraft({ ...draft, directions: toggle(draft.directions, d) })}
                              style={[
                                styles.filterPill,
                                on ? styles.filterPillDirOn : styles.filterPillOff,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.filterPillText,
                                  on ? styles.filterPillDirTextOn : styles.filterPillTextOff,
                                ]}
                              >
                                {d}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Footer actions */}
                <View style={styles.filterActions}>
                  <TouchableOpacity
                    style={styles.filterClearBtn}
                    onPress={() => setDraft(EMPTY_FILTER)}
                    activeOpacity={0.7}
                    disabled={draftCount === 0}
                  >
                    <Text
                      style={[
                        styles.filterClearText,
                        draftCount === 0 && { opacity: 0.4 },
                      ]}
                    >
                      Clear
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.filterApplyBtn}
                    onPress={() => { setApplied(draft); setMenuOpen(false) }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.filterApplyText}>
                      {draftCount > 0 ? `Apply (${draftCount})` : 'Apply'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
              <Text style={styles.breakRegion}>{regionLabel(b)}</Text>
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

// ─── Sessions tab ─────────────────────────────────────────────────────────────

type SessionSortKey = 'date' | 'rating' | 'swell' | 'board' | 'length'

const SESSION_SORT_OPTIONS: { key: SessionSortKey; label: string }[] = [
  { key: 'date',   label: 'Date'           },
  { key: 'rating', label: 'Rating'         },
  { key: 'swell',  label: 'Swell size'     },
  { key: 'board',  label: 'Board type'     },
  { key: 'length', label: 'Session length' },
]

function ratingChipStyle(rating: number | null): {
  bg: string
  color: string
  borderColor: string | null
} {
  if (rating == null || rating <= 0) {
    return { bg: 'transparent', color: '#4A7A87', borderColor: 'rgba(74,122,135,0.35)' }
  }
  if (rating >= 8) return { bg: '#1B7A87', color: '#E8D5B8', borderColor: null }
  if (rating >= 6) return { bg: 'rgba(60,196,196,0.2)', color: '#3CC4C4', borderColor: null }
  if (rating >= 4) return { bg: 'rgba(197,168,130,0.18)', color: '#C5A882', borderColor: null }
  return { bg: 'rgba(74,122,135,0.2)', color: '#4A7A87', borderColor: null }
}

// Swell strings are like "0–1ft", "4–6ft", "20ft+" — parse the leading number for sort order.
function swellRank(s: string | null): number {
  if (!s) return -1
  const m = s.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : -1
}

function SessionsTab({ sessions }: { sessions: SessionRow[] }) {
  const [sort, setSort] = useState<SessionSortKey>('date')
  const [menuOpen, setMenuOpen] = useState(false)

  const sorted = useMemo(() => {
    if (sort === 'rating') {
      return [...sessions].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
    }
    if (sort === 'swell') {
      return [...sessions].sort((a, b) => swellRank(b.swell_size) - swellRank(a.swell_size))
    }
    if (sort === 'length') {
      return [...sessions].sort((a, b) => (b.duration_minutes ?? -1) - (a.duration_minutes ?? -1))
    }
    if (sort === 'board') {
      // Group-by-board surfaces categorical structure; flat sort would just cluster invisibly.
      return [...sessions].sort((a, b) => {
        const ab = (a.board ? a.board.split(' — ')[0] : 'zzz').toLowerCase()
        const bb = (b.board ? b.board.split(' — ')[0] : 'zzz').toLowerCase()
        if (ab !== bb) return ab.localeCompare(bb)
        return a.date < b.date ? 1 : -1
      })
    }
    return sessions
  }, [sessions, sort])

  const groups: SessionMonthGroup[] = useMemo(() => {
    if (sort !== 'date') return []
    const map = new Map<string, SessionRow[]>()
    for (const s of sorted) {
      if (!s.date) continue
      const d = new Date(s.date)
      if (Number.isNaN(d.getTime())) continue
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
      const list = map.get(label) ?? []
      list.push(s)
      map.set(label, list)
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }))
  }, [sorted, sort])

  if (sessions.length === 0) {
    return <Text style={styles.emptyTabText}>No sessions logged yet.</Text>
  }

  const currentLabel = SESSION_SORT_OPTIONS.find(o => o.key === sort)?.label ?? 'Date'

  const sortButton = (
    <TouchableOpacity
      style={styles.inlineSortButton}
      onPress={() => setMenuOpen(true)}
      activeOpacity={0.7}
      hitSlop={6}
    >
      <Text style={styles.inlineSortLabel}>Sort</Text>
      <Text style={styles.inlineSortValue}>{currentLabel}</Text>
      <Ionicons name="chevron-down" size={12} color="#E8D5B8" />
    </TouchableOpacity>
  )

  return (
    <>
      {sort === 'date' ? (
        groups.map(({ label, items }, gidx) => {
          const totalMins = items.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0)
          const ratings = items
            .map(s => s.rating)
            .filter((r): r is number => r != null && r > 0)
          const avgRating = ratings.length
            ? ratings.reduce((a, b) => a + b, 0) / ratings.length
            : null

          const summary: string[] = []
          if (totalMins > 0) summary.push(`${formatDuration(totalMins)} surfed`)
          if (avgRating != null) summary.push(`avg ${avgRating.toFixed(1)}`)

          return (
            <View key={label}>
              <View style={[styles.regionRow, gidx === 0 && styles.regionRowFirst]}>
                <View style={styles.regionLabelCol}>
                  <Text style={styles.regionLabel}>{label} · {items.length}</Text>
                  {summary.length > 0 && (
                    <Text style={styles.monthSummary}>{summary.join(' · ')}</Text>
                  )}
                </View>
                {gidx === 0 && sortButton}
              </View>
              {items.map(s => (
                <SessionRowItem key={s.id} session={s} />
              ))}
            </View>
          )
        })
      ) : (
        <>
          <View style={[styles.regionRow, styles.regionRowFirst]}>
            <Text style={styles.regionLabel}>{sorted.length} SESSIONS</Text>
            {sortButton}
          </View>
          {sorted.map(s => <SessionRowItem key={s.id} session={s} />)}
        </>
      )}

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuOpen(false)}>
          <View style={styles.sortBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.sortMenu}>
                <Text style={styles.sortMenuTitle}>SORT SESSIONS BY</Text>
                {SESSION_SORT_OPTIONS.map(opt => {
                  const active = sort === opt.key
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={styles.sortMenuItem}
                      onPress={() => { setSort(opt.key); setMenuOpen(false) }}
                      activeOpacity={0.6}
                    >
                      <Text style={[
                        styles.sortMenuItemText,
                        active && styles.sortMenuItemTextActive,
                      ]}>
                        {opt.label}
                      </Text>
                      {active && <Ionicons name="checkmark" size={18} color="#3CC4C4" />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  )
}

function SessionRowItem({ session }: { session: SessionRow }) {
  const b = session.breaks
  const date = new Date(session.date)
  const dayLabel = Number.isNaN(date.getTime())
    ? session.date
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const chip = ratingChipStyle(session.rating)
  const showRating = session.rating != null && session.rating > 0
  const boardType = session.board ? session.board.split(' — ')[0] : null
  const regionStr = b && (b.admin1 || b.country) ? regionLabel(b) : null

  const meta: string[] = []
  if (session.swell_size) meta.push(session.swell_size)
  if (session.duration_minutes) meta.push(formatDuration(session.duration_minutes))
  if (boardType) meta.push(boardType)

  return (
    <TouchableOpacity
      style={styles.sessionRow}
      activeOpacity={0.6}
      onPress={() =>
        b && router.push({
          pathname: '/break-detail',
          params: { id: session.break_id, name: b.name, view: 'sessions' },
        })
      }
    >
      <View
        style={[
          styles.scoreChip,
          { backgroundColor: chip.bg },
          chip.borderColor ? { borderWidth: 0.5, borderColor: chip.borderColor } : null,
        ]}
      >
        {showRating && (
          <Text style={[styles.scoreChipText, { color: chip.color }]}>{session.rating}</Text>
        )}
      </View>

      <View style={styles.sessionInfo}>
        <Text style={styles.sessionBreak} numberOfLines={1}>{b?.name ?? 'Unknown break'}</Text>
        {regionStr && (
          <Text style={styles.sessionRegion} numberOfLines={1}>{regionStr}</Text>
        )}
        {meta.length > 0 && (
          <Text style={styles.sessionMeta} numberOfLines={1}>{meta.join(' · ')}</Text>
        )}
      </View>

      <Text style={styles.sessionDate}>{dayLabel}</Text>
    </TouchableOpacity>
  )
}

function formatDuration(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m === 0 ? `${h}h` : `${h}h ${m}m`
  }
  return `${mins}m`
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const TABS: TabKey[] = ['breaks', 'sessions', 'wishlist']
type TabKey = 'breaks' | 'sessions' | 'wishlist'

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ userId?: string }>()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [viewedUserId,  setViewedUserId]  = useState<string | null>(null)
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
  const [userSessions,   setUserSessions]  = useState<SessionRow[]>([])
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

  // Refresh when the tab regains focus (e.g. after returning from Edit Profile).
  useFocusEffect(
    useCallback(() => {
      resolveAndFetch()
    }, [params.userId])
  )

  // Distinct admin1 + country sets derived from logged sessions —
  // drives the ProfileGlobe highlight coloring.
  const surfedAdmin1s = useMemo(() => {
    const set = new Set<string>()
    for (const s of userSessions) {
      if (s.breaks?.admin1) set.add(s.breaks.admin1)
    }
    return [...set]
  }, [userSessions])

  const surfedCountries = useMemo(() => {
    const set = new Set<string>()
    for (const s of userSessions) {
      if (s.breaks?.country) set.add(s.breaks.country)
    }
    return [...set]
  }, [userSessions])

  async function resolveAndFetch() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const selfId = session?.user?.id ?? null
    setCurrentUserId(selfId)

    const targetId = params.userId && params.userId !== selfId ? params.userId : selfId
    const own = !params.userId || params.userId === selfId
    setIsOwnProfile(own)
    setViewedUserId(targetId ?? null)

    if (!targetId) { setLoading(false); return }
    await fetchAll(targetId, selfId, own)
  }

  async function fetchAll(targetId: string, selfId: string | null, own: boolean) {
    try {
      const [
        { data: profileData },
        { data: metaData },
        { data: sessionData },
        { data: ratingData },
        { data: wishlistData },
        { count: followerCnt },
        { count: followingCnt },
      ] = await Promise.all([
        supabase.from('profiles').select('username, display_name, bio, created_at').eq('id', targetId).single(),
        supabase.from('profiles').select('stance, preferred_board, home_break').eq('id', targetId).maybeSingle(),
        supabase.from('sessions').select('id, date, rating, swell_size, duration_minutes, board, break_id, breaks(name, lat, lng, country, admin1)').eq('user_id', targetId).order('date', { ascending: false }),
        supabase.from('break_ratings').select('break_id, rating, approx_sessions, is_favorite, breaks(name, lat, lng, type, direction, country, admin1)').eq('user_id', targetId),
        supabase.from('wishlist').select('break_id, breaks(name, lat, lng, type, direction, country, admin1)').eq('user_id', targetId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
      ])

      if (profileData) {
        const meta = (metaData ?? {}) as Partial<Profile>
        setProfile({
          ...profileData,
          stance: meta.stance ?? null,
          preferred_board: meta.preferred_board ?? null,
          home_break: meta.home_break ?? null,
        } as Profile)
      }

      const sessions = (sessionData ?? []) as unknown as SessionRow[]
      setUserSessions(sessions)
      setSurfCount(sessions.length)
      const distinctBreaks = new Set(
        ((ratingData ?? []) as Array<{ break_id: string }>).map(r => r.break_id).filter(Boolean)
      )
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

      const countries = new Set(ratedRows.map(r => r.breaks?.country).filter(Boolean) as string[])
      setCountryCount(countries.size)
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
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* ── Profile card ── */}
          <View style={styles.card}>

            {/* Header: avatar + name block + globe */}
            <View style={styles.headerRow}>
              <View style={[styles.avatarCircle, { backgroundColor: isOwnProfile ? '#1B7A87' : avatarColor(username) }]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>

              <View style={styles.nameColumn}>
                <Text style={styles.displayName} numberOfLines={1}>{displayName}</Text>
                {(() => {
                  const parts: string[] = []
                  if (profile?.display_name && username) parts.push(`@${username}`)
                  if (profile?.created_at) {
                    parts.push(`Joined ${new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`)
                  }
                  if (parts.length === 0) return null
                  return (
                    <Text style={styles.usernameLine} numberOfLines={1}>
                      {parts.join(' · ')}
                    </Text>
                  )
                })()}

                <View style={styles.followRow}>
                  <TouchableOpacity
                    hitSlop={6}
                    onPress={() =>
                      viewedUserId &&
                      router.push({
                        pathname: '/follows-list',
                        params: { userId: viewedUserId, type: 'followers' },
                      })
                    }
                  >
                    <Text style={styles.followText}>
                      <Text style={styles.followNum}>{followerCount}</Text>
                      {' followers'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.followDot}> · </Text>
                  <TouchableOpacity
                    hitSlop={6}
                    onPress={() =>
                      viewedUserId &&
                      router.push({
                        pathname: '/follows-list',
                        params: { userId: viewedUserId, type: 'following' },
                      })
                    }
                  >
                    <Text style={styles.followText}>
                      <Text style={styles.followNum}>{followingCount}</Text>
                      {' following'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!isOwnProfile && (
                  <TouchableOpacity
                    style={[styles.followPill, isFollowing && styles.followPillActive]}
                    onPress={toggleFollow}
                    disabled={followLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.followPillText, isFollowing && styles.followPillTextActive]}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={styles.globeColumn}
                activeOpacity={0.75}
                hitSlop={8}
                onPress={() =>
                  viewedUserId &&
                  router.push({
                    pathname: '/surfed-globe',
                    params: { userId: viewedUserId },
                  })
                }
              >
                <SpinningGlobe size={72} />
                <Text style={styles.globeSubtitle} numberOfLines={1}>
                  {(displayName.trim().split(/\s+/)[0] || 'Their') + "'s Travels"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Stats row: 3 cells */}
            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Text style={styles.statValue} numberOfLines={1}>{surfCount}</Text>
                <Text style={styles.statLabel}>SESSIONS</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue} numberOfLines={1}>{breakCount}</Text>
                <Text style={styles.statLabel}>BREAKS</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue} numberOfLines={1}>{surfedAdmin1s.length}</Text>
                <Text style={styles.statLabel}>REGIONS</Text>
              </View>
            </View>

            {/* Surfer meta row: board · stance · home break */}
            {(profile?.preferred_board || profile?.stance || profile?.home_break) && (() => {
              const items: { key: string; node: React.ReactNode }[] = []
              if (profile?.preferred_board) {
                items.push({
                  key: 'board',
                  node: (
                    <View style={styles.metaItem}>
                      <BoardIcon value={profile.preferred_board} selected width={11} height={20} />
                      <Text style={styles.metaLabel} numberOfLines={1}>
                        {humanizeBoard(profile.preferred_board)}
                      </Text>
                    </View>
                  ),
                })
              }
              if (profile?.stance) {
                items.push({
                  key: 'stance',
                  node: (
                    <View style={styles.metaItem}>
                      <Ionicons name="footsteps-outline" size={13} color="#4A7A87" />
                      <Text style={styles.metaLabel} numberOfLines={1}>
                        {humanizeStance(profile.stance)}
                      </Text>
                    </View>
                  ),
                })
              }
              if (profile?.home_break) {
                items.push({
                  key: 'home',
                  node: (
                    <View style={[styles.metaItem, styles.metaItemFlex]}>
                      <Ionicons name="location-outline" size={13} color="#4A7A87" />
                      <Text style={styles.metaLabel} numberOfLines={1}>
                        {profile.home_break}
                      </Text>
                    </View>
                  ),
                })
              }
              return (
                <View style={styles.metaRow}>
                  {items.map((item, i) => (
                    <Fragment key={item.key}>
                      {item.node}
                      {i < items.length - 1 && <Text style={styles.metaDot}>·</Text>}
                    </Fragment>
                  ))}
                </View>
              )
            })()}

            {/* Bio — sits above the Edit Profile button */}
            {!!profile?.bio?.trim() && (
              <Text style={styles.bioText}>{profile.bio.trim()}</Text>
            )}

            {/* Action button — own profile only */}
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => router.push('/edit-profile')}
                activeOpacity={0.8}
              >
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
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
              : activeTab === 'sessions'
                ? <SessionsTab sessions={userSessions} />
                : <WishlistTab items={wishlist} />
            }
          </View>
        </ScrollView>
      )}

      {/* ── Sign out (sticky footer, own profile only) ── */}
      {isOwnProfile && !loading && (
        <View style={styles.signOutFooter}>
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
        </View>
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
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.3)',
  },

  // Header row: avatar + name + globe
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 27,
    color: '#E8D5B8',
  },
  nameColumn: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 22,
    color: '#E8D5B8',
    marginBottom: 2,
  },
  usernameLine: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  followText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#4A7A87',
  },
  followNum: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '600',
    fontSize: 14,
    color: '#E8D5B8',
  },
  followDot: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#4A7A87',
    marginHorizontal: 4,
  },
  globeColumn: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 0,
    marginRight: 6,
    width: 96,
  },
  globeSubtitle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    letterSpacing: 0.3,
    marginTop: 5,
    textAlign: 'center',
    lineHeight: 13,
  },

  // Bio
  bioText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
    lineHeight: 18,
    marginBottom: 12,
  },

  // Stats row (4 cells)
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    marginBottom: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(74,122,135,0.25)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.25)',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  statValue: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 25,
    color: '#E8D5B8',
  },
  statLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 1.2,
    marginTop: 3,
  },

  // Surfer meta row (board · stance · home break)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItemFlex: {
    flexShrink: 1,
  },
  metaLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#E8D5B8',
    letterSpacing: 0.2,
  },
  metaDot: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
    marginHorizontal: 8,
  },

  // Edit Profile (own-profile only)
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

  // Follow pill (other-user profile, sits under follower counts)
  followPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3CC4C4',
    backgroundColor: 'transparent',
  },
  followPillActive: {
    backgroundColor: '#1B7A87',
    borderColor: '#1B7A87',
  },
  followPillText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 12,
    color: '#3CC4C4',
    letterSpacing: 0.3,
  },
  followPillTextActive: {
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

  // Inline sort/filter button (rendered in the first group header)
  inlineSortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.45)',
    gap: 5,
    flexShrink: 0,
  },
  inlineSortLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inlineSortValue: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 12,
    color: '#E8D5B8',
  },

  // Sort menu modal
  sortBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  sortMenu: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#0F2838',
    borderRadius: 14,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.35)',
  },
  sortMenuTitle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    letterSpacing: 1.5,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  sortMenuItemText: {
    fontFamily: 'Georgia',
    fontSize: 17,
    color: '#E8D5B8',
  },
  sortMenuItemTextActive: {
    color: '#3CC4C4',
    fontWeight: '700',
  },

  // Filter sheet (Breaks tab)
  filterBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: '#0F2838',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '85%',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(74,122,135,0.35)',
  },
  filterHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(74,122,135,0.5)',
    marginBottom: 14,
  },
  filterSheetTitle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    letterSpacing: 1.8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.18)',
  },
  filterSectionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  filterRatingRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  filterRatingDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  filterRatingDotFilled: {
    backgroundColor: '#3CC4C4',
  },
  filterRatingDotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1B5A6A',
  },
  filterPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 0.5,
  },
  filterPillOff: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(74,122,135,0.4)',
  },
  filterPillRegionOn: {
    backgroundColor: 'rgba(60,196,196,0.18)',
    borderColor: '#3CC4C4',
  },
  filterPillTypeOn: {
    backgroundColor: 'rgba(83,74,183,0.2)',
    borderColor: '#534AB7',
  },
  filterPillDirOn: {
    backgroundColor: 'rgba(15,110,86,0.2)',
    borderColor: '#0F6E56',
  },
  filterPillText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  filterPillTextOff: {
    color: '#4A7A87',
  },
  filterPillRegionTextOn: {
    color: '#3CC4C4',
  },
  filterPillTypeTextOn: {
    color: '#9B95E8',
  },
  filterPillDirTextOn: {
    color: '#3CC4C4',
  },

  // Filter footer actions
  filterActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(74,122,135,0.2)',
  },
  filterClearBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.5)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  filterClearText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#E8D5B8',
  },
  filterApplyBtn: {
    flex: 2,
    backgroundColor: '#1B7A87',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  filterApplyText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 13,
    color: '#E8D5B8',
  },

  // Session row
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.18)',
  },
  scoreChip: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreChipText: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 21,
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
  },
  sessionBreak: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 16,
    color: '#E8D5B8',
    marginBottom: 2,
  },
  sessionRegion: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  sessionMeta: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
  },
  sessionDate: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 0.4,
    alignSelf: 'flex-start',
    marginTop: 3,
    flexShrink: 0,
  },
  monthSummary: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 0.2,
    marginTop: 4,
  },

  // Sign out (sticky footer)
  signOutFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#0B2230',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(74,122,135,0.2)',
  },
  signOutButton: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.4)',
    gap: 10,
  },
  regionRowFirst: {
    paddingTop: 14,
  },
  regionLabelCol: {
    flex: 1,
    minWidth: 0,
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
