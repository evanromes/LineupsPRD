// -- Migration required in Supabase before crowd_factor will save:
// -- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
// -- crowd_factor text CHECK (crowd_factor IN ('empty','moderate','crowded','zoo'));

import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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

const SWELL_OPTIONS = ['0–3ft', '3–5ft', '5–8ft', '8–12ft', '12–15ft', '15–20ft', '20ft+']
const WIND_OPTIONS  = ['Offshore', 'Onshore', 'Glassy', 'Cross', 'N/A']

const CROWD_OPTIONS: { label: string; value: string }[] = [
  { label: 'Empty',    value: 'empty' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Crowded',  value: 'crowded' },
  { label: 'Zoo',      value: 'zoo' },
]

function breakRatingLabel(r: number): string {
  if (r === 1) return 'Not worth it'
  if (r === 2) return 'Mediocre'
  if (r === 3) return 'Decent spot'
  if (r === 4) return 'Really good'
  if (r === 5) return 'Epic'
  return ''
}

function sessionRatingLabel(r: number): string {
  if (r <= 0) return ''
  if (r <= 2) return 'Rough one'
  if (r <= 4) return 'Below average'
  if (r <= 6) return 'Decent waves'
  if (r <= 8) return 'Excellent session'
  return 'One for the books'
}

// ─── Progress Dots ────────────────────────────────────────────────────────────

function ProgressDots({ step, isFirstVisit }: { step: number; isFirstVisit: boolean | null }) {
  return (
    <View style={styles.progressDotsRow}>
      {[1, 2, 3].map(i => {
        const isActive = i === step
        const isDone = i < step || (i === 1 && isFirstVisit === false)
        return (
          <View
            key={i}
            style={[
              styles.progressDot,
              isActive ? styles.progressDotActive
              : isDone  ? styles.progressDotDone
              :            styles.progressDotUpcoming,
            ]}
          />
        )
      })}
    </View>
  )
}

// ─── Custom Toggle ────────────────────────────────────────────────────────────

function Toggle({
  value,
  onValueChange,
  onColor,
  offColor,
  trackWidth = 36,
  trackHeight = 20,
}: {
  value: boolean
  onValueChange: (v: boolean) => void
  onColor: string
  offColor: string
  trackWidth?: number
  trackHeight?: number
}) {
  const thumbSize = 16
  const thumbTop = (trackHeight - thumbSize) / 2
  const thumbOnLeft = trackWidth - thumbSize - 2
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start()
  }, [value])

  const thumbLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [2, thumbOnLeft] })
  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: [offColor, onColor] })

  return (
    <TouchableOpacity onPress={() => onValueChange(!value)} activeOpacity={0.8}>
      <Animated.View style={{
        width: trackWidth,
        height: trackHeight,
        borderRadius: trackHeight / 2,
        backgroundColor: trackColor,
      }}>
        <Animated.View style={{
          position: 'absolute',
          top: thumbTop,
          width: thumbSize,
          height: thumbSize,
          borderRadius: thumbSize / 2,
          backgroundColor: '#FEFAF5',
          left: thumbLeft,
        }} />
      </Animated.View>
    </TouchableOpacity>
  )
}

// ─── Break Rating Dots (step 1) ───────────────────────────────────────────────

function BreakRatingDots({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.breakRatingDotsRow}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = i <= value
        return (
          <TouchableOpacity
            key={i}
            onPress={() => onChange(i === value ? 0 : i)}
            activeOpacity={0.7}
            style={[
              styles.breakRatingDot,
              filled ? styles.breakRatingDotFilled : styles.breakRatingDotEmpty,
            ]}
          />
        )
      })}
    </View>
  )
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ children, color }: { children: string; color?: string }) {
  return (
    <Text style={[styles.sectionLabel, color ? { color } : undefined]}>{children}</Text>
  )
}

// ─── Chip Row ─────────────────────────────────────────────────────────────────

