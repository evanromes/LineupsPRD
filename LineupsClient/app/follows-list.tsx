import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'

interface ProfileRow {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
}

type FollowType = 'followers' | 'following'

export default function FollowsListScreen() {
  const insets = useSafeAreaInsets()
  const { userId, type } = useLocalSearchParams<{ userId: string; type: FollowType }>()

  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<ProfileRow[]>([])

  const isFollowers = type === 'followers'
  const title = isFollowers ? 'Followers' : 'Following'

  useEffect(() => {
    if (userId) fetchList()
  }, [userId, type])

  async function fetchList() {
    setLoading(true)
    try {
      // followers => people whose following_id = userId, return their follower_id
      // following => people whose follower_id = userId, return their following_id
      const selectCol = isFollowers ? 'follower_id' : 'following_id'
      const filterCol = isFollowers ? 'following_id' : 'follower_id'

      const { data: rows } = await supabase
        .from('follows')
        .select(selectCol)
        .eq(filterCol, userId)

      const ids = (rows ?? []).map((r: any) => r[selectCol]).filter(Boolean)
      if (ids.length === 0) {
        setProfiles([])
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', ids)

      // Sort alphabetically by display name (or username fallback)
      const sorted = (profileData ?? []).slice().sort((a, b) => {
        const an = (a.display_name || a.username || '').toLowerCase()
        const bn = (b.display_name || b.username || '').toLowerCase()
        return an.localeCompare(bn)
      })
      setProfiles(sorted as ProfileRow[])
    } finally {
      setLoading(false)
    }
  }

  function openProfile(id: string) {
    router.push({ pathname: '/user-profile', params: { userId: id } })
  }

  function renderRow({ item }: { item: ProfileRow }) {
    const name = item.display_name || item.username || 'Surfer'
    const initial = name.charAt(0).toUpperCase()
    return (
      <TouchableOpacity style={styles.row} onPress={() => openProfile(item.id)} activeOpacity={0.7}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
          {item.username && item.display_name && (
            <Text style={styles.rowHandle} numberOfLines={1}>@{item.username}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#4A7A87" />
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2230" />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#E8D5B8" />
          <Text style={styles.backLabel}>Profile</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3CC4C4" />
        </View>
      ) : profiles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {isFollowers ? 'No followers yet.' : 'Not following anyone yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={p => p.id}
          renderItem={renderRow}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B2230',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(74, 122, 135, 0.3)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 100,
  },
  backLabel: {
    fontFamily: 'Helvetica Neue',
    fontSize: 16,
    color: '#E8D5B8',
    letterSpacing: 0.4,
    marginLeft: -2,
  },
  title: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 18,
    color: '#E8D5B8',
  },
  headerSpacer: {
    width: 100,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 14,
    color: '#4A7A87',
    textAlign: 'center',
  },
  list: {
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1B3A45',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'Georgia',
    fontWeight: '700',
    fontSize: 18,
    color: '#E8D5B8',
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontFamily: 'Helvetica Neue',
    fontWeight: '500',
    fontSize: 15,
    color: '#E8D5B8',
    letterSpacing: 0.2,
  },
  rowHandle: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: '#4A7A87',
    marginTop: 2,
  },
  separator: {
    height: 0.5,
    backgroundColor: 'rgba(74, 122, 135, 0.2)',
    marginLeft: 74,
  },
})
