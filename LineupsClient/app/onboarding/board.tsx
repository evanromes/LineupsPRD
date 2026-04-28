import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Ellipse, Line, Path } from 'react-native-svg'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

type BoardValue = 'shortboard' | 'longboard' | 'mid-length' | 'gun' | 'sup' | 'foil' | null

const OPTIONS: { value: BoardValue; label: string; description?: string }[] = [
  { value: 'shortboard', label: 'Shortboard' },
  { value: 'mid-length', label: 'Mid-Length' },
  { value: 'longboard',  label: 'Longboard'  },
  {
    value: 'gun',
    label: 'Gun',
    description: "For big-wave days — paddles fast and holds in steep, powerful surf",
  },
  { value: 'sup',  label: 'SUP'  },
  { value: 'foil', label: 'Foil' },
  {
    value: null,
    label: 'N/A',
    description: "You ride multiple boards or have no preference — this won't show on your profile",
  },
]

function BoardIcon({ value, selected }: { value: BoardValue; selected: boolean }) {
  if (value === 'shortboard') {
    return (
      <Svg width={32} height={60} viewBox="0 0 64 104">
        <Ellipse
          cx={32} cy={54} rx={6.5} ry={26}
          fill={selected ? '#0F4E63' : 'rgba(197,168,130,0.25)'}
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.5 : 1}
        />
        {selected && (
          <Ellipse
            cx={32} cy={54} rx={3} ry={18}
            fill="none" stroke="#3CC4C4"
            strokeWidth={0.75} opacity={0.4}
          />
        )}
      </Svg>
    )
  }
  if (value === 'mid-length') {
    return (
      <Svg width={32} height={60} viewBox="0 0 64 104">
        <Ellipse
          cx={32} cy={52} rx={8} ry={33}
          fill={selected ? '#0F4E63' : 'rgba(197,168,130,0.25)'}
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.5 : 1}
        />
        <Ellipse
          cx={32} cy={52} rx={2.5} ry={24}
          fill="none"
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.4)'}
          strokeWidth={0.75}
          opacity={selected ? 0.4 : 1}
        />
      </Svg>
    )
  }
  if (value === 'longboard') {
    return (
      <Svg width={32} height={60} viewBox="0 0 64 104">
        <Ellipse
          cx={32} cy={51} rx={9.5} ry={51}
          fill={selected ? '#0F4E63' : 'rgba(197,168,130,0.25)'}
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.5 : 1}
        />
        <Ellipse
          cx={32} cy={52} rx={2} ry={37}
          fill="none"
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.4)'}
          strokeWidth={0.75}
          opacity={selected ? 0.4 : 1}
        />
      </Svg>
    )
  }
  if (value === 'gun') {
    return (
      <Svg width={32} height={60} viewBox="0 0 64 104">
        <Path
          d="M 32 8 Q 26 25 25 50 Q 25 75 30 90 Q 32 92 34 90 Q 39 75 39 50 Q 38 25 32 8 Z"
          fill={selected ? '#0F4E63' : 'rgba(197,168,130,0.25)'}
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.5 : 1}
        />
        {selected && (
          <Path
            d="M 32 22 Q 31 40 31 51 Q 31 65 32 78"
            stroke="#3CC4C4"
            strokeWidth={0.75}
            opacity={0.4}
            fill="none"
          />
        )}
      </Svg>
    )
  }
  if (value === 'sup') {
    return (
      <Svg width={32} height={60} viewBox="0 0 64 104">
        <Ellipse
          cx={26} cy={51} rx={10.5} ry={51}
          fill={selected ? '#0F4E63' : 'rgba(197,168,130,0.25)'}
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.5 : 1}
        />
        {selected && (
          <Ellipse
            cx={26} cy={51} rx={4} ry={37}
            fill="none" stroke="#3CC4C4"
            strokeWidth={0.75} opacity={0.4}
          />
        )}
        <Line
          x1={46} y1={8} x2={46} y2={selected ? 84 : 86}
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.5 : 1}
          strokeLinecap="round"
        />
        <Ellipse
          cx={46} cy={selected ? 90 : 92} rx={5} ry={7}
          fill="none"
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.5 : 1}
        />
      </Svg>
    )
  }
  if (value === 'foil') {
    return (
      <Svg width={32} height={60} viewBox="0 0 64 104">
        <Ellipse
          cx={32} cy={38} rx={6.5} ry={24}
          fill={selected ? '#0F4E63' : 'rgba(197,168,130,0.25)'}
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.5 : 1}
        />
        {selected && (
          <Ellipse
            cx={32} cy={38} rx={3} ry={17}
            fill="none" stroke="#3CC4C4"
            strokeWidth={0.75} opacity={0.4}
          />
        )}
        <Line
          x1={32} y1={62} x2={32} y2={81}
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.5 : 1.2}
          strokeLinecap="round"
        />
        <Path
          d="M 18 81 Q 32 79 46 81"
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.8 : 1.2}
          strokeLinecap="round"
          fill="none"
        />
        <Line
          x1={32} y1={81} x2={32} y2={92}
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.5 : 1.2}
          strokeLinecap="round"
        />
        <Path
          d="M 22 92 Q 32 90.5 42 92"
          stroke={selected ? '#3CC4C4' : 'rgba(197,168,130,0.5)'}
          strokeWidth={selected ? 1.2 : 1}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    )
  }
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

