// -- Migration required in Supabase before crowd_factor will save:
// -- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
// -- crowd_factor text CHECK (crowd_factor IN ('empty','moderate','crowded','zoo'));

import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  PanResponder,
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
import Svg, { Ellipse, Line, Path } from 'react-native-svg'
import { supabase } from '../lib/supabase'

const SCREEN_HEIGHT = Dimensions.get('window').height

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

type BoardType = 'shortboard' | 'mid-length' | 'longboard' | 'gun' | 'sup' | 'foil' | null

const BOARD_OPTIONS: { value: BoardType; label: string }[] = [
  { value: 'shortboard', label: 'Shortboard' },
  { value: 'mid-length', label: 'Mid-Length' },
  { value: 'longboard',  label: 'Longboard'  },
  { value: 'gun',        label: 'Gun'         },
  { value: 'sup',        label: 'SUP'         },
  { value: 'foil',       label: 'Foil'        },
  { value: null,         label: 'Other'        },
]

function getBoardNotesPlaceholder(bt: BoardType): string {
  if (bt === null)          return "e.g. Mixed quiver"
  if (bt === 'shortboard')  return "e.g. 5'8 Al Merrick"
  if (bt === 'mid-length')  return "e.g. 7'6 Pyzel Mid"
  if (bt === 'longboard')   return "e.g. 9'2 Noserider"
  if (bt === 'gun')         return "e.g. 9'6 Stretch Gun"
  if (bt === 'sup')         return "e.g. 10'6 Race board"
  if (bt === 'foil')        return "e.g. Armstrong CF1200"
  return "e.g. Board details"
}

