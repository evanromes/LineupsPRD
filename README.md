# Lineups — PRD & Engineering Reference

> "every break, remembered"

Lineups is a surf session tracking app. Users log surf sessions, rate breaks, and share with other surfers. Think Beli for surfing.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript (strict) |
| Routing | expo-router (file-based) |
| Backend | Supabase (auth, database, storage) |
| Target | iOS, Android, Web |

---

## Theming Architecture

Lineups supports **light and dark mode** with a user-controlled toggle (defaults to system preference). The infrastructure is set up and ready — screens are migrated to it incrementally as functionality stabilises.

### How it works

```
constants/colors.ts      — semantic color token objects (darkTheme, lightTheme, brand)
context/ThemeContext.tsx  — React Context, toggle function, AsyncStorage persistence
```

The user's preference is persisted to `AsyncStorage` under the key `@lineups_theme`. On first launch it defaults to the device system preference (`useColorScheme()`).

### Token structure (`constants/colors.ts`)

Each theme exports an object with identical keys but different values:

| Token | Dark value | Light value |
|---|---|---|
| `background` | `#0B2230` | `#F5EDE0` |
| `cardBackground` | `#0F2838` | `#EDE0CC` |
| `titleText` | `#E8D5B8` | `#2A1A08` |
| `subtext` | `#4A7A87` | `#A8845A` |
| `borderPrimary` | `#E8D5B8` | `#C5A882` |
| `placeholder` | `#4A7A87` | `#C5A882` |
| `ctaBackground` | `#1B7A87` | `#1B7A87` |
| `followBorder/Text` | `#3CC4C4` | `#1B7A87` |
| `typePillBackground` | `rgba(83,74,183,0.2)` | `#EEEDFE` |
| `dirPillBackground` | `rgba(15,110,86,0.2)` | `#E1F5EE` |

A separate `brand` object holds colors that never change between themes (`teal`, `aqua`, `cream`, `purple`, etc.).

### Using the theme in a component

```tsx
import { useTheme } from '../context/ThemeContext'
import { StyleSheet } from 'react-native'
import type { Theme } from '../constants/colors'

export default function MyScreen() {
  const { theme } = useTheme()
  const styles = getStyles(theme)

  return <View style={styles.container} />
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    container: { backgroundColor: theme.background },
    title: { color: theme.titleText },
  })
}
```

The key pattern: **replace `StyleSheet.create({...})` at module scope with a `getStyles(theme)` function called inside the component**, so styles are recomputed when the theme changes.

### Wiring the provider

`ThemeProvider` needs to wrap the root of the app in `app/_layout.tsx` (or equivalent):

```tsx
import { ThemeProvider } from '../context/ThemeContext'

export default function RootLayout() {
  return (
    <ThemeProvider>
      {/* rest of app */}
    </ThemeProvider>
  )
}
```

### Toggle UI

A toggle switch (to be added to the Profile screen settings) calls:
```tsx
const { toggleTheme, themeType } = useTheme()
// themeType is 'light' | 'dark'
```

### Migration status

Screens are migrated to theme tokens incrementally. Until a screen is migrated, it uses hardcoded hex strings and will not respond to the toggle.

| Screen | Migrated |
|---|---|
| All onboarding screens | — pending |
| Tab screens (map, feed, journal, breaks, profile) | — pending |

---

## Design System

### Color Palette (Reef)
| Token | Hex | Usage |
|---|---|---|
| Teal | `#1B7A87` | Primary CTAs, active nav, filled buttons |
| Deep Teal | `#0F5A65` | Hover states, icon inner block |
| Aqua | `#3CC4C4` | Visited pins, active elements, selected states |
| Cream | `#E8D5B8` | Text on dark backgrounds |
| Sand | `#C5A882` | Borders, secondary text |
| Dark Brown | `#2A1A08` | Body text on light screens |
| Navy | `#0B2230` | Dark screen backgrounds, map |
| Purple | `#7F77DD` | Favourite pins, favourite indicators |

### Typography
- **Display / headings:** Georgia, bold — `fontSize: 38` for primary titles
- **UI / body:** Helvetica Neue, light (300) and regular (400/500)
- **Section labels:** Helvetica Neue 300, `fontSize: 9–10`, `letterSpacing: 2`, uppercase

