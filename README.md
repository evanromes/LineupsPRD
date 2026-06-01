# Lineups — PRD & Engineering Reference

> "every break, remembered"

Lineups is a surf session tracking app. Users log surf sessions, rate breaks, and share with other surfers. Think Beli for surfing.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript (strict) |
| Routing | expo-router (file-based) |
| Backend | Supabase (auth, Postgres, storage, RLS) |
| Maps | `react-native-maps` + `react-native-map-clustering` |
| SVG / Graphics | `react-native-svg` (board icons, wordmark, globes) |
| Gestures | `react-native-gesture-handler` + `react-native-reanimated` + `react-native-worklets` |
| Geo (globe feature) | `d3-geo`, `topojson-client`, `mapshaper` (build-step CLI) |
| Target | iOS, Android, Web |

---

## Theming Architecture

Lineups uses a **dark navy** theme throughout. The infrastructure for a user-controlled light/dark toggle exists but screens are migrated incrementally.

### Color Palette (Reef)
| Token | Hex | Usage |
|---|---|---|
| Teal | `#1B7A87` | Primary CTAs, active nav, filled buttons |
| Deep Teal | `#0F5A65` | Hover states |
| Aqua | `#3CC4C4` | Active elements, selected states, slider/dot fill |
| Cream | `#E8D5B8` | Primary text on dark backgrounds |
| Sand | `#C5A882` | Borders, secondary text, wind chip accent |
| Dark Brown | `#2A1A08` | Body text on light screens |
| Navy | `#0B2230` | Dark screen backgrounds, map |
| Card Navy | `#0F2838` | Card/sheet backgrounds |
| Purple | `#7F77DD` | Favourite pins, favourite indicators |
| Purple Tint | `rgba(83,74,183,0.2)` / `#9B95E8` | Break type pills, crowd factor chips |
| Green Tint | `rgba(15,110,86,0.2)` / `#3CC4C4` | Wave direction pills |

### Typography
- **Display / headings:** Georgia, bold — `fontSize: 38` for onboarding, `26–34` for session flow
- **UI / body:** Helvetica Neue, light (300) and regular (400/500)
- **Section labels:** Helvetica Neue 300, `fontSize: 9–11`, `letterSpacing: 1.5–2`, uppercase

### Screen Themes
- **Dark screens** (all tab screens, session logging, onboarding steps 1–6): `#0B2230` background, `#E8D5B8` text, `#4A7A87` subtext
- **Onboarding social steps** (contacts, friends): warm sand — transitions from dark to light mid-flow

---

## Navigation Tabs (5)

```
Feed → Breaks → Map → Search → Profile
```

Tab bar: `#060F14` bg, `#3CC4C4` active, `#2A5A65` inactive, height 80.
Breaks tab uses a custom SVG wave icon (two wave Bezier paths).

`Search` provides cross-user discovery (find surfers, breaks). Replaced an earlier `Journal` tab; logging happens directly from map callouts and break detail pages now.

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
- **Step 1:** First name + last name inputs. 92×92px avatar circle with `+` badge.
- **Step 2:** Username field with real-time availability check (debounced 400ms).
- Saves `display_name`, `username`, `email` to `profiles`.

#### 4. `onboarding/stance.tsx` — *"What's your experience level?"*
Four option cards: **Beginner / Intermediate / Advanced / Pro**. Saves `experience_level`.

#### 5. `onboarding/stance-screen.tsx` — *"What's your stance?"*
Three option cards: **Regular / Goofy / N/A**. `null` = N/A (valid selection). Saves `stance`.

#### 6. `onboarding/board.tsx` — *"What's your board of choice?"*
Seven option cards stacked vertically, each containing a board-silhouette SVG icon on the left and a large label. Cards are sized to fill the available vertical space so the Continue button rests at the bottom — no scrolling needed.

| Option | Value | Icon |
|---|---|---|
| Shortboard | `shortboard` | Narrow ellipse |
| Mid-Length | `mid-length` | Medium ellipse with stringer |
| Longboard | `longboard` | Wide tall ellipse with stringer |
| Gun | `gun` | Pointed teardrop path |
| SUP | `sup` | Wide ellipse + paddle line |
| Foil | `foil` | Short ellipse + mast + wings |
| N/A | `null` | No icon |

