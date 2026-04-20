import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

type StanceValue = 'regular' | 'goofy' | null

const OPTIONS: { value: StanceValue; label: string; description: string }[] = [
  {
    value: 'regular',
    label: 'Regular',
    description: 'You surf with your right foot back',
  },
  {
    value: 'goofy',
    label: 'Goofy',
    description: 'You surf with your left foot back',
  },
  {
    value: null,
    label: 'N/A',
    description: "You have no preference or don't know — this won't show on your profile",
  },
]

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
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1B5A6A',
  },
  dotActive: {
    width: 23,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8D5B8',
  },
  dotDone: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3CC4C4',
  },
})

export default function OnboardingStanceScreen() {
  const [selected, setSelected] = useState<StanceValue | undefined>(undefined)
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
      .update({ stance: selected })
      .eq('id', userId)
    setSaving(false)
    router.push('/onboarding/board')
  }

  const isReady = selected !== undefined

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.screen}>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          <ProgressDots total={5} current={3} />
        </View>

        {/* Back chevron */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>

        {/* Vertically centered content */}
        <View style={styles.center}>
          <Text style={styles.heading}>What's your stance?</Text>
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
                    <Text style={[styles.cardDesc, isSelected && styles.cardDescSelected]}>
                      {opt.description}
                    </Text>
                  </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 96,
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
    marginBottom: 20,
  },

  cardList: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    backgroundColor: 'rgba(42, 26, 8, 0.35)',
    borderWidth: 0.5,
    borderColor: 'rgba(197, 168, 130, 0.4)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 10,
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
    fontSize: 18,
    color: '#C5A882',
    marginBottom: 3,
  },
  cardLabelSelected: {
    color: '#3CC4C4',
  },
  cardDesc: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 13,
    color: '#4A7A87',
    lineHeight: 18,
  },
  cardDescSelected: {
    color: '#7AABB8',
  },

  radio: {
    width: 23,
    height: 23,
    borderRadius: 11.5,
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
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#3CC4C4',
  },

  nextButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#1B7A87',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
