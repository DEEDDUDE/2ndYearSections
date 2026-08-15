# Build Spec — Phase 2

Appends to `BUILD-SPEC.md`. Steps 7 (print) and 8 (RTL) still come after this.

---

## §13. Intro screen

The app becomes two screens: **intro** → **sections**. Client-side only, no router — swap a container, push a history state so the back button works.

```
┌────────────────────────────────────────────────┐
│                              العربية | English │
│                                                │
│   SECOND YEAR · FIRST SEMESTER                 │
│   Offered sections                             │
│   Spring 2026 / 2027                           │
│                                                │
│   19 credit hours · 6 courses · 15 available   │
│                                                │
│   ┌──────────────────────────────────────┐     │
│   │  Browse all sections            →    │     │
│   └──────────────────────────────────────┘     │
│                                                │
│   Or start from what matters to you            │
│                                                │
│   ┌────────────┐ ┌────────────┐ ┌───────────┐  │
│   │ LATEST     │ │ EARLIEST   │ │ LEAST     │  │
│   │ MORNINGS   │ │ FINISHES   │ │ WAITING   │  │
│   │ 4 / 42     │ │ 2 / 22     │ │ 4 / 41    │  │
│   │ nothing    │ │ never past │ │ 5h 10m    │  │
│   │ before     │ │ 15:20      │ │ of gaps   │  │
│   │ 09:30      │ │            │ │           │  │
│   └────────────┘ └────────────┘ └───────────┘  │
│   ┌────────────┐ ┌────────────┐                │
│   │ SHORT DAY  │ │ MOST EVEN  │                │
│   │ 6 / 61     │ │ 2 / 21     │                │
│   │ Monday is  │ │ no day     │                │
│   │ one 2h 50m │ │ over 6h50m │                │
│   │ block      │ │            │                │
│   └────────────┘ └────────────┘                │
│                                                │
│   Labs do not run every week. Timings from     │
│   the registration system — verify before      │
│   registering.                                 │
└────────────────────────────────────────────────┘
```

**Quick-pick cards are computed, never hardcoded.** Same ranking functions as the badges. Each shows the winning combo id and the one concrete fact that earns it. On a tie, show the first by section number and add a small "and 1 other" — the sections page shows the rest.

Clicking a card goes to the sections page **with that combo already selected and scrolled to**, not filtered. The student should see their pick in context.

Header strings live in `SETTINGS` so they're a one-line edit each term:

```js
year:     { en: "Second year · First semester", ar: "السنة الثانية · الفصل الأول" },
term:     { en: "Spring 2026 / 2027",           ar: "ربيع ٢٠٢٦ / ٢٠٢٧" },
```

> **Check this before publishing:** "first semester" and "Spring" usually don't go together — spring is normally the second semester. Whichever is right, it's two strings in `SETTINGS`.

---

## §14. Sections 7 and 8 — shown, marked, not selectable

**Cross-sectioning is not allowed.** A student takes all six courses in one section, full stop. So there is no fix to offer, no swap to suggest, and no mixed schedule to export. Do not build a swap-finder.

But don't hide them either. All 21 combos appear in the list. Sections 7 and 8 are simply marked as broken:

| Tier | Combos | In list? | Grid viewable? | Selectable / PDF? |
|---|---|---|---|---|
| **Available** | the 15 | yes | yes | yes |
| **Has a clash** | 7-71/72/73, 8-81/82/83 | yes, below the others | yes | **no** |

Clicking one shows its week grid so the student can see the problem for themselves — that's more convincing than a sentence. The two clashing blocks render **overlapping, in a hatched red state**, exactly as they collide in reality. Everything else in the week renders normally.

Above the grid, a plain notice naming what clashes:

> **Section 7 has a clash.** Molecular Biology & Genetics (12:00–13:50) overlaps Public Health (12:30–13:50) on Saturday and Wednesday.

> **Section 8 has a clash.** Microbiology (Wed 10:00–11:20) overlaps Public Health (Wed 11:00–12:20).

Then, for both:

> You can't take this section as it stands. It may be corrected in a later timetable release.

No "Save as PDF" button on these. No stats strip, no badges, no nudge — they're not competing with the valid options, so don't score them.

Generate the notice text from the computed `conflicts` array, never hardcode it. If the data is corrected and a section comes back clean, it should move into Available on its own, with no code change.

## §15. Word labels — remove all emoji

Every badge, tier marker, and card label is words. Nothing decorative carries meaning.

