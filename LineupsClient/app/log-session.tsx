// -- Migration required in Supabase before crowd_factor will save:
// -- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
// -- crowd_factor text CHECK (crowd_factor IN ('empty','moderate','crowded','zoo'));
//
// -- Migration required in Supabase before tagged users will save:
// -- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tagged_user_ids uuid[];

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
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path } from 'react-native-svg'
import { supabase } from '../lib/supabase'

const SCREEN_HEIGHT = Dimensions.get('window').height

// ─── Types ────────────────────────────────────────────────────────────────────

interface PickedPhoto {
  uri: string
  fileName: string
  mimeType: string
}

interface TaggedProfile {
  id: string
  username: string | null
  display_name: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SWELL_OPTIONS = [
  '0–1ft', '1–3ft', '3–5ft', '5–8ft', '8–12ft', '12–15ft', '15–20ft', '20ft+',
]
// Visual wave heights (in viewBox px) per swell index — sized so the surfer
// looks dwarfed at 20ft and toy-sized waves at 0–1ft.
const SWELL_WAVE_HEIGHTS = [14, 30, 46, 64, 84, 104, 122, 138]
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

// ─── Swell Size Slider (visual wave + draggable surfer) ──────────────────────

const STAGE_WIDTH       = 320
const STAGE_HEIGHT      = 158
const BASELINE          = 146
const SURFER_THUMB_SIZE = 42
const WAVE_WIDTH        = 152
const WAVE_OFFSET_X     = (STAGE_WIDTH - WAVE_WIDTH) / 2

function WaveAndSurfer({ height }: { height: number }) {
  // Continuous flow phase — streaks lift up the wave on their own.
  // Cycle ~3.63s (15% faster than the prior 4.17s); ~30 ticks/sec stays smooth.
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const dt  = (now - last) / 1000
      last = now
      setPhase(p => (p + dt / 3.63) % 1)
    }, 1000 / 30)
    return () => clearInterval(id)
  }, [])

  if (height <= 4) {
    // Flat-water look for tiny swell — just a hint of ripple
    return (
      <Path
        d={`M 20 ${BASELINE - 2} Q 60 ${BASELINE - 4} 110 ${BASELINE - 2} Q 150 ${BASELINE} 200 ${BASELINE - 2}`}
        fill="none" stroke="#3CC4C4" strokeWidth={1} opacity={0.5}
      />
    )
  }

  const peakY = BASELINE - height
  // Asymmetric breaking-wave shape: longer back, steeper face
  const wavePath = `
    M 0 ${BASELINE}
    L 0 ${BASELINE - height * 0.35}
    Q 22 ${peakY - 4} 58 ${peakY}
    L 78 ${peakY + height * 0.05}
    Q 94 ${peakY + height * 0.28} 108 ${peakY + height * 0.5}
    Q 128 ${peakY + height * 0.78} 152 ${BASELINE}
    Z
  `

  // Surfer rides the face, just right of the lip — fixed size regardless of wave height
  const sx    = 110
  const sFeet = BASELINE - height * 0.48

  // Board tilts to match the wave face slope at the surfer's position.
  // Slope ≈ atan2(dy, dx) on the face curve from x=108 to x=128.
  const slopeDeg   = (Math.atan2(height * 0.28, 20) * 180) / Math.PI
  const boardAngle = Math.min(38, slopeDeg * 0.75)

  const skin  = '#E8D5B8'
  const board = '#0F2838'

  return (
    <G transform={`translate(${WAVE_OFFSET_X} 0)`}>
      <Defs>
        <ClipPath id="waveClip">
          <Path d={wavePath} />
        </ClipPath>
      </Defs>

      {/* Wave fill */}
      <Path d={wavePath} fill="#1B7A87" opacity={0.55} />

      {/* Rising streaks — water lifts up the wave and drifts toward the back.
         Each lane has a fixed base x; its streak rises from the baseline to
         the wave crest, drifting slightly left as it climbs (matches face
         slope direction). Lanes are phase-staggered so the face shimmers.
         Clipped to the wave silhouette so streaks never spill onto the canvas. */}
      <G clipPath="url(#waveClip)">
      {(() => {
        // Lane base x-positions — face → back. Adds another set on top of the
        // doubled density: 6 / 9 / 12 lanes for small / medium / big swells.
        const lanes: number[] =
          height < 28  ? [124, 108, 92, 78, 64, 50] :
          height < 70  ? [138, 124, 110, 96, 82, 68, 54, 40, 26] :
                         [143, 132, 120, 108, 96, 84, 72, 60, 48, 36, 24, 12]
        const laneOffsets = [
          0.0, 0.42, 0.74, 0.21, 0.58, 0.13,
          0.85, 0.36, 0.65, 0.04, 0.49, 0.92,
        ]

        // Local wave height at a given x (mirrors the wave silhouette)
        const localH = (x: number) => {
          if (x <= 0 || x >= 152) return 0
          if (x < 58)  return height * (0.35 + (x / 58) * 0.65)
          if (x <= 78) return height
          return height * Math.max(0, 1 - (x - 78) / 74)
        }

        // Streak tilt parallels the wave face slope
        const tiltRad = Math.atan2(height, 74)
        const len     = Math.max(7, Math.min(16, height * 0.28))
        const dx      = (len / 2) * Math.cos(tiltRad)
        const dy      = (len / 2) * Math.sin(tiltRad)

        // Smaller waves peel mostly horizontally — leftward drift dominates;
        // bigger waves throw water more vertically up the face.
        const driftFactor =
          height < 50 ? 1.5 :   // 0–1ft, 1–3ft, 3–5ft — strong leftward flow
          height < 70 ? 0.6 :   // 5–8ft — diagonal
                        0.22    // 8ft+ — mostly vertical lift

        return lanes.map((laneX, i) => {
          const h = localH(laneX)
          if (h < 10) return null

          const vp = (phase + laneOffsets[i]) % 1
          // Rise (vp 0→1) and drift left; small waves peel near-horizontal,
          // big waves climb near-vertical.
          const cx = laneX - vp * h * driftFactor
          const cy = BASELINE - vp * h

          // Fade in low, dissolve near the top — born-and-die feel
          let opacity = 0.6
          if (vp < 0.15)      opacity *= vp / 0.15
          else if (vp > 0.82) opacity *= Math.max(0, (1 - vp) / 0.18)

          return (
            <Path
              key={i}
              d={`M ${cx - dx} ${cy - dy} L ${cx + dx} ${cy + dy}`}
              fill="none" stroke="#7AABB8" strokeWidth={1.1} opacity={opacity}
              strokeLinecap="round"
            />
          )
        })
      })()}
      </G>

      {/* Wave outline */}
      <Path d={wavePath} fill="none" stroke="#3CC4C4" strokeWidth={1.2} opacity={0.9} />
      {/* Subtle highlight on the face */}
      <Path
        d={`M 78 ${peakY + height * 0.05} Q 94 ${peakY + height * 0.28} 108 ${peakY + height * 0.5}`}
        fill="none" stroke="#7AABB8" strokeWidth={0.7} opacity={0.6}
      />

      {/* Surfer — local frame: feet at y=0, forward direction = +x.
         Whole figure rotates with the board so it points down the wave. */}
      <G transform={`translate(${sx} ${sFeet}) rotate(${boardAngle}) scale(1.15)`}>
        {/* Board with rounded tail (left) and pointed nose (right) */}
        <Path
          d="M -12 0 Q -13 -2 -9 -1.8 L 9 -1.4 Q 14 -0.2 14 0 Q 14 0.2 9 1.4 L -9 1.8 Q -13 2 -12 0 Z"
          fill={board} stroke={skin} strokeWidth={0.9}
        />

        {/* Back leg — slight knee bend, knee tracks forward */}
        <Path
          d="M -7 0 Q -1 -2 -2.5 -5 Q -2 -6 -1 -7"
          stroke={skin} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
        {/* Front leg — pulled back to ~60% along the nose, deeper crouch */}
        <Path
          d="M 5 0 Q 3 -4 1 -7"
          stroke={skin} strokeWidth={3} strokeLinecap="round" fill="none"
        />

        {/* Torso silhouette — hips low and back, shoulder forward */}
        <Path
          d="M -2 -7 Q -1 -10 2 -13 Q 5 -14.5 7 -14 Q 7 -12 5 -10 Q 3 -8 1 -7 Z"
          fill={skin}
        />

        {/* Back arm — pulled back for balance */}
        <Path
          d="M 2 -13 Q -1 -12 -4 -10"
          stroke={skin} strokeWidth={2.2} strokeLinecap="round" fill="none"
        />
        {/* Front arm — extended forward, leading the line */}
        <Path
          d="M 6 -13 Q 9 -12 12 -10"
          stroke={skin} strokeWidth={2.2} strokeLinecap="round" fill="none"
        />

        {/* Head */}
        <Circle cx={6} cy={-16.5} r={2.7} fill={skin} />
      </G>
    </G>
  )
}