function ChipRow({
  options,
  selected,
  onSelect,
  selectedBg = '#0F5A65',
  selectedBorderColor = '#1B7A87',
  selectedTextColor = '#3CC4C4',
}: {
  options: string[]
  selected: string | null
  onSelect: (v: string | null) => void
  selectedBg?: string
  selectedBorderColor?: string
  selectedTextColor?: string
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
      <View style={styles.chipRow}>
        {options.map(opt => {
          const isSelected = selected === opt
          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.chip,
                isSelected && {
                  backgroundColor: selectedBg,
                  borderColor: selectedBorderColor,
                  borderWidth: 0.5,
                },
              ]}
              onPress={() => onSelect(isSelected ? null : opt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isSelected && { color: selectedTextColor }]}>
                {opt}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LogSessionScreen() {
  const { break_id, break_name } = useLocalSearchParams<{
    break_id: string
    break_name: string
  }>()

  // Step navigation
  const [step, setStep] = useState(1)

  // Step 1 — break rating
  const [breakRating,  setBreakRating]  = useState(0)
  const [isFavorite,   setIsFavorite]   = useState(false)

  // Step 2 — session conditions
  const [date]                          = useState(() => new Date())
  const [sessionRating, setSessionRating] = useState(0)
  const [swellSize,    setSwellSize]    = useState<string | null>(null)
  const [wind,         setWind]         = useState<string | null>(null)
  const [crowdFactor,  setCrowdFactor]  = useState<string | null>(null)

  // Step 3 — scene details
  const [board,        setBoard]        = useState('')
  const [surfedWith,   setSurfedWith]   = useState('')
  const [notes,        setNotes]        = useState('')
  const [photos,       setPhotos]       = useState<PickedPhoto[]>([])
  const [isPublic,     setIsPublic]     = useState(true)

  // Context
  const [isFirstVisit,    setIsFirstVisit]    = useState<boolean | null>(null)
  const [sessionCount,    setSessionCount]    = useState(0)
  const [loadingContext,  setLoadingContext]  = useState(true)
  const [userId,          setUserId]          = useState<string | null>(null)

  // UI
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)

  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // ─── Load context ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!break_id) { setLoadingContext(false); return }
    loadBreakContext()
  }, [break_id])

  async function loadBreakContext() {
    setLoadingContext(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingContext(false); return }
      const uid = session.user.id
      setUserId(uid)

      const [ratingResult, lastSessionResult, countResult] = await Promise.all([
        supabase
          .from('break_ratings')
          .select('rating, is_favorite')
          .eq('user_id', uid)
          .eq('break_id', break_id)
          .maybeSingle(),
        supabase
          .from('sessions')
          .select('swell_size, wind, crowd_factor, board, is_public')
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

      if (ratingResult.data) {
        setIsFirstVisit(false)
        setBreakRating(ratingResult.data.rating ?? 0)
        setIsFavorite(ratingResult.data.is_favorite ?? false)
        setStep(2)
      } else {
        setIsFirstVisit(true)
      }

      if (lastSessionResult.data) {
        const s = lastSessionResult.data
        if (s.swell_size)   setSwellSize(s.swell_size)
        if (s.wind)         setWind(s.wind)
        if (s.crowd_factor) setCrowdFactor(s.crowd_factor)
        if (s.board)        setBoard(s.board)
        setIsPublic(s.is_public ?? true)
      }

      setSessionCount((countResult.count ?? 0) + 1)
    } finally {
      setLoadingContext(false)
    }
  }

  // ─── Photos ────────────────────────────────────────────────────────────────

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

  // ─── Navigation ────────────────────────────────────────────────────────────

  function handleBack() {
    const initialStep = isFirstVisit === false ? 2 : 1
    if (step <= initialStep) {
      router.back()
    } else {
      setStep(s => s - 1)
    }
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!break_id) { setError('No break selected.'); return }
    setSaving(true)
    setError(null)

    try {
      let uid = userId
      if (!uid) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setError('You must be signed in to log a session.'); return }
        uid = session.user.id
      }

      const { data: inserted, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id:      uid,
          break_id,
          date:         date.toISOString().split('T')[0],
          rating:       sessionRating || null,
          swell_size:   swellSize ?? null,
          wind:         wind ?? null,
          crowd_factor: crowdFactor ?? null,
          board:        board.trim() || null,
          surfed_with:  surfedWith.trim() || null,
          notes:        notes.trim() || null,
          is_public:    isPublic,
        })
        .select('id')
        .single()

      if (sessionError) throw sessionError

      const sessionId = inserted.id

      if (isFirstVisit && breakRating > 0) {
        const { error: ratingError } = await supabase
          .from('break_ratings')
          .insert({ user_id: uid, break_id, rating: breakRating, is_favorite: isFavorite })
        if (ratingError) throw ratingError
      }

      if (photos.length > 0) {
        await Promise.all(
          photos.map(async (photo, idx) => {
            const ext  = photo.fileName.split('.').pop() ?? 'jpg'
            const path = `${uid}/${sessionId}/${idx}.${ext}`
            const response = await fetch(photo.uri)
            const blob = await response.blob()
            const { error: uploadError } = await supabase.storage
              .from('session-photos')
              .upload(path, blob, { contentType: photo.mimeType, upsert: true })
            if (uploadError) throw uploadError
            const { data: { publicUrl } } = supabase.storage
              .from('session-photos')
              .getPublicUrl(path)
            await supabase.from('session_photos').insert({
              session_id: sessionId, user_id: uid, url: publicUrl, storage_path: path,
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

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loadingContext) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#1B7A87" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#2A1A08" />
        </TouchableOpacity>
        <ProgressDots step={step} isFirstVisit={isFirstVisit} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, step <= 2 && styles.scrollContentFull]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step 1: Rate the Break ─────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.step1Container}>
            {/* Top group */}
            <View style={styles.step1Top}>
              <Text style={styles.step1ContextLine}>{break_name}</Text>
              <Text style={styles.step1Heading}>How would you rate this break?</Text>
            </View>

            {/* Middle group — dots + descriptor */}
            <View style={styles.step1Middle}>
              <BreakRatingDots value={breakRating} onChange={setBreakRating} />
              <Text style={styles.step1Descriptor}>
                {breakRating > 0 ? breakRatingLabel(breakRating) : ' '}
              </Text>
            </View>

            {/* Bottom group — toggle + buttons */}
            <View style={styles.step1Bottom}>
              <View style={styles.toggleCard}>
                <View style={styles.toggleCardLeft}>
                  <View style={styles.favoriteDot} />
                  <Text style={styles.toggleCardLabel}>Mark as a favorite</Text>
                </View>
                <Toggle
                  value={isFavorite}
                  onValueChange={setIsFavorite}
                  onColor="#7F77DD"
                  offColor="#D8C8B0"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setStep(2)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Next →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => { setBreakRating(0); setIsFavorite(false); setStep(2) }}
                activeOpacity={0.7}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 2: How was the session? ───────────────────────────────── */}
        {step === 2 && (
          <View style={styles.step2Container}>
            {/* Top group */}
            <View>
              <Text style={styles.stepContextLine}>{formattedDate}</Text>
              <Text style={styles.stepHeading}>How was the session?</Text>
              {isFirstVisit === false && (
                <Text style={styles.sessionCountLine}>Session {sessionCount} here</Text>
              )}
            </View>

            {/* Session rating 1–10 */}
            <View>
              <View style={styles.sessionPillsRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.sessionPill,
                      n <= sessionRating ? styles.sessionPillSelected : styles.sessionPillUnselected,
                    ]}
                    onPress={() => setSessionRating(n)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.sessionPillText,
                      n <= sessionRating ? styles.sessionPillTextSelected : styles.sessionPillTextUnselected,
                    ]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.ratingDescriptor}>
                {sessionRating > 0 ? sessionRatingLabel(sessionRating) : ' '}
              </Text>
            </View>

            {/* Swell size */}
            <View>
              <SectionLabel>SWELL SIZE</SectionLabel>
              <ChipRow options={SWELL_OPTIONS} selected={swellSize} onSelect={setSwellSize} />
            </View>

            {/* Wind */}
            <View>
              <SectionLabel>WIND</SectionLabel>
              <ChipRow options={WIND_OPTIONS} selected={wind} onSelect={setWind} />
            </View>

            {/* Crowd factor */}
            <View>
              <SectionLabel color="#534AB7">CROWD FACTOR</SectionLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <View style={styles.chipRow}>
                  {CROWD_OPTIONS.map(({ label, value }) => {
                    const isSelected = crowdFactor === value
                    return (
                      <TouchableOpacity
                        key={value}
                        style={[styles.chip, isSelected && styles.crowdChipSelected]}
                        onPress={() => setCrowdFactor(isSelected ? null : value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, isSelected && styles.crowdChipTextSelected]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Buttons */}
            <View>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setStep(3)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>Next →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => setStep(3)}
                activeOpacity={0.7}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 3: Set the Scene ──────────────────────────────────────── */}
        {step === 3 && (
          <View style={styles.step3Container}>
            <Text style={styles.stepHeading}>Set the scene</Text>
            <Text style={styles.stepSubheading}>Conditions, who you surfed with, notes</Text>

            {/* Board */}
            <View style={styles.fieldBlock}>
              <SectionLabel>BOARD</SectionLabel>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 9'2 longboard"
                placeholderTextColor="#C5A882"
                value={board}
                onChangeText={setBoard}
                autoCorrect={false}
              />
            </View>

            {/* Surfed with */}
            <View style={styles.fieldBlock}>
              <SectionLabel>SURFED WITH</SectionLabel>
              <TextInput
                style={styles.textInput}
                placeholder="Add people you surfed with"
                placeholderTextColor="#C5A882"
                value={surfedWith}
                onChangeText={setSurfedWith}
                autoCorrect={false}
              />
            </View>

            {/* Notes */}
            <View style={styles.fieldBlock}>
              <SectionLabel>NOTES</SectionLabel>
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
            <View style={styles.fieldBlock}>
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
                    <Ionicons name="add" size={28} color="#A8845A" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>

            {/* Public / private toggle */}
            <View style={styles.toggleCardLarge}>
              <View style={styles.toggleCardLeft}>
                <View>
                  <Text style={styles.toggleCardLabel}>Public</Text>
                  <Text style={styles.toggleCardSub}>Shared to your feed</Text>
                </View>
              </View>
              <Toggle
                value={isPublic}
                onValueChange={setIsPublic}
                onColor="#1B7A87"
                offColor="#C5A882"
                trackWidth={40}
                trackHeight={22}
              />
            </View>

            {/* Error */}
            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
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

            <View style={{ height: 32 }} />
          </View>
        )}
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

  loadingContainer: {
    flex: 1,
    backgroundColor: '#F5EDE0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5EDE0',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 14,
  },
  headerBack: {
    width: 32,
  },
  headerSpacer: {
    width: 32,
  },

  // Progress dots
  progressDotsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
  },
  progressDotActive: {
    width: 20,
    backgroundColor: '#1B7A87',
  },
  progressDotDone: {
    width: 8,
    backgroundColor: '#3CC4C4',
  },
  progressDotUpcoming: {
    width: 8,
    backgroundColor: '#C5A882',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  scrollContentFull: {
    flexGrow: 1,
  },

  // Step 1 — full-height distributed layout
  step1Container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  step1Top: {
    alignItems: 'center',
  },
  step1ContextLine: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#1B7A87',
    textAlign: 'center',
    marginBottom: 12,
  },
  step1Heading: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 34,
    color: '#2A1A08',
    textAlign: 'center',
  },
  step1Middle: {
    alignItems: 'center',
  },
  step1Descriptor: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#1B7A87',
    textAlign: 'center',
    marginTop: 14,
    minHeight: 22,
  },
  step1Bottom: {},

  // Step 2 — full-height distributed layout
  step2Container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },

  // Step 3 — scrollable with even spacing
  step3Container: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },

  // Legacy stepContainer (unused but kept for safety)
  stepContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  stepContextLine: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#1B7A87',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepHeading: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 34,
    color: '#2A1A08',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepSubheading: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#A8845A',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  sessionCountLine: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 11,
    color: '#1B7A87',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 4,
  },

  // Field block
  fieldBlock: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#A8845A',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  // Break rating dots (step 1)
  breakRatingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  breakRatingDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  breakRatingDotFilled: {
    backgroundColor: '#1B7A87',
  },
  breakRatingDotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#C5A882',
  },

  // Rating descriptor
  ratingDescriptor: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#1B7A87',
    textAlign: 'center',
    marginTop: 8,
    minHeight: 22,
  },

  // Toggle cards
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEFAF5',
    borderWidth: 0.5,
    borderColor: '#D8C8B0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    marginTop: 4,
  },
  toggleCardLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEFAF5',
    borderWidth: 0.5,
    borderColor: '#D8C8B0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    marginTop: 4,
  },
  toggleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  toggleCardLabel: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 15,
    color: '#2A1A08',
  },
  toggleCardSub: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#A8845A',
    marginTop: 2,
  },
  favoriteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7F77DD',
  },

  // Custom toggle (now rendered inline in component — these are unused but kept as reference)
  toggleTrack: {},
  toggleThumb: {},

  // Session rating pills
  sessionPillsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  sessionPill: {
    flex: 1,
    height: 36,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionPillSelected: {
    backgroundColor: '#1B7A87',
  },
  sessionPillUnselected: {
    backgroundColor: '#EDE0CC',
    borderWidth: 1,
    borderColor: '#C5A882',
  },
  sessionPillText: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 12,
  },
  sessionPillTextSelected: {
    color: '#E8D5B8',
  },
  sessionPillTextUnselected: {
    color: '#C5A882',
  },

  // Chips
  chipScroll: {
    marginHorizontal: -24,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingRight: 32,
  },
  chip: {
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#7A4E2A',
  },
  crowdChipSelected: {
    backgroundColor: '#EEEDFE',
    borderColor: '#534AB7',
    borderWidth: 0.5,
  },
  crowdChipTextSelected: {
    color: '#534AB7',
  },

  // Text inputs
  textInput: {
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    height: 46,
    fontFamily: 'Georgia',
    fontSize: 13,
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
    fontSize: 13,
    color: '#2A1A08',
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Photos
  photoRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  photoThumb: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  photoImage: {
    width: 60,
    height: 60,
    borderRadius: 9,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F5EDE0',
    borderRadius: 9,
  },
  photoAdd: {
    width: 60,
    height: 60,
    backgroundColor: '#EDE0CC',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderStyle: 'dashed',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Buttons
  primaryButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 14,
    color: '#E8D5B8',
    letterSpacing: 0.3,
  },
  ghostButton: {
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  ghostButtonText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#A8845A',
    letterSpacing: 0.3,
  },
  skipButton: {
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: '#C5A882',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  skipButtonText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#A8845A',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '600',
    fontSize: 14,
    color: '#E8D5B8',
    letterSpacing: 0.3,
  },

  // Error
  errorText: {
    color: '#C0503A',
    fontSize: 13,
    fontFamily: 'Helvetica Neue',
    textAlign: 'center',
    marginBottom: 10,
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
