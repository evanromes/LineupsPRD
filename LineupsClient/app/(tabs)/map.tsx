import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Marker, Region } from 'react-native-maps'
import ClusteredMapView from 'react-native-map-clustering'
import Svg, { Path } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type PinStatus = 'visited' | 'favorite' | 'wishlist' | 'unvisited' | 'custom'

interface Break {
  id: string
  name: string
  lat: number
  lng: number
  type: string | null
  direction: string | null
  is_custom: boolean
}

interface BreakWithStatus extends Break {
  status: PinStatus
}

interface CalloutStats {
  sessions: number
  breakRating: number | null   // 1–5
  avgSessionRating: number | null  // 1–10, only set when sessions >= 3
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIN_CONFIG: Record<PinStatus, {
  fill: string
  stroke: string
  strokeWidth: number
  strokeDash: boolean
  wrapperOpacity?: number
}> = {
  visited:   { fill: '#3CC4C4', stroke: '#E8D5B8', strokeWidth: 1.5, strokeDash: false },
  favorite:  { fill: '#7F77DD', stroke: '#CECBF6', strokeWidth: 1,   strokeDash: false },
  wishlist:  { fill: '#C5A882', stroke: '#E8D5B8', strokeWidth: 1,   strokeDash: false },
  unvisited: { fill: '#4A2D0E', stroke: '#C5A882', strokeWidth: 1.5, strokeDash: false, wrapperOpacity: 0.75 },
  custom:    { fill: '#0B2230', stroke: '#E8D5B8', strokeWidth: 1.5, strokeDash: true },
}

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

const DEFAULT_REGION: Region = {
  latitude: 20,
  longitude: -150,
  latitudeDelta: 80,
  longitudeDelta: 80,
}

// ─── Pin Marker ───────────────────────────────────────────────────────────────

function PinMarker({ status }: { status: PinStatus }) {
  const { fill, stroke, strokeWidth, strokeDash, wrapperOpacity } = PIN_CONFIG[status]
  const isFavorite = status === 'favorite'
  const size = isFavorite ? 26 : 22
  // Wave SVG sized to fit inside the circle with ~4px padding each side
  const svgW = size - 8
  const svgH = Math.round((size - 8) * 0.57)

  return (
    <View style={[styles.pinWrapper, wrapperOpacity != null ? { opacity: wrapperOpacity } : undefined]}>
      <View style={[
        styles.pinCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          borderColor: stroke,
          borderWidth: strokeWidth,
          borderStyle: strokeDash ? 'dashed' : 'solid',
        },
      ]}>
        <Svg width={svgW} height={svgH} viewBox="2 4 20 12">
          <Path
            d="M4 10 Q8 5, 12 10 Q16 15, 20 10"
            stroke={stroke}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={[styles.pinTailLine, { backgroundColor: stroke }]} />
      <View style={[styles.pinTailDot, { backgroundColor: stroke }]} />
    </View>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const [breaks, setBreaks] = useState<BreakWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBreak, setSelectedBreak] = useState<BreakWithStatus | null>(null)
  const [calloutStats, setCalloutStats] = useState<CalloutStats | null>(null)

  const slideAnim = useRef(new Animated.Value(320)).current