function MiniSurfer({ active, height }: { active: boolean; height: number }) {
  const skin  = active ? '#E8D5B8' : '#4A7A87'
  const board = active ? '#3CC4C4' : '#1B3A45'
  // Match the wave surfer's board angle — same formula as WaveAndSurfer
  const slopeDeg   = (Math.atan2(height * 0.28, 20) * 180) / Math.PI
  const boardAngle = Math.min(38, slopeDeg * 0.75)
  return (
    <Svg width={SURFER_THUMB_SIZE} height={SURFER_THUMB_SIZE} viewBox="0 0 42 42">
      <Circle cx={21} cy={21} r={19} fill="#0F2838" stroke={active ? '#3CC4C4' : '#1B3A45'} strokeWidth={1.5} />
      {/* Mini surfer — same stance as the rider on the wave (board tilted,
         filled torso, bent back leg, lead arm forward). Local origin = feet.
         Board tilt tracks the wave selection so the thumb leans with size. */}
      <G transform={`translate(18 30) rotate(${boardAngle})`}>
        {/* Board (rounded tail left, pointed nose right) */}
        <Path
          d="M -12 0 Q -13 -2 -9 -1.8 L 9 -1.4 Q 14 -0.2 14 0 Q 14 0.2 9 1.4 L -9 1.8 Q -13 2 -12 0 Z"
          fill={board} stroke={skin} strokeWidth={0.6}
        />
        {/* Back leg with knee bend */}
        <Path
          d="M -7 0 Q -1 -2 -2.5 -5 Q -2 -6 -1 -7"
          stroke={skin} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
        {/* Front leg pulled back */}
        <Path
          d="M 5 0 Q 3 -4 1 -7"
          stroke={skin} strokeWidth={2.2} strokeLinecap="round" fill="none"
        />
        {/* Torso silhouette */}
        <Path
          d="M -2 -7 Q -1 -10 2 -13 Q 5 -14.5 7 -14 Q 7 -12 5 -10 Q 3 -8 1 -7 Z"
          fill={skin}
        />
        {/* Back arm */}
        <Path
          d="M 2 -13 Q -1 -12 -4 -10"
          stroke={skin} strokeWidth={1.6} strokeLinecap="round" fill="none"
        />
        {/* Front arm */}
        <Path
          d="M 6 -13 Q 9 -12 12 -10"
          stroke={skin} strokeWidth={1.6} strokeLinecap="round" fill="none"
        />
        {/* Head */}
        <Circle cx={6} cy={-16.5} r={2.4} fill={skin} />
      </G>
    </Svg>
  )
}

