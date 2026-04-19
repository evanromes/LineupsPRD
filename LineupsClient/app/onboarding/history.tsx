import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  FlatList,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface RatedBreak {
  breakId: string
  name: string
  rating: number
  isFavorite: boolean
}

function DotRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={ratingStyles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} style={ratingStyles.dotWrap}>
          <View style={[ratingStyles.dot, i <= value && ratingStyles.dotFilled]} />
        </TouchableOpacity>
      ))}
    </View>
  )
}

const ratingStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  dotWrap: { padding: 4 },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#C5A882',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#1B7A87',
    borderColor: '#1B7A87',
  },
})

export default function OnboardingHistory() {
  const [userId, setUserId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [ratedBreaks, setRatedBreaks] = useState<RatedBreak[]>([])
  const [sheetVisible, setSheetVisible] = useState(false)
  const [sheetBreakName, setSheetBreakName] = useState('')
  const [sheetRating, setSheetRating] = useState(0)
  const [sheetFavorite, setSheetFavorite] = useState(false)
  const [saving, setSaving] = useState(false)
  const sheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  function openSheet() {
    if (!searchText.trim()) return
    setSheetBreakName(searchText.trim())
    setSheetRating(0)
    setSheetFavorite(false)
    setSheetVisible(true)
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start()
  }

  function closeSheet() {
    Animated.timing(sheetY, { toValue: SCREEN_HEIGHT, useNativeDriver: true, duration: 260 }).start(() => {
      setSheetVisible(false)
    })
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) sheetY.setValue(gs.dy)
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          closeSheet()
        } else {
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: true }).start()
        }
      },
    })
  ).current

  async function confirmBreak() {
    if (!userId || sheetRating === 0) return
    setSaving(true)

    // Upsert break by name
    const { data: existingBreak } = await supabase
      .from('breaks')
      .select('id')
      .ilike('name', sheetBreakName)
      .maybeSingle()

    let breakId = existingBreak?.id as string | undefined

    if (!breakId) {
      const { data: newBreak, error: breakErr } = await supabase
        .from('breaks')
        .insert({ name: sheetBreakName })
        .select('id')
        .single()

      if (breakErr || !newBreak) {
        setSaving(false)
        return
      }
      breakId = newBreak.id
    }

    await supabase.from('break_ratings').upsert(
      { user_id: userId, break_id: breakId, rating: sheetRating, is_favorite: sheetFavorite },
      { onConflict: 'user_id,break_id' }
    )

    setRatedBreaks((prev) => [
      ...prev.filter((b) => b.breakId !== breakId),
      { breakId: breakId!, name: sheetBreakName, rating: sheetRating, isFavorite: sheetFavorite },
    ])

    setSaving(false)
    setSearchText('')
    closeSheet()
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.stepRow}>
          <Text style={styles.stepText}>3 / 5</Text>
        </View>

        <Text style={styles.title}>Rate Your Breaks</Text>
        <Text style={styles.subtitle}>Add breaks you've surfed and rate them</Text>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Break name..."
            placeholderTextColor="#A89070"
            value={searchText}
            onChangeText={setSearchText}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={openSheet}
          />
          <TouchableOpacity
            style={[styles.addButton, !searchText.trim() && styles.addButtonDisabled]}
            onPress={openSheet}
            disabled={!searchText.trim()}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {ratedBreaks.length > 0 && (
          <View style={styles.ratedList}>
            {ratedBreaks.map((b) => (
              <View key={b.breakId} style={styles.ratedCard}>
                <View style={styles.ratedCardLeft}>
                  <Text style={styles.ratedName}>{b.name}</Text>
                  <View style={styles.ratedDots}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <View
                        key={i}
                        style={[styles.miniDot, i <= b.rating && styles.miniDotFilled]}
                      />
                    ))}
                    {b.isFavorite && <Text style={styles.favStar}>★</Text>}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setRatedBreaks((prev) => prev.filter((x) => x.breakId !== b.breakId))
                  }
                >
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/onboarding/friends')}>
            <Text style={styles.primaryButtonText}>
              {ratedBreaks.length > 0 ? 'Continue' : 'Continue'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={() => router.replace('/onboarding/friends')}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Rating bottom sheet */}
      {sheetVisible && (
        <>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
            <View style={styles.sheetHandle} {...panResponder.panHandlers} />

            <Text style={styles.sheetTitle}>{sheetBreakName}</Text>
            <Text style={styles.sheetLabel}>Rating</Text>
            <DotRating value={sheetRating} onChange={setSheetRating} />

            <TouchableOpacity
              style={styles.favRow}
              onPress={() => setSheetFavorite((f) => !f)}
            >
              <View style={[styles.favCheck, sheetFavorite && styles.favCheckActive]}>
                {sheetFavorite && <Text style={styles.favCheckMark}>✓</Text>}
              </View>
              <Text style={styles.favLabel}>Mark as favourite</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmButton, (sheetRating === 0 || saving) && styles.disabled]}
              onPress={confirmBreak}
              disabled={sheetRating === 0 || saving}
            >
              {saving ? (
                <ActivityIndicator color="#E8D5B8" />
              ) : (
                <Text style={styles.confirmButtonText}>Add Break</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5EDE0' },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  stepRow: { alignSelf: 'flex-end', marginBottom: 24 },
  stepText: { fontFamily: 'Helvetica Neue', fontSize: 13, color: '#A89070' },
  title: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 38,
    color: '#2A1A08',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 18,
    color: '#8A7055',
    textAlign: 'center',
    marginBottom: 28,
  },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4BFA0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#2A1A08',
    fontSize: 15,
    fontFamily: 'Georgia',
  },
  addButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  addButtonDisabled: { opacity: 0.4 },
  addButtonText: {
    color: '#E8D5B8',
    fontFamily: 'Helvetica Neue',
    fontWeight: '600',
    fontSize: 14,
  },
  ratedList: { gap: 10, marginBottom: 24 },
  ratedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  ratedCardLeft: { gap: 4 },
  ratedName: { fontFamily: 'Georgia', fontSize: 14, color: '#2A1A08' },
  ratedDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#C5A882',
    backgroundColor: 'transparent',
  },
  miniDotFilled: { backgroundColor: '#1B7A87', borderColor: '#1B7A87' },
  favStar: { color: '#7F77DD', fontSize: 13, marginLeft: 4 },
  removeText: { color: '#A89070', fontSize: 16 },
  actions: { marginTop: 'auto', paddingTop: 24, gap: 8 },
  primaryButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#E8D5B8',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
  },
  skipButton: { alignItems: 'center', paddingVertical: 12 },
  skipText: { color: '#A89070', fontSize: 14, fontFamily: 'Helvetica Neue' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4BFA0',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: 'Georgia',
    fontWeight: 'bold',
    fontSize: 20,
    color: '#2A1A08',
  },
  sheetLabel: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '300',
    fontSize: 11,
    letterSpacing: 2,
    color: '#8A7055',
  },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  favCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C5A882',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favCheckActive: { backgroundColor: '#7F77DD', borderColor: '#7F77DD' },
  favCheckMark: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  favLabel: { fontFamily: 'Helvetica Neue', fontSize: 14, color: '#2A1A08' },
  confirmButton: {
    backgroundColor: '#1B7A87',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmButtonText: {
    color: '#E8D5B8',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
  },
  disabled: { opacity: 0.5 },
})