  // ─── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    console.log('[MapScreen] mounted')
    fetchBreaks()
  }, [])

  async function fetchBreaks() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      const { data: allBreaks, error } = await supabase
        .from('breaks')
        .select('id, name, lat, lng, type, direction, is_custom')

      console.log('[MapScreen] breaks fetch — count:', allBreaks?.length ?? 0)
      console.log('[MapScreen] breaks fetch — first:', allBreaks?.[0] ?? null)
      console.log('[MapScreen] breaks fetch — error:', error ?? null)

      if (error || !allBreaks) return

      if (!userId) {
        setBreaks(allBreaks.map(b => ({ ...b, status: 'unvisited' as PinStatus })))
        return
      }

      const [{ data: sessions }, { data: wishlist }, { data: ratings }] = await Promise.all([
        supabase.from('sessions').select('break_id').eq('user_id', userId),
        supabase.from('wishlist').select('break_id').eq('user_id', userId),
        supabase.from('break_ratings').select('break_id, is_favorite').eq('user_id', userId),
      ])

      const visitedIds  = new Set((sessions  ?? []).map((s: any) => s.break_id))
      const wishlistIds = new Set((wishlist   ?? []).map((w: any) => w.break_id))
      const favoriteIds = new Set((ratings    ?? []).filter((r: any) => r.is_favorite).map((r: any) => r.break_id))

      const withStatus: BreakWithStatus[] = allBreaks.map(b => {
        let status: PinStatus = 'unvisited'
        if (favoriteIds.has(b.id))  status = 'favorite'
        else if (visitedIds.has(b.id))   status = 'visited'
        else if (wishlistIds.has(b.id))  status = 'wishlist'
        return { ...b, status }
      })

      setBreaks(withStatus)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCalloutStats(breakId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) {
      setCalloutStats({ sessions: 0, breakRating: null, avgSessionRating: null })
      return
    }

    const [{ data: sessionsData }, { data: ratingData }] = await Promise.all([
      supabase
        .from('sessions')
        .select('rating')
        .eq('break_id', breakId)
        .eq('user_id', userId),
      supabase
        .from('break_ratings')
        .select('rating')
        .eq('break_id', breakId)
        .eq('user_id', userId)
        .maybeSingle(),
    ])

    const count = sessionsData?.length ?? 0
    const rated = (sessionsData ?? []).filter((s: any) => s.rating != null && s.rating > 0)
    const avg =
      count >= 3 && rated.length > 0
        ? rated.reduce((sum: number, s: any) => sum + s.rating, 0) / rated.length
        : null

    setCalloutStats({
      sessions: count,
      breakRating: ratingData?.rating ?? null,
      avgSessionRating: avg,
    })
  }

  // ─── Pin tap ────────────────────────────────────────────────────────────────

  function handlePinPress(b: BreakWithStatus) {
    setSelectedBreak(b)
    setCalloutStats(null)
    fetchCalloutStats(b.id)
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start()
  }

  function dismissCallout() {
    Animated.timing(slideAnim, {
      toValue: 320,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setSelectedBreak(null)
      setCalloutStats(null)
    })
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#060F14" />

      {/* Map */}
      <ClusteredMapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        customMapStyle={DARK_MAP_STYLE}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        showsUserLocation
        showsCompass={false}
        showsScale={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        onPress={selectedBreak ? dismissCallout : undefined}
        clusteringEnabled
        radius={40}
        maxZoom={14}
        minZoom={1}
        extent={512}
        nodeSize={64}
        animationEnabled
        renderCluster={(cluster: any) => {
          const { id, geometry, onPress, properties } = cluster
          const count: number = properties.point_count
          const size = count >= 51 ? 64 : count >= 11 ? 54 : 44
          return (
            <Marker
              key={`cluster-${id}`}
              coordinate={{ latitude: geometry.coordinates[1], longitude: geometry.coordinates[0] }}
              onPress={onPress}
              tracksViewChanges={false}
            >
              <View style={[styles.cluster, { width: size, height: size, borderRadius: size / 2 }]}>
                <Text style={styles.clusterText}>{count}</Text>
              </View>
            </Marker>
          )
        }}
      >
        {breaks.map((b, i) => {
          if (i === 0) console.log('[MapScreen] rendering pins, count:', breaks.length, 'first coord:', b.lat, b.lng)
          return (
            <Marker
              key={b.id}
              coordinate={{ latitude: b.lat, longitude: b.lng }}
              onPress={() => handlePinPress(b)}
              tracksViewChanges={false}
            >
              <PinMarker status={b.status} />
            </Marker>
          )
        })}
      </ClusteredMapView>

      {/* Search bar */}
      <View style={styles.topBar}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={14} color="#3CC4C4" />
          <Text style={styles.searchPlaceholder}>Search breaks...</Text>
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="options-outline" size={18} color="#3CC4C4" />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {([
          { color: '#3CC4C4', label: 'Visited' },
          { color: '#7F77DD', label: 'Favorite' },
          { color: '#C5A882', label: 'Wishlist' },
        ] as const).map(({ color, label }) => (
          <View key={label} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => Alert.alert('Coming soon', 'Custom pin drop coming soon')}
        activeOpacity={0.8}
      >
        <Ionicons name="location-outline" size={20} color="#E8D5B8" />
      </TouchableOpacity>

      {/* Callout card */}
      {selectedBreak && (
        <Animated.View
          style={[styles.callout, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Header */}
          <View style={styles.calloutHeader}>
            <View style={styles.calloutPinIcon}>
              <Ionicons name="water" size={16} color="#E8D5B8" />
            </View>
            <View style={styles.calloutTitleBlock}>
              <Text style={styles.calloutName}>{selectedBreak.name}</Text>
              <Text style={styles.calloutLocation}>{selectedBreak.type ?? ''}</Text>
            </View>
            <View style={[styles.pill, styles.pillVisit]}>
              <Text style={styles.pillVisitText}>
                {selectedBreak.status.charAt(0).toUpperCase() + selectedBreak.status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Break type + direction pills */}
          <View style={styles.pillRow}>
            {selectedBreak.type && (
              <View style={[styles.pill, styles.pillType]}>
                <Text style={styles.pillTypeText}>{selectedBreak.type}</Text>
              </View>
            )}
            {selectedBreak.direction && (
              <View style={[styles.pill, styles.pillDir]}>
                <Text style={styles.pillDirText}>{selectedBreak.direction}</Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {/* Sessions */}
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>SESSIONS</Text>
              <Text style={styles.statValue}>
                {calloutStats?.sessions != null ? String(calloutStats.sessions) : '—'}
              </Text>
            </View>

            {/* Break rating dots */}
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>BREAK</Text>
              <View style={styles.statDotsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.statDot,
                      (calloutStats?.breakRating ?? 0) >= i
                        ? styles.statDotFilled
                        : styles.statDotEmpty,
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Avg session rating */}
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>AVG SESSION</Text>
              <Text style={[
                styles.statValue,
                calloutStats?.avgSessionRating != null
                  ? styles.statValueTeal
                  : styles.statValueDim,
              ]}>
                {calloutStats?.avgSessionRating != null
                  ? calloutStats.avgSessionRating.toFixed(1)
                  : '—'}
              </Text>
            </View>
          </View>

          {/* CTAs */}
          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={styles.ctaPrimary}
              activeOpacity={0.8}
              onPress={() => {
                dismissCallout()
                router.push({
                  pathname: '/log-session',
                  params: { break_id: selectedBreak.id, break_name: selectedBreak.name },
                })
              }}
            >
              <Text style={styles.ctaPrimaryText}>Log session</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaSecondary} activeOpacity={0.8}>
              <Text style={styles.ctaSecondaryText}>View break</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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

  // Pin
  pinWrapper: {
    alignItems: 'center',
  },
  pinCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTailLine: {
    width: 2,
    height: 7,
  },
  pinTailDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Cluster bubble
  cluster: {
    backgroundColor: '#1B7A87',
    borderWidth: 2,
    borderColor: '#3CC4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: {
    color: '#E8D5B8',
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 13,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F2D3A',
    borderWidth: 0.5,
    borderColor: '#1B5A6A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchPlaceholder: {
    color: '#4A7A87',
    fontSize: 12,
    fontFamily: 'Helvetica Neue',
  },
  filterButton: {
    width: 38,
    height: 38,
    backgroundColor: '#0F2D3A',
    borderWidth: 0.5,
    borderColor: '#1B5A6A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Legend
  legend: {
    position: 'absolute',
    top: 112,
    right: 14,
    backgroundColor: '#0B2230EE',
    borderWidth: 0.5,
    borderColor: '#1B5A6A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 5,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendText: {
    color: '#7AABB8',
    fontSize: 10,
    letterSpacing: 0.5,
    fontFamily: 'Helvetica Neue',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1B7A87',
    borderWidth: 1.5,
    borderColor: '#3CC4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Callout
  callout: {
    position: 'absolute',
    bottom: 90,
    left: 14,
    right: 14,
    backgroundColor: '#0F2D3A',
    borderWidth: 0.5,
    borderColor: '#1B6878',
    borderRadius: 18,
    padding: 14,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  calloutPinIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1B7A87',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  calloutTitleBlock: {
    flex: 1,
  },
  calloutName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 15,
    color: '#E8D5B8',
    letterSpacing: 0.3,
  },
  calloutLocation: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Pills
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  pill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillVisit: {
    backgroundColor: '#0F5A65',
    flexShrink: 0,
  },
  pillVisitText: {
    color: '#3CC4C4',
    fontSize: 10,
    fontFamily: 'Helvetica Neue',
    letterSpacing: 0.5,
  },
  pillType: {
    backgroundColor: '#1E1640',
  },
  pillTypeText: {
    color: '#7F77DD',
    fontSize: 10,
    fontFamily: 'Helvetica Neue',
    letterSpacing: 0.8,
  },
  pillDir: {
    backgroundColor: '#0D2A18',
  },
  pillDirText: {
    color: '#1D9E75',
    fontSize: 10,
    fontFamily: 'Helvetica Neue',
    letterSpacing: 0.8,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  statTile: {
    flex: 1,
    backgroundColor: '#0B2230',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  statLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#4A7A87',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  statValue: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 17,
    color: '#E8D5B8',
  },
  statValueTeal: {
    color: '#3CC4C4',
  },
  statValueDim: {
    color: '#4A7A87',
  },
  statDotsRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    marginTop: 2,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statDotFilled: {
    backgroundColor: '#3CC4C4',
  },
  statDotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C5A882',
  },

  // CTAs
  ctaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  ctaPrimary: {
    flex: 1,
    backgroundColor: '#1B7A87',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    color: '#E8D5B8',
    fontSize: 11,
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  ctaSecondary: {
    flex: 1,
    backgroundColor: '#0B2230',
    borderWidth: 0.5,
    borderColor: '#1B6878',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    color: '#3CC4C4',
    fontSize: 11,
    fontFamily: 'Helvetica Neue',
    letterSpacing: 0.5,
  },
})
