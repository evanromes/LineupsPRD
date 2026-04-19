import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { router } from 'expo-router'

const { width: W, height: H } = Dimensions.get('window')

const CREAM_STARS: { x: number; y: number; r: number; op: number }[] = [
  { x: 0.07, y: 0.04, r: 1.2, op: 0.50 },
  { x: 0.24, y: 0.02, r: 1.0, op: 0.35 },
  { x: 0.43, y: 0.01, r: 1.5, op: 0.45 },
  { x: 0.82, y: 0.05, r: 1.1, op: 0.55 },
  { x: 0.92, y: 0.15, r: 1.3, op: 0.40 },
  { x: 0.16, y: 0.08, r: 1.0, op: 0.30 },
  { x: 0.34, y: 0.05, r: 1.4, op: 0.50 },
  { x: 0.53, y: 0.10, r: 1.2, op: 0.45 },
  { x: 0.95, y: 0.09, r: 1.0, op: 0.35 },
  { x: 0.06, y: 0.13, r: 1.5, op: 0.55 },
  { x: 0.26, y: 0.15, r: 1.1, op: 0.40 },
  { x: 0.47, y: 0.18, r: 1.3, op: 0.45 },
  { x: 0.78, y: 0.17, r: 1.0, op: 0.30 },
  { x: 0.55, y: 0.20, r: 1.4, op: 0.50 },
  { x: 0.70, y: 0.22, r: 1.2, op: 0.35 },
  { x: 0.13, y: 0.24, r: 1.5, op: 0.55 },
  { x: 0.88, y: 0.26, r: 1.0, op: 0.40 },
  { x: 0.58, y: 0.28, r: 1.3, op: 0.45 },
  { x: 0.20, y: 0.30, r: 1.1, op: 0.35 },
  { x: 0.90, y: 0.32, r: 1.4, op: 0.50 },
]

const TEAL_STARS: { x: number; y: number; r: number; op: number }[] = [
  { x: 0.63, y: 0.04, r: 3.5, op: 0.65 },
  { x: 0.75, y: 0.07, r: 4.0, op: 0.55 },
  { x: 0.38, y: 0.16, r: 3.0, op: 0.75 },
  { x: 0.34, y: 0.06, r: 3.5, op: 0.60 },
  { x: 0.88, y: 0.14, r: 3.0, op: 0.65 },
]

const PURPLE_STARS: { x: number; y: number; r: number; op: number }[] = [
  { x: 0.21, y: 0.03, r: 3.0, op: 0.55 },
  { x: 0.82, y: 0.11, r: 3.5, op: 0.75 },
  { x: 0.51, y: 0.06, r: 2.5, op: 0.45 },
  { x: 0.06, y: 0.19, r: 3.2, op: 0.65 },
]

const wave1 = `M 0,${H * 0.78} Q ${W * 0.18},${H * 0.776} ${W * 0.38},${H * 0.782} Q ${W * 0.6},${H * 0.787} ${W * 0.78},${H * 0.778} Q ${W * 0.9},${H * 0.774} ${W},${H * 0.78}`
const wave2 = `M 0,${H * 0.82} Q ${W * 0.22},${H * 0.817} ${W * 0.45},${H * 0.824} Q ${W * 0.65},${H * 0.829} ${W * 0.82},${H * 0.818} Q ${W * 0.92},${H * 0.813} ${W},${H * 0.82}`

export default function Splash() {
  return (
    <View style={styles.root}>
      {/* Ocean band */}
      <View style={styles.oceanBand} />

      {/* Star field + wave lines */}
      <Svg style={StyleSheet.absoluteFill} width={W} height={H} pointerEvents="none">
        {CREAM_STARS.map((s, i) => (
          <Circle
            key={`c${i}`}
            cx={W * s.x}
            cy={H * s.y}
            r={s.r}
            fill="#E8D5B8"
            opacity={s.op}
          />
        ))}
        {TEAL_STARS.map((s, i) => (
          <Circle
            key={`t${i}`}
            cx={W * s.x}
            cy={H * s.y}
            r={s.r}
            fill="#3CC4C4"
            opacity={s.op}
          />
        ))}
        {PURPLE_STARS.map((s, i) => (
          <Circle
            key={`p${i}`}
            cx={W * s.x}
            cy={H * s.y}
            r={s.r}
            fill="#7F77DD"
            opacity={s.op}
          />
        ))}
        <Path d={wave1} stroke="#1B5A6A" strokeWidth={1} fill="none" opacity={0.4} />
        <Path d={wave2} stroke="#1B5A6A" strokeWidth={0.7} fill="none" opacity={0.25} />
      </Svg>

      {/* Centered content */}
      <View style={styles.content}>
        {/* Logo tile */}
        <View style={styles.outerTile}>
          <View style={styles.innerBlock}>
            <View style={styles.waveLine1} />
            <View style={styles.waveLine2} />
            <View style={styles.waveLine3} />
          </View>
        </View>

        {/* Wordmark */}
        <Text style={styles.wordmark}>Lineups</Text>
        <Text style={styles.submark}>SURF JOURNAL</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>every break, remembered</Text>
      </View>

      {/* Buttons pinned to bottom */}
      <View style={styles.buttonArea}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/signup')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Get started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Log in</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060F14',
  },
  oceanBand: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: H * 0.20,
    backgroundColor: '#0B2230',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: H * 0.20,
  },
  outerTile: {
    width: 110,
    height: 110,
    borderRadius: 26,
    backgroundColor: '#1B7A87',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerBlock: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: '#0F5A65',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  waveLine1: {
    width: 46,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#E8D5B8',
    opacity: 1.0,
  },
  waveLine2: {
    width: 46,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E8D5B8',
    opacity: 0.6,
  },
  waveLine3: {
    width: 46,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#E8D5B8',
    opacity: 0.3,
  },
  wordmark: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 52,
    color: '#E8D5B8',
    letterSpacing: 4,
    marginTop: 28,
  },
  submark: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 14,
    color: '#4A7A87',
    letterSpacing: 6,
    marginTop: 4,
  },
  tagline: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 18,
    color: '#3A5A65',
    marginTop: 64,
  },
  buttonArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: 52,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 14,
    color: '#E8D5B8',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#1B5A6A',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#3CC4C4',
  },
})