export default function OnboardingBoard() {
  const [selected, setSelected] = useState<BoardValue | undefined>(undefined)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  async function handleNext() {
    if (selected === undefined || !userId) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ preferred_board: selected })
      .eq('id', userId)
    setSaving(false)
    router.push('/onboarding/homebreak')
  }

  const isReady = selected !== undefined

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.screen}>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          <ProgressDots total={5} current={4} />
        </View>

        {/* Back chevron */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.center}>
          <Text style={styles.heading}>What's your board of choice?</Text>
          <Text style={styles.subtext}>This will show on your profile to other surfers</Text>

          <View style={styles.cardList}>
            {OPTIONS.map((opt, i) => {
              const isSelected = selected === opt.value && selected !== undefined
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  onPress={() => setSelected(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardLeft}>
                    <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                      {opt.label}
                    </Text>
                    {opt.description && (
                      <Text style={[styles.cardDesc, isSelected && styles.cardDescSelected]}>
                        {opt.description}
                      </Text>
                    )}
                  </View>
                  {opt.value !== null && (
                    <View style={styles.iconWrap}>
                      <BoardIcon value={opt.value} selected={isSelected} />
                    </View>
                  )}
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            style={[styles.nextButton, (!isReady || saving) && styles.disabled]}
            onPress={handleNext}
            disabled={!isReady || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#E8D5B8" />
            ) : (
              <Text style={styles.nextButtonText}>Next →</Text>
            )}
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
    paddingBottom: 16,
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
    marginBottom: 12,
  },

  cardList: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(42, 26, 8, 0.35)',
    borderWidth: 0.5,
    borderColor: 'rgba(197, 168, 130, 0.4)',
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
    minHeight: 68,
  },
  cardSelected: {
    backgroundColor: '#0F4E63',
    borderColor: '#3CC4C4',
  },
  cardLeft: {
    flex: 1,
  },
  cardLabel: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 19,
    color: '#C5A882',
    marginBottom: 3,
  },
  cardLabelSelected: {
    color: '#3CC4C4',
  },
  cardDesc: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 12,
    color: '#4A7A87',
    lineHeight: 16,
  },
  cardDescSelected: {
    color: '#7AABB8',
  },

  iconWrap: {
    width: 32,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    borderWidth: 1.5,
    borderColor: 'rgba(197, 168, 130, 0.4)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#3CC4C4',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3CC4C4',
  },

  nextButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#1B7A87',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 8,
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
})
