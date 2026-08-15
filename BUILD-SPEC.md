# Section Picker — Build Spec

**For:** Al-Quds University, Faculty of Medicine — 2nd year block (19 CH, 6 courses)
**Stack:** single-page static site, no build step, deployable to GitHub Pages
**Files:** `index.html`, `schedule-data.js`, `styles.css`, `app.js`
**Languages:** Arabic + English, full RTL
**Output:** browser-native PDF export of one chosen schedule

---

## 0. What this tool is

A student picks **one** timetable out of 15 valid ones, sees exactly what their week looks like, and prints it.

It is **not** a filter builder, not a conflict solver, not a registration system. Every possible answer is precomputed and sitting in `schedule-data.js`. The app's entire job is: *rank them, show them, explain them, print one.*

Build it in this order. Do not start section N+1 until section N renders correctly.

---

## 1. The domain rules (non-negotiable — these drive everything)

1. A student takes **all six courses in the same section number**. Micro section 2 → every course section 2.
2. Sections are **1, 2, 4, 5, 6, 7, 8**. **Section 3 does not exist.**
3. Three courses have labs: Biochemistry, Microbiology, Pathology. Every lab is 3 hours in room **0601**.
4. Lab codes are `section*10 + group`. Section 2 → labs 21, 22, 23 only.
5. **The lab group is locked across all three lab courses.** Pick Biochem lab 21 → you must take Micro 21 and Pathology 21. You cannot mix 21 with 22.

So the entire choice space is `section × labGroup` = 7 × 3 = **21 options**, of which **15 are valid** and 6 are broken.

**Consequence for the UI:** there is exactly ONE selection control, not two. Never build a "choose section" dropdown and a separate "choose lab" dropdown — that lets users construct combinations that don't exist.

---

## 2. Labs are not weekly

Labs do not run every week (start-of-term weeks, exam weeks, and holidays drop them). This is not a footnote — it changes which option is best:

| | Dead time WITH labs | Dead time WITHOUT labs |
|---|---|---|
| Section 4 / labs 41 | 5:10 | **3:10** ← best |
| Section 2 / labs 21 | 5:40 | 4:10 |
| Section 5 / labs 51 | 6:10 | **8:40** ← worse! |
| Section 6 / labs 61 | 5:40 | **8:10** ← worse! |

Sections 5 and 6 were using labs to *plug their gaps*. On a lecture-only week those gaps reopen.

