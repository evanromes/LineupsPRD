import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Contacts from 'expo-contacts'
import Svg, { Path, Circle, G } from 'react-native-svg'
import { router } from 'expo-router'

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

function ContactsIllustration() {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
      {/* Center surfer */}
      <Circle cx={60} cy={60} r={22} fill="rgba(27,90,106,0.35)" stroke="#3CC4C4" strokeWidth={1} />
      <Circle cx={60} cy={53} r={8} fill="#1B7A87" />
      <Path d="M46 72 Q60 65 74 72" stroke="#3CC4C4" strokeWidth={1.5} strokeLinecap="round" fill="none" />

      {/* Left friend */}
      <Circle cx={22} cy={58} r={16} fill="rgba(27,90,106,0.25)" stroke="#4A7A87" strokeWidth={0.8} strokeDasharray="3 2" />
      <Circle cx={22} cy={53} r={6} fill="#0F5A65" />
      <Path d="M13 66 Q22 61 31 66" stroke="#4A7A87" strokeWidth={1.2} strokeLinecap="round" fill="none" />

      {/* Right friend */}
      <Circle cx={98} cy={58} r={16} fill="rgba(27,90,106,0.25)" stroke="#4A7A87" strokeWidth={0.8} strokeDasharray="3 2" />
      <Circle cx={98} cy={53} r={6} fill="#0F5A65" />
      <Path d="M89 66 Q98 61 107 66" stroke="#4A7A87" strokeWidth={1.2} strokeLinecap="round" fill="none" />

      {/* Connection lines */}
      <Path d="M38 58 L44 58" stroke="#3CC4C4" strokeWidth={1} strokeLinecap="round" strokeDasharray="2 2" />
      <Path d="M76 58 L82 58" stroke="#3CC4C4" strokeWidth={1} strokeLinecap="round" strokeDasharray="2 2" />

      {/* Wave beneath center */}
      <Path d="M48 86 Q54 82 60 86 Q66 90 72 86" stroke="#3CC4C4" strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.6} />
    </Svg>
  )
}

export default function OnboardingContacts() {
  const [requesting, setRequesting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleAllow() {
    setRequesting(true)
    await Contacts.requestPermissionsAsync()
    setRequesting(false)
    router.push('/onboarding/friends')
  }

  function handleNotNow() {
    setShowConfirm(true)
  }

  function handleSkipAnyway() {
    setShowConfirm(false)
    router.push('/onboarding/friends')
  }

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
          <View style={styles.illustration}>
            <ContactsIllustration />
          </View>

          <Text style={styles.heading}>Discover your friends{'\n'}already on Lineups</Text>
          <Text style={styles.subtext}>So you can see where they're surfing</Text>

          <TouchableOpacity
            style={[styles.allowButton, requesting && styles.disabled]}
            onPress={handleAllow}
            disabled={requesting}
            activeOpacity={0.85}
          >
            {requesting ? (
              <ActivityIndicator color="#E8D5B8" />
            ) : (
              <Text style={styles.allowButtonText}>Allow Contacts</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notNowButton}
            onPress={handleNotNow}
            activeOpacity={0.75}
          >
            <Text style={styles.notNowText}>Not now</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* Confirmation modal */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Are you sure?</Text>
            <Text style={styles.modalBody}>
              Lineups is more fun when you follow your friends and see where they're surfing. Are you sure you want to skip this step?
            </Text>
            <TouchableOpacity
              style={styles.modalAllowButton}
              onPress={() => setShowConfirm(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalAllowText}>Allow Contacts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSkipButton}
              onPress={handleSkipAnyway}
              activeOpacity={0.7}
            >
              <Text style={styles.modalSkipText}>Skip anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    fontSize: 28,
    color: '#4A7A87',
    lineHeight: 32,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 24,
  },

  illustration: {
    marginBottom: 32,
    opacity: 0.95,
  },

  heading: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 38,
    color: '#E8D5B8',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 46,
  },
  subtext: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 20,
    color: '#4A7A87',
    textAlign: 'center',
    marginBottom: 48,
  },

  allowButton: {
    width: '100%',
    height: 64,
    backgroundColor: '#1B7A87',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  allowButtonText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 20,
    color: '#E8D5B8',
  },
  disabled: { opacity: 0.6 },

  notNowButton: {
    width: '100%',
    height: 64,
    borderWidth: 0.5,
    borderColor: 'rgba(197, 168, 130, 0.4)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notNowText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 20,
    color: '#C5A882',
  },

  // Confirmation modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0F2838',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(74, 122, 135, 0.4)',
    gap: 16,
  },
  modalTitle: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 22,
    color: '#E8D5B8',
    textAlign: 'center',
  },
  modalBody: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 16,
    color: '#4A7A87',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalAllowButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalAllowText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 16,
    color: '#E8D5B8',
  },
  modalSkipButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalSkipText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 14,
    color: '#4A7A87',
  },
})