function BoardIcon({ value, selected }: { value: BoardType; selected: boolean }) {
  const stroke  = selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'
  const fill    = selected ? '#0F4E63' : 'rgba(197,168,130,0.25)'
  const sw      = selected ? 1.5 : 1

  if (value === 'shortboard') return (
    <Svg width={28} height={52} viewBox="0 0 64 104">
      <Ellipse cx={32} cy={54} rx={6.5} ry={26} fill={fill} stroke={stroke} strokeWidth={sw} />
      {selected && <Ellipse cx={32} cy={54} rx={3} ry={18} fill="none" stroke="#3CC4C4" strokeWidth={0.75} opacity={0.4} />}
    </Svg>
  )
  if (value === 'mid-length') return (
    <Svg width={28} height={52} viewBox="0 0 64 104">
      <Ellipse cx={32} cy={52} rx={8} ry={33} fill={fill} stroke={stroke} strokeWidth={sw} />
      <Ellipse cx={32} cy={52} rx={2.5} ry={24} fill="none" stroke={stroke} strokeWidth={0.75} opacity={selected ? 0.4 : 1} />
    </Svg>
  )
  if (value === 'longboard') return (
    <Svg width={28} height={52} viewBox="0 0 64 104">
      <Ellipse cx={32} cy={51} rx={9.5} ry={51} fill={fill} stroke={stroke} strokeWidth={sw} />
      <Ellipse cx={32} cy={52} rx={2} ry={37} fill="none" stroke={stroke} strokeWidth={0.75} opacity={selected ? 0.4 : 1} />
    </Svg>
  )
  if (value === 'gun') return (
    <Svg width={28} height={52} viewBox="0 0 64 104">
      <Path
        d="M 32 8 Q 26 25 25 50 Q 25 75 30 90 Q 32 92 34 90 Q 39 75 39 50 Q 38 25 32 8 Z"
        fill={fill} stroke={stroke} strokeWidth={sw}
      />
      {selected && (
        <Path
          d="M 32 22 Q 31 40 31 51 Q 31 65 32 78"
          stroke="#3CC4C4" strokeWidth={0.75} opacity={0.4} fill="none"
        />
      )}
    </Svg>
  )
  if (value === 'sup') return (
    <Svg width={28} height={52} viewBox="0 0 64 104">
      <Ellipse cx={26} cy={51} rx={10.5} ry={51} fill={fill} stroke={stroke} strokeWidth={sw} />
      {selected && <Ellipse cx={26} cy={51} rx={4} ry={37} fill="none" stroke="#3CC4C4" strokeWidth={0.75} opacity={0.4} />}
      <Line x1={46} y1={8} x2={46} y2={selected ? 84 : 86} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Ellipse cx={46} cy={selected ? 90 : 92} rx={5} ry={7} fill="none" stroke={stroke} strokeWidth={sw} />
    </Svg>
  )
  if (value === 'foil') return (
    <Svg width={28} height={52} viewBox="0 0 64 104">
      <Ellipse cx={32} cy={38} rx={6.5} ry={24} fill={fill} stroke={stroke} strokeWidth={sw} />
      {selected && <Ellipse cx={32} cy={38} rx={3} ry={17} fill="none" stroke="#3CC4C4" strokeWidth={0.75} opacity={0.4} />}
      <Line x1={32} y1={62} x2={32} y2={81} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M 18 81 Q 32 79 46 81" stroke={stroke} strokeWidth={selected ? 1.8 : 1.2} strokeLinecap="round" fill="none" />
      <Line x1={32} y1={81} x2={32} y2={92} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Path d="M 22 92 Q 32 90.5 42 92" stroke={stroke} strokeWidth={selected ? 1.2 : 1} strokeLinecap="round" fill="none" />
    </Svg>
  )
  return null
}

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
      {[1, 2, 3, 4, 5].map(i => {
        const isActive = i === step
        const isDone   = i < step || (i === 1 && isFirstVisit === false)
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
  const thumbSize   = 16
  const thumbTop    = (trackHeight - thumbSize) / 2
  const thumbOnLeft = trackWidth - thumbSize - 2
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 150, useNativeDriver: false }).start()
  }, [value])

  const thumbLeft  = anim.interpolate({ inputRange: [0, 1], outputRange: [2, thumbOnLeft] })
  const trackColor = anim.interpolate({ inputRange: [0, 1], outputRange: [offColor, onColor] })

  return (
    <TouchableOpacity onPress={() => onValueChange(!value)} activeOpacity={0.8}>
      <Animated.View style={{ width: trackWidth, height: trackHeight, borderRadius: trackHeight / 2, backgroundColor: trackColor }}>
        <Animated.View style={{ position: 'absolute', top: thumbTop, width: thumbSize, height: thumbSize, borderRadius: thumbSize / 2, backgroundColor: '#E8D5B8', left: thumbLeft }} />
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
            style={[styles.breakRatingDot, filled ? styles.breakRatingDotFilled : styles.breakRatingDotEmpty]}
          />
        )
      })}
    </View>
  )
}

// ─── Session Rating Slider ────────────────────────────────────────────────────

const THUMB_SIZE = 28

function SessionRatingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0)
  const trackWidthRef = useRef(0)
  const trackPageXRef = useRef(0)
  const onChangeRef   = useRef(onChange)
  onChangeRef.current = onChange
  const trackViewRef  = useRef<View>(null)

  function posToValue(x: number): number {
    const usableWidth = trackWidthRef.current - THUMB_SIZE
    if (usableWidth <= 0) return 1
    const ratio = Math.max(0, Math.min(1, (x - THUMB_SIZE / 2) / usableWidth))
    return Math.round(ratio * 9) + 1
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const relX = e.nativeEvent.pageX - trackPageXRef.current
        onChangeRef.current(posToValue(relX))
      },
      onPanResponderMove: (e) => {
        const relX = e.nativeEvent.pageX - trackPageXRef.current
        onChangeRef.current(posToValue(relX))
      },
    })
  ).current

  function onTrackLayout(e: any) {
    const w = e.nativeEvent.layout.width
    trackWidthRef.current = w
    setTrackWidth(w)
    trackViewRef.current?.measure((_x, _y, _w, _h, pageX) => {
      trackPageXRef.current = pageX
    })
  }

  const usableWidth  = Math.max(0, trackWidth - THUMB_SIZE)
  const thumbLeft    = value > 0 ? ((value - 1) / 9) * usableWidth : 0
  const fillWidth    = thumbLeft + THUMB_SIZE / 2

  return (
    <View style={sliderStyles.container}>
      <View
        ref={trackViewRef}
        style={sliderStyles.touchArea}
        onLayout={onTrackLayout}
        {...panResponder.panHandlers}
      >
        {/* Track background */}
        <View style={sliderStyles.track} />
        {/* Filled portion */}
        {value > 0 && (
          <View style={[sliderStyles.fill, { width: fillWidth }]} />
        )}
        {/* Thumb */}
        {value > 0 && (
          <View style={[sliderStyles.thumb, { left: thumbLeft }]} />
        )}
        {/* Inactive thumb indicator when no value */}
        {value === 0 && (
          <View style={[sliderStyles.thumbEmpty, { left: 0 }]} />
        )}
      </View>
      <View style={sliderStyles.numbersRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <TouchableOpacity key={n} onPress={() => onChange(n)} activeOpacity={0.6} hitSlop={6}>
            <Text style={[sliderStyles.numberText, n === value && sliderStyles.numberTextActive]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const sliderStyles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 8,
  },
  touchArea: {
    height: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: 3,
    backgroundColor: '#1B3A45',
    borderRadius: 2,
  },
  fill: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    height: 3,
    backgroundColor: '#3CC4C4',
    borderRadius: 2,
    marginLeft: -THUMB_SIZE / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#3CC4C4',
    shadowColor: '#3CC4C4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  thumbEmpty: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#1B3A45',
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: THUMB_SIZE / 2,
    marginTop: 8,
  },
  numberText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
    textAlign: 'center',
    minWidth: 16,
  },
  numberTextActive: {
    color: '#3CC4C4',
    fontWeight: '700',
  },
})

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
  selectedBg = '#1B7A87',
  selectedBorderColor = '#3CC4C4',
  selectedTextColor = '#E8D5B8',
  inactiveBorderColor,
  inactiveTextColor,
}: {
  options: string[]
  selected: string | null
  onSelect: (v: string | null) => void
  selectedBg?: string
  selectedBorderColor?: string
  selectedTextColor?: string
  inactiveBorderColor?: string
  inactiveTextColor?: string
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
                inactiveBorderColor && !isSelected && { borderColor: inactiveBorderColor },
                isSelected && { backgroundColor: selectedBg, borderColor: selectedBorderColor, borderWidth: 0.5 },
              ]}
              onPress={() => onSelect(isSelected ? null : opt)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.chipText,
                inactiveTextColor && !isSelected && { color: inactiveTextColor },
                isSelected && { color: selectedTextColor },
              ]}>
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

  // Steps: 1=break rating, 2=session rating, 3=conditions, 4=set the scene
  const [step, setStep] = useState(1)

  // Step 1 — break rating
  const [breakRating,   setBreakRating]   = useState(0)
  const [isFavorite,    setIsFavorite]    = useState(false)

  // Step 2 — session rating
  const [date]                             = useState(() => new Date())
  const [sessionRating, setSessionRating] = useState(5)

  // Step 3 — conditions
  const [swellSize,    setSwellSize]    = useState<string | null>(null)
  const [wind,         setWind]         = useState<string | null>(null)
  const [crowdFactor,  setCrowdFactor]  = useState<string | null>(null)

  // Step 3 — board selection
  const [boardType, setBoardType] = useState<BoardType | undefined>(undefined)
  const [boardNotes, setBoardNotes] = useState('')

  // Step 5 — scene details
  const [board,        setBoard]        = useState('')
  const [surfedWith,   setSurfedWith]   = useState('')
  const [notes,        setNotes]        = useState('')
  const [photos,       setPhotos]       = useState<PickedPhoto[]>([])
  const [isPublic,     setIsPublic]     = useState(true)

  // Context
  const [isFirstVisit,   setIsFirstVisit]   = useState<boolean | null>(null)
  const [sessionCount,   setSessionCount]   = useState(0)
  const [loadingContext, setLoadingContext] = useState(true)
  const [userId,         setUserId]         = useState<string | null>(null)

  // UI
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)

  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
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
        supabase.from('break_ratings').select('rating, is_favorite').eq('user_id', uid).eq('break_id', break_id).maybeSingle(),
        supabase.from('sessions').select('swell_size, wind, crowd_factor, board, is_public').eq('user_id', uid).eq('break_id', break_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('break_id', break_id),
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
    if (step <= initialStep) router.back()
    else setStep(s => s - 1)
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
          user_id: uid, break_id,
          date: date.toISOString().split('T')[0],
          rating: sessionRating || null,
          swell_size: swellSize ?? null,
          wind: wind ?? null,
          crowd_factor: crowdFactor ?? null,
          board: boardType !== undefined
            ? (boardType
                ? [boardType.charAt(0).toUpperCase() + boardType.slice(1), boardNotes.trim() || null].filter(Boolean).join(' — ')
                : boardNotes.trim() || null)
            : board.trim() || null,
          surfed_with: surfedWith.trim() || null,
          notes: notes.trim() || null,
          is_public: isPublic,
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
        await Promise.all(photos.map(async (photo, idx) => {
          const ext  = photo.fileName.split('.').pop() ?? 'jpg'
          const path = `${uid}/${sessionId}/${idx}.${ext}`
          const response = await fetch(photo.uri)
          const blob = await response.blob()
          const { error: uploadError } = await supabase.storage
            .from('session-photos').upload(path, blob, { contentType: photo.mimeType, upsert: true })
          if (uploadError) throw uploadError
          const { data: { publicUrl } } = supabase.storage.from('session-photos').getPublicUrl(path)
          await supabase.from('session_photos').insert({ session_id: sessionId, user_id: uid, url: publicUrl, storage_path: path })
        }))
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
        <ActivityIndicator color="#3CC4C4" />
      </View>
    )
  }

  // Step 2 renders as a half-screen bottom sheet over the map
  if (step === 2) {
    return (
      <View style={styles.step2Outer}>
        {/* Bottom sheet */}
        <View style={styles.step2Sheet}>
          <View style={styles.sheetHandle} />

          {/* Progress dots + back inside sheet */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.headerBack} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color="#E8D5B8" />
            </TouchableOpacity>
            <ProgressDots step={step} isFirstVisit={isFirstVisit} />
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.step2Content}>
            {/* Context lines */}
            <View style={styles.step2TextGroup}>
              <Text style={styles.step2ContextLine}>{formattedDate}</Text>
              <Text style={styles.step2Heading}>How was your surf?</Text>
              {isFirstVisit === false && (
                <Text style={styles.step2SessionCount}>Session {sessionCount} here</Text>
              )}
            </View>

            {/* Slider */}
            <View style={styles.step2SliderGroup}>
              <SessionRatingSlider value={sessionRating} onChange={setSessionRating} />
              <Text style={styles.step2Descriptor}>
                {sessionRating > 0 ? sessionRatingLabel(sessionRating) : ' '}
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.step2Buttons}>
              <TouchableOpacity
                style={[styles.primaryButton, sessionRating === 0 && styles.primaryButtonDisabled]}
                onPress={() => sessionRating > 0 && setStep(3)}
                activeOpacity={sessionRating > 0 ? 0.85 : 1}
              >
                <Text style={[styles.primaryButtonText, sessionRating === 0 && styles.primaryButtonTextDisabled]}>
                  Next →
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Toast visible={showToast} />
      </View>
    )
  }

  // Step 3 — board selection sheet
  if (step === 3) {
    return (
      <View style={styles.step2Outer}>
        <View style={styles.conditionsSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.headerBack} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color="#E8D5B8" />
            </TouchableOpacity>
            <ProgressDots step={step} isFirstVisit={isFirstVisit} />
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.step3Scroll}
            contentContainerStyle={styles.boardScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.step3Heading}>What board{'\n'}did you ride?</Text>

            {BOARD_OPTIONS.map(opt => {
              const isSelected = boardType === opt.value && boardType !== undefined
              return (
                <View key={opt.value ?? 'na'}>
                  <TouchableOpacity
                    style={[styles.boardCard, isSelected && styles.boardCardSelected]}
                    onPress={() => setBoardType(opt.value)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.boardCardLeft}>
                      <Text style={[styles.boardCardLabel, isSelected && styles.boardCardLabelSelected]}>
                        {opt.label}
                      </Text>
                    </View>
                    {opt.value !== null && (
                      <View style={styles.boardIconWrap}>
                        <BoardIcon value={opt.value} selected={isSelected} />
                      </View>
                    )}
                    <View style={[styles.boardRadio, isSelected && styles.boardRadioSelected]}>
                      {isSelected && <View style={styles.boardRadioDot} />}
                    </View>
                  </TouchableOpacity>
                  {isSelected && (
                    <TextInput
                      style={styles.boardNotesInput}
                      placeholder={getBoardNotesPlaceholder(opt.value)}
                      placeholderTextColor="#4A7A87"
                      value={boardNotes}
                      onChangeText={setBoardNotes}
                      autoCorrect={false}
                    />
                  )}
                </View>
              )
            })}

            <View style={styles.step3Buttons}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(4)} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Next →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setStep(4)} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
        <Toast visible={showToast} />
      </View>
    )
  }

  // Step 4 renders as a half-screen bottom sheet over the map
  if (step === 4) {
    return (
      <View style={styles.step2Outer}>
        <View style={styles.conditionsSheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.headerBack} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color="#E8D5B8" />
            </TouchableOpacity>
            <ProgressDots step={step} isFirstVisit={isFirstVisit} />
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.step3Scroll}
            contentContainerStyle={styles.step3ScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.step3Heading}>How were the conditions?</Text>

            <View style={styles.step3Section}>
              <SectionLabel color="#3CC4C4">SWELL SIZE</SectionLabel>
              <ChipRow
                options={SWELL_OPTIONS}
                selected={swellSize}
                onSelect={setSwellSize}
              />
            </View>

            <View style={styles.step3Section}>
              <SectionLabel color="#C5A882">WIND</SectionLabel>
              <ChipRow
                options={WIND_OPTIONS}
                selected={wind}
                onSelect={setWind}
                selectedBg="rgba(197,168,130,0.18)"
                selectedBorderColor="#C5A882"
                selectedTextColor="#C5A882"
                inactiveBorderColor="rgba(197,168,130,0.28)"
                inactiveTextColor="#7A5C42"
              />
            </View>

            <View style={styles.step3Section}>
              <SectionLabel color="#9B95E8">CROWD FACTOR</SectionLabel>
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
                        <Text style={[styles.chipText, isSelected && styles.crowdChipTextSelected]}>{label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </ScrollView>
            </View>

            <View style={styles.step3Buttons}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(5)} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Next →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setStep(5)} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        <Toast visible={showToast} />
      </View>
    )
  }

  // Steps 1, 5 — full screen layout
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#E8D5B8" />
        </TouchableOpacity>
        <ProgressDots step={step} isFirstVisit={isFirstVisit} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, step !== 5 && styles.scrollContentFull]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step 1: Rate the Break ─────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.step1Container}>
            <View style={styles.step1Top}>
              <Text style={styles.step1ContextLine}>{break_name}</Text>
              <Text style={styles.step1Heading}>How would you rate this break?</Text>
            </View>

            <View style={styles.step1Middle}>
              <BreakRatingDots value={breakRating} onChange={setBreakRating} />
              <Text style={styles.step1Descriptor}>
                {breakRating > 0 ? breakRatingLabel(breakRating) : ' '}
              </Text>
            </View>

            <View style={styles.step1Bottom}>
              <View style={styles.toggleCard}>
                <View style={styles.toggleCardLeft}>
                  <View style={styles.favoriteDot} />
                  <Text style={styles.toggleCardLabel}>Mark as a favorite</Text>
                </View>
                <Toggle value={isFavorite} onValueChange={setIsFavorite} onColor="#7F77DD" offColor="#1B3A45" />
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Next →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setBreakRating(0); setIsFavorite(false); setStep(2) }} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Step 5: Set the Scene ──────────────────────────────────────── */}
        {step === 5 && (
          <View style={styles.step4Container}>
            <Text style={styles.stepHeading}>Set the scene</Text>
            <Text style={styles.stepSubheading}>Who you surfed with, notes</Text>

            <View style={styles.fieldBlock}>
              <SectionLabel>SURFED WITH</SectionLabel>
              <TextInput style={styles.textInput} placeholder="Add people you surfed with" placeholderTextColor="#4A7A87" value={surfedWith} onChangeText={setSurfedWith} autoCorrect={false} />
            </View>

            <View style={styles.fieldBlock}>
              <SectionLabel>NOTES</SectionLabel>
              <TextInput style={styles.notesInput} placeholder="How was it..." placeholderTextColor="#4A7A87" value={notes} onChangeText={setNotes} multiline textAlignVertical="top" />
            </View>

            <View style={styles.fieldBlock}>
              <SectionLabel>PHOTOS</SectionLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photoRow}>
                  {photos.map((p, i) => (
                    <View key={i} style={styles.photoThumb}>
                      <Image source={{ uri: p.uri }} style={styles.photoImage} />
                      <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)} hitSlop={6}>
                        <Ionicons name="close-circle" size={18} color="#E8D5B8" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto} activeOpacity={0.7}>
                    <Ionicons name="add" size={28} color="#4A7A87" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>

            <View style={styles.toggleCardLarge}>
              <View style={styles.toggleCardLeft}>
                <View>
                  <Text style={styles.toggleCardLabel}>Public</Text>
                  <Text style={styles.toggleCardSub}>Shared to your feed</Text>
                </View>
              </View>
              <Toggle value={isPublic} onValueChange={setIsPublic} onColor="#1B7A87" offColor="#1B3A45" trackWidth={40} trackHeight={22} />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#E8D5B8" /> : <Text style={styles.saveButtonText}>Save session</Text>}
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
    backgroundColor: '#0B2230',
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B2230',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Step 2 half-screen bottom sheet ──────────────────────────────────────

  step2Outer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  step2Backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  step2Sheet: {
    height: SCREEN_HEIGHT * 0.52,
    backgroundColor: '#0F2838',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 0.5,
    borderTopColor: '#1B3A45',
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1B3A45',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  step2Content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  step2TextGroup: {
    alignItems: 'center',
  },
  step2ContextLine: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 21,
    color: '#3CC4C4',
    textAlign: 'center',
    marginBottom: 8,
  },
  step2Heading: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 34,
    lineHeight: 42,
    color: '#E8D5B8',
    textAlign: 'center',
  },
  step2SessionCount: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 14,
    color: '#3CC4C4',
    textAlign: 'center',
    marginTop: 4,
  },
  step2SliderGroup: {
    gap: 4,
  },
  step2Descriptor: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 21,
    color: '#3CC4C4',
    textAlign: 'center',
    minHeight: 28,
  },
  step2Buttons: {
    gap: 0,
  },

  // ── Standard header (steps 1, 3, 4) ─────────────────────────────────────

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B2230',
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
    backgroundColor: '#1B3A45',
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

  // Step 1 — break rating
  step1Container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  step1Top: { alignItems: 'center' },
  step1ContextLine: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#3CC4C4',
    textAlign: 'center',
    marginBottom: 12,
  },
  step1Heading: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 34,
    color: '#E8D5B8',
    textAlign: 'center',
  },
  step1Middle: { alignItems: 'center' },
  step1Descriptor: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#3CC4C4',
    textAlign: 'center',
    marginTop: 14,
    minHeight: 22,
  },
  step1Bottom: {},

  // Step 4 — set the scene
  step4Container: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },

  // Shared step text
  stepHeading: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 34,
    color: '#E8D5B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepSubheading: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  sessionCountLine: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 11,
    color: '#3CC4C4',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 4,
  },

  // Field block
  fieldBlock: { marginBottom: 20 },
  sectionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  // Break rating dots
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
  breakRatingDotFilled: { backgroundColor: '#3CC4C4' },
  breakRatingDotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#1B5A6A',
  },

  ratingDescriptor: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#3CC4C4',
    textAlign: 'center',
    marginTop: 8,
    minHeight: 22,
  },

  // Toggle cards
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
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
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
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
    color: '#E8D5B8',
  },
  toggleCardSub: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    marginTop: 2,
  },
  favoriteDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7F77DD',
  },

  // Chips
  chipScroll: { marginHorizontal: -24 },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingRight: 32,
  },
  chip: {
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
  },
  crowdChipSelected: {
    backgroundColor: 'rgba(83,74,183,0.2)',
    borderColor: '#534AB7',
    borderWidth: 0.5,
  },
  crowdChipTextSelected: { color: '#9B95E8' },

  // Text inputs
  textInput: {
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    height: 46,
    fontFamily: 'Georgia',
    fontSize: 13,
    color: '#E8D5B8',
  },
  notesInput: {
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 13,
    color: '#E8D5B8',
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Photos
  photoRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  photoThumb: { position: 'relative', width: 60, height: 60 },
  photoImage: { width: 60, height: 60, borderRadius: 9 },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#0B2230',
    borderRadius: 9,
  },
  photoAdd: {
    width: 60,
    height: 60,
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
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
  primaryButtonDisabled: {
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.2)',
  },
  primaryButtonText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 14,
    color: '#E8D5B8',
    letterSpacing: 0.3,
  },
  primaryButtonTextDisabled: { color: '#2A5A65' },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.25)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 2,
  },
  cancelButtonText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
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
    color: '#E05A4A',
    fontSize: 13,
    fontFamily: 'Helvetica Neue',
    textAlign: 'center',
    marginBottom: 10,
  },

  // Board step
  boardScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  boardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(42,26,8,0.35)',
    borderWidth: 0.5,
    borderColor: 'rgba(197,168,130,0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 7,
    minHeight: 56,
  },
  boardCardSelected: {
    backgroundColor: '#0F4E63',
    borderColor: '#3CC4C4',
  },
  boardCardLeft: {
    flex: 1,
  },
  boardCardLabel: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 17,
    color: '#C5A882',
  },
  boardCardLabelSelected: {
    color: '#3CC4C4',
  },
  boardIconWrap: {
    width: 28,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  boardRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(197,168,130,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardRadioSelected: {
    borderColor: '#3CC4C4',
  },
  boardRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3CC4C4',
  },
  boardNotesInput: {
    backgroundColor: '#0B2230',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.4)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 15,
    color: '#E8D5B8',
    marginTop: -2,
    marginBottom: 8,
  },

  // Step 3 conditions sheet — natural height, no fixed constraint
  conditionsSheet: {
    backgroundColor: '#0F2838',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 0.5,
    borderTopColor: '#1B3A45',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  step3Scroll: {
    flexShrink: 1,
  },
  step3ScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  step3Heading: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 34,
    color: '#E8D5B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  step3Section: {
    marginBottom: 18,
  },
  step3Buttons: {
    marginTop: 4,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F2838',
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
