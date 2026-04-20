import { View } from 'react-native'
import Svg, { Rect, Text, Path } from 'react-native-svg'

interface Props {
  size?: number
}

export default function LineupsLogo({ size = 120 }: Props) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 400 400">
        <Rect x="0" y="0" width="400" height="400" rx="88" fill="#0B2230" />
        <Text
          x="200"
          y="195"
          fontFamily="Georgia, serif"
          fontSize="62"
          fontWeight="700"
          fill="#E8D5B8"
          textAnchor="middle"
          letterSpacing="2"
        >
          Lineups
        </Text>
        <Path
          d="M60 240 Q130 224,200 240 Q270 256,340 240"
          fill="none"
          stroke="#3CC4C4"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <Path
          d="M60 262 Q130 246,200 262 Q270 278,340 262"
          fill="none"
          stroke="#3CC4C4"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        <Path
          d="M60 282 Q130 268,200 282 Q270 296,340 282"
          fill="none"
          stroke="#3CC4C4"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.3"
        />
        <Rect
          x="2"
          y="2"
          width="396"
          height="396"
          rx="86"
          fill="none"
          stroke="#1B5A6A"
          strokeWidth="1.5"
          opacity="0.4"
        />
      </Svg>
    </View>
  )
}
