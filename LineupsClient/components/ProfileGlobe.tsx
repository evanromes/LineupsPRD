// Rotatable / zoomable orthographic globe for the Profile screen.
// Renders Natural Earth admin_1 features (states/provinces) and highlights
// any whose name is in `surfedAdmin1s` or whose country is in `surfedCountries`.
//
// Perf notes:
//   - Centroids are precomputed once at module load (geoCentroid is expensive).
//   - We cull features whose centroid is on the back hemisphere via a cheap
//     spherical law-of-cosines check before asking d3-geo to project them.
//   - During an active gesture we drop the graticule and filter out
//     high-scalerank (i.e. small / fine-detail) features to keep the SVG
//     re-render cost manageable. Surfed features always render regardless.

import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS, useSharedValue } from 'react-native-reanimated'
import { geoCentroid, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import { feature as topoFeature } from 'topojson-client'

import admin0Topo from '../assets/world/admin0.json'
import admin1Topo from '../assets/world/admin1.json'
import continentsTopo from '../assets/world/continents.json'

// ─── Constants ───────────────────────────────────────────────────────────────

const OCEAN = '#0E3038'
const OCEAN_BORDER = '#1B7A87'
const GRATICULE = '#3CC4C4'
const LAND = '#173A42'
const LAND_SURFED = '#3CC4C4'
const BORDER = '#0B2230'
const MUTED = '#4A7A87'

// ─── Module-level setup ──────────────────────────────────────────────────────
// Both world files are shipped as simplified TopoJSON (mapshaper, ~12% / 20%
// vertex retention). Convert to GeoJSON Feature arrays once at module load so
// the rest of the code is GeoJSON-shaped. Centroids precomputed once because
// geoCentroid is expensive (and the data is static).

type Admin1Properties = {
  name: string
  admin: string
  scalerank: number
  adm1_code?: string
}
type Admin1Feature = {
  type: 'Feature'
  properties: Admin1Properties
  geometry: any
}

type Admin0Feature = {
  type: 'Feature'
  properties: { NAME: string; [k: string]: any }
  geometry: any
}

type ContinentFeature = {
  type: 'Feature'
  properties: { CONTINENT?: string; [k: string]: any }
  geometry: any
}

const ADMIN1_TOPO = admin1Topo as any
const ADMIN1_OBJECT = Object.keys(ADMIN1_TOPO.objects)[0]
const ADMIN1_FEATURES = ((topoFeature(ADMIN1_TOPO, ADMIN1_TOPO.objects[ADMIN1_OBJECT]) as any).features as Admin1Feature[])
const ADMIN1_CENTROIDS: [number, number][] = ADMIN1_FEATURES.map(f => geoCentroid(f as any) as [number, number])

// admin0 (countries) — used at idle for countries the user hasn't surfed in.
// Avoids iterating all 4,596 admin1 features when most of them are landlocked
// regions a surfer would never log in.
const ADMIN0_TOPO = admin0Topo as any
const ADMIN0_OBJECT = Object.keys(ADMIN0_TOPO.objects)[0]
const ADMIN0_FEATURES = ((topoFeature(ADMIN0_TOPO, ADMIN0_TOPO.objects[ADMIN0_OBJECT]) as any).features as Admin0Feature[])
const ADMIN0_CENTROIDS: [number, number][] = ADMIN0_FEATURES.map(f => geoCentroid(f as any) as [number, number])

// Continents (admin0 dissolved by CONTINENT property) — used during drag.
// ~7 features instead of ~250 for the smoothest possible gesture.
const CONTINENTS_TOPO = continentsTopo as any
const CONTINENTS_OBJECT = Object.keys(CONTINENTS_TOPO.objects)[0]
const CONTINENTS_FEATURES = ((topoFeature(CONTINENTS_TOPO, CONTINENTS_TOPO.objects[CONTINENTS_OBJECT]) as any).features as ContinentFeature[])
const CONTINENTS_CENTROIDS: [number, number][] = CONTINENTS_FEATURES.map(f => geoCentroid(f as any) as [number, number])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  'worklet'
  return Math.min(Math.max(v, lo), hi)
}