| Was | EN | AR |
|---|---|---|
| 🌙 | Latest mornings | أحدث بداية |
| ☀️ | Earliest finishes | أبكر نهاية |
| ⚖️ | Most even days | الأكثر توازنًا |
| 🎯 | Least waiting | أقل انتظار |
| 🛋️ | Has a short day | فيه يوم قصير |
| ⚠️ | Better version exists | يوجد خيار أفضل |
| ✕ | Not available | غير متاح |

Set them in mono, uppercase, letterspaced, in the course-neutral ink. A badge is a **label**, so it should look like a label — not a chip, not a pill, not a colored tag.

"Better version exists" replaces "Avoid." The tool's job is to inform, not scold.

---

## §16. Sort control

Above the option rail. Segmented control, not a dropdown — there are only five options and they should all be visible.

| Sort | Default direction | Key |
|---|---|---|
| **Section** *(default)* | ascending | `section`, then `group` |
| Waiting time | ascending | `deadMin` |
| Longest day | ascending | `worstDayMin` |
| Start time | descending (latest first) | `avgStartMin` |
| Finish time | ascending (earliest first) | `avgEndMin` |

Default view is **Section, ascending** — 1-11 first. Direction is a separate toggle; clicking the active sort flips it. Show the direction as a caret, and label it in the tooltip so it isn't guesswork.

Sorting respects the Full/Lecture-week toggle, since every key except `section` changes with it.

**Tier order overrides sort.** All Available options first, clashing ones always last. Sorting happens within Available only — the clashing group keeps a fixed section order, since it has no stats to sort by.

---

## §17. Colour — one stain per course

Six courses on a single hematoxylin→eosin axis was too tight; they don't separate. Replace it with **six real laboratory stains**, one per course. They're distinct hues, they're all things this cohort handles in room 0601, and they stay a family because they're all stains.

```css
--c-ph:  #C08A2E;  /* iodine        — Public Health */
--c-mb:  #2C6FAF;  /* methylene blue — Molecular Biology */
--c-bc:  #1F7A6B;  /* malachite green — Biochemistry */
--c-mc:  #6A4C93;  /* crystal violet — Microbiology */
--c-pa:  #D4547E;  /* eosin          — Pathology */
--c-pm:  #A03528;  /* safranin       — Pharmacology */
```

Hues are spread across the wheel, and where two sit close (iodine/safranin) they're separated on lightness as well — so they hold up for colour-blind readers and in greyscale print.

Keep the existing UI ink and ground unchanged: hematoxylin `#2E2A5C` for text and rules, `#FBF7F4` for the page, `#E8E2DD` for the void panels. **The void panels stay neutral** — they're the signature, and they must not compete with six hues.

Block treatment: 12% tint of the course hue as fill, 3px solid left border in the full hue, label text in hematoxylin ink. Never white text on a colour block — it fails at small sizes and in print.

---

## §18. Labs must be a different material

Right now labs read as just another block. That's the biggest problem on screen, because the whole Full/Lecture-week idea depends on seeing at a glance what disappears.

Fix it with **texture, not colour**, so it works no matter which stain the course carries:

1. **Diagonal hatch fill** — `repeating-linear-gradient(45deg, ...)` in the course hue at low opacity, 6px stripes
2. **Dashed outline** instead of solid
3. A mono micro-label inside the block: `LAB · not weekly` / `مختبر · ليس أسبوعيًا`
4. The lab code (`21`) printed in the corner in mono

A lecture is a solid field; a lab is a hatched field. That difference survives greyscale printing, colour-blindness, a phone screen at arm's length, and any future palette change.

In Lecture week, hatched blocks fade to 15% and the void panel expands over them — the fade should read as *the material being removed*, which is exactly what happens in a real lab-free week.

---

## §19. Language

The toggle lives on the intro, top-right, and persists to every screen and into the PDF. `localStorage`, key `lang`.

Both options always visible as `العربية | English` with the inactive one dimmed — never a single button that toggles, since a student shouldn't have to click to find out what it does.

Course names come from `COURSES` (both languages are already in the data). Day names, badge labels, sort labels, tier labels, and all notices come from `STRINGS`. No text hardcoded in markup anywhere.

---

## §20. Transitions

Two moments only. Everything else stays still.

**Intro → sections:** intro content lifts and fades out over 260ms; the week grid draws in behind it with the existing top-left→bottom-right stagger. One continuous movement, not two animations queued. Back button reverses it.

**Quick-pick card → sections:** same transition, but the chosen combo's blocks land last and hold a 1px eosin outline for 600ms, so the eye lands on the answer.

Both gated behind `prefers-reduced-motion: no-preference`. Reduced motion keeps every layout and drops every animation — never a degraded layout.

