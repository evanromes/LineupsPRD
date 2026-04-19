import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

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
    marginBottom: 24,
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

const EXPERIENCE_LEVELS = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
  { label: 'Pro', value: 'pro' },
]
const BOARD_TYPES = ['Longboard', 'Shortboard', 'Mid-Length', 'SUP', 'Variable']
const STANCES = ['Regular', 'Goofy', 'Switch']

export default function OnboardingStance() {
  const [experience, setExperience] = useState<string | null>(null)
  const [board, setBoard] = useState<string | null>(null)
  const [stance, setStance] = useState<string | null>(null)
  const [homeBreak, setHomeBreak] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  async function handleContinue(skip = false) {
    if (!userId) return
    setLoading(true)

    if (!skip) {
      await supabase.from('profiles').update({
        experience_level: experience ?? null,
        preferred_board: board?.toLowerCase() ?? null,
        stance: stance?.toLowerCase() ?? null,
        home_break: homeBreak.trim() || null,
      }).eq('id', userId)
    }

    setLoading(false)
    router.replace('/onboarding/history')
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>

            {/* ── Top block ── */}
            <View style={styles.topBlock}>
              <ProgressDots total={5} current={2} />
              <Text style={styles.title}>Your Surfing</Text>
              <Text style={styles.subtitle}>Help us personalise your experience</Text>
            </View>

            {/* ── Bottom block ── */}
            <View style={styles.bottomBlock}>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>EXPERIENCE</Text>
                <View style={styles.chipRow}>
                  {EXPERIENCE_LEVELS.slice(0, 3).map((e) => (
                    <TouchableOpacity
                      key={e.value}
                      style={[styles.chip, experience === e.value && styles.chipSelected]}
                      onPress={() => setExperience(experience === e.value ? null : e.value)}
                    >
                      <Text style={[styles.chipText, experience === e.value && styles.chipTextSelected]}>
                        {e.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.chipRowCentered}>
                  {EXPERIENCE_LEVELS.slice(3).map((e) => (
                    <TouchableOpacity
                      key={e.value}
                      style={[styles.chip, experience === e.value && styles.chipSelected]}
                      onPress={() => setExperience(experience === e.value ? null : e.value)}
                    >
                      <Text style={[styles.chipText, experience === e.value && styles.chipTextSelected]}>
                        {e.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PREFERRED BOARD</Text>
                <View style={[styles.chipRow, styles.chipRowBoard]}>
                  {BOARD_TYPES.slice(0, 3).map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.chip, styles.chipBoard, board === b && styles.chipSelected]}
                      onPress={() => setBoard(board === b ? null : b)}
                    >
                      <Text style={[styles.chipText, board === b && styles.chipTextSelected]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.chipRowCentered}>
                  {BOARD_TYPES.slice(3).map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.chip, styles.chipBoard, board === b && styles.chipSelected]}
                      onPress={() => setBoard(board === b ? null : b)}
                    >
                      <Text style={[styles.chipText, board === b && styles.chipTextSelected]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>STANCE</Text>
                <View style={styles.chipRow}>
                  {STANCES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, stance === s && styles.chipSelected]}
                      onPress={() => setStance(stance === s ? null : s)}
                    >
                      <Text style={[styles.chipText, stance === s && styles.chipTextSelected]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>HOME BREAK</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Mavericks, Pipe, your local beach"
                  placeholderTextColor="#C5A882"
                  value={homeBreak}
                  onChangeText={setHomeBreak}
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabled]}
                onPress={() => handleContinue(false)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#E8D5B8" />
                ) : (
                  <Text style={styles.primaryButtonText}>Continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => handleContinue(true)}
                disabled={loading}
              >
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A2E22',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 24,
    backgroundColor: '#1A2E22',
  },

  // ── Top block ──
  topBlock: {
    alignItems: 'center',
    paddingTop: 60,
  },
  title: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 38,
    color: '#E8D5B8',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 18,
    color: '#4A7A5A',
    textAlign: 'center',
    marginBottom: 0,
  },

  // ── Bottom block ──
  bottomBlock: {
    marginTop: 'auto',
    paddingBottom: 8,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 13,
    color: '#4A7A87',
    letterSpacing: 2,
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  chipRowBoard: {},
  chipBoard: {
    paddingHorizontal: 14,
  },
  chipRowCentered: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 21,
    paddingVertical: 12,
    borderRadius: 23,
    borderWidth: 0.5,
    borderColor: 'rgba(197, 168, 130, 0.4)',
    backgroundColor: 'rgba(42, 26, 8, 0.35)',
  },
  chipSelected: {
    backgroundColor: '#0F4E63',
    borderColor: '#3CC4C4',
    borderWidth: 0.5,
  },
  chipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 16,
    color: '#C5A882',
  },
  chipTextSelected: {
    color: '#3CC4C4',
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(42, 26, 8, 0.35)',
    borderWidth: 0.5,
    borderColor: 'rgba(197, 168, 130, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#E8D5B8',
    fontSize: 17,
    fontFamily: 'Georgia',
  },
  primaryButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#E8D5B8',
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
  },
  disabled: {
    opacity: 0.6,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipText: {
    color: '#4A7A5A',
    fontSize: 16,
    fontFamily: 'Helvetica Neue',
  },
})
