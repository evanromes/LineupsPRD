import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Circle, Path as SvgPath } from 'react-native-svg'
import { supabase } from '../lib/supabase'
import { BoardIcon, type BoardValue } from './onboarding/board'

type Stance = 'regular' | 'goofy' | null
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

interface BreakRow {
  id: string
  name: string
  lat: number | null
  lng: number | null
  type: string | null
  direction: string | null
  region: string | null
}

// Fallback region label for breaks without a populated `region` column.
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

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 13 13" fill="none">
      <Circle cx="5.5" cy="5.5" r="4.5" stroke="#C5A882" strokeWidth="1.2" />
      <SvgPath d="M9.5 9.5L12 12" stroke="#C5A882" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  )
}

interface ProfileForm {
  display_name: string
  username: string
  bio: string
  home_break: string
  stance: Stance
  preferred_board: BoardValue
}

const BOARD_OPTIONS: { value: Exclude<BoardValue, null>; label: string }[] = [
  { value: 'shortboard', label: 'Shortboard' },
  { value: 'mid-length', label: 'Mid-Length' },
  { value: 'longboard',  label: 'Longboard'  },
  { value: 'gun',        label: 'Gun'        },
  { value: 'sup',        label: 'SUP'        },
  { value: 'foil',       label: 'Foil'       },
]

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets()

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [form, setForm] = useState<ProfileForm>({
    display_name: '',
    username: '',
    bio: '',
    home_break: '',
    stance: null,
    preferred_board: null,
  })

  const [originalUsername, setOriginalUsername] = useState('')
  const [usernameStatus,   setUsernameStatus]   = useState<UsernameStatus>('idle')

  // Home break search
  const [breakQuery,    setBreakQuery]    = useState('')
  const [breakResults,  setBreakResults]  = useState<BreakRow[]>([])
  const [breakSearching, setBreakSearching] = useState(false)
  const [selectedBreak, setSelectedBreak] = useState<BreakRow | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id ?? null
      if (!userId) {
        router.replace('/(auth)/login')
        return
      }
      if (cancelled) return
      setCurrentUserId(userId)

      const { data } = await supabase
        .from('profiles')
        .select('display_name, username, bio, home_break, stance, preferred_board')
        .eq('id', userId)
        .single()

      if (cancelled) return
      if (data) {
        setForm({
          display_name:    data.display_name ?? '',
          username:        data.username ?? '',
          bio:             data.bio ?? '',
          home_break:      data.home_break ?? '',
          stance:          data.stance ?? null,
          preferred_board: data.preferred_board ?? null,
        })
        setOriginalUsername(data.username ?? '')
        setBreakQuery(data.home_break ?? '')

        // Try to resolve the saved home break to a Break row so the
        // selected-card UI matches onboarding on first load.
        if (data.home_break) {
          const { data: brk } = await supabase
            .from('breaks')
            .select('id, name, lat, lng, type, direction, region')
            .eq('name', data.home_break)
            .limit(1)
            .maybeSingle()
          if (!cancelled && brk) setSelectedBreak(brk as BreakRow)
        }
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Debounced username availability check (mirrors onboarding/profile pattern)
  useEffect(() => {
    if (!currentUserId) return
    const trimmed = form.username.trim().toLowerCase()

    // Unchanged from saved value — treat as idle (no indicator).
    if (trimmed === originalUsername) {
      setUsernameStatus('idle')
      return
    }
    if (trimmed.length < 3) {
      setUsernameStatus('idle')
      return
    }

    setUsernameStatus('checking')
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmed)
        .neq('id', currentUserId)
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 400)

    return () => clearTimeout(handle)
  }, [form.username, originalUsername, currentUserId])

  // Debounced break search (mirrors onboarding/homebreak pattern: name + region).
  useEffect(() => {
    const term = breakQuery.trim()
    if (!term || (selectedBreak && term === selectedBreak.name)) {
      setBreakResults([])
      setBreakSearching(false)
      return
    }

    setBreakSearching(true)
    const handle = setTimeout(async () => {
      const [byName, byRegion] = await Promise.all([
        supabase
          .from('breaks')
          .select('id, name, lat, lng, type, direction, region')
          .ilike('name', `%${term}%`)
          .limit(6),
        supabase
          .from('breaks')
          .select('id, name, lat, lng, type, direction, region')
          .ilike('region', `%${term}%`)
          .limit(6),
      ])
      const seen = new Set<string>()
      const merged: BreakRow[] = []
      for (const item of [...(byName.data ?? []), ...(byRegion.data ?? [])] as BreakRow[]) {
        if (!seen.has(item.id)) { seen.add(item.id); merged.push(item) }
      }
      setBreakResults(merged.slice(0, 8))
      setBreakSearching(false)
    }, 300)

    return () => clearTimeout(handle)
  }, [breakQuery, selectedBreak])

  function pickBreak(b: BreakRow) {
    setSelectedBreak(b)
    setBreakQuery(b.name)
    setBreakResults([])
    setForm(f => ({ ...f, home_break: b.name }))
  }

  function clearBreak() {
    setSelectedBreak(null)
    setBreakQuery('')
    setForm(f => ({ ...f, home_break: '' }))
  }

  async function handleSave() {
    if (!currentUserId) return
    if (usernameStatus === 'taken' || usernameStatus === 'checking') {
      Alert.alert('Cannot save', 'Please choose an available username')
      return
    }
    if (!form.display_name.trim()) {
      Alert.alert('Cannot save', 'Name is required')
      return
    }
    if (form.username.trim().length < 3) {
      Alert.alert('Cannot save', 'Username must be at least 3 characters')
      return
    }

    // Home break: prefer the picked Break's name; fall back to the
    // free-text query so the user doesn't lose data if they re-typed.
    const homeBreakValue =
      selectedBreak?.name ?? breakQuery.trim() ?? null

    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name:    form.display_name.trim(),
        username:        form.username.trim().toLowerCase(),
        bio:             form.bio.trim() || null,
        home_break:      homeBreakValue || null,
        stance:          form.stance,
        preferred_board: form.preferred_board,
      })
      .eq('id', currentUserId)
    setSaving(false)

    if (error) {
      console.error('[edit-profile] save failed:', error)
      Alert.alert('Save failed', error.message)
      return
    }
    router.back()
  }

  const initial = (form.display_name || form.username).charAt(0).toUpperCase() || '?'
  const saveDisabled =
    saving ||
    usernameStatus === 'taken' ||
    usernameStatus === 'checking' ||
    !form.display_name.trim() ||
    form.username.trim().length < 3

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2230" />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.headerSide}
        >
          <Ionicons name="chevron-back" size={24} color="#E8D5B8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saveDisabled}
          hitSlop={8}
          style={[styles.headerSide, { alignItems: 'flex-end' }]}
        >
          <Text style={[styles.saveBtn, saveDisabled && styles.saveBtnDisabled]}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3CC4C4" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert('Coming soon', 'Profile photo upload coming soon')}
                hitSlop={6}
              >
                <Text style={styles.editPhotoText}>Edit profile photo</Text>
              </TouchableOpacity>
            </View>

            {/* Name */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NAME</Text>
              <TextInput
                style={styles.input}
                value={form.display_name}
                onChangeText={v => setForm(f => ({ ...f, display_name: v }))}
                placeholder="Your name"
                placeholderTextColor="rgba(232,213,184,0.35)"
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            {/* Username */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>USERNAME</Text>
              <TextInput
                style={[styles.input, usernameStatus === 'taken' && styles.inputError]}
                value={form.username}
                onChangeText={v =>
                  setForm(f => ({ ...f, username: v.replace(/[^a-z0-9_.]/gi, '').toLowerCase() }))
                }
                placeholder="username"
                placeholderTextColor="rgba(232,213,184,0.35)"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {form.username.trim().length >= 3 &&
                form.username.trim().toLowerCase() !== originalUsername && (
                <View style={styles.availabilityRow}>
                  {usernameStatus === 'checking' && (
                    <Text style={styles.availChecking}>Checking…</Text>
                  )}
                  {usernameStatus === 'available' && (
                    <>
                      <View style={[styles.availDot, { backgroundColor: '#3CC4C4' }]} />
                      <Text style={styles.availOk}>Available</Text>
                    </>
                  )}
                  {usernameStatus === 'taken' && (
                    <>
                      <View style={[styles.availDot, { backgroundColor: '#E07070' }]} />
                      <Text style={styles.availTaken}>Already taken</Text>
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Home break */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>HOME BREAK</Text>
              <View style={[styles.searchWrap, selectedBreak && styles.searchWrapSelected]}>
                <View style={styles.searchIcon} pointerEvents="none">
                  <SearchIcon />
                </View>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by break name or region…"
                  placeholderTextColor="#C5A882"
                  value={breakQuery}
                  onChangeText={t => {
                    setBreakQuery(t)
                    if (selectedBreak) setSelectedBreak(null)
                  }}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {breakSearching && (
                  <ActivityIndicator size="small" color="#4A7A87" style={styles.searchSpinner} />
                )}
              </View>

              {selectedBreak && (
                <View style={styles.selectedCard}>
                  <View style={styles.selectedCardBody}>
                    <Text style={styles.selectedBreakName} numberOfLines={1}>
                      {selectedBreak.name}
                    </Text>
                    {(selectedBreak.region ?? getLocationLabel(selectedBreak.lat, selectedBreak.lng)) && (
                      <Text style={styles.selectedBreakLoc} numberOfLines={1}>
                        {selectedBreak.region ?? getLocationLabel(selectedBreak.lat, selectedBreak.lng)}
                      </Text>
                    )}
                  </View>
                  {(selectedBreak.type || selectedBreak.direction) && (
                    <View style={styles.selectedPillStack}>
                      {selectedBreak.type && (
                        <View style={styles.pillType}>
                          <Text style={styles.pillTypeText}>{selectedBreak.type}</Text>
                        </View>
                      )}
                      {selectedBreak.direction && (
                        <View style={styles.pillDir}>
                          <Text style={styles.pillDirText}>{selectedBreak.direction}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.selectedClear}
                    onPress={clearBreak}
                    activeOpacity={0.7}
                    hitSlop={6}
                  >
                    <Text style={styles.selectedClearText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!selectedBreak && breakResults.length > 0 && (
                <View style={styles.resultsList}>
                  {breakResults.map((b, i) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.resultRow, i === breakResults.length - 1 && styles.resultRowLast]}
                      onPress={() => pickBreak(b)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.resultLeft}>
                        <Text style={styles.resultName} numberOfLines={1}>{b.name}</Text>
                        {(b.region ?? getLocationLabel(b.lat, b.lng)) && (
                          <Text style={styles.resultRegion} numberOfLines={1}>
                            {b.region ?? getLocationLabel(b.lat, b.lng)}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.resultArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {breakQuery.trim().length > 0 &&
                !breakSearching &&
                breakResults.length === 0 &&
                !selectedBreak && (
                <Text style={styles.noResultsText}>
                  No breaks found for "{breakQuery.trim()}"
                </Text>
              )}
            </View>

            {/* Stance */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>STANCE</Text>
              <View style={styles.pillRow}>
                {([
                  { value: 'regular' as const, label: 'Regular' },
                  { value: 'goofy'   as const, label: 'Goofy'   },
                ]).map(opt => {
                  const active = form.stance === opt.value
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.optionPill, active && styles.optionPillActive]}
                      onPress={() =>
                        setForm(f => ({ ...f, stance: f.stance === opt.value ? null : opt.value }))
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.optionPillText, active && styles.optionPillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* Preferred board */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PREFERRED BOARD</Text>
              <View style={styles.boardGrid}>
                {BOARD_OPTIONS.map(opt => {
                  const active = form.preferred_board === opt.value
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.boardOption, active && styles.boardOptionActive]}
                      onPress={() =>
                        setForm(f => ({
                          ...f,
                          preferred_board: f.preferred_board === opt.value ? null : opt.value,
                        }))
                      }
                      activeOpacity={0.7}
                    >
                      <BoardIcon value={opt.value} selected={active} width={16} height={30} />
                      <Text style={[styles.boardOptionText, active && styles.boardOptionTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            {/* Bio */}
            <View style={styles.section}>
              <View style={styles.bioLabelRow}>
                <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>BIO</Text>
                <Text style={styles.bioCounter}>{form.bio.length}/150</Text>
              </View>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={form.bio}
                onChangeText={v => setForm(f => ({ ...f, bio: v }))}
                placeholder="A few words about your surfing"
                placeholderTextColor="rgba(232,213,184,0.35)"
                multiline
                textAlignVertical="top"
                maxLength={150}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B2230',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.3)',
  },
  headerSide: {
    width: 64,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 17,
    color: '#E8D5B8',
    flexShrink: 1,
    textAlign: 'center',
  },
  saveBtn: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 15,
    color: '#3CC4C4',
  },
  saveBtnDisabled: {
    color: '#4A7A87',
  },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 4,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1B7A87',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 42,
    color: '#E8D5B8',
  },
  editPhotoText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 13,
    color: '#3CC4C4',
    letterSpacing: 0.3,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  sectionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  // Inputs
  input: {
    fontFamily: 'Georgia',
    fontSize: 16,
    color: '#E8D5B8',
    backgroundColor: '#0F2838',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
  },
  inputError: {
    borderColor: '#E07070',
  },
  bioInput: {
    minHeight: 110,
    paddingTop: 12,
  },
  bioLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bioCounter: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    letterSpacing: 0.4,
  },

  // Username availability indicator
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  availDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availOk: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#3CC4C4',
  },
  availTaken: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#E07070',
  },
  availChecking: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
  },

  // Home break search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F2838',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
    paddingHorizontal: 12,
    gap: 10,
    minHeight: 46,
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
    fontSize: 16,
    color: '#E8D5B8',
    paddingVertical: 10,
  },
  searchSpinner: {
    marginLeft: 4,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,78,99,0.4)',
    borderWidth: 0.5,
    borderColor: '#3CC4C4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  selectedCardBody: {
    flex: 1,
    minWidth: 0,
  },
  selectedBreakName: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 17,
    color: '#E8D5B8',
    marginBottom: 2,
  },
  selectedBreakLoc: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
  },
  selectedPillStack: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 5,
    marginHorizontal: 10,
  },
  pillType: {
    backgroundColor: 'rgba(83,74,183,0.2)',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillTypeText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#9B95E8',
    fontWeight: '500',
  },
  pillDir: {
    backgroundColor: 'rgba(15,110,86,0.2)',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillDirText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#3CC4C4',
    fontWeight: '500',
  },
  selectedClear: {
    paddingLeft: 10,
    paddingVertical: 4,
  },
  selectedClearText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#4A7A87',
  },
  resultsList: {
    marginTop: 6,
    backgroundColor: 'rgba(15,34,48,0.95)',
    borderWidth: 0.5,
    borderColor: 'rgba(197,168,130,0.2)',
    borderRadius: 10,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(197,168,130,0.1)',
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultLeft: {
    flex: 1,
    minWidth: 0,
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
  noResultsText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 12,
    color: '#4A7A87',
    textAlign: 'center',
    marginTop: 10,
  },

  // Stance pills
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.4)',
    backgroundColor: 'transparent',
  },
  optionPillActive: {
    backgroundColor: '#1B7A87',
    borderColor: '#1B7A87',
  },
  optionPillText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#C5A882',
  },
  optionPillTextActive: {
    color: '#E8D5B8',
    fontWeight: '500',
  },

  // Board grid
  boardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  boardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.4)',
    backgroundColor: 'rgba(15,40,56,0.5)',
  },
  boardOptionActive: {
    backgroundColor: '#0F4E63',
    borderColor: '#3CC4C4',
  },
  boardOptionText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 13,
    color: '#C5A882',
  },
  boardOptionTextActive: {
    color: '#3CC4C4',
  },
})
