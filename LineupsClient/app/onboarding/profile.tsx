// PATTERN — one focused question per screen:
// Each onboarding screen should show one question centered on screen,
// Georgia bold 20px heading, Helvetica Neue 300 11px subtext,
// a single input/chip group, a full-width "Next →" button, and a back chevron top-left.
// Keep content vertically centered so the keyboard does not displace it.
// Do not show more than one question at a time.

import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken'

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

export default function OnboardingProfile() {
  const [step, setStep] = useState<1 | 2>(1)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [saving, setSaving] = useState(false)

  const lastNameRef = useRef<TextInput>(null)
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  // Username availability check
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current)
    const trimmed = username.trim()
    if (trimmed.length < 3) {
      setUsernameStatus('idle')
      return
    }
    setUsernameStatus('checking')
    checkTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmed.toLowerCase())
        .neq('id', userId ?? '')
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 400)
  }, [username, userId])

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled) setAvatarUri(result.assets[0].uri)
  }

  function handleStep1Next() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter both your first and last name.')
      return
    }
    setError(null)
    setStep(2)
  }

  async function handleStep2Next() {
    const trimmedUsername = username.trim().toLowerCase()
    if (!trimmedUsername || trimmedUsername.length < 3) {
      setError('Please choose a username with at least 3 characters.')
      return
    }
    if (usernameStatus !== 'available') {
      setError('Please choose an available username.')
      return
    }
    if (!userId) return

    setSaving(true)
    setError(null)

    const { error: dbError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        display_name: `${firstName.trim()} ${lastName.trim()}`,
        username: trimmedUsername,
      },
      { onConflict: 'id' }
    )

    setSaving(false)
    if (dbError) {
      setError(dbError.message)
      return
    }
    router.replace('/onboarding/stance')
  }

  const avatarLetter = (firstName[0] ?? userEmail?.[0] ?? '?').toUpperCase()
  const step1Ready = firstName.trim().length > 0 && lastName.trim().length > 0
  const step2Ready = usernameStatus === 'available' && username.trim().length >= 3

  // ── Screen 1 ──────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.screen}>
            {/* Progress dots — pinned top */}
            <View style={styles.dotsRow}>
              <ProgressDots total={5} current={1} />
            </View>

            {/* Content flows top-down below progress dots */}
            <View style={styles.center}>
              {/* Avatar — just below progress dots */}
              <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.85}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeIcon}>+</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.heading}>First, what's your name?</Text>
              <Text style={styles.subtext}>This is what will show to other surfers</Text>

              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor="#C5A882"
                value={firstName}
                onChangeText={(t) => { setFirstName(t); setError(null) }}
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => lastNameRef.current?.focus()}
                blurOnSubmit={false}
              />
              <TextInput
                ref={lastNameRef}
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor="#C5A882"
                value={lastName}
                onChangeText={(t) => { setLastName(t); setError(null) }}
                autoCorrect={false}
                returnKeyType="done"
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={[styles.nextButton, !step1Ready && styles.disabled]}
                onPress={handleStep1Next}
                disabled={!step1Ready}
                activeOpacity={0.85}
              >
                <Text style={styles.nextButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ── Screen 2 ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.screen}>
          {/* Progress dots — pinned top */}
          <View style={styles.dotsRow}>
            <ProgressDots total={5} current={1} />
          </View>

          {/* Back chevron */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { setStep(1); setError(null) }}
            activeOpacity={0.7}
          >
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>

          {/* Content flows top-down below progress dots */}
          <View style={styles.center}>
            {/* Avatar — same position as Screen 1 */}
            <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.85}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeIcon}>+</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.heading}>Now, Choose a username</Text>
            <Text style={styles.subtext}>This is how other surfers will find you</Text>

            {/* Username field with @ prefix */}
            <View style={styles.usernameWrap}>
              <View style={styles.atWrap} pointerEvents="none">
                <Text style={styles.atSign}>@</Text>
              </View>
              <TextInput
                style={[styles.input, styles.usernameInput]}
                placeholder="username"
                placeholderTextColor="#C5A882"
                value={username}
                onChangeText={(t) => {
                  setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))
                  setError(null)
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>

            {/* Availability indicator */}
            {username.trim().length >= 3 && (
              <View style={styles.availabilityRow}>
                {usernameStatus === 'checking' && (
                  <Text style={styles.availChecking}>Checking...</Text>
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

            <Text style={styles.changeHint}>You can always change this later</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.nextButton, (!step2Ready || saving) && styles.disabled]}
              onPress={handleStep2Next}
              disabled={!step2Ready || saving}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B2230',
  },
  flex: { flex: 1 },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },

  // Progress dots row
  dotsRow: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  // Back chevron
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 24,
    padding: 8,
  },
  backChevron: {
    fontFamily: 'Helvetica Neue',
    fontSize: 28,
    color: '#4A7A87',
    lineHeight: 32,
  },

  // Content block — flows from top below dots
  center: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 96,
  },

  // Avatar
  avatarWrap: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#1B7A87',
    borderWidth: 2,
    borderColor: '#3CC4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 36,
    color: '#E8D5B8',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3CC4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeIcon: {
    color: '#0B2230',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
    marginTop: -1,
  },

  // Headings
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
    marginBottom: 28,
  },

  // Input fields
  input: {
    width: '100%',
    backgroundColor: '#0B2230',
    borderWidth: 0.5,
    borderColor: '#E8D5B8',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 64,
    color: '#E8D5B8',
    fontSize: 20,
    fontFamily: 'Georgia',
    marginBottom: 8,
  },
  usernameWrap: {
    position: 'relative',
    width: '100%',
  },
  atWrap: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 8,
    justifyContent: 'center',
    zIndex: 1,
  },
  atSign: {
    fontFamily: 'Georgia',
    fontSize: 20,
    color: 'rgba(197, 168, 130, 0.5)',
  },
  usernameInput: {
    paddingLeft: 30,
    borderWidth: 0.5,
    borderColor: '#E8D5B8',
    color: '#E8D5B8',
  },

  // Availability indicator
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: -2,
    marginBottom: 6,
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
  changeHint: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 16,
    color: '#4A7A87',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 46,
  },

  // Error
  error: {
    color: '#E07070',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },

  // Next button
  nextButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#1B7A87',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
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
