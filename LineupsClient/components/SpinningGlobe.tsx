// Decorative auto-rotating globe for the Profile card. No surfed-region data —
// it shows the same country outlines for every user. The actual travels
// visualization lives on the /surfed-globe route.
//
// Render is cheap: ~250 admin0 features → one combined <Path>, refreshed
// at ~12 fps. Front-hemisphere cull halves the work each frame.

import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg'
import { geoCentroid, geoOrthographic, geoPath } from 'd3-geo'
import { feature as topoFeature } from 'topojson-client'

import admin0Topo from '../assets/world/admin0.json'

const OCEAN = '#0E3038'
const OCEAN_BORDER = '#1B7A87'
const LAND = '#1B5A65'
const BORDER = '#0B2230'

// Static rotation tilt — slightly north of equator gives a friendlier read
// than dead-center on the equator.
const PHI = -15

type Admin0Feature = {
  type: 'Feature'
  properties: { NAME: string; [k: string]: any }
  geometry: any
}

const TOPO = admin0Topo as any
const OBJECT_NAME = Object.keys(TOPO.objects)[0]
const FEATURES = ((topoFeature(TOPO, TOPO.objects[OBJECT_NAME]) as any).features as Admin0Feature[])
const CENTROIDS: [number, number][] = FEATURES.map(
  f => geoCentroid(f as any) as [number, number],
)

function isOnFrontHemisphere(
  centroid: [number, number],
  lambda: number,
): boolean {
  const toRad = Math.PI / 180
  const lng1 = centroid[0] * toRad
  const lat1 = centroid[1] * toRad
  const lng2 = -lambda * toRad
  const lat2 = -PHI * toRad
  const cosC =
    Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng1 - lng2)
  return cosC > -0.1
}

type Props = {
  size?: number
  /** Degrees of longitude per second. Positive spins the globe eastward. */
  speed?: number
}

export default function SpinningGlobe({ size = 60, speed = 14 }: Props) {
  const [lambda, setLambda] = useState(0)

  useEffect(() => {
    const tickMs = 80 // ~12 fps — feels smooth at small size, easy on JS thread
    const degreesPerTick = (speed * tickMs) / 1000
    const id = setInterval(() => {
      setLambda(l => (l + degreesPerTick) % 360)
    }, tickMs)
    return () => clearInterval(id)
  }, [speed])

  const projection = useMemo(
    () =>
      geoOrthographic()
        .scale(size / 2.1)
        .translate([size / 2, size / 2])
        .rotate([lambda, PHI])
        .clipAngle(90),
    [size, lambda],
  )

  const pathFn = useMemo(() => geoPath(projection), [projection])

  const landPath = useMemo(() => {
    const parts: string[] = []
    for (let i = 0; i < FEATURES.length; i++) {
      if (!isOnFrontHemisphere(CENTROIDS[i], lambda)) continue
      const d = pathFn(FEATURES[i] as any)
      if (d) parts.push(d)
    }
    return parts.join(' ')
  }, [pathFn, lambda])

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <ClipPath id="spinning-globe-clip">
            <Circle cx={size / 2} cy={size / 2} r={size / 2 - 0.5} />
          </ClipPath>
        </Defs>

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 0.5}
          fill={OCEAN}
          stroke={OCEAN_BORDER}
          strokeWidth={0.75}
        />

        <G clipPath="url(#spinning-globe-clip)">
          {landPath ? (
            <Path
              d={landPath}
              fill={LAND}
              stroke={BORDER}
              strokeWidth={0.2}
            />
          ) : null}
        </G>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
