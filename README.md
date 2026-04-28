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
Feed → Breaks → Map → Journal → Profile
```

Tab bar: `#060F14` bg, `#3CC4C4` active, `#2A5A65` inactive, height 80.
Breaks tab uses a custom SVG wave icon (two wave Bezier paths).

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
Seven option cards with SVG board silhouette icons:

| Option | Value | Icon |
|---|---|---|
| Shortboard | `shortboard` | Narrow ellipse |
| Mid-Length | `mid-length` | Medium ellipse with stringer |
| Longboard | `longboard` | Wide tall ellipse with stringer |
| Gun | `gun` | Pointed teardrop path — for big-wave days |
| SUP | `sup` | Wide ellipse + paddle line |
| Foil | `foil` | Short ellipse + mast + wings |
| N/A | `null` | No icon |

**Decision:** Gun added between Longboard and SUP. Description: *"For big-wave days — paddles fast and holds in steep, powerful surf."* Stored as `"gun"` in `profiles.preferred_board`.

Card style: unselected `rgba(42,26,8,0.35)` bg / `rgba(197,168,130,0.4)` border / `#C5A882` label. Selected `#0F4E63` bg / `#3CC4C4` border / `#3CC4C4` label. Radio button right-aligned.

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

- **Top bar:** Lineups wordmark center
- **Username:** centered above stats row, Georgia bold 26px, cream, no @ symbol
- **Avatar:** 83×83px circle, offset right and upward
- **Display name:** Georgia regular (not bold) below avatar
- **Stats row:** SURFS / BREAKS / REGIONS — 22px Georgia bold cream values, 11px teal labels
- **Follow row:** followers/following left, "Member since Mon YYYY" right-aligned (14px teal)
- **Tabs:** Breaks / Wishlist — same sliding indicator as breaks page
- Break rows match breaks page style exactly

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
- `profiles` — `username`, `display_name`, `bio`, `email`, `experience_level`, `stance`, `preferred_board`, `home_break`, `created_at`
- `breaks` — `id`, `name`, `lat`, `lng`, `type`, `direction`, `region`, `is_custom`, `created_by`
- `sessions` — `user_id`, `break_id`, `date`, `rating`, `swell_size`, `wind`, `crowd_factor`, `board`, `surfed_with`, `notes`, `is_public`
- `session_photos` — `session_id`, `user_id`, `url`, `storage_path`
- `break_ratings` — `user_id`, `break_id`, `rating`, `is_favorite`
- `follows` — `follower_id`, `following_id`
- `wishlist` — `user_id`, `break_id`

### Migrations Required
```sql
-- Add region to breaks
scripts/add-region-column.sql

-- Add email to profiles
scripts/add-email-to-profiles.sql

-- Add crowd_factor to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
crowd_factor text CHECK (crowd_factor IN ('empty','moderate','crowded','zoo'));
```

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
| `expo-contacts` | Read device contacts for friends discovery |
| `expo-image-picker` | Avatar + session photo selection |
| `react-native-maps` | Map view |
| `react-native-map-clustering` | Pin clustering on map |
| `react-native-svg` | Board icons, Lineups wordmark |
| `@expo/vector-icons` | Ionicons tab and UI icons |

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
    journal.tsx         — session journal
    profile.tsx         — user profile (dark theme)
  onboarding/
    profile.tsx         — name + username
    stance.tsx          — experience level
    stance-screen.tsx   — regular / goofy / N/A
    board.tsx           — board type with SVG icons (7 options incl. Gun)
    homebreak.tsx       — home break search
    contacts.tsx        — contacts permission
    friends.tsx         — find your crew
    history.tsx         — log past sessions
    done.tsx            — completion
  log-session.tsx       — 5-step session logging flow (transparent modal)
  _layout.tsx           — root stack, log-session as transparentModal

lib/
  supabase.ts           — Supabase client

constants/
  colors.ts             — darkTheme / lightTheme token objects

context/
  ThemeContext.tsx      — ThemeProvider + useTheme hook

scripts/
  seed-breaks.sql
  add-region-column.sql
  add-email-to-profiles.sql
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
