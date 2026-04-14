import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PickedPhoto {
  uri: string
  fileName: string
  mimeType: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SWELL_OPTIONS  = ['0–3ft', '3–5ft', '5–8ft', '8–12ft', '12–15ft', '15–20ft', '20ft+']
const WIND_OPTIONS   = ['Offshore', 'Onshore', 'Glassy', 'Cross-shore']

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children, style }: { children: string; style?: object }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: string[]
  selected: string | null
  onSelect: (v: string) => void
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
      <View style={styles.chipRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, selected === opt && styles.chipSelected]}
            onPress={() => onSelect(selected === opt ? '' : opt)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, selected === opt && styles.chipTextSelected]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

function RatingDots({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} activeOpacity={0.7}>
          <View style={[styles.dot, i <= value ? styles.dotFilled : styles.dotEmpty]} />
        </TouchableOpacity>
      ))}
      <Text style={styles.ratingLabel}>{value > 0 ? `${value} / 5` : 'Tap to rate'}</Text>
    </View>
  )
}

function SessionRatingPills({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View>
      <View style={styles.pillsRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <TouchableOpacity
            key={n}
            style={[styles.pill, n <= value ? styles.pillSelected : styles.pillUnselected]}
            onPress={() => onChange(n)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, n <= value ? styles.pillTextSelected : styles.pillTextUnselected]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {value > 0 && (
        <Text style={styles.sessionRatingSubLabel}>Session rating: {value} / 10</Text>
      )}
    </View>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={16} color="#3CC4C4" />
      <Text style={styles.toastText}>Session saved!</Text>
    </Animated.View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LogSessionScreen() {
  const { break_id, break_name } = useLocalSearchParams<{
    break_id: string
    break_name: string
  }>()

  // Form state
  const [date]              = useState(() => new Date())
  const [sessionRating,     setSessionRating]     = useState(0)
  const [breakRating,       setBreakRating]       = useState(0)
  const [swellSize,         setSwellSize]         = useState<string | null>(null)
  const [wind,              setWind]              = useState<string | null>(null)
  const [board,             setBoard]             = useState('')
  const [surfedWith,        setSurfedWith]        = useState('')
  const [notes,             setNotes]             = useState('')
  const [photos,            setPhotos]            = useState<PickedPhoto[]>([])
  const [isPublic,          setIsPublic]          = useState(true)

  // Visit context state
  const [isFirstVisit,      setIsFirstVisit]      = useState<boolean | null>(null)
  const [breakRatingExpanded, setBreakRatingExpanded] = useState(false)
  const [sessionCount,      setSessionCount]      = useState(0)
  const [loadingContext,    setLoadingContext]     = useState(true)
  const [userId,            setUserId]            = useState<string | null>(null)

  // UI state
  const [saving,            setSaving]            = useState(false)
  const [error,             setError]             = useState<string | null>(null)
  const [showToast,         setShowToast]         = useState(false)

  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // ─── Load break context on mount ─────────────────────────────────────────

  useEffect(() => {
    if (!break_id) {
      setLoadingContext(false)
      return
    }
    loadBreakContext()
  }, [break_id])

  async function loadBreakContext() {
    setLoadingContext(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoadingContext(false)
        return
      }
      const uid = session.user.id
      setUserId(uid)

      // Parallel fetches: break rating row, last session, session count
      const [ratingResult, lastSessionResult, countResult] = await Promise.all([
        supabase
          .from('break_ratings')
          .select('rating')
          .eq('user_id', uid)
          .eq('break_id', break_id)
          .maybeSingle(),
        supabase
          .from('sessions')
          .select('swell_size, wind, board, is_public')
          .eq('user_id', uid)
          .eq('break_id', break_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('break_id', break_id),
      ])

      // First vs return visit
      if (ratingResult.data) {
        setIsFirstVisit(false)
        setBreakRating(ratingResult.data.rating ?? 0)
      } else {
        setIsFirstVisit(true)
      }

      // Pre-fill from last session (return visits)
      if (lastSessionResult.data) {
        const s = lastSessionResult.data
        if (s.swell_size) setSwellSize(s.swell_size)
        if (s.wind)       setWind(s.wind)
        if (s.board)      setBoard(s.board)
        setIsPublic(s.is_public ?? true)
      }

      // Session count (shown as next session number)
      setSessionCount((countResult.count ?? 0) + 1)
    } finally {
      setLoadingContext(false)
    }
  }

  // ─── Photo picker ────────────────────────────────────────────────────────

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add session photos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (!result.canceled) {
      const picked: PickedPhoto[] = result.assets.map(a => ({
        uri: a.uri,
        fileName: a.fileName ?? `photo_${Date.now()}.jpg`,
        mimeType: a.mimeType ?? 'image/jpeg',
      }))
      setPhotos(prev => [...prev, ...picked])
    }
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  // ─── Save ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!break_id) {
      setError('No break selected.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      let uid = userId
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError('You must be signed in to log a session.')
          return
        }
        uid = session.user.id
      }

      // Parse numeric swell height from the selected chip label (e.g. "3–5ft" → 5)
      const swellHeight = swellSize
        ? parseInt(swellSize.replace(/[^0-9]/g, '').slice(-2) || '0', 10) || null
        : null

      // Insert session
      const { data: inserted, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id:      uid,
          break_id,
          date:         date.toISOString().split('T')[0],
          rating:       sessionRating || null,
          swell_size:   swellSize ?? null,
          swell_height: swellHeight,
          wind:         wind ?? null,
          board:        board.trim() || null,
          surfed_with:  surfedWith.trim() || null,
          notes:        notes.trim() || null,
          is_public:    isPublic,
        })
        .select('id')
        .single()

      if (sessionError) throw sessionError

      const sessionId = inserted.id

      // Save break rating: insert on first visit, upsert when user tapped Update on return
      const shouldSaveBreakRating =
        (isFirstVisit && breakRating > 0) ||
        (!isFirstVisit && breakRatingExpanded && breakRating > 0)

      if (shouldSaveBreakRating) {
        const { error: ratingError } = await supabase
          .from('break_ratings')
          .upsert(
            { user_id: uid, break_id, rating: breakRating },
            { onConflict: 'user_id,break_id' }
          )
        if (ratingError) throw ratingError
      }

      // Upload photos
      if (photos.length > 0) {
        await Promise.all(
          photos.map(async (photo, idx) => {
            const ext      = photo.fileName.split('.').pop() ?? 'jpg'
            const path     = `${uid}/${sessionId}/${idx}.${ext}`

            const response = await fetch(photo.uri)
            const blob     = await response.blob()

            const { error: uploadError } = await supabase.storage
              .from('session-photos')
              .upload(path, blob, { contentType: photo.mimeType, upsert: true })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
              .from('session-photos')
              .getPublicUrl(path)

            await supabase.from('session_photos').insert({
              session_id: sessionId,
              user_id:    uid,
              url:        publicUrl,
              storage_path: path,
            })
          })
        )
      }

      setShowToast(true)
      setTimeout(() => router.back(), 1800)
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={20} color="#2A1A08" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Log Session</Text>
        </View>
        <View style={styles.closeButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Break + date */}
        <View style={styles.section}>
          <SectionLabel>BREAK</SectionLabel>
          <TouchableOpacity style={styles.breakNameRow} activeOpacity={0.6}>
            <Text style={styles.breakNameText}>{break_name ?? 'Select a break'}</Text>
            <Ionicons name="chevron-forward" size={14} color="#1B7A87" />
          </TouchableOpacity>
          {!loadingContext && sessionCount > 0 && (
            <Text style={styles.sessionCountText}>Session {sessionCount} here</Text>
          )}

          <SectionLabel style={{ marginTop: 12 }}>DATE</SectionLabel>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color="#A8845A" />
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
        </View>

        {/* Break rating — first visit only, shown at top */}
        {!loadingContext && isFirstVisit && (
          <View style={styles.section}>
            <View style={styles.firstVisitBanner}>
              <Text style={styles.firstVisitTitle}>First session here!</Text>
              <Text style={styles.firstVisitSubtitle}>How would you rate this break overall?</Text>
            </View>
            <SectionLabel style={{ marginTop: 10 }}>BREAK RATING</SectionLabel>
            <RatingDots value={breakRating} onChange={setBreakRating} />
          </View>
        )}

        {/* Session rating (1–10) — every visit */}
        <View style={styles.section}>
          <SectionLabel>SESSION RATING (1–10)</SectionLabel>
          <SessionRatingPills value={sessionRating} onChange={setSessionRating} />
        </View>

        {/* Swell + wind */}
        <View style={styles.section}>
          <SectionLabel>SWELL SIZE</SectionLabel>
          <ChipRow options={SWELL_OPTIONS} selected={swellSize} onSelect={setSwellSize} />

          <SectionLabel style={{ marginTop: 12 }}>WIND</SectionLabel>
          <ChipRow options={WIND_OPTIONS} selected={wind} onSelect={setWind} />
        </View>

        {/* Board */}
        <View style={styles.section}>
          <SectionLabel>BOARD</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="e.g. 9'0 longboard"
            placeholderTextColor="#C5A882"
            value={board}
            onChangeText={setBoard}
            autoCorrect={false}
          />
        </View>

        {/* Surfed with */}
        <View style={styles.section}>
          <SectionLabel>SURFED WITH</SectionLabel>
          <TextInput
            style={styles.input}
            placeholder="Add people you surfed with"
            placeholderTextColor="#C5A882"
            value={surfedWith}
            onChangeText={setSurfedWith}
            autoCorrect={false}
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <SectionLabel>SESSION NOTES</SectionLabel>
          <TextInput
            style={styles.notesInput}
            placeholder="How was it..."
            placeholderTextColor="#C5A882"
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <SectionLabel>PHOTOS</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photoRow}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri: p.uri }} style={styles.photoImage} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => removePhoto(i)}
                    hitSlop={6}
                  >
                    <Ionicons name="close-circle" size={18} color="#2A1A08" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto} activeOpacity={0.7}>
                <Ionicons name="add" size={22} color="#A8845A" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Visibility */}
        <View style={styles.section}>
          <SectionLabel>WHO CAN SEE THIS</SectionLabel>
          <View style={styles.visibilityRow}>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: '#C5A882', true: '#1B7A87' }}
              thumbColor="#FEFAF5"
            />
            <View style={styles.visibilityLabel}>
              <Text style={styles.visibilityTitle}>
                {isPublic ? 'Public' : 'Private'}
              </Text>
              <Text style={styles.visibilitySubtitle}>
                {isPublic
                  ? 'Shared to your feed & followers'
                  : 'Only visible to you'}
              </Text>
            </View>
          </View>
        </View>

        {/* Break rating — return visit compact row, above save */}
        {!loadingContext && isFirstVisit === false && (
          <View style={styles.section}>
            <View style={styles.returnBreakRow}>
              <View style={styles.returnBreakLeft}>
                <Text style={styles.returnBreakLabel}>Your break rating</Text>
                <View style={styles.miniDotsRow}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <View
                      key={i}
                      style={[styles.miniDot, i <= breakRating ? styles.dotFilled : styles.dotEmpty]}
                    />
                  ))}
                </View>
              </View>
              {!breakRatingExpanded && (
                <TouchableOpacity onPress={() => setBreakRatingExpanded(true)} hitSlop={8}>
                  <Text style={styles.updateLink}>Update →</Text>
                </TouchableOpacity>
              )}
            </View>
            {breakRatingExpanded && (
              <View style={{ marginTop: 10 }}>
                <RatingDots value={breakRating} onChange={setBreakRating} />
              </View>
            )}
          </View>
        )}

        {/* Error */}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#E8D5B8" />
          ) : (
            <Text style={styles.saveButtonText}>Save session</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>

      <Toast visible={showToast} />
    </KeyboardAvoidingView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F5EDE0',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2E8D8',
    borderBottomWidth: 0.5,
    borderBottomColor: '#D8C8B0',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 14,
  },
  closeButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 20,
    color: '#2A1A08',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Section
  section: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#D8C8B0',
  },
  sectionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 9,
    color: '#A8845A',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  // Break name
  breakNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  breakNameText: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 16,
    color: '#1B7A87',
  },
  sessionCountText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 8,
    color: '#A8845A',
    marginBottom: 4,
    marginLeft: 2,
  },

  // Date
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#2A1A08',
  },

  // First visit banner
  firstVisitBanner: {
    backgroundColor: '#E1F5EE',
    borderWidth: 0.5,
    borderColor: '#1B7A87',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  firstVisitTitle: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 9,
    color: '#0F5A65',
    marginBottom: 2,
  },
  firstVisitSubtitle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 8,
    color: '#1B7A87',
  },

  // Rating dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dotFilled: {
    backgroundColor: '#1B7A87',
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#C5A882',
  },
  ratingLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#A8845A',
    marginLeft: 4,
  },

  // Session rating pills (1–10)
  pillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  pill: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: '#1B7A87',
  },
  pillUnselected: {
    backgroundColor: '#EDE0CC',
    borderWidth: 1,
    borderColor: '#C5A882',
  },
  pillText: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 10,
  },
  pillTextSelected: {
    color: '#E8D5B8',
  },
  pillTextUnselected: {
    color: '#C5A882',
  },
  sessionRatingSubLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 8,
    color: '#A8845A',
    textAlign: 'center',
    marginTop: 6,
  },

  // Return visit break rating row
  returnBreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2E8D8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  returnBreakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  returnBreakLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#2A1A08',
  },
  miniDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  miniDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  updateLink: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 11,
    color: '#1B7A87',
  },

  // Chips
  chipScroll: {
    marginHorizontal: -18,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 18,
    paddingRight: 24,
  },
  chip: {
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: '#0F5A65',
    borderColor: '#1B7A87',
  },
  chipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#7A4E2A',
  },
  chipTextSelected: {
    color: '#3CC4C4',
  },

  // Inputs
  input: {
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Georgia',
    fontSize: 14,
    color: '#2A1A08',
  },
  notesInput: {
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 14,
    color: '#2A1A08',
    minHeight: 100,
  },

  // Photos
  photoRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  photoThumb: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  photoImage: {
    width: 52,
    height: 52,
    borderRadius: 7,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F5EDE0',
    borderRadius: 9,
  },
  photoAdd: {
    width: 52,
    height: 52,
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderStyle: 'dashed',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Visibility
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  visibilityLabel: {
    flex: 1,
  },
  visibilityTitle: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 13,
    color: '#2A1A08',
  },
  visibilitySubtitle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#A8845A',
    marginTop: 1,
  },

  // Error
  errorText: {
    color: '#C0503A',
    fontSize: 13,
    fontFamily: 'Helvetica Neue',
    textAlign: 'center',
    marginHorizontal: 18,
    marginTop: 4,
  },

  // Save
  saveButton: {
    marginHorizontal: 18,
    marginTop: 20,
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '600',
    fontSize: 15,
    color: '#E8D5B8',
    letterSpacing: 0.3,
  },

  bottomPad: {
    height: 20,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F2D3A',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toastText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#E8D5B8',
  },
})