**Requirement:** a persistent toggle — **`Full week` / `Lecture week`** (`أسبوع كامل` / `أسبوع بدون مختبر`). It must:
- re-render the grid (lab blocks fade out, they don't just disappear)
- **recompute every stat and every badge live** — badges are not static labels
- carry through to the PDF, with the active mode named in the printed header

Both stat sets are already in the data as `withLabs` and `lecturesOnly`.

---

## 3. Data layer — computed at runtime, not baked in

`schedule-data.js` holds **raw timings only**, as pipe-delimited text blocks. Nothing is precomputed. The app parses it on load and derives everything: conflicts, validity, stats, badges, nudges, twins.

This is deliberate. The timetable data is known to be incomplete and will be corrected. A student must be able to fix one line in GitHub's web editor and refresh — no build step, no script to re-run, no JavaScript syntax to break.

```js
export const LECTURES = `
# course | section | day | start | end | room
PH | 1 | Sun | 09:30 | 10:50 | ST215
BC | 2 | Mon | 12:30 | 13:50 | ST238 ~
PM | 2 | Sun | 12:30 | 13:50 | ?
`;
```

Parser rules:
- Split on newline, then on `|`, trim every field
- Skip blank lines and lines starting with `#`
- Room `?` → unknown, render `—`, tooltip *"Room not published yet"*
- Room suffix `~` → assumed for both days, render with dotted underline, tooltip *"Room assumed for both days — confirm with registration"*
- `LABS` uses `labCode` (11, 12, 21…) in place of `section`; section is `Math.floor(code/10)`, group is `code%10`
- `COURSES` gives id, course number, EN name, AR name, credit hours, has-lab

### `buildCombos()` — the one computed function

Runs once on load. For each section × labGroup (21 pairs):

1. Gather 12 lecture meetings + 3 lab meetings
2. Pairwise overlap test — same day and `aStart < bEnd && bStart < aEnd`
3. `valid = conflicts.length === 0`
4. Compute stats twice: once with labs, once lectures-only
5. Per day: `start`, `end`, `spanMin`, `classMin`, `gapMin = span - class`
6. Per combo: `deadMin`, `worstDayMin`, `totalSpanMin`, `avgStartMin`, `avgEndMin`, `earlyDays` (start ≤ 08:30), `lateDays` (end ≥ 16:00)
7. Twins: two valid combos whose stringified stats match exactly → `identicalTo`

**Verification — run this on first build.** With the shipped data, `buildCombos()` must produce exactly:

- **15 valid, 6 invalid**
- §7 invalid on all 3 lab groups (PH vs MB, Sat and Wed)
- §8 invalid on all 3 lab groups (MC vs PH, Wed, 20 min)
- `2-21` Full week: worst day **6:50**, dead **5:40**
- `4-41` Full week: dead **5:10** (lowest); Lecture week: dead **3:10**
- `5-51` Lecture week: dead **8:40** — *higher* than its 6:10 with labs
- Twins: `1-11`≡`1-12`, `2-22`≡`2-23`, `4-42`≡`4-43`, `5-51`≡`5-52`

If any number differs, the parser or the overlap test is wrong. Fix before styling.

### Validation banner

A bad edit must explain itself, never blank the page. On parse, collect errors and render a dismissible banner above the app:

```
⚠ 2 problems in schedule-data.js
   Line 47: day "Thurs" not recognised — use Sat Sun Mon Tue Wed
   Line 83: end time 09:00 is before start time 11:00
```

Check: field count is 6; day is in `SETTINGS.days`; times match `HH:MM`; end > start; course id exists in `COURSES`; section is in `sectionsAvailable`; lab code's section and group are valid. Report the **line number in the source block** — that's what the editor is looking at. Bad lines are skipped; the rest of the app still runs.

## 4. The broken options

Six combos are invalid. **Show them — greyed, unselectable, at the bottom of the list.** Students will otherwise try to register for them and hit the wall at the registration system instead of here.

| Combo | What breaks |
|---|---|
| §7 (labs 71, 72, 73) | Public Health `12:30–13:50` sits inside MolBio `12:00–13:50` — **on Saturday AND Wednesday** |
| §8 (labs 81, 82, 83) | Microbiology Wed `10:00–11:20` overlaps Public Health Wed `11:00–12:20` by 20 min |

Both are **lecture** clashes, so no lab group rescues them — that's why all three groups die together.

Card copy (EN): *"Not available — Public Health and Molecular Biology overlap on Saturday and Wednesday. This is a lecture clash, so no lab group fixes it."*
Add a small note under the invalid group: *"These may be corrected in a later timetable release. We'll update the tool when they are."*

---

## 5. Badges

Every badge is **computed from the active view**, never hardcoded. Recompute on the Full/Lecture-week toggle.

| Badge | EN | AR | Rule |
|---|---|---|---|
| 🌙 | Late starter | يبدأ متأخر | highest `avgStartMin` |
| ☀️ | Early finish | ينتهي مبكرًا | lowest `avgEndMin` |
| ⚖️ | Most balanced | الأكثر توازنًا | lowest `worstDayMin` |
| 🎯 | Least waiting | أقل وقت انتظار | lowest `deadMin` |
| 🛋️ | Lightest day | أخف يوم | smallest single-day `spanMin` |
| ⚠️ | Avoid | يُفضّل تجنّبه | a sibling in the same section beats it on `deadMin` |

Ties get the badge shared — do not invent a tiebreak. In `Full week`, `☀️ Early finish` is a two-way tie (2-22 and 2-23) and `🌙 Late starter` is a two-way tie (4-42 and 4-43). That's correct; render both.

**Current winners (Full week)** — use these to verify your implementation is correct:

- 🌙 `4-42`, `4-43` — no day starts before 09:30
- ☀️ `2-22`, `2-23` — never past 15:20
- ⚖️ `2-21`, `2-22`, `2-23` — no day over 6:50 (2-22/2-23 scatter their gaps more, but tie on the longest day)
- 🎯 `4-41` — 5:10 dead time
- 🛋️ `4-41`, `6-61`, `6-62`, `6-63` — each has a single 2:50 day (6-61/6-62's is Monday; 4-41's is Sunday)
- ⚠️ `2-22`, `2-23`, `4-42`, `4-43`, `5-53`, `6-63` — each has a same-section sibling with lower `deadMin` (`5-53` 9:10 and `6-63` 8:40 are the worst offenders)

Every badge is a **trade-off**, and the card must say so in one line. Not "best schedule" — *"Latest mornings, but three days end at 16:50."* This is the tool's actual value: it stops someone picking 4-42 for the sleep-in and discovering the 16:50 finishes in week three.

---

## 6. The nudge (your "suggestion if better")

Not a recommender. A hardcoded comparison between siblings inside the same section, since that's the only fair comparison — same lectures, only the lab group differs.

Trigger: user selects a combo where a same-section sibling has lower `deadMin`.

```
⚠  There's a better version of this section.
   5-53 and 5-51 have identical lectures. The only difference is the labs —
   and 5-53 adds 3 hours of waiting.
   [ Switch to 5-51 ]
```

Fires for: `5-53 → 5-51`, `6-63 → 6-61`, `2-22/2-23 → 2-21`, `4-42/4-43 → 4-41`.
Compute it from `deadMin`; don't hardcode the list — it changes with the view toggle.

**Twins:** where `identicalTo` exists, the timings are byte-identical. Show a quiet chip: *"Same timings as 2-23 — different seat only."* Nobody should agonize between them.

**Shape chips (near-twins):** two same-section combos can match on `deadMin` *and* `worstDayMin` yet differ in per-day spans — same totals, different distribution. Show a neutral chip naming the day each one loads: *"Same totals — 1-11 loads Saturday, 1-13 loads Monday."* This is **not** a nudge: no Switch button, no better/worse framing. `1-11` and `1-13` are mirrors that swap which day carries the 7:50 (1-11 loads Saturday, 1-13 loads Monday; both still carry a second 7:50 on Wednesday). It's a preference, not a mistake. Compute the differing day from per-day `spanMin`; dedupe byte-identical twins, which get the twin chip instead.

---

## 7. Layout

```
┌──────────────────────────────────────────────────┐
│  ‹header›  Section Picker            [AR] [EN]   │
│            19 CH · 6 courses · 15 valid options  │
├──────────────────────────────────────────────────┤
│  [ Full week ●───  Lecture week ]                │
├───────────────┬──────────────────────────────────┤
│ ‹option rail› │  ‹week canvas›                   │
│               │                                  │
│  🎯 4 / 41    │   Sat  Sun  Mon  Tue  Wed        │
│  ⚖️ 2 / 21 ◀  │  8 ▓▓                            │
│  🌙 4 / 42    │  9 ▓▓   ░░   ░░                  │
│     4 / 43    │ 10      ▓▓        ▓▓             │
│  ☀️ 2 / 22    │ 11 ▓▓        ▓▓                  │
│     ...       │ 12                               │
│  ─ unavailable│ 13 ██   ██        ██   ██        │
│  ✕ 7 / 71     │ 14                                │
│  ✕ 8 / 81     │ 15                               │
│               │ 16                               │
│               │  ── stats strip ──               │
│               │  6:50 worst · 5:40 waiting       │
│               │  [ Save as PDF ]                 │
└───────────────┴──────────────────────────────────┘
```

Mobile: rail collapses to a horizontal scroller above the canvas. The canvas stays a 5-column grid — never a stacked day list; the whole point is seeing the week at once.

---

## 8. Visual direction

The palette comes from the subject's own materials: **H&E staining** — hematoxylin and eosin, the two stains sitting in room 0601 for both the Pathology and Microbiology labs. Not decoration; it's what this cohort actually handles.

```css
--slide:    #FBF7F4;  /* prepared slide, unstained — page ground */
--hema:     #2E2A5C;  /* hematoxylin — deep blue-violet, primary ink */
--hema-lo:  #6B66A8;  /* diluted — secondary text, grid rules */
--eosin:    #D4547E;  /* eosin — accent, selection, active state */
--eosin-lo: #F5D8E2;  /* eosin wash — lab block fill */
--void:     #E8E2DD;  /* dead time — visible negative space */
```

Course blocks are tinted along the hematoxylin→eosin axis so the six courses stay distinguishable without a rainbow. Labs get the eosin wash + a 3px eosin left border, so they read as a different *material* from lectures — which matters when you toggle them off.

**Type:**
- Display / headings: **Readex Pro** — genuine Arabic and Latin in one family, so the AR/EN toggle doesn't change the page's personality
- Body: **IBM Plex Sans Arabic**
- Data (all times, all section codes, all stats): **IBM Plex Mono** — times are tabular data and should align in a column; this also makes the AR/EN switch leave the grid geometry untouched

Load from Google Fonts with a system fallback stack. Do not use a serif display face.

**Signature element — draw the gaps.**

Every other timetable tool renders classes and leaves the rest white. This one renders **dead time as a visible material**: `--void` fill, with the duration printed inside it in mono (`2h 10m`). The thesis of the tool is *the time you lose*, not *the classes you take* — the stat everyone actually chooses on is `deadMin`, so make it the thing you literally see.

On selecting a combo, blocks stagger in top-left → bottom-right over ~400ms, then the void panels fade up 200ms behind them. One orchestrated moment, on selection only. No scroll effects, no hover animation beyond a 1px border shift. Respect `prefers-reduced-motion`: keep the layout, drop the stagger.

Everything else stays quiet — hairline grid, no shadows, no gradients, no rounded cards beyond 4px.

---

## 9. PDF export

Use `@media print` + `window.print()`. **Do not add jsPDF or html2canvas** — they rasterize and wreck Arabic shaping.

Print stylesheet:
- Hide: option rail, language toggle, view toggle, nudges, badges
- Show: chosen combo header, the week grid, a text schedule table, footer
- Force single page, landscape, `--slide` background stripped to white
- Keep the eosin left-border on labs (prints as grey — still distinguishable)

**Printed content, in order:**

1. **Header:** `Section 2 · Labs 21` / `الشعبة 2 · مختبرات 21` (Western digits — see §19's later decision), view mode, generated date
2. **Week grid** — same geometry as screen
3. **Schedule table** — one row per meeting, sorted by day then start:
   `Day | Start | End | Duration | Course | Type | Room`
4. **Daily totals**, since this is what a student actually needs on paper:

   | Day | First class | Last class | On campus | In class | Waiting |
   |---|---|---|---|---|---|
   | Sat | 08:00 | 14:50 | 6h 50m | 5h 20m | 1h 30m |

   Then a week total row.
5. **Footer:** *"Labs do not run every week. Rooms marked ⌁ are unconfirmed. Timings from the registration system — verify before registering."*

Durations print as `6h 50m` / `6س 50د` (Western digits, Arabic unit letters — see §19's later decision), not `06:50`. On paper, hours and minutes read faster than a clock-format number that looks like a time of day.

---

## 10. Bilingual

- Toggle sets `document.documentElement.lang` and `dir`; layout is CSS logical properties throughout (`margin-inline-start`, never `margin-left`)
- Persist the choice in `localStorage`
- **The grid mirrors with the page.** Saturday is leftmost in English, rightmost in Arabic — overridden from this doc's original "the grid never mirrors" rule per explicit product decision; the timeline-readability argument for keeping it fixed didn't outweigh wanting the grid to visually match the rest of the RTL layout.
- Times stay Western digits in both languages (`14:00`), matching the registration system. Durations may use Arabic-Indic in AR.
- Strings live in one `STRINGS = { en: {...}, ar: {...} }` object. No inline text anywhere in the markup.

---

## 11. Build order

1. Parser + `buildCombos()` + the validation banner. Render results as a plain HTML table and check them against the verification numbers in §3
2. Week grid geometry, correct block positioning, no styling
3. Option rail, selection, live stat strip
4. Full/Lecture-week toggle with live stat + badge recompute
5. Badges and nudges
6. Visual pass — palette, type, void panels, stagger animation
7. Print stylesheet + PDF verification (test Arabic PDF on both Chrome and Safari)
8. AR/EN toggle and RTL pass

**Verify at step 1** against §3, and again at step 4 against §5. If `2-21` isn't showing 6:50 worst day and 5:40 dead time in Full week, the math is wrong — stop and fix it before styling anything.

---

## 12. Out of scope for v1

Professor names, exam dates, seat availability, a personal-constraint filter ("no class before 10"), saved profiles, cross-section mixing. The data doesn't support any of it yet. Keep `schedule-data.js` the single source of truth so adding professors later is a data edit, not a rewrite.

Adding a professor column later should mean: append ` | Dr. Name` to each `LECTURES` line, add one field to the parser, add one line to the block renderer. If it needs more than that, the architecture drifted.