function SwellSizeSlider({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string) => void
}) {
  const findIdx = (v: string | null) => (v ? SWELL_OPTIONS.indexOf(v) : -1)
  const [index, setIndex] = useState(findIdx(value))
  const [trackWidth, setTrackWidth] = useState(0)
  const trackWidthRef = useRef(0)
  const trackPageXRef = useRef(0)
  const trackViewRef  = useRef<View>(null)
  const onChangeRef   = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const i = findIdx(value)
    if (i !== index) setIndex(i)
  }, [value])

  const lastIdx = SWELL_OPTIONS.length - 1

  function posToIndex(x: number): number {
    const w = trackWidthRef.current - SURFER_THUMB_SIZE
    if (w <= 0) return 0
    const ratio = Math.max(0, Math.min(1, (x - SURFER_THUMB_SIZE / 2) / w))
    // Left edge → smallest swell (index 0); right edge → biggest
    return Math.round(ratio * lastIdx)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const relX = e.nativeEvent.pageX - trackPageXRef.current
        const i = posToIndex(relX)
        setIndex(i)
        onChangeRef.current(SWELL_OPTIONS[i])
      },
      onPanResponderMove: (e) => {
        const relX = e.nativeEvent.pageX - trackPageXRef.current
        const i = posToIndex(relX)
        setIndex(i)
        onChangeRef.current(SWELL_OPTIONS[i])
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

  const isUnset     = index < 0
  const displayIdx  = isUnset ? 2 : index
  const waveHeight  = SWELL_WAVE_HEIGHTS[displayIdx]
  const usableWidth = Math.max(0, trackWidth - SURFER_THUMB_SIZE)
  const thumbLeft   = (displayIdx / lastIdx) * usableWidth

  return (
    <View>
      <View style={swellStyles.headerRow}>
        <Text style={swellStyles.sectionLabel}>SWELL SIZE</Text>
        <Text style={[swellStyles.currentValue, isUnset && swellStyles.currentValueUnset]}>
          {isUnset ? 'drag to size' : SWELL_OPTIONS[index]}
        </Text>
      </View>

      {/* Wave visual */}
      <View style={[swellStyles.stage, isUnset && swellStyles.stageUnset]}>
        <Svg
          width="100%"
          height={STAGE_HEIGHT}
          viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
          preserveAspectRatio="xMidYMax meet"
        >
          <Line x1={0} y1={BASELINE} x2={STAGE_WIDTH} y2={BASELINE} stroke="#1B3A45" strokeWidth={0.8} />
          <WaveAndSurfer height={waveHeight} />
        </Svg>
      </View>

      {/* Slider track */}
      <View
        ref={trackViewRef}
        style={swellStyles.sliderTrack}
        onLayout={onTrackLayout}
        {...panResponder.panHandlers}
      >
        <View style={swellStyles.sliderLine} />
        <View style={[swellStyles.surferThumb, { left: thumbLeft }]} pointerEvents="none">
          <MiniSurfer active={!isUnset} height={waveHeight} />
        </View>
      </View>

      <View style={swellStyles.rangeLabels}>
        <Text style={swellStyles.rangeLabel}>0–1ft</Text>
        <Text style={[swellStyles.rangeLabelHint]}>← drag to size your swell →</Text>
        <Text style={swellStyles.rangeLabel}>20ft+</Text>
      </View>
    </View>
  )
}

const swellStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#3CC4C4',
    letterSpacing: 1.5,
  },
  currentValue: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontStyle: 'italic',
    fontSize: 18,
    color: '#3CC4C4',
  },
  currentValueUnset: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontStyle: 'italic',
    fontSize: 12,
    color: '#4A7A87',
    letterSpacing: 0.4,
  },
  stage: {
    width: '100%',
    height: STAGE_HEIGHT,
    marginBottom: 4,
  },
  stageUnset: {
    opacity: 0.45,
  },
  sliderTrack: {
    height: SURFER_THUMB_SIZE + 4,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderLine: {
    position: 'absolute',
    left: SURFER_THUMB_SIZE / 2,
    right: SURFER_THUMB_SIZE / 2,
    height: 3,
    backgroundColor: '#1B3A45',
    borderRadius: 2,
  },
  surferThumb: {
    position: 'absolute',
    width: SURFER_THUMB_SIZE,
    height: SURFER_THUMB_SIZE,
  },
  rangeLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  rangeLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 10,
    color: '#4A7A87',
    letterSpacing: 0.5,
  },
  rangeLabelHint: {
    fontFamily: 'Helvetica Neue',
    fontStyle: 'italic',
    fontSize: 10,
    color: '#2A5A65',
    letterSpacing: 0.3,
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
  const [taggedUsers,  setTaggedUsers]  = useState<TaggedProfile[]>([])
  const [tagQuery,     setTagQuery]     = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<TaggedProfile[]>([])
  const [tagSearching, setTagSearching] = useState(false)
  const tagSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  // ─── Tag search ────────────────────────────────────────────────────────────

  useEffect(() => {
    const q = tagQuery.trim()
    if (tagSearchTimer.current) clearTimeout(tagSearchTimer.current)
    if (q.length === 0) {
      setTagSuggestions([])
      setTagSearching(false)
      return
    }
    setTagSearching(true)
    tagSearchTimer.current = setTimeout(async () => {
      const term = `%${q}%`
      let query = supabase
        .from('profiles')
        .select('id, username, display_name')
        .or(`username.ilike.${term},display_name.ilike.${term}`)
        .limit(8)
      if (userId) query = query.neq('id', userId)
      const { data } = await query
      const taggedIds = new Set(taggedUsers.map(u => u.id))
      setTagSuggestions((data ?? []).filter(p => !taggedIds.has(p.id)))
      setTagSearching(false)
    }, 300)
    return () => {
      if (tagSearchTimer.current) clearTimeout(tagSearchTimer.current)
    }
  }, [tagQuery, userId, taggedUsers])

  function addTag(p: TaggedProfile) {
    setTaggedUsers(prev => prev.some(u => u.id === p.id) ? prev : [...prev, p])
    setTagQuery('')
    setTagSuggestions([])
  }

  function removeTag(id: string) {
    setTaggedUsers(prev => prev.filter(u => u.id !== id))
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
          tagged_user_ids: taggedUsers.length > 0 ? taggedUsers.map(u => u.id) : null,
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
              <SwellSizeSlider value={swellSize} onChange={setSwellSize} />
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

  // Step 5 — set the scene sheet
  if (step === 5) {
    return (
      <KeyboardAvoidingView
        style={styles.step2Outer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.stepHeading}>Set the scene</Text>
            <Text style={styles.stepSubheading}>Who you surfed with, notes</Text>

            <View style={styles.fieldBlock}>
              <SectionLabel>SURFED WITH</SectionLabel>
              {taggedUsers.length > 0 && (
                <View style={styles.tagChipRow}>
                  {taggedUsers.map(u => (
                    <View key={u.id} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>
                        {u.display_name || u.username || 'Surfer'}
                      </Text>
                      <TouchableOpacity onPress={() => removeTag(u.id)} hitSlop={8} style={styles.tagChipRemove}>
                        <Ionicons name="close" size={12} color="#E8D5B8" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TextInput
                style={styles.textInput}
                placeholder="Search by name or username"
                placeholderTextColor="#4A7A87"
                value={tagQuery}
                onChangeText={setTagQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {tagQuery.trim().length > 0 && (
                <View style={styles.tagSuggestList}>
                  {tagSearching && tagSuggestions.length === 0 && (
                    <Text style={styles.tagSuggestEmpty}>Searching…</Text>
                  )}
                  {!tagSearching && tagSuggestions.length === 0 && (
                    <Text style={styles.tagSuggestEmpty}>No matches</Text>
                  )}
                  {tagSuggestions.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.tagSuggestRow}
                      onPress={() => addTag(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.tagSuggestName}>
                        {p.display_name || p.username || 'Surfer'}
                      </Text>
                      {p.username && p.display_name && (
                        <Text style={styles.tagSuggestHandle}>@{p.username}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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
          </ScrollView>
        </View>

        <Toast visible={showToast} />
      </KeyboardAvoidingView>
    )
  }

  // Step 1 — full screen layout
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

  // Tag chips + autocomplete
  tagChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60,196,196,0.18)',
    borderWidth: 0.5,
    borderColor: '#3CC4C4',
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
    gap: 6,
  },
  tagChipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#E8D5B8',
  },
  tagChipRemove: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(11,34,48,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagSuggestList: {
    marginTop: 6,
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tagSuggestRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74,122,135,0.18)',
  },
  tagSuggestName: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#E8D5B8',
  },
  tagSuggestHandle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 11,
    color: '#4A7A87',
    marginTop: 2,
  },
  tagSuggestEmpty: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
    paddingHorizontal: 14,
    paddingVertical: 10,
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
