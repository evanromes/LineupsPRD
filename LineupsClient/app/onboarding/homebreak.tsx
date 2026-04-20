import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

interface Break {
  id: string
  name: string
  lat: number | null
  lng: number | null
  type: string | null
  direction: string | null
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
  return null
}

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
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1B5A6A' },
  dotActive: { width: 23, height: 8, borderRadius: 4, backgroundColor: '#E8D5B8' },
  dotDone: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3CC4C4' },
})

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 13 13" fill="none">
      <Circle cx="5.5" cy="5.5" r="4.5" stroke="#C5A882" strokeWidth="1.2" />
      <Path d="M9.5 9.5L12 12" stroke="#C5A882" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  )
}

export default function OnboardingHomeBreak() {
  const [userId, setUserId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Break[]>([])
  const [selected, setSelected] = useState<Break | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const term = query.trim()
    if (!term) { setResults([]); setSearching(false); return }

    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('breaks')
        .select('id, name, lat, lng, type, direction')
        .ilike('name', `%${term}%`)
        .limit(6)
      setResults(data ?? [])
      setSearching(false)
    }, 300)
  }, [query])

  function selectBreak(b: Break) {
    setSelected(b)
    setQuery(b.name)
    setResults([])
  }

  async function handleNext(skip = false) {
    if (!userId) return
    setSaving(true)
    if (!skip && selected) {
      await supabase
        .from('profiles')
        .update({ home_break: selected.name })
        .eq('id', userId)
    }
    setSaving(false)
    router.push('/onboarding/friends')
  }

  const showResults = query.trim().length > 0 && results.length > 0 && !selected

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.screen}>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          <ProgressDots total={5} current={5} />
        </View>

        {/* Back chevron */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.center}>
          <Text style={styles.heading}>What's your home break?</Text>
          <Text style={styles.subtext}>Your go-to spot — this shows on your profile</Text>

          {/* Search field */}
          <View style={[styles.searchWrap, selected && styles.searchWrapSelected]}>
            <View style={styles.searchIcon} pointerEvents="none">
              <SearchIcon />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by break name or region..."
              placeholderTextColor="#C5A882"
              value={query}
              onChangeText={(t) => { setQuery(t); if (selected) setSelected(null) }}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searching && (
              <ActivityIndicator size="small" color="#4A7A87" style={styles.searchSpinner} />
            )}
          </View>

          {/* Selected break card */}
          {selected && (
            <View style={styles.selectedCard}>
              <View style={styles.selectedCardBody}>
                <Text style={styles.selectedBreakName}>{selected.name}</Text>
                {getLocationLabel(selected.lat, selected.lng) && (
                  <Text style={styles.selectedBreakLoc}>
                    {getLocationLabel(selected.lat, selected.lng)}
                  </Text>
                )}
              </View>
              {(selected.type || selected.direction) && (
                <View style={styles.selectedPillStack}>
                  {selected.type && (
                    <View style={styles.pillType}>
                      <Text style={styles.pillTypeText}>{selected.type}</Text>
                    </View>
                  )}
                  {selected.direction && (
                    <View style={styles.pillDir}>
                      <Text style={styles.pillDirText}>{selected.direction}</Text>
                    </View>
                  )}
                </View>
              )}
              <TouchableOpacity
                style={styles.selectedClear}
                onPress={() => { setSelected(null); setQuery('') }}
                activeOpacity={0.7}
              >
                <Text style={styles.selectedClearText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search results */}
          {showResults && (
            <View style={styles.resultsList}>
              {results.map((b, i) => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.resultRow, i === results.length - 1 && styles.resultRowLast]}
                  onPress={() => selectBreak(b)}
                  activeOpacity={0.75}
                >
                  <View style={styles.resultLeft}>
                    <Text style={styles.resultName}>{b.name}</Text>
                    {getLocationLabel(b.lat, b.lng) && (
                      <Text style={styles.resultRegion}>{getLocationLabel(b.lat, b.lng)}</Text>
                    )}
                  </View>
                  <Text style={styles.resultArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* No results */}
          {query.trim().length > 0 && !searching && results.length === 0 && !selected && (
            <Text style={styles.noResults}>No breaks found for "{query.trim()}"</Text>
          )}

          {/* Hint */}
          <Text style={styles.hintText}>
            Not seeing your home break? Don't worry, you can skip for now and drop a pin once you're in the app!
          </Text>

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.nextButton, (!selected || saving) && styles.disabled]}
            onPress={() => handleNext(false)}
            disabled={!selected || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#E8D5B8" />
            ) : (
              <Text style={styles.nextButtonText}>Next →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => handleNext(true)}
            disabled={saving}
            activeOpacity={0.75}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B2230',
  },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },

  dotsRow: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  backBtn: {
    position: 'absolute',
    top: 48,
    left: 24,
    padding: 8,
  },
  backChevron: {
    fontFamily: 'Helvetica Neue',
    fontSize: 20,
    color: '#4A7A87',
    lineHeight: 24,
  },

  center: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 96,
  },

  heading: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 38,
    color: '#E8D5B8',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 20,
    color: '#4A7A87',
    textAlign: 'center',
    marginBottom: 24,
  },

  // Search
  searchWrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B2230',
    borderWidth: 0.5,
    borderColor: '#E8D5B8',
    borderRadius: 12,
    height: 64,
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 0,
  },
  searchWrapSelected: {
    borderColor: '#3CC4C4',
  },
  searchIcon: {
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Georgia',
    fontSize: 18,
    color: '#E8D5B8',
    padding: 0,
  },
  searchSpinner: {
    marginLeft: 4,
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    color: '#4A7A87',
    fontSize: 13,
  },

  // Selected break card
  selectedCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 78, 99, 0.4)',
    borderWidth: 0.5,
    borderColor: '#3CC4C4',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  selectedCardBody: {
    flex: 1,
  },
  selectedBreakName: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 23,
    color: '#E8D5B8',
    marginBottom: 4,
  },
  selectedBreakLoc: {
    fontFamily: 'Helvetica Neue',
    fontSize: 16,
    color: '#4A7A87',
  },
  selectedPillStack: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    marginHorizontal: 12,
  },
  pillType: {
    backgroundColor: 'rgba(83, 74, 183, 0.2)',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillTypeText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 15,
    color: '#9B95E8',
    fontWeight: '500',
  },
  pillDir: {
    backgroundColor: 'rgba(15, 110, 86, 0.2)',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillDirText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 15,
    color: '#3CC4C4',
    fontWeight: '500',
  },
  selectedClear: {
    paddingLeft: 12,
    paddingVertical: 4,
  },
  selectedClearText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#4A7A87',
  },

  // Results
  resultsList: {
    width: '100%',
    backgroundColor: 'rgba(15, 34, 48, 0.95)',
    borderWidth: 0.5,
    borderColor: 'rgba(197, 168, 130, 0.2)',
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(197, 168, 130, 0.1)',
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultLeft: {
    flex: 1,
  },
  resultName: {
    fontFamily: 'Georgia',
    fontSize: 15,
    color: '#E8D5B8',
    marginBottom: 2,
  },
  resultRegion: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
  },
  resultArrow: {
    fontFamily: 'Helvetica Neue',
    fontSize: 18,
    color: '#4A7A87',
    marginLeft: 8,
  },
  noResults: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 12,
    color: '#4A7A87',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },

  hintText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 14,
    color: '#4A7A87',
    textAlign: 'center',
    lineHeight: 21,
    width: '100%',
    marginTop: 20,
    marginBottom: 20,
  },

  // Buttons
  nextButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#1B7A87',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  nextButtonText: {
    color: '#E8D5B8',
    fontSize: 20,
    fontWeight: '500',
    fontFamily: 'Helvetica Neue',
  },
  disabled: {
    opacity: 0.6,
  },
  skipButton: {
    width: '100%',
    height: 64,
    borderWidth: 0.5,
    borderColor: 'rgba(197, 168, 130, 0.4)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 20,
    color: '#C5A882',
  },
})