**Decision:** All cards show only the label (20pt Georgia bold). Earlier per-board descriptions were dropped — the screen heading already establishes we're asking *about the user's board*, so per-card copy read like recommendations and added noise. Only N/A keeps a one-line subtitle ("*No preference — won't show on your profile*") because that option's behavior is non-obvious.

Card style: unselected `rgba(42,26,8,0.35)` bg / `rgba(197,168,130,0.4)` border / `#C5A882` label. Selected `#0F4E63` bg / `#3CC4C4` border / `#3CC4C4` label. Icon size 28×53. Radio button right-aligned.

`BoardIcon` accepts optional `width` / `height` props and is exported so it can be reused at smaller sizes elsewhere (e.g. on the profile surfer meta row).

Saves `preferred_board` to `profiles`. Routes to `/onboarding/homebreak`.

#### 7. `onboarding/homebreak.tsx` — *"What's your home break?"*
Debounced search (300ms) across `name` and `region` columns. Saves `home_break` as break name string.

#### 8. `onboarding/contacts.tsx`
Contacts permission request with skip confirmation modal.

#### 9. `onboarding/friends.tsx` — *"Find your crew"*
Three prioritized sections: contacts matches → home break region → suggested.

#### 10. `onboarding/history.tsx` — *"Log your surf history"*
Region-grouped break list. Rating popup with 5 dot rating + "Mark as favourite" + `🏄 Favorite` pill on rated breaks.

#### 11. `onboarding/done.tsx`
Routes to main tab navigator.

### Progress Dots (onboarding)
- Total: 5 dots
- Inactive: 9×9px, `#1B5A6A`
- Done: 9×9px, `#3CC4C4`
- Active: 23×9px pill, `#E8D5B8` (dark screens) / `#1B7A87` (light screens)

---

## Session Logging Flow

Accessed via **"Log session"** on the map callout (for rated breaks) or after **"Rate break"** on unrated breaks.

### Rate Break → Log Session (map)

When a user taps a pin on the map:
- **Unrated break** → callout shows **"Rate break"** button
- **Rated break** → callout shows **"Log session"** button

**Rate Break modal** (dark bottom sheet, slides up from map):
- Step 1: Break name + *"What would you rate this break out of 5?"* (31px Georgia bold, cream) + 5 teal dot rating + "Mark as favorite" toggle card (dark navy) + Next / Cancel
- Step 2: *"Would you like to log your session?"* + **"Yes, log session →"** (saves rating, awaits Supabase write, then navigates to log-session) + **"No thanks"** (saves rating only)

**Decision:** Rating is saved to `break_ratings` and awaited before navigating, so `log-session` always finds the record and correctly skips the break rating step.

### Log Session Screen (`app/log-session.tsx`)

Presented as `transparentModal` with `cardStyle: { backgroundColor: 'transparent' }` so the map is visible behind bottom-sheet steps.

**5 steps total.** Progress: 5 dots (dot 1 pre-filled for returning visitors).

---

#### Step 1 — Rate the Break *(first visit only)*
Full-screen dark navy. Shown only when no `break_ratings` record exists for this break.
- Break name context line (italic teal)
- *"How would you rate this break?"* heading
- 5 × 44px dot rating (teal filled / `#1B5A6A` empty border)
- Descriptor label (Not worth it → Epic)
- "Mark as a favorite" toggle card (`#0F2838` bg)
- Next → / Skip

**Decision:** Returning visitors (`isFirstVisit === false`) start at step 2; dot 1 is shown as done.

---

#### Step 2 — How was your surf? *(half-screen bottom sheet)*
Transparent outer + `#0F2838` sheet rising to **52% of screen height**. Map visible above.
- Date context line (italic teal, 21px)
- *"How was your surf?"* heading (34px Georgia bold, cream)
- Session count line for returning visitors (italic teal, 14px)
- **Horizontal drag slider 1–10:** draggable thumb + tappable number labels below. Initialized at **5**. Track fill teal, empty track `#1B3A45`. Numbers 1–10 shown below; active number highlighted teal bold (13px).
- Descriptor label (Rough one → One for the books, italic teal, 21px)
- Next → (disabled/greyed until rating selected) / Cancel (exits flow)