// Front-hemisphere test via spherical law of cosines.
// Globe center in geographic coords is (-lambda, -phi) under d3 rotation convention.
// cosC > 0 means within 90° of the center; we leave a small negative buffer so
// features whose centroid is just over the edge but whose geometry pokes onto
// the visible side still render.
function isOnFrontHemisphere(
  centroid: [number, number],
  lambda: number,
  phi: number,
): boolean {
  const toRad = Math.PI / 180
  const lng1 = centroid[0] * toRad
  const lat1 = centroid[1] * toRad
  const lng2 = -lambda * toRad
  const lat2 = -phi * toRad
  const cosC =
    Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng1 - lng2)
  return cosC > -0.1
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  surfedAdmin1s: string[]
  surfedCountries: string[]
  size?: number
}

export default function ProfileGlobe({
  surfedAdmin1s,
  surfedCountries,
  size = 280,
}: Props) {
  // Initial view: rotate([120, -25]) = centered on the Pacific just west of
  // California, which is where most surf in this app currently lives.
  // Combined into one state object so each gesture frame triggers exactly
  // one re-render, not three.
  const [view, setView] = useState({
    lambda: 120,
    phi: -25,
    scaleValue: size / 2.1,
  })
  const [isGesturing, setIsGesturing] = useState(false)
  const { lambda, phi, scaleValue } = view

  const surfedAdmin1Set = useMemo(() => new Set(surfedAdmin1s), [surfedAdmin1s])
  const surfedCountrySet = useMemo(() => new Set(surfedCountries), [surfedCountries])

  const projection = useMemo(
    () =>
      geoOrthographic()
        .scale(scaleValue)
        .translate([size / 2, size / 2])
        .rotate([lambda, phi])
        .clipAngle(90),
    [lambda, phi, scaleValue, size],
  )

  const pathFn = useMemo(() => geoPath(projection), [projection])

  // Graticule (10° lat/lng grid) is a single geometry — a multi-line — so
  // it's just one geoPath call per frame regardless of feature count. Cheap
  // enough to keep rendering during drag now that the rest of the world
  // is reduced to continent polygons during gesture.
  const graticulePath = useMemo(
    () => pathFn(geoGraticule10() as any),
    [pathFn],
  )

  // Precompute the small set of surfed feature indices once per surfed set
  // change. The highlight path iterates only this subset (typically <10).
  const surfedIndices = useMemo(() => {
    const out: number[] = []
    for (let i = 0; i < ADMIN1_FEATURES.length; i++) {
      if (surfedAdmin1Set.has(ADMIN1_FEATURES[i].properties.name)) out.push(i)
    }
    return out
  }, [surfedAdmin1Set])

  // Combined highlighted path — surfed admin1 features as one <Path>.
  // Rendered both during gesture (so highlights move with the globe) and idle.
  const highlightedPath = useMemo(() => {
    const parts: string[] = []
    for (const idx of surfedIndices) {
      if (!isOnFrontHemisphere(ADMIN1_CENTROIDS[idx], lambda, phi)) continue
      const d = pathFn(ADMIN1_FEATURES[idx] as any)
      if (d) parts.push(d)
    }
    return parts.join(' ')
  }, [pathFn, surfedIndices, lambda, phi])

  // Base land path:
  //   - During gesture → just the ~7 continent polygons (smoothest possible drag).
  //   - At idle → hybrid: admin0 (countries) for places the user hasn't surfed,
  //     admin1 (states) only for surfed countries so state borders show where
  //     the user actually has been. This collapses ~4,596 features to ~300 at
  //     idle without sacrificing fidelity where it matters.
  const baseLandPath = useMemo(() => {
    const parts: string[] = []
    if (isGesturing) {
      for (let i = 0; i < CONTINENTS_FEATURES.length; i++) {
        if (!isOnFrontHemisphere(CONTINENTS_CENTROIDS[i], lambda, phi)) continue
        const d = pathFn(CONTINENTS_FEATURES[i] as any)
        if (d) parts.push(d)
      }
    } else {
      // admin0 outlines for any country the user has NOT surfed
      for (let i = 0; i < ADMIN0_FEATURES.length; i++) {
        if (surfedCountrySet.has(ADMIN0_FEATURES[i].properties.NAME)) continue
        if (!isOnFrontHemisphere(ADMIN0_CENTROIDS[i], lambda, phi)) continue
        const d = pathFn(ADMIN0_FEATURES[i] as any)
        if (d) parts.push(d)
      }
      // admin1 states ONLY within surfed countries (and skip the highlighted ones)
      for (let i = 0; i < ADMIN1_FEATURES.length; i++) {
        if (!surfedCountrySet.has(ADMIN1_FEATURES[i].properties.admin)) continue
        if (surfedAdmin1Set.has(ADMIN1_FEATURES[i].properties.name)) continue
        if (!isOnFrontHemisphere(ADMIN1_CENTROIDS[i], lambda, phi)) continue
        const d = pathFn(ADMIN1_FEATURES[i] as any)
        if (d) parts.push(d)
      }
    }
    return parts.join(' ')
  }, [pathFn, surfedAdmin1Set, surfedCountrySet, lambda, phi, isGesturing])

  // Gesture-start snapshots live as sharedValues so worklets can both read
  // (in onChange) and write (in onBegin) without Reanimated's "frozen ref"
  // warnings. JS-side state still drives the actual render via runOnJS(commitView).
  const startLambda = useSharedValue(lambda)
  const startPhi = useSharedValue(phi)
  const startScale = useSharedValue(scaleValue)

  // Throttle: drop any onChange event that fires <33ms after the last commit,
  // so the JS thread never sees more than ~30 state updates per second.
  const lastUpdateMs = useSharedValue(0)
  const MIN_UPDATE_MS = 33

  // Single JS-thread setter — collapses lambda/phi/scale into one setState
  // so we render once per gesture frame instead of three times.
  const commitView = (lambda: number, phi: number, scaleValue?: number) => {
    setView(prev => ({
      lambda,
      phi,
      scaleValue: scaleValue ?? prev.scaleValue,
    }))
  }

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startLambda.value = lambda
      startPhi.value = phi
      runOnJS(setIsGesturing)(true)
    })
    .onChange(e => {
      const now = Date.now()
      if (now - lastUpdateMs.value < MIN_UPDATE_MS) return
      lastUpdateMs.value = now

      const sensitivity = 90 / scaleValue
      const newLambda = startLambda.value + e.translationX * sensitivity
      const newPhi = clamp(
        startPhi.value - e.translationY * sensitivity,
        -90,
        90,
      )
      runOnJS(commitView)(newLambda, newPhi, undefined)
    })
    .onEnd(() => {
      runOnJS(setIsGesturing)(false)
    })

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scaleValue
      runOnJS(setIsGesturing)(true)
    })
    .onChange(e => {
      const now = Date.now()
      if (now - lastUpdateMs.value < MIN_UPDATE_MS) return
      lastUpdateMs.value = now

      const minScale = size / 2.5
      const maxScale = size * 3
      const newScale = clamp(startScale.value * e.scale, minScale, maxScale)
      runOnJS(commitView)(lambda, phi, newScale)
    })
    .onEnd(() => {
      runOnJS(setIsGesturing)(false)
    })

  const composed = Gesture.Simultaneous(panGesture, pinchGesture)

  const noun = (n: number, singular: string, plural: string) =>
    `${n} ${n === 1 ? singular : plural}`

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Defs>
              <ClipPath id="profile-globe-clip">
                <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} />
              </ClipPath>
            </Defs>

            <Circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 1}
              fill={OCEAN}
              stroke={OCEAN_BORDER}
              strokeWidth={1}
            />

            <G clipPath="url(#profile-globe-clip)">
              {graticulePath ? (
                <Path
                  d={graticulePath}
                  fill="none"
                  stroke={GRATICULE}
                  strokeOpacity={0.12}
                  strokeWidth={0.5}
                />
              ) : null}
              {baseLandPath ? (
                <Path
                  d={baseLandPath}
                  fill={LAND}
                  stroke={BORDER}
                  strokeWidth={0.3}
                />
              ) : null}
              {highlightedPath ? (
                <Path
                  d={highlightedPath}
                  fill={LAND_SURFED}
                  stroke={BORDER}
                  strokeWidth={0.4}
                />
              ) : null}
            </G>
          </Svg>
        </View>
      </GestureDetector>

      <View style={styles.legendRow}>
        <View style={styles.legendSwatch} />
        <Text style={styles.legendText}>
          {noun(surfedAdmin1s.length, 'region', 'regions')} in{' '}
          {noun(surfedCountries.length, 'country', 'countries')}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: LAND_SURFED,
  },
  legendText: {
    fontFamily: 'Helvetica Neue',
    fontSize: 12,
    color: MUTED,
    letterSpacing: 0.4,
  },
})
