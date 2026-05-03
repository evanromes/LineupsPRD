import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function tabIcon(active: IoniconsName, inactive: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={22} color={color} />
  )
}

function WaveIcon({ color }: { color: string; focused: boolean }) {
  return (
    <Svg width={24} height={22} viewBox="0 0 24 22">
      <Path
        d="M2 14 Q5 9 8 14 Q11 19 14 14 Q17 9 20 14 Q21.5 16.5 22 14"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M2 9 Q5 4 8 9 Q11 14 14 9 Q17 4 20 9 Q21.5 11.5 22 9"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.45}
      />
    </Svg>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3CC4C4',
        tabBarInactiveTintColor: '#2A5A65',
        tabBarStyle: {
          backgroundColor: '#060F14',
          borderTopWidth: 0.5,
          borderTopColor: '#1B3A45',
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: tabIcon('people', 'people-outline'),
        }}
      />
      <Tabs.Screen
        name="breaks"
        options={{
          title: 'Breaks',
          tabBarIcon: WaveIcon,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: tabIcon('map', 'map-outline'),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: tabIcon('search', 'search-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: tabIcon('person', 'person-outline'),
        }}
      />
    </Tabs>
  )
}