**Decision:** Rating required to advance — Next is non-tappable until slider moves. Default value 5 positions the thumb at center on load. Numbers are tappable to jump the slider.

---

#### Step 3 — What board did you ride? *(natural-height bottom sheet)*
Transparent outer + `#0F2838` sheet sized to content. Map visible above.
- *"What board did you ride?"* heading
- 7 board cards (same style as onboarding, slightly compact: 17px label, 28×52px icon)
- **Inline notes field** appears directly below the selected card (not at bottom of list): `#0B2230` bg, italic Georgia 15px, board-specific placeholder text

| Board | Notes placeholder |
|---|---|
| Shortboard | `e.g. 5'8 Al Merrick` |
| Mid-Length | `e.g. 7'6 Pyzel Mid` |
| Longboard | `e.g. 9'2 Noserider` |
| Gun | `e.g. 9'6 Stretch Gun` |
| SUP | `e.g. 10'6 Race board` |
| Foil | `e.g. Armstrong CF1200` |
| Other | `e.g. Mixed quiver` |

**Decision:** N/A renamed to "Other" in the session flow. Board type + notes combined into the `sessions.board` column as `"Shortboard — 5'8 Al Merrick"` on save. Notes field only appears after a board is selected.

---

#### Step 4 — How were the conditions? *(natural-height bottom sheet)*
Transparent outer + `#0F2838` sheet sized to content. Map visible above.
- *"How were the conditions?"* heading
- **SWELL SIZE** — label `#3CC4C4` (teal). Chips: selected `#1B7A87` bg / `#3CC4C4` border / `#E8D5B8` text
- **WIND** — label `#C5A882` (sand/brown). Chips: inactive `rgba(197,168,130,0.28)` border / `#7A5C42` text; selected `rgba(197,168,130,0.18)` bg / `#C5A882` border + text
- **CROWD FACTOR** — label `#9B95E8` (purple). Chips: selected `rgba(83,74,183,0.2)` bg / `#534AB7` border / `#9B95E8` text
- Next → / Skip

**Decision:** Each condition category has a distinct color accent (teal / sand-brown / purple) to visually separate them. SWELL SIZE label color matches its selected chip border.

---

#### Step 5 — Set the Scene *(full-screen dark)*
Full-screen dark navy with standard header + progress dots.
- SURFED WITH — text input
- NOTES — multiline italic text input
- PHOTOS — horizontal scroll with add button
- Public/Private toggle (`#1B7A87` on / `#1B3A45` off)
- Save session CTA

---

### Chip Rows (shared component)
`ChipRow` accepts `selectedBg`, `selectedBorderColor`, `selectedTextColor`, `inactiveBorderColor`, `inactiveTextColor` — allowing per-section color theming without separate components.

---

## My Breaks Page (`app/(tabs)/breaks.tsx`)

### Layout
- **Top bar:** username (left, `#E8D5B8`, 14px) | Lineups wordmark (center) | share icon (right)
- **Tabs:** Visited / Favorites / Wishlist / All — sliding underline indicator (Animated spring)
- **Search bar:** searches by break name OR region
- **Filter button:** opens bottom sheet; teal tint + badge count when active

### Break Rows
Flat rows (no card chrome), separated by `borderBottomWidth: 0.5` lines.
- Rank: 22px Georgia bold cream
- Break name: 17px Georgia bold cream
- Region subtext: 12px Helvetica teal
- Rating dots: 9×9px teal/empty
- `🏄 Favorite` pill: `rgba(127,119,221,0.15)` bg, `#7F77DD` text (shown instead of purple dot)

### Filter Sheet
- **Min rating:** 5 interactive 22px dots (tap to select/deselect)
- **Sessions logged:** `1-5`, `6-15`, `16-50`, `50+`
- **Break type:** inactive dark, selected purple tint (`rgba(83,74,183,0.2)` / `#9B95E8`)
- **Wave direction:** inactive dark, selected green tint (`rgba(15,110,86,0.2)` / `#3CC4C4`)
- Draft state — changes only apply on "Apply Filters"
- Region filter removed (use search bar instead)

---

## Profile Page (`app/(tabs)/profile.tsx`)

