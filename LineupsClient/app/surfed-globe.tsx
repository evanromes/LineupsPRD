// Dedicated full-screen view for the interactive globe.
// Re-queries the viewed user's sessions so it works for both self and
// other-user profiles without needing to thread state through navigation.

import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
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
import ProfileGlobe from '../components/ProfileGlobe'

const COUNTRY_ALIAS: Record<string, string> = {
  'United States of America': 'USA',
  'Russian Federation': 'Russia',
  'United Kingdom': 'UK',
  'Republic of Korea': 'South Korea',
  'Democratic Republic of the Congo': 'DR Congo',
}
const aliasCountry = (name: string) => COUNTRY_ALIAS[name] ?? name

type BreakItem = { id: string; name: string; sessionCount: number }
type RegionGroup = { region: string; breaks: BreakItem[] }
type CountryGroup = { country: string; regions: RegionGroup[] }

export default function SurfedGlobeScreen() {
  const insets = useSafeAreaInsets()
  const { userId } = useLocalSearchParams<{ userId: string }>()

  const [loading, setLoading] = useState(true)
  const [sessionRows, setSessionRows] = useState<
    { break_id: string; name: string; country: string | null; admin1: string | null }[]
  >([])
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null } | null>(null)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const [sessionsRes, profileRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('break_id, breaks(name, country, admin1)')
          .eq('user_id', userId),
        supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', userId)
          .maybeSingle(),
      ])

      if (cancelled) return

      const rows: typeof sessionRows = []
      for (const s of (sessionsRes.data ?? []) as any[]) {
        if (!s.breaks) continue
        rows.push({
          break_id: s.break_id,
          name: s.breaks.name,
          country: s.breaks.country,
          admin1: s.breaks.admin1,
        })
      }
      setSessionRows(rows)
      setProfile(profileRes.data ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const firstName = useMemo(() => {
    if (profile?.display_name?.trim()) {
      return profile.display_name.trim().split(/\s+/)[0]
    }
    return profile?.username ?? null
  }, [profile])

  const headerTitle = firstName ? `${firstName}'s travels` : 'Travels'

  const surfedAdmin1s = useMemo(() => {
    const s = new Set<string>()
    for (const r of sessionRows) if (r.admin1) s.add(r.admin1)
    return [...s]
  }, [sessionRows])

  const surfedCountries = useMemo(() => {
    const s = new Set<string>()
    for (const r of sessionRows) if (r.country) s.add(r.country)
    return [...s]
  }, [sessionRows])

  const breakdown: CountryGroup[] = useMemo(() => {
    // country -> region -> break_id -> { name, count }
    const map = new Map<
      string,
      Map<string, Map<string, { name: string; count: number }>>
    >()
    for (const r of sessionRows) {
      const country = r.country ? aliasCountry(r.country) : 'Unknown'
      const region = r.admin1 ?? '—'
      if (!map.has(country)) map.set(country, new Map())
      const regionMap = map.get(country)!
      if (!regionMap.has(region)) regionMap.set(region, new Map())
      const breakMap = regionMap.get(region)!
      const existing = breakMap.get(r.break_id)
      if (existing) existing.count += 1
      else breakMap.set(r.break_id, { name: r.name, count: 1 })
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([country, regions]) => ({
        country,
        regions: [...regions.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([region, breaks]) => ({
            region,
            breaks: [...breaks.entries()]
              .map(([id, { name, count }]) => ({ id, name, sessionCount: count }))
              // Most-surfed first; tiebreak alphabetically.
              .sort((a, b) => b.sessionCount - a.sessionCount || a.name.localeCompare(b.name)),
          })),
      }))
  }, [sessionRows])

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2230" />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color="#E8D5B8" />
          <Text style={styles.backLabel}>Profile</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{headerTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3CC4C4" />
        </View>
      ) : (
        <View style={styles.body}>
          {/* Globe — top 2/3 */}
          <View style={styles.globeSection}>
            <ProfileGlobe
              surfedAdmin1s={surfedAdmin1s}
              surfedCountries={surfedCountries}
              size={300}
            />
            <Text style={styles.hint}>Drag to rotate · pinch to zoom</Text>
          </View>

          {/* Breakdown — bottom 1/3, scrollable */}
          <View style={styles.breakdownSection}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.breakdownContent}
            >
              {breakdown.length === 0 ? (
                <Text style={styles.emptyText}>
                  No sessions logged yet.
                </Text>
              ) : (
                breakdown.map(({ country, regions }) => {
                  const regionCount = regions.length
                  const breakCount = regions.reduce((n, r) => n + r.breaks.length, 0)
                  return (
                    <View key={country} style={styles.countryBlock}>
                      <View style={styles.countryHeader}>
                        <Text style={styles.countryName}>{country}</Text>
                        <Text style={styles.countryMeta}>
                          {regionCount} {regionCount === 1 ? 'region' : 'regions'}
                          {'  ·  '}
                          {breakCount} {breakCount === 1 ? 'break' : 'breaks'}
                        </Text>
                      </View>
                      {regions.map(({ region, breaks }) => (
                        <View key={region} style={styles.regionBlock}>
                          <Text style={styles.regionName}>{region}</Text>
                          <View style={styles.breaksList}>
                            {breaks.map(b => (
                              <View key={b.id} style={styles.breakItem}>
                                <View style={styles.breakDot} />
                                <Text style={styles.breakName} numberOfLines={1}>
                                  {b.name}
                                </Text>
                                <Text style={styles.breakSessions}>
                                  {b.sessionCount} {b.sessionCount === 1 ? 'session' : 'sessions'}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  )
                })
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B2230',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.3)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 100,
  },
  backLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 16,
    color: '#E8D5B8',
    letterSpacing: 0.4,
    marginLeft: -2,
  },
  title: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 18,
    color: '#E8D5B8',
    flexShrink: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 100,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Layout split
  body: {
    flex: 1,
  },
  globeSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 18,
  },
  hint: {
    marginTop: 14,
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
    letterSpacing: 0.4,
  },

  // Breakdown
  breakdownSection: {
    flex: 1,
    backgroundColor: '#0F2838',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(74,122,135,0.3)',
  },
  breakdownContent: {
    paddingBottom: 28,
  },
  emptyText: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 14,
    color: '#4A7A87',
    textAlign: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },

  // Country block
  countryBlock: {
    paddingTop: 18,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.2)',
  },
  countryHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  countryName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 20,
    color: '#E8D5B8',
    letterSpacing: 0.3,
  },
  countryMeta: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 1.2,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  // Region block
  regionBlock: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  regionName: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 11,
    color: '#3CC4C4',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  breaksList: {
    gap: 7,
  },
  breakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1B7A87',
  },
  breakName: {
    flex: 1,
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#E8D5B8',
    letterSpacing: 0.2,
  },
  breakSessions: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
    letterSpacing: 0.3,
    marginLeft: 8,
  },
})
