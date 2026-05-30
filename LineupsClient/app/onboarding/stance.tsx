// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ONBOARDING PATTERN — one question per screen
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Every remaining screen must follow this spec exactly:
//
// SCREENS IN ORDER:
//   app/onboarding/stance.tsx          ← THIS FILE (experience level)
//   app/onboarding/stance-screen.tsx   → "Regular or Goofy?"
//   app/onboarding/board.tsx           → "What's your preferred board?"
//   app/onboarding/homebreak.tsx       → "What's your home break?"
//   app/onboarding/history.tsx         → "Add breaks you've already surfed"
//   app/onboarding/friends.tsx         → "Find your crew"
//   app/onboarding/done.tsx            → "You're in the lineup"
//
// RULES:
//  1. ONE question or task per screen — never more
//  2. All content vertically centered — keyboard never displaces the question
//  3. Back chevron top-left on every screen (except done.tsx)
//  4. Section label: Helvetica Neue 9px #4A7A87 letterSpacing 2px ALL CAPS above every heading
//  5. Subtext answers WHAT we collect AND WHY — always both
//  6. Progress dots always visible at top of screen
//  7. Heading: Georgia bold 20px #E8D5B8
//  8. Subtext: Helvetica Neue 300 11px #4A7A87
//  9. Primary button: full width, #1B7A87, height 48px, radius 12px, disabled until valid selection
// 10. Ghost/skip button: transparent bg, 0.5px rgba(197,168,130,0.4) border, radius 10px,
//     full width, Helvetica Neue 13px #C5A882
// 11. Option cards: unselected rgba(42,26,8,0.35) / selected #0F4E63 with radio dot
// 12. Save each answer to Supabase immediately on Next tap before navigating
// 13. Background #0B2230 for all dark onboarding screens

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

type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert'

const OPTIONS: { value: ExperienceLevel; label: string; description: string }[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'Still finding your feet — working on pop-ups and whitewater',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable on green waves, starting to work the face',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Surfing overhead+ with confidence, charging bigger days',
  },
  {
    value: 'expert',
    label: 'Expert',
    description: 'High-performance surfing, comfortable in serious conditions',
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

export default function OnboardingExperience() {
  const [selected, setSelected] = useState<ExperienceLevel | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  async function handleNext() {
    if (!selected || !userId) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ experience_level: selected })
      .eq('id', userId)
    if (error) console.error('[onboarding/stance] failed to save experience_level:', error)
    setSaving(false)
    router.push('/onboarding/stance-screen')
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.screen}>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          <ProgressDots total={5} current={2} />
        </View>

        {/* Back chevron */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>

        {/* Vertically centered content */}
        <View style={styles.center}>
          <Text style={styles.heading}>What's your experience level?</Text>
          <Text style={styles.subtext}>This helps us show you the right breaks</Text>

          <View style={styles.cardList}>
            {OPTIONS.map((opt) => {
              const isSelected = selected === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
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
            style={[styles.nextButton, (!selected || saving) && styles.disabled]}
            onPress={handleNext}
            disabled={!selected || saving}
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