`ProfileScreen` powers two routes:
- `(tabs)/profile` — own profile (read from `auth.getSession()`)
- `/user-profile?userId=…` — another user's profile (re-exports the same component; the Profile *tab* never gets hijacked by another user's `userId` param)

### Top bar
- Back chevron (other-user view only) | Lineups wordmark center | Settings gear (own view only)

### Profile card (`#0F2838` bg)
- **Username:** centered above the avatar/stats row (Georgia bold, no @ symbol)
- **Left column:** 83 × 83 avatar circle (initial centered) + display name below
- **Right column:**
  - Stats row — **SESSIONS / BREAKS / COUNTRIES** (25pt Georgia bold cream values, 13pt muted-teal labels). `SESSIONS` counts the user's logged sessions; `BREAKS` and `COUNTRIES` derive from `break_ratings` rows so the numbers match what the Breaks tab shows.
  - **SpinningGlobe** — auto-rotating ~60 px globe centered beneath the stat numbers. Decorative (no user data), tappable → navigates to `/surfed-globe`.
- **Bio + surfer meta row** — between bio text and the follower counts. Three small icon + label items separated by `·`:
  - `BoardIcon` + preferred board (Shortboard / Mid-Length / …)
  - `footsteps-outline` + Regular / Goofy
  - `location-outline` + home break name
  - Each item omitted entirely if its field is null; home break uses `flexShrink:1` + `numberOfLines={1}` so long names ellipsize cleanly.
- **Follower row** — `<n> followers` / `<n> following` are tappable, push to `/follows-list?userId=…&type=followers|following`. "Member since Mon YYYY" right-aligned.
- **Action button** — own profile shows full-width *Edit Profile* (placeholder). Other-user view shows side-by-side Follow / Message.

### Tabs
**Breaks · Sessions · Wishlist** with the same sliding underline indicator as the Breaks tab.
- **Breaks** — region-grouped list. Groups by `admin1` (state/province) when populated, falling back to `country` with a small alias map (`United States of America` → `USA`, etc.). Each row: rank, break name, region subtitle, type + direction pills, optional avg-session-rating chip, dot rating, optional `🏄 Favorite` pill.
- **Sessions** — flat list of logged sessions grouped by month (`MAY 2026 · 4`). Each row: date · break name · swell · duration · `X/10` rating in teal. Tap → break detail.
- **Wishlist** — same row treatment as Breaks but without ratings.

### Sign-out
- Sticky footer outside the `ScrollView` (own profile only). The ScrollView is `flex:1` and the footer renders as a sibling so it remains anchored at the bottom of the available area regardless of scroll position.

### Other-user navigation
- Tapping a session author on the feed and rows on `follows-list` push to `/user-profile` (not the Profile tab) so the Profile tab params never get rewritten.

---

## Travels Globe

The interactive globe that shows the regions a user has surfed in. Reached by tapping the spinning globe on the profile card.

### Two components

**`components/SpinningGlobe.tsx`** — decorative, 60 px, auto-rotates at ~14°/sec via `setInterval` (~12 fps). Renders only `admin0` country outlines in muted teal (`#1B5A65`) — same view for every user, no per-user data. Lives in the profile card's right column.

**`components/ProfileGlobe.tsx`** — full-screen interactive view at `/surfed-globe`. Drag-to-rotate (pan gesture) + pinch-to-zoom built with `react-native-gesture-handler` + `react-native-reanimated` worklets. Gesture-start snapshots use `useSharedValue` (not refs) because Reanimated worklets serialize captured objects; refs trigger `[Worklets] Tried to modify key 'current'` warnings and undefined behavior.

### Data pipeline

Highlighted regions are derived per-user from `sessions → breaks → (country, admin1)`:

