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
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
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
    marginTop: 0,
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

export default function OnboardingProfile() {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [avatarUri, setAvatarUri] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  const avatarLetter = (
    displayName.trim()[0] ?? userEmail?.[0] ?? '?'
  ).toUpperCase()

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  async function upsertProfile(partial: boolean) {
    if (!userId) return
    if (!partial && !displayName.trim()) {
      setError('Please enter a display name.')
      return
    }
    setLoading(true)
    setError(null)

    const { error: dbError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        display_name: displayName.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
      },
      { onConflict: 'id' }
    )

    setLoading(false)
    if (dbError) {
      setError(dbError.message)
      return
    }
    router.replace('/onboarding/stance')
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
              <ProgressDots total={5} current={1} />

              <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.85}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarCircle} />
                ) : (
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                  </View>
                )}
                <View style={styles.avatarAddBtn}>
                  <Text style={styles.avatarAddIcon}>+</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.title}>Set up your profile</Text>
              <Text style={styles.subtitle}>How other surfers will find you</Text>
            </View>

            {/* ── Bottom block ── */}
            <View style={styles.bottomBlock}>
              <TextInput
                style={styles.input}
                placeholder="Display name"
                placeholderTextColor="#C5A882"
                value={displayName}
                onChangeText={setDisplayName}
                autoCorrect={false}
              />

              <View style={styles.usernameWrap}>
                <View style={styles.atWrap} pointerEvents="none">
                  <Text style={styles.atSign}>@</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.usernameInput]}
                  placeholder="username"
                  placeholderTextColor="#C5A882"
                  value={username}
                  onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Short bio (optional)"
                placeholderTextColor="#C5A882"
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={[styles.continueButton, loading && styles.disabled]}
                onPress={() => upsertProfile(false)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#E8D5B8" />
                ) : (
                  <Text style={styles.continueButtonText}>Continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => upsertProfile(true)}
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
    backgroundColor: '#0B2230',
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
    backgroundColor: '#0B2230',
  },

  // ── Top block ──
  topBlock: {
    alignItems: 'center',
    paddingTop: 60,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#1B7A87',
    borderWidth: 2.5,
    borderColor: '#3CC4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 35,
    color: '#E8D5B8',
  },
  avatarAddBtn: {
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
  avatarAddIcon: {
    color: '#0B2230',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 16,
    marginTop: -1,
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
    color: '#4A7A87',
    textAlign: 'center',
    marginBottom: 36,
  },

  // ── Bottom block ──
  bottomBlock: {
    marginTop: 'auto',
    paddingBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(42, 26, 8, 0.35)',
    borderWidth: 0.5,
    borderColor: 'rgba(197, 168, 130, 0.4)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    height: 64,
    color: '#E8D5B8',
    fontSize: 17,
    fontFamily: 'Georgia',
    marginBottom: 12,
  },
  usernameWrap: {
    position: 'relative',
    width: '100%',
  },
  atWrap: {
    position: 'absolute',
    left: 18,
    top: 0,
    bottom: 12,
    justifyContent: 'center',
    zIndex: 1,
  },
  atSign: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: 'rgba(197, 168, 130, 0.5)',
  },
  usernameInput: {
    paddingLeft: 30,
  },
  bioInput: {
    height: undefined,
    minHeight: 99,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  error: {
    color: '#E07070',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  continueButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    width: '100%',
  },
  continueButtonText: {
    color: '#E8D5B8',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'Helvetica Neue',
  },
  disabled: {
    opacity: 0.6,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    color: '#4A7A87',
    fontSize: 13,
    fontFamily: 'Helvetica Neue',
  },
})