### Screen Themes
- **Dark screens** (onboarding steps 1–6): `#0B2230` background, `#E8D5B8` text, `#4A7A87` subtext
- **Light screens** (social steps, feed, profile): `#F5EDE0` background, `#2A1A08` text, `#A8845A` subtext
- The onboarding flow starts dark and transitions to warm sand at the contacts/friends step.

### Progress Dots
- Total: 5 dots
- Inactive: 9×9px, `#D8C8B0`
- Done: 9×9px, `#3CC4C4`
- Active: 24×9px pill, `#1B7A87`
- Gap: 6px between dots

---

## Onboarding Flow

### Screen Order

```
splash → login → profile (name) → profile (username) → stance (experience)
→ stance-screen (regular/goofy) → board → homebreak → contacts → friends → history → done
```

### Screen-by-screen Reference

#### 1. `splash.tsx`
Entry point. Displays the Lineups logo and transitions to login.

#### 2. `(auth)/login.tsx`
Supabase email/password auth. On success, routes to `/onboarding/profile`.

#### 3. `onboarding/profile.tsx` — *"What's your name?"* + *"Choose a username"*
Two sub-steps within a single file, controlled by `step: 1 | 2` state.

- **Step 1:** First name + last name inputs. 92×92px avatar circle with `+` badge (photo picker via `expo-image-picker`).
- **Step 2:** Username field with `@` prefix, real-time availability check (debounced 400ms), `available` / `taken` / `checking` indicator.
- Saves `display_name`, `username`, and `email` to `profiles` on completion.
- Routes to `/onboarding/stance`.

**Decision:** Email is stored on the profile (not just in `auth.users`) so it can be used for contacts matching on the friends screen without requiring a server-side function.

#### 4. `onboarding/stance.tsx` — *"What's your experience level?"*
Four option cards: **Beginner / Intermediate / Advanced / Pro**. Radio button selection. Saves `experience_level` to `profiles`. Routes to `/onboarding/stance-screen`.

#### 5. `onboarding/stance-screen.tsx` — *"What's your stance?"*
Three option cards: **Regular / Goofy / N/A**. `null` is a valid selection (N/A — surfs both or no preference). Saves `stance` to `profiles`. Routes to `/onboarding/board`.

**Decision:** `undefined` = nothing chosen yet (button disabled); `null` = N/A explicitly selected (button enabled). This avoids treating N/A as an unset state.

#### 6. `onboarding/board.tsx` — *"What's your board of choice?"*
Six option cards: **Shortboard / Mid-Length / Longboard / SUP / Foil / N/A**. Each card includes a custom SVG board silhouette icon (see `BoardIcon` component). Saves `preferred_board` to `profiles`. Routes to `/onboarding/homebreak`.

**Decision:** N/A means "rides multiple boards or no preference" — stored as `null`, not hidden.

#### 7. `onboarding/homebreak.tsx` — *"What's your home break?"*
Debounced search (300ms) with two parallel queries:
- `.ilike('name', '%term%')` — name match
- `.ilike('region', '%term%')` — region match (e.g. typing "Fiji" surfaces Cloudbreak, Restaurants, Swimming Pools, etc.)

Results are merged and deduplicated by `id`. Selecting a break shows a card with the break name, region subtext, and type/direction pills stacked on the right. Saves `home_break` (break name string) to `profiles`. Routes to `/onboarding/contacts`.

**Decision:** Home break is stored as the break's name string (not a foreign key) so it remains human-readable on the profile even if the break record changes.

#### 8. `onboarding/contacts.tsx` — *"Discover your friends already on Lineups"*
Requests `expo-contacts` permission. Two buttons:

- **Allow Contacts** — calls `Contacts.requestPermissionsAsync()`, then routes to `/onboarding/friends`.
- **Not now** — triggers a confirmation modal: *"Lineups is more fun when you follow your friends and see where they're surfing. Are you sure you want to skip this step?"* with **Allow Contacts** (dismisses modal) and **Skip anyway** (routes to friends).

**Decision:** The confirmation step exists to reduce accidental skips — contacts matching significantly improves the friends discovery experience.

**iOS config required** — add to `app.json` under `expo.ios.infoPlist`:
```json
"NSContactsUsageDescription": "Lineups uses your contacts to help you find friends already on the app."
```

#### 9. `onboarding/friends.tsx` — *"Find your crew"*
Three prioritized sections, loaded on mount in parallel:

| Section | Label | Logic |
|---|---|---|
| 1 | FROM YOUR CONTACTS | Reads device contacts emails via `expo-contacts`, queries `profiles.email`. Only shown if contacts permission was granted. |
| 2 | SURFERS NEAR YOUR HOME BREAK | Looks up current user's `home_break` → fetches its `region` from `breaks` table → finds all other profiles with a `home_break` in the same region. Excludes anyone in section 1. |
| 3 | SUGGESTED | Recent signups, excluding anyone shown above. |

Search (name or username) overlays the sections with a flat list. Follow/unfollow state is tracked in a single `Map` shared across all sections — changes reflect instantly everywhere.

#### 10. `onboarding/history.tsx` — *"Log your surf history"*
Displays breaks organized into **region sections**, with the user's home break region shown first. Other regions are sorted alphabetically; breaks with no region go into "Other" at the bottom.

Search bar supports both **name and region search** — runs two parallel queries (`.ilike('name', ...)` and lat/lng bounds matching via `REGIONS` bounds table) and merges results.

Break rating popup (bottom sheet) includes:
- Break name + region subtext
- "MY RATING" label with a live descriptor that updates as dots are selected: *Not worth it / Mediocre / Decent spot / Really good / Epic*
- "Mark as favourite" checkbox (purple fill when active)

After rating, the break card shows:
- Inline teal rating dots
- A purple dot + "Favourite" label if marked as favourite

#### 11. `onboarding/done.tsx`
Completion screen. Routes to the main app tab navigator.

---

## Database Changes

Two migrations are required beyond the initial schema. Both scripts live in `scripts/`.

### `scripts/add-region-column.sql`
Adds a `region TEXT` column to the `breaks` table and backfills it for all seeded breaks using `CASE WHEN` lat/lng bounds.

| Region | Lat range | Lng range |
|---|---|---|
| Los Angeles, CA | 33.75–34.15 | -119.1 to -118.35 |
| Orange County, CA | 33.35–33.75 | -118.15 to -117.45 |
| San Diego, CA | 32.5–33.35 | -118.0 to -117.0 |
| Santa Barbara, CA | 34.15–34.55 | -120.2 to -118.85 |
| Northern California | 36.5–38.2 | -122.7 to -121.8 |
| Oahu, HI | 21.2–21.75 | -158.2 to -157.75 |
| Maui, HI | 20.55–21.1 | -156.8 to -155.9 |
| Fiji | -18.1 to -17.7 | 177.0 to 177.35 |
| Portugal | 38.5–38.75 | -9.5 to -9.1 |
| Mexico | 17.7–18.9 | -104.1 to -101.5 |

**Decision:** Region is stored as a DB column rather than computed from lat/lng at runtime. This prevents coordinates from ever surfacing as region labels in the UI, and makes region-based queries possible directly in Supabase without client-side filtering.

### `scripts/add-email-to-profiles.sql`
Adds an `email TEXT` column to `profiles` and backfills from `auth.users`. New accounts write email to profiles during the profile creation step of onboarding.

**Decision:** Required for client-side contacts matching. Without storing email in `profiles`, there's no way to match device contacts against registered users without a server-side function.

---

## Key Dependencies Added

| Package | Purpose |
|---|---|
| `expo-contacts` | Read device contacts for friends discovery on the friends screen |
| `expo-image-picker` | Avatar photo selection on the profile screen |

---

## File Structure (Onboarding)

```
app/
  (auth)/
    splash.tsx         — entry / logo screen
    login.tsx          — Supabase email auth
  onboarding/
    profile.tsx        — name + username (2 sub-steps)
    stance.tsx         — experience level
    stance-screen.tsx  — regular / goofy / N/A
    board.tsx          — board type with SVG icons
    homebreak.tsx      — home break search (name + region)
    contacts.tsx       — contacts permission request + skip modal
    friends.tsx        — find your crew (3 prioritized sections)
    history.tsx        — log past sessions (region-grouped, rated)
    done.tsx           — completion

scripts/
  seed-breaks.sql              — initial breaks dataset
  add-region-column.sql        — migration: adds region to breaks
  add-email-to-profiles.sql    — migration: adds email to profiles
```

---

## Running the App

```bash
npm start          # Expo dev server (scan QR with Expo Go)
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run web        # Browser
```

No lint or test scripts are configured yet.