1. **Schema:** `breaks` table has nullable `country TEXT` and `admin1 TEXT` columns (Natural Earth admin1 `name` and `admin` respectively, e.g. `California` / `United States of America`).
2. **Backfill:** `scripts/backfill-break-geography.js` runs once locally with a service-role key. For each break, point-in-polygon test against the vendored admin1 GeoJSON; falls back to admin0, then to nearest-centroid within 1000 km for offshore reef breaks (Pipeline at lat/lng 1 km off Oahu wouldn't match `geoContains` on the simplified coastline).
3. **Read path:** Profile screen and `/surfed-globe` derive `surfedAdmin1s` / `surfedCountries` from the user's sessions and pass them to `ProfileGlobe` as props.

### Vendored topology files

| File | Contents | Use |
|---|---|---|
| `assets/world/admin0.json` | TopoJSON, ~250 country outlines, 10% retention, ~900 KB | Idle base for unsurfed countries |
| `assets/world/admin1.json` | TopoJSON, ~4,600 state/province outlines, 12% retention, ~12 MB | Idle base for surfed countries (so state borders appear where the user has been) + the highlight layer (surfed states in aqua) |
| `assets/world/continents.json` | TopoJSON, ~7 features dissolved by `CONTINENT`, 15% retention, ~tiny | Base layer during pan/pinch — minimal feature count means the JS thread can re-project every frame without bridge backpressure |
| `assets/world/*.geojson.bak` | Original full-resolution Natural Earth GeoJSON | Source for re-running the simplifier; not bundled |

All three files come from `nvkelso/natural-earth-vector` and are processed by `scripts/simplify-world.sh` via `mapshaper` CLI (Visvalingam-weighted simplification + TopoJSON conversion + 1e4 quantization). Re-run the script if Natural Earth data updates or different simplification tradeoffs are desired.

### Render-time perf strategy

| State | Base layer | Features rendered |
|---|---|---|
| Idle | admin0 for unsurfed countries + admin1 for surfed countries (skipping highlighted states) | ~300 |
| Gesture active | Continents only (no country borders) | ~7 |

Other techniques applied:
- **One `<Path>` per layer** — all features in a layer combined into a single concatenated `d` string. Cuts `react-native-svg` reconciliation cost vs. one Path per feature.
- **Front-hemisphere cull** — cheap spherical-law-of-cosines check on precomputed centroids skips back-facing features before calling `geoPath`.
- **Combined state setter + 30 fps throttle** — gesture frames update `{lambda, phi, scaleValue}` as one object via a single `runOnJS(commitView)`, gated by a `lastUpdateMs` sharedValue.
- **Graticule (10° lat/lng grid)** stays visible during drag — single geometry, one `geoPath` call regardless of line count.

### Routes
- `/surfed-globe?userId=…` — full-screen interactive globe. Re-queries the user's sessions on mount so it works for self and other-user views identically.

### Setup notes

The root `_layout.tsx` wraps the Stack in `<GestureHandlerRootView style={{ flex: 1 }}>`. Without it `GestureDetector` throws *"must be used as a descendant of GestureHandlerRootView"*. The `flex: 1` is non-negotiable — without it the whole UI collapses.

`react-native-worklets` is a peer dependency of `react-native-reanimated@4` and must be installed explicitly (`npx expo install react-native-worklets`). Without it the bundler errors at `Unable to resolve "react-native-worklets" from "node_modules/react-native-reanimated/src/initializers.ts"`.

---

## Feed Page (`app/(tabs)/feed.tsx`)

Dark navy theme:
- Cards: `#0F2838` bg, `rgba(74,122,135,0.3)` border
- Break name / display name: `#E8D5B8`; username / timestamp / excerpt: `#4A7A87`
- Rating dots: `#3CC4C4` filled / `#1B5A6A` empty border
- Type pills: `rgba(83,74,183,0.2)` / `#9B95E8`; Direction pills: `rgba(15,110,86,0.2)` / `#3CC4C4`
- Like icon: `#3CC4C4` active / `#4A7A87` inactive

---

## Map Page (`app/(tabs)/map.tsx`)

### Pin Types
| Status | Fill | Stroke |
|---|---|---|
| Visited | `#3CC4C4` | `#E8D5B8` |
| Favorite | `#7F77DD` | `#CECBF6` |
| Wishlist | `#C5A882` | `#E8D5B8` |
| Unvisited | `#4A2D0E` | `#C5A882` (0.75 opacity) |
| Custom | `#0B2230` | `#E8D5B8` (dashed) |

### Callout Card
- Shows break name, type, status pill, break type + direction pills, stats (sessions / break rating dots / avg session)
- **"Rate break"** shown when `calloutStats.breakRating === null`
- **"Log session"** shown when break is already rated
- "View break" secondary CTA (placeholder)

### Pin Drop
FAB (bottom right) enters pin drop mode. Tap map to place pin. Form sheet collects name, break type, wave direction, coordinates. CTAs: "Save & log session" / "Save pin only".

---

## Database

### Tables
- `profiles` — `username`, `display_name`, `bio`, `email`, `avatar_url`, `home_break`, `home_break_id`, `experience_level`, `experience` (legacy, unused), `stance`, `preferred_board`, `created_at`
- `breaks` — `id`, `name`, `lat`, `lng`, `type`, `direction`, `region`, `country`, `admin1`, `is_custom`, `created_by`
- `sessions` — `user_id`, `break_id`, `date`, `rating`, `swell_size`, `wind`, `crowd_factor`, `board`, `duration_minutes`, `surfed_with`, `tagged_user_ids`, `notes`, `is_public`
- `session_photos` — `session_id`, `user_id`, `url`, `storage_path`
- `break_ratings` — `user_id`, `break_id`, `rating`, `approx_sessions`, `is_favorite`
- `follows` — `follower_id`, `following_id`
- `wishlist` — `user_id`, `break_id`

### Column Notes
- `profiles.experience` is a legacy column kept for back-compat; current onboarding writes `experience_level`. Safe to drop on next schema cleanup.
- `breaks.country` / `breaks.admin1` are populated by `scripts/backfill-break-geography.js` from the vendored Natural Earth GeoJSON (see Travels Globe section). Country uses the Natural Earth `NAME` / `admin` long form (e.g. `United States of America`). UI applies a small alias map for display.
- `breaks.region` predates the country/admin1 columns and is left in place; the app now reads `admin1`/`country` for region groupings.

### Migrations Applied / Required
```sql
-- Profile onboarding columns (added during this work)
ALTER TABLE profiles ADD COLUMN preferred_board TEXT;
ALTER TABLE profiles ADD CONSTRAINT profiles_preferred_board_check
  CHECK (preferred_board IS NULL OR preferred_board IN
    ('shortboard','mid-length','longboard','gun','sup','foil'));
ALTER TABLE profiles ADD COLUMN home_break TEXT;
ALTER TABLE profiles ADD COLUMN experience_level TEXT;
ALTER TABLE profiles ADD CONSTRAINT profiles_experience_level_check
  CHECK (experience_level IS NULL OR experience_level IN
    ('beginner','intermediate','advanced','expert'));

-- Travels Globe columns on breaks
ALTER TABLE breaks ADD COLUMN country TEXT;
ALTER TABLE breaks ADD COLUMN admin1 TEXT;

-- Earlier scripted migrations (still required)
scripts/add-region-column.sql
scripts/add-email-to-profiles.sql

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  crowd_factor text CHECK (crowd_factor IN ('empty','moderate','crowded','zoo'));
```

### Row-Level Security

Existing policies on `break_ratings` and `wishlist` were ownership-only (`auth.uid() = user_id`), which meant other users' rated/wished breaks appeared as zero counts on their public profiles. Added permissive SELECT policies so social profile views work:

```sql
CREATE POLICY "break_ratings_select_all"
  ON break_ratings FOR SELECT USING (true);

CREATE POLICY "wishlist_select_all"
  ON wishlist FOR SELECT USING (true);
```

Writes remain owner-only via the pre-existing `ALL` policies (Postgres OR-combines SELECT policies, so the permissive SELECT here doesn't unlock writes).

`profiles` has two redundant `SELECT USING (true)` policies (`Profiles are viewable by everyone` + `Authenticated users can read profiles`). Safe to consolidate into one on next cleanup.

### Onboarding Write Hygiene

Every onboarding `.update()` call now destructures `{ error }` from the supabase response and logs failures via `console.error('[onboarding/<screen>] failed to save <field>:', error)`. Previously silent — exposed the original "columns don't exist, data is silently dropped" problem only when we tried to surface the fields on the profile. Don't write to `profiles` without this pattern.

### Region Bounds (for `add-region-column.sql`)
| Region | Lat | Lng |
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

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | Auth, Postgres queries, RLS |
| `expo-contacts` | Read device contacts for friends discovery |
| `expo-image-picker` | Avatar + session photo selection |
| `expo-camera`, `expo-media-library` | Session photo capture / storage |
| `expo-router` | File-based navigation |
| `react-native-maps`, `react-native-map-clustering` | Map view + pin clustering |
| `react-native-svg` | Board icons, Lineups wordmark, globe rendering |
| `react-native-gesture-handler` | Pan/pinch on the full globe; required `GestureHandlerRootView` wrap at root layout |
| `react-native-reanimated` + `react-native-worklets` | Gesture worklets + shared values for the globe; worklets must be installed explicitly with reanimated v4 |
| `d3-geo` | Orthographic projection, path generation, point-in-polygon (backfill) |
| `topojson-client` | Unwrap vendored TopoJSON to GeoJSON at module load |
| `@expo/vector-icons` | Ionicons tab and UI icons |
| `mapshaper` *(dev / build only, via `npx`)* | One-shot simplification + TopoJSON conversion of the world topology |

---

## File Structure

```
app/
  (auth)/
    splash.tsx          — entry / logo screen
    login.tsx           — Supabase email auth
  (tabs)/
    _layout.tsx         — tab bar config, WaveIcon for Breaks tab
    feed.tsx            — social feed (dark theme)
    breaks.tsx          — my breaks list with filter sheet
    map.tsx             — map with pins, callout, rate break modal, pin drop
    profile.tsx         — user profile (dark theme); also re-exported by user-profile.tsx
    search/             — discover surfers & breaks (replaced earlier Journal tab)
  onboarding/
    profile.tsx         — name + username
    stance.tsx          — experience level
    stance-screen.tsx   — regular / goofy / N/A
    board.tsx           — board type with SVG icons (7 options); exports BoardIcon
    homebreak.tsx       — home break search
    contacts.tsx        — contacts permission
    friends.tsx         — find your crew
    history.tsx         — log past sessions
    done.tsx            — completion
  break-detail.tsx      — per-break detail (rating, sessions, hero meta line)
  log-session.tsx       — 5-step session logging flow (transparent modal)
  follows-list.tsx      — followers / following list reached from profile counts
  user-profile.tsx      — re-exports ProfileScreen so other-user views don't hijack the Profile tab
  surfed-globe.tsx      — full-screen interactive globe (ProfileGlobe host)
  _layout.tsx           — root stack wrapped in GestureHandlerRootView; log-session as transparentModal

components/
  LineupsLogo.tsx       — Lineups wordmark SVG
  RateBreakModal.tsx    — re-rate flow used on the break detail screen
  SpinningGlobe.tsx     — decorative auto-rotating globe on the profile card
  ProfileGlobe.tsx      — interactive globe with pan/pinch on /surfed-globe

assets/
  world/
    admin0.json         — TopoJSON, simplified country outlines (10% retention)
    admin1.json         — TopoJSON, simplified state/province outlines (12% retention)
    continents.json     — TopoJSON, ~7 dissolved continent polygons (15% retention)
    *.geojson.bak       — original Natural Earth source (not bundled at runtime)

lib/
  supabase.ts           — Supabase client

constants/
  colors.ts             — darkTheme / lightTheme token objects

context/
  ThemeContext.tsx      — ThemeProvider + useTheme hook

scripts/
  seed-breaks.sql       — seed data
  add-region-column.sql — initial breaks.region column + bounds
  add-email-to-profiles.sql
  backfill-break-geography.js  — one-shot; sets breaks.country / breaks.admin1 via point-in-polygon
  simplify-world.sh     — runs mapshaper on the .geojson.bak files to (re)produce the vendored TopoJSON
  check_admin1.js       — diagnostic; counts admin1 features and verifies key region coverage
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

### Fresh-clone setup for the Travels Globe

The vendored TopoJSON files in `assets/world/` are committed, so a fresh clone runs without extra setup. The two paths below are only needed if you're regenerating the geometry or backfilling break geography for new data.

**Regenerate the simplified world files** (requires the `.geojson.bak` originals — download from the [`nvkelso/natural-earth-vector`](https://github.com/nvkelso/natural-earth-vector) repo's `geojson/` folder if missing):

```bash
./scripts/simplify-world.sh
```

**Backfill `country` / `admin1` on `breaks`** (one-shot; uses the service-role key, treat it as a secret):

```bash
export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<rotated key>"
node scripts/backfill-break-geography.js
unset SUPABASE_SERVICE_ROLE_KEY
```
