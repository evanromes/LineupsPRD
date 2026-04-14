# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Lineups — Surf Session Tracker

## App overview
Lineups is a surf session tracking app. Users log surf sessions, 
rate breaks, and share with other surfers. Think Beli for surfing.

## Tagline
"every break, remembered"

## Design files
All screen mockups are in the /design folder:
- lineups_map_screen_v3.html — map screen with pin system
- lineups_breaks_list_v2.html — breaks list screen
- lineups_journal_screen.html — journal + log session form
- lineups_feed_and_privacy.html — social feed + privacy toggle
- lineups_profile_screen.html — profile screen
- lineups_onboarding_flow.html — full onboarding flow
- lineups_design_spec.docx — full design specification

## Color palette (Reef)
- Teal: #1B7A87 (primary, CTAs, active nav)
- Deep Teal: #0F5A65 (hover states, icon inner block)
- Aqua: #3CC4C4 (visited pins, active elements)
- Cream: #E8D5B8 (text on dark backgrounds)
- Sand: #C5A882 (borders, secondary text)
- Dark Brown: #2A1A08 (body text on light screens)
- Navy: #0B2230 (map background, dark cards)
- Purple: #7F77DD (favorite pins, favorite indicators)

## Typography
- Display/headings: Georgia serif, bold
- UI/body: Helvetica Neue, light (300) and regular (400)

## Screen themes
- Map screen: dark ocean (#0B2230)
- All interior screens: warm sand (#F5EDE0)
- Onboarding: starts dark, transitions to light

## Navigation tabs (5)
Map → Breaks → Journal → Feed → Profile

## Supabase tables
- profiles, breaks, sessions, session_photos
- follows, wishlist, break_ratings
- Connection file: lib/supabase.ts

## Key design patterns
- Dot ratings (5 circles, teal filled / sand outlined) — no stars
- Three map pin types: teal (visited), purple (favorite), sand (wishlist)
- Public/private toggle on every session
- Break type pills: purple tint (#EEEDFE bg, #534AB7 text)
- Direction pills: green tint (#E1F5EE bg, #0F6E56 text)

## Commands

```bash
# Start dev server (choose platform)
npm start          # Expo dev server (scan QR with Expo Go)
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run web        # Browser
```

No lint or test scripts are configured yet.

## Architecture

**Stack:** React Native + Expo (v54) + TypeScript (strict), targeting iOS/Android/Web. Uses Expo's New Architecture.

**Routing:** expo-router (file-based routing). Screens go in an `app/` directory following the expo-router convention — `app/index.tsx` is the root, `app/(tabs)/` for tab groups, etc. The `app/` directory does not exist yet; the project is still at the boilerplate stage.

**Backend:** Supabase (`lib/supabase.ts`) — provides auth, database, and storage. The client is pre-configured with AsyncStorage for session persistence. Import `supabase` from `lib/supabase` wherever data access is needed.

**Planned screens** (see `design/` for HTML mockups):
- Onboarding flow (splash → sign-up → preferences → friends)
- Map screen — location-based features with react-native-maps
- Journal screen — activity logging with dot ratings and session chips
- Breaks list — interval/break tracking
- Profile screen

**Design system** (derived from mockups):
- Dark background: `#060F14`, card bg: `#0F2D3A`, teal accent: `#3CC4C4` / `#1B7A87`
- Light variant bg: `#FEFAF5`, warm tan: `#EDE0CC`, text: `#E8D5B8`
- Typography: Georgia (serif) for body/inputs, Helvetica Neue for labels/buttons
