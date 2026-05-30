import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

function breakRatingLabel(r: number): string {
  if (r === 1) return 'Not worth it'
  if (r === 2) return 'Mediocre'
  if (r === 3) return 'Decent spot'
  if (r === 4) return 'Really good'
  if (r === 5) return 'Epic'
  return ''
}

export interface RateBreakModalProps {
  visible: boolean
  breakName: string
  initialRating?: number
  initialFavorite?: boolean
  onClose: () => void
  onLogSession: (rating: number, isFavorite: boolean) => void
  onRateOnly: (rating: number, isFavorite: boolean) => void
}

export function RateBreakModal({
  visible,
  breakName,
  initialRating = 0,
  initialFavorite = false,
  onClose,
  onLogSession,
  onRateOnly,
}: RateBreakModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [rating, setRating] = useState(initialRating)
  const [isFavorite, setIsFavorite] = useState(initialFavorite)
  const favAnim = useRef(new Animated.Value(initialFavorite ? 1 : 0)).current

  // Reset to initial values whenever the modal opens
  useEffect(() => {
    if (visible) {
      setStep(1)
      setRating(initialRating)
      setIsFavorite(initialFavorite)
      favAnim.setValue(initialFavorite ? 1 : 0)
    }
  }, [visible, initialRating, initialFavorite, favAnim])

  function handleClose() {
    onClose()
  }

  function handleNext() {
    setStep(2)
  }

  function handleFavoriteToggle(val: boolean) {
    setIsFavorite(val)
    Animated.timing(favAnim, { toValue: val ? 1 : 0, duration: 150, useNativeDriver: false }).start()
  }

  const favTrackColor = favAnim.interpolate({ inputRange: [0, 1], outputRange: ['#1B3A45', '#7F77DD'] })
  const favThumbLeft  = favAnim.interpolate({ inputRange: [0, 1], outputRange: [2, 20] })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={rbs.overlay}>
        <View style={rbs.sheet}>
          <View style={rbs.handle} />

          {step === 1 && (
            <View style={rbs.stepContainer}>
              <Text style={rbs.contextLine}>{breakName}</Text>
              <Text style={rbs.heading}>What would you rate{'\n'}this break out of 5?</Text>

              <View style={rbs.dotsRow}>
                {[1, 2, 3, 4, 5].map(i => {
                  const filled = i <= rating
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setRating(i === rating ? 0 : i)}
                      activeOpacity={0.7}
                      style={[rbs.dot, filled ? rbs.dotFilled : rbs.dotEmpty]}
                    />
                  )
                })}
              </View>
              <Text style={rbs.descriptor}>{rating > 0 ? breakRatingLabel(rating) : ' '}</Text>

              <TouchableOpacity
                style={rbs.favCard}
                onPress={() => handleFavoriteToggle(!isFavorite)}
                activeOpacity={0.8}
              >
                <View style={rbs.favCardLeft}>
                  <View style={rbs.favDot} />
                  <Text style={rbs.favLabel}>Mark as a favorite</Text>
                </View>
                <Animated.View style={[rbs.toggleTrack, { backgroundColor: favTrackColor }]}>
                  <Animated.View style={[rbs.toggleThumb, { left: favThumbLeft }]} />
                </Animated.View>
              </TouchableOpacity>

              <TouchableOpacity style={rbs.primaryBtn} onPress={handleNext} activeOpacity={0.85} disabled={rating === 0}>
                <Text style={[rbs.primaryBtnText, rating === 0 && { opacity: 0.5 }]}>Next →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={rbs.ghostBtn} onPress={handleClose} activeOpacity={0.7}>
                <Text style={rbs.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={rbs.stepContainer}>
              <Text style={rbs.heading}>Would you like to{'\n'}log your session?</Text>
              <Text style={rbs.subtext}>You can always log it later from the map</Text>

              <TouchableOpacity
                style={rbs.primaryBtn}
                onPress={() => onLogSession(rating, isFavorite)}
                activeOpacity={0.85}
              >
                <Text style={rbs.primaryBtnText}>Yes, log session →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={rbs.secondaryBtn}
                onPress={() => onRateOnly(rating, isFavorite)}
                activeOpacity={0.8}
              >
                <Text style={rbs.secondaryBtnText}>No thanks</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const rbs = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6,15,20,0.7)',
  },
  sheet: {
    backgroundColor: '#0B2230',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 48,
    borderTopWidth: 0.5,
    borderTopColor: '#1B3A45',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1B3A45',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  stepContainer: {
    paddingHorizontal: 28,
    paddingTop: 24,
    alignItems: 'center',
  },
  contextLine: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#3CC4C4',
    textAlign: 'center',
    marginBottom: 12,
  },
  heading: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 31,
    lineHeight: 40,
    color: '#E8D5B8',
    textAlign: 'center',
    marginBottom: 36,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  dotFilled: {
    backgroundColor: '#3CC4C4',
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#1B5A6A',
  },
  descriptor: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 16,
    color: '#3CC4C4',
    textAlign: 'center',
    marginBottom: 28,
    minHeight: 22,
  },
  favCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  favCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  favDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7F77DD',
  },
  favLabel: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 15,
    color: '#E8D5B8',
  },
  toggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    position: 'relative',
  },
  toggleThumb: {
    position: 'absolute',
    top: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E8D5B8',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 15,
    color: '#E8D5B8',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    width: '100%',
    backgroundColor: '#0F2838',
    borderWidth: 0.5,
    borderColor: 'rgba(74,122,135,0.4)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 15,
    color: '#4A7A87',
    letterSpacing: 0.3,
  },
  ghostBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  ghostBtnText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
    letterSpacing: 0.3,
  },
  subtext: {
    fontFamily: 'Helvetica Neue',
    fontSize: 13,
    color: '#4A7A87',
    textAlign: 'center',
    marginTop: -20,
    marginBottom: 36,
    letterSpacing: 0.3,
  },
})