No hover animation beyond a 1px border shift. No scroll effects. No page-load animation on the sections screen when arriving without a transition (a refresh should be instant).

---

## §21. Mobile layout

Desktop stays exactly as it is — this is a mobile-only pass, breakpoint 768px.

### List and detail become separate screens

On desktop the option rail and week grid sit side by side. On mobile that doesn't fit, so it's two screens:

- **Options screen** — full-width scrollable list of the 21 combos. Each row shows the combo id, its word badges, and two stats (waiting, longest day). Tap a row to open it.
- **Week screen** — full-screen grid with a back arrow to the list, and the combo id in a sticky header.

Browser back returns to the list, not the intro screen. Implemented as an extension of the existing hash router: `#sections` with no id means the list; `#sections/<id>` means the detail screen is open for that combo. The in-app back arrow calls `history.back()` rather than duplicating the navigation logic, so it and the physical back button go through the same code path.

### The grid stays five columns

No stacking days vertically, no horizontal scroll. Fit it by cutting content, not columns:

- Course names become their two-letter ids (`PH`, `MB`, `BC`, `MC`, `PA`, `PM`) — colour carries the rest
- Room text is dropped from blocks entirely
- Time axis narrows to hour numbers only (`08`, `09`, `10`…)
- Void panels keep their duration label but drop to the short form (`2h50` not `2h 50m`); the label disappears entirely on voids under 60 minutes
- Lab blocks keep the hatch and dashed outline; the micro-label shrinks to `LAB` + the lab code

Tapping any block opens a detail popover: full course name, type, exact times, room, and lab code. This is also where the room warnings live now (see below) — full and short forms render together in the markup, CSS picks the right one per breakpoint, so nothing needs to be recomputed on resize.

### Touch fixes (bugs, not polish)

- Room tooltips were hover-only, so "room assumed" / "room not published" were invisible on touch. They now render inside the block popover instead of (not in addition to — the hover title is a desktop-only affordance) a tap-only surface.
- Every tappable target is at least 44px in its smaller dimension. Grid blocks under 44px tall get an invisible expanded hit area (a pseudo-element sized to 44px, not a bigger visual block) rather than growing visually.
- Nothing depends on hover to be discoverable on the mobile breakpoint. (Desktop's hover tooltips are untouched — the popover only opens on tap, gated to <768px, so desktop's click-does-nothing-on-a-block behavior stays exactly as it was.)

### Controls

- **Sort** — horizontally scrollable chip row on mobile in place of the segmented control. Same five keys, same defaults, single ascending mode (no direction toggle — matches the desktop control after its own simplification; §21 originally called for a direction caret here, but that would have reintroduced the two-mode sort just removed. Built single-mode to match; flagged for confirmation).
- **Full week / Lecture week** — full-width two-up toggle, sticky under the header on both screens.
- **Language toggle** — stays in the header; hidden specifically on the week screen's compact detail header to keep it minimal (back arrow + combo id only), still reachable from the list screen.
- **Stats strip** — sticky to the bottom of the week screen, one line, mono.
- **Save as PDF** — **not built.** The button's mobile placement is specified (full-width, above the stats strip, with a landscape hint underneath) but PDF export itself doesn't exist yet — it's a separate, not-yet-requested feature. Building a button that does nothing seemed worse than leaving the slot for it; the stats strip is already positioned so the button can slot in above it later with no layout change.

### Type and spacing

Base font never drops below 14px. Space comes from cutting content and padding, not shrinking text. Grid block labels (the two-letter codes) may go to 11px mono. Hairline rules stay hairline — they disappear if thinned further on a phone screen.

### Transitions

List → week is a horizontal slide (list exits to the inline-start side, week enters from the inline-end side — i.e. left/right in English, mirrored in Arabic since this, unlike the day grid, follows the page's own RTL rules); back reverses it. The existing block stagger still plays on arrival. Both gated behind `prefers-reduced-motion: no-preference`, using the same snapshot-ghost technique as the intro↔sections transition (§20) — forced-reflow trigger, `transitionend` cleanup, `setTimeout` safety net.

---

## Build order for this phase

1. §17 palette + §18 lab material — fixes what's visibly wrong now
2. §15 word labels — mechanical, do it while you're in the same files
3. §16 sort control
4. §14 the two tiers — clashing sections listed, viewable, marked, not selectable
5. §13 intro screen with computed quick-picks
6. §19 language plumbing on the intro
7. §20 transitions last, once both screens are stable

Verify after step 4: all 21 combos appear in the list; the 6 clashing ones sit last, show their grid with the two colliding blocks overlapping in hatched red, carry a notice generated from their `conflicts` array, and offer no PDF button.
