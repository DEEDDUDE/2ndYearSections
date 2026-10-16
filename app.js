// ============================================================
//  Data engine: parses schedule-data.js into courses, lectures, labs
//  and instructors, and computes per-week stats. Rendering is below.
// ============================================================

import { COURSES, LECTURES, LABS, INSTRUCTORS, SETTINGS } from "./schedule-data.js";

export const errors = [];

const toMin = (t) => {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  return m ? +m[1] * 60 + +m[2] : null;
};
export const fmt = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const dur = (m) => {
  const h = Math.floor(m / 60), mm = m % 60;
  return h && mm ? `${h}h ${mm}m` : h ? `${h}h` : `${mm}m`;
};

// ---- parser -------------------------------------------------
function rows(block, expected, label) {
  const out = [];
  block.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const f = line.split("|").map((s) => s.trim());
    if (f.length !== expected) {
      errors.push(`${label} line ${i + 1}: expected ${expected} fields, found ${f.length} — "${line}"`);
      return;
    }
    out.push({ f, line: i + 1 });
  });
  return out;
}

export const courses = {};
rows(COURSES, 6, "COURSES").forEach(({ f }) => {
  courses[f[0]] = { code: f[1], en: f[2], ar: f[3], ch: +f[4], hasLab: f[5] === "yes" };
});

function meeting(f, line, label, idField) {
  const [cid, id, day, s, e, roomRaw] = f;
  if (!courses[cid]) { errors.push(`${label} line ${line}: unknown course "${cid}"`); return null; }
  if (!SETTINGS.days.includes(day)) {
    errors.push(`${label} line ${line}: day "${day}" not recognised — use ${SETTINGS.days.join(" ")}`);
    return null;
  }
  const start = toMin(s), end = toMin(e);
  if (start === null) { errors.push(`${label} line ${line}: bad time "${s}" — use HH:MM`); return null; }
  if (end === null) { errors.push(`${label} line ${line}: bad time "${e}" — use HH:MM`); return null; }
  if (end <= start) { errors.push(`${label} line ${line}: end ${e} is not after start ${s}`); return null; }
  const uncertain = roomRaw.endsWith("~");
  const room = roomRaw.replace(/~$/, "").trim();
  return { course: cid, [idField]: +id, day, start, end,
           room: room === "?" ? null : room, roomUncertain: uncertain };
}

export const lectures = [];
rows(LECTURES, 6, "LECTURES").forEach(({ f, line }) => {
  const m = meeting(f, line, "LECTURES", "section");
  if (!m) return;
  if (!SETTINGS.sectionsAvailable.includes(m.section))
    return errors.push(`LECTURES line ${line}: section ${m.section} is not in sectionsAvailable`);
  lectures.push(m);
});

export const labs = [];
rows(LABS, 6, "LABS").forEach(({ f, line }) => {
  const m = meeting(f, line, "LABS", "labCode");
  if (!m) return;
  const sec = Math.floor(m.labCode / 10), grp = m.labCode % 10;
  if (!SETTINGS.sectionsAvailable.includes(sec))
    return errors.push(`LABS line ${line}: lab ${m.labCode} points at section ${sec}, which doesn't exist`);
  if (!SETTINGS.labGroups.includes(grp))
    return errors.push(`LABS line ${line}: lab ${m.labCode} has group ${grp}, expected one of ${SETTINGS.labGroups.join(" ")}`);
  labs.push({ ...m, section: sec, group: grp });
});

// ---- stats --------------------------------------------------
export function stats(blocks) {
  const byDay = {};
  let deadMin = 0, totalSpanMin = 0, classMin = 0, worstDayMin = 0, freeDays = 0;
  const starts = [], ends = [];
  for (const d of SETTINGS.days) {
    const items = blocks.filter((b) => b.day === d).sort((a, b) => a.start - b.start);
    if (!items.length) { byDay[d] = null; freeDays++; continue; }
    const start = items[0].start;
    const end = Math.max(...items.map((i) => i.end));
    const cls = items.reduce((s, i) => s + (i.end - i.start), 0);
    const span = end - start;
    byDay[d] = { start, end, spanMin: span, classMin: cls, gapMin: span - cls, items };
    deadMin += span - cls; totalSpanMin += span; classMin += cls;
    worstDayMin = Math.max(worstDayMin, span);
    starts.push(start); ends.push(end);
  }
  const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  return { byDay, deadMin, totalSpanMin, classMin, worstDayMin, freeDays,
    earliestStart: Math.min(...starts), latestEnd: Math.max(...ends),
    avgStartMin: avg(starts), avgEndMin: avg(ends),
    earlyDays: starts.filter((s) => s <= 8 * 60 + 30).length,
    lateDays: ends.filter((e) => e >= 16 * 60).length };
}

export const overlaps = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;

// Lecture instructors, keyed "PH-1" (course-section). Purely descriptive —
// nothing in the combo/stat engine reads it.
export const instructors = {};
rows(INSTRUCTORS, 4, "INSTRUCTORS").forEach(({ f, line }) => {
  if (!courses[f[0]]) return void errors.push(`INSTRUCTORS line ${line}: unknown course "${f[0]}"`);
  instructors[`${f[0]}-${+f[1]}`] = { en: f[2], ar: f[3] };
});
const instructorOf = (m, lang) =>
  m.kind === "lecture" ? instructors[`${m.course}-${m.section}`]?.[lang] ?? "" : "";

// ============================================================
//  Rendering helpers shared by the builder and the print sheet.
// ============================================================

export const GRID_START = toMin(SETTINGS.gridStart);
export const GRID_END   = toMin(SETTINGS.gridEnd);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Times, time ranges, room codes, section numbers and lab codes are LTR
// data that can sit inside RTL Arabic text. Without isolation the bidi
// algorithm can visually reverse them ("09:00–10:50" rendering as
// "10:50–09:00", "ST215" as "215ST") — this is a real, separate bug from
// which SCRIPT is used, so it's applied unconditionally in both
// languages: harmless in EN's own LTR context, one code path either way.
// Content must already be HTML-escaped by the caller before wrapping.
// Exported since index.html builds a couple of these spans directly too
// (the mobile detail header's combo code).
export const ltr = (html) => `<span class="ltr-data">${html}</span>`;

// Same fix, plain-text form — for strings that end up as a title/aria
// attribute or get esc()'d as a whole by their caller, where a <span>
// would either be inert (attributes don't parse markup) or get mangled
// into literal "&lt;span&gt;" text. U+2066/U+2069 (LRI/PDI) are invisible
// formatting characters, not in esc()'s escaped set, so they survive
// either path and still force LTR reading order.
const blocksFor = (combo) => [...combo.lectures, ...combo.labs];
const ltrText = (s) => `⁦${s}⁩`;

// ---- §19: bilingual strings + digit/duration helpers ---------

// Numbers stay Western digits in both languages — counts, section/lab
// codes, combo ids, and durations. `lang` stays in these signatures so
// call sites are uniform; it just no longer selects a digit script.
export const num = (n, lang) => String(n);

// Durations: "6h 50m" in EN, "6س 10د" in AR — Arabic unit letters
// (hour/minute), Western digits. "Hours and minutes read faster than a
// clock-format number" (BUILD-SPEC.md §9) applies on screen too.
export function durText(m, lang) {
  if (lang !== "ar") return dur(m);
  const h = Math.floor(m / 60), mm = m % 60;
  return h && mm ? `${h}س ${mm}د` : h ? `${h}س` : `${mm}د`;
}

// §21 — mobile void-panel short form: "2h50" not "2h 50m" (no internal
// space). Only the combined hour+minute case compacts; a bare "40m"/"40د"
// is already as short as it gets.
export function durTextShort(m, lang) {
  const h = Math.floor(m / 60), mm = m % 60;
  if (lang === "ar") return h && mm ? `${h}س${mm}` : h ? `${h}س` : `${mm}د`;
  return h && mm ? `${h}h${mm}` : h ? `${h}h` : `${mm}m`;
}

const courseName = (code, lang) => courses[code]?.[lang] || code;

// Day names — grid headers use the short form, notices/joins use the
// full form. Arabic has no separate abbreviation, so it reuses the full
// name in both places; English's short form is just its internal code
// (SETTINGS.days values already ARE "Sat"/"Sun"/…).
const DAY_AR = { Sat: "السبت", Sun: "الأحد", Mon: "الاثنين", Tue: "الثلاثاء", Wed: "الأربعاء" };
const DAY_EN_FULL = { Sat: "Saturday", Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday" };
const dayShort = (d, lang) => (lang === "ar" ? DAY_AR[d] : d);
const dayFull  = (d, lang) => (lang === "ar" ? DAY_AR[d] : DAY_EN_FULL[d]);

function joinDays(days, lang) {
  const names = [...new Set(days)]
    .sort((a, b) => SETTINGS.days.indexOf(a) - SETTINGS.days.indexOf(b))
    .map((d) => dayFull(d, lang));
  if (names.length === 1) return names[0];
  if (lang === "ar") {
    return names.length === 2
      ? `${names[0]} و${names[1]}`
      : `${names.slice(0, -1).join("، ")} و${names[names.length - 1]}`;
  }
  return names.length === 2
    ? `${names[0]} and ${names[1]}`
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// §19 — every fixed UI string in one place. Course names come from
// COURSES (already bilingual in the data); everything else — day/sort/
// badge/tier labels, notices, nudge and chip copy — comes from here.
// No text is hardcoded in the markup functions below.
export const STRINGS = {
  en: {
    fullWeek: "Full week",
    lectureWeek: "Lecture week",
    stat: { worstDayMin: "worst day", deadMin: "waiting", classMin: "in class",
            totalSpanMin: "on campus", avgStartMin: "avg start", avgEndMin: "avg end",
            earlyDays: "early days", lateDays: "late days" },
    freeDay: "Free",
    labTag: "LAB · not weekly",
    labTagShort: "LAB",
    typeLecture: "Lecture",
    typeLab: "Lab",
    universityName: "Al-Quds University",
    close: "Close",
    roomUnknown: "Room not published yet",
    problems: (n) => `${n} problem${n > 1 ? "s" : ""} in schedule-data.js`,
    overlaps: "overlaps",
    on: "on",
    disclaimer: "Student-made, not an official university tool. Data is copied from the registration portal.",
    saveAsPdf: "Save as PDF",
    printDialogHint: "Turn off \"Headers and footers\" in the print dialog for a clean page",
    printSectionLabs: (section, labCode) => `Section ${section} · Labs ${labCode}`,
    printGenerated: (date) => `Generated ${date}`,
    printDay: "Day", printStart: "Start", printEnd: "End", printDuration: "Duration",
    printCourse: "Course", printType: "Type", printRoom: "Room",
    printInstructor: "Instructor", instructorsHead: "Instructors",
    printFirstClass: "First class", printLastClass: "Last class",
    printOnCampus: "On campus", printInClass: "In class", printWaiting: "Waiting",
    printWeekTotal: "Week total",
    printFooterNote: "Labs do not run every week. Verify timings with registration.",
  },
  ar: {
    fullWeek: "أسبوع كامل",
    lectureWeek: "أسبوع بدون مختبر",
    stat: { worstDayMin: "أطول يوم", deadMin: "الانتظار", classMin: "داخل الصف",
            totalSpanMin: "في الجامعة", avgStartMin: "متوسط البداية", avgEndMin: "متوسط النهاية",
            earlyDays: "أيام مبكرة", lateDays: "أيام متأخرة" },
    freeDay: "فارغ",
    labTag: "مختبر · ليس أسبوعيًا",
    labTagShort: "مختبر",
    typeLecture: "محاضرة",
    typeLab: "مختبر",
    universityName: "جامعة القدس",
    close: "إغلاق",
    roomUnknown: "القاعة غير معلنة بعد",
    problems: (n) => `${n} مشكلة في بيانات الجدول`,
    overlaps: "يتعارض مع",
    on: "في",
    disclaimer: "من إعداد طالب وليس أداة رسمية للجامعة. البيانات منسوخة من بوابة التسجيل.",
    saveAsPdf: "حفظ كملف PDF",
    printDialogHint: "أوقف «الرؤوس والتذييلات» في نافذة الطباعة للحصول على صفحة نظيفة",
    printSectionLabs: (section, labCode) => `الشعبة ${section} · مختبرات ${labCode}`,
    printGenerated: (date) => `أُنشئ في ${date}`,
    printDay: "اليوم", printStart: "البداية", printEnd: "النهاية", printDuration: "المدة",
    printCourse: "المادة", printType: "النوع", printRoom: "القاعة",
    printInstructor: "المحاضر", instructorsHead: "المحاضرون",
    printFirstClass: "أول حصة", printLastClass: "آخر حصة",
    printOnCampus: "في الجامعة", printInClass: "داخل الصف", printWaiting: "الانتظار",
    printWeekTotal: "إجمالي الأسبوع",
    printFooterNote: "لا تُعقد المختبرات كل أسبوع. تأكد من المواعيد عبر التسجيل.",
  },
};

// ---- STEP 2: week grid geometry -----------------------------
// Absolute-positioned blocks on a shared time axis. No palette,
// no fonts, no animation — that is the step-6 visual pass.
export function gridHTML(combo, view = "withLabs", animate = false, lang = "en") {
  const S = STRINGS[lang];
  const range = GRID_END - GRID_START;
  const pct = (m) => ((m - GRID_START) / range) * 100;
  const showLabs = view === "withLabs";
  // Invalid combos carry their clashing meeting-object pairs in .conflicts —
  // the same object references blocksFor() returns, so identity works.
  const clashSet = combo.valid ? null : new Set(combo.conflicts.flat());

  // §21 — mobile narrows the time axis to hour numbers only ("08" not
  // "08:00"). Both forms render always; CSS picks one per breakpoint so
  // nothing needs recomputing on resize.
  // Every label sits centered on its tick EXCEPT the first and last:
  // centering those would straddle the dayhead/daybody seam and the
  // grid's own bottom border, cutting a visible line through the glyph.
  // They sit flush inside the grid instead.
  let hours = "";
  for (let m = GRID_START; m <= GRID_END; m += 60) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const shift = m === GRID_START ? "0%" : m === GRID_END ? "-100%" : "-50%";
    hours += `<div class="hour" style="top:${pct(m)}%;transform:translateY(${shift})">
                <span class="hour-full">${ltr(fmt(m))}</span><span class="hour-short">${ltr(hh)}</span>
              </div>`;
  }

  const cols = SETTINGS.days.map((d, ci) => {
    const dayBlocks = blocksFor(combo).filter((b) => b.day === d)
      .sort((a, b) => a.start - b.start);
    // active = the blocks that count for THIS view's dead time
    const active = dayBlocks.filter((b) => showLabs || b.kind === "lecture");

    // Void panels — the gaps between consecutive active blocks, drawn as a
    // visible material with their duration inside. They sum to the view's
    // deadMin: the waiting time you literally see. This is the signature.
    // (Overlapping — i.e. clashing — meetings never open a gap here: gs>ge
    // is skipped below, so a clash never produces a nonsense void.)
    let voids = "";
    for (let i = 1; i < active.length; i++) {
      const gs = active[i - 1].end, ge = active[i].start;
      if (ge <= gs) continue;
      const gap = ge - gs;
      const top = pct(gs), h = pct(ge) - pct(gs);
      const delay = Math.round(380 + (top / 100) * 120);   // fade up behind the blocks
      // §21 — mobile drops to a short-form label ("2h50"), and hides the
      // label entirely under 60min (desktop always shows the full form).
      voids += `<div class="void${gap < 60 ? " voidshort" : ""}" style="top:${top}%;height:${h}%;--d:${delay}ms">
                  <span class="vd-full">${ltr(durText(gap, lang))}</span>
                  <span class="vd-short">${ltr(durTextShort(gap, lang))}</span>
                </div>`;
    }

    // Blocks that clash on this day get a lane offset so both left borders
    // stay visible — they render overlapping, exactly as they collide.
    const dayClash = clashSet ? dayBlocks.filter((b) => clashSet.has(b)) : [];

    const blocks = dayBlocks.map((b) => {
      const top = pct(b.start), h = pct(b.end) - pct(b.start);
      const faded = b.kind === "lab" && !showLabs ? " faded" : "";
      const isClash = clashSet && clashSet.has(b);
      const lane = isClash ? dayClash.indexOf(b) % 2 : -1;
      const laneStyle = lane === 0 ? "inset-inline:3px 52%;"
        : lane === 1 ? "inset-inline:52% 3px;" : "";
      const delay = Math.round(ci * 25 + (top / 100) * 200);  // top-left → bottom-right
      const room = b.room === null
        ? `<span class="br unknown" title="${esc(S.roomUnknown)}">${ltr("—")}</span>`
        : `<span class="br">${ltr(esc(b.room))}</span>`;
      // A lab is a different material: hatch fill + dashed outline (in CSS)
      // plus a mono micro-label and the lab code, so it survives greyscale.
      // §21 — mobile shrinks "LAB · not weekly" to just "LAB".
      const labMeta = b.kind === "lab"
        ? `<span class="labtag-full">${esc(S.labTag)}</span><span class="labtag-short">${esc(S.labTagShort)}</span><span class="labcode">${ltr(num(b.labCode, lang))}</span>`
        : "";
      // §21 — data-* carries everything the tap popover needs (room state
      // included, since that's how touch reaches the hover-only warnings).
      return `<div class="block ${b.kind}${faded}${isClash ? " clash" : ""}" data-course="${b.course}"
                   data-kind="${b.kind}" data-day="${b.day}" data-start="${b.start}" data-end="${b.end}"
                   data-room="${b.room === null ? "" : esc(b.room)}" data-instructor="${esc(instructorOf(b, lang))}"
                   ${b.kind === "lab" ? `data-lab-code="${b.labCode}"` : ""}
                   style="top:${top}%;height:${h}%;--d:${delay}ms;${laneStyle}">
                <span class="bc-full">${esc(courseName(b.course, lang))}</span>
                <span class="bc-short">${esc(b.course)}</span>
                <span class="bt">${ltr(`${fmt(b.start)}–${fmt(b.end)}`)}</span>
                ${room}
                ${labMeta}
              </div>`;
    }).join("");

    return `<div class="daycol">
              <div class="dayhead">${esc(dayShort(d, lang))}</div>
              <div class="daybody">${active.length ? "" : `<div class="freeday">${esc(S.freeDay)}</div>`}${voids}${blocks}</div>
            </div>`;
  }).join("");

  return `<div class="grid${animate ? " animate" : ""}">
            <div class="daycol timecol">
              <div class="dayhead"></div>
              <div class="daybody">${hours}</div>
            </div>
            ${cols}
          </div>`;
}

// ---- §21: block detail popover (mobile) ----------------------
// Reachable only by tap, gated to <768px in index.html — desktop keeps
// its existing hover-title behaviour untouched. `info` is read straight
// off a block's data-* attributes: {course, kind, day, start, end,
// room ("" for unknown), labCode}.
export function blockPopoverHTML(info, lang) {
  const S = STRINGS[lang];
  const name = courseName(info.course, lang);
  const type = info.kind === "lab" ? S.typeLab : S.typeLecture;
  const day = dayFull(info.day, lang);
  const time = ltr(`${fmt(+info.start)}–${fmt(+info.end)}`);
  const roomBlock = info.room === ""
    ? `<div class="popoverwarn">${esc(S.roomUnknown)}</div>`
    : `<div class="popoverroom">${ltr(esc(info.room))}</div>`;
  const instructorLine = info.instructor
    ? `<div class="popoverlab">${esc(S.printInstructor)}: ${esc(info.instructor)}</div>` : "";
  const labLine = info.kind === "lab"
    ? `<div class="popoverlab">${esc(S.labTag)} · ${ltr(num(info.labCode, lang))}</div>` : "";
  return `<button class="popoverclose" data-popover-close aria-label="${esc(S.close)}">×</button>
    <div class="popoverbc">${esc(name)}</div>
    <div class="popovermeta">${esc(type)} · ${esc(day)} ${time}</div>
    ${roomBlock}
    ${instructorLine}
    ${labLine}`;
}

// On-screen list of who teaches each course in this combo (hidden in
// print — the schedule table's Instructor column carries it there).
export function instructorsHTML(combo, lang) {
  const S = STRINGS[lang];
  const byCourse = new Map();
  for (const l of combo.lectures) {
    const name = instructorOf(l, lang);
    if (!name) continue;
    (byCourse.get(l.course) || byCourse.set(l.course, new Set()).get(l.course)).add(name);
  }
  const items = [...byCourse.entries()]
    .map(([id, names]) => `<li><span class="insname">${esc(courseName(id, lang))}</span><span class="insdoc">${[...names].map(esc).join(" · ")}</span></li>`)
    .join("");
  return items ? `<div class="instructors"><div class="inshead">${esc(S.instructorsHead)}</div><ul>${items}</ul></div>` : "";
}

// ---- STEP 3/4: option rail + sort + two tiers + live stat strip -----

// Plain-language sentence(s) describing what clashes, generated from the
// computed .conflicts array — never hardcoded. Groups pairs that share the
// same two courses and times, so a clash repeated on several days reads as
// one sentence ("...on Saturday and Wednesday") instead of one per day.
export function conflictSentence(combo, lang = "en") {
  const S = STRINGS[lang];
  const groups = new Map();
  for (const [a, b] of combo.conflicts) {
    const [x, y] = a.start <= b.start ? [a, b] : [b, a];   // earlier meeting leads
    const key = `${x.course}:${x.start}-${x.end}|${y.course}:${y.start}-${y.end}`;
    if (!groups.has(key)) groups.set(key, { x, y, days: [] });
    groups.get(key).days.push(x.day);
  }
  return [...groups.values()].map(({ x, y, days }) => {
    const cx = courseName(x.course, lang);
    const cy = courseName(y.course, lang);
    // conflictSentence's result is used both as a plain-text title
    // attribute and esc()'d-as-a-whole elsewhere, so times use ltrText()
    // (invisible isolate characters) here, not the <span>-based ltr().
    if (days.length > 1) {
      return `${cx} (${ltrText(`${fmt(x.start)}–${fmt(x.end)}`)}) ${S.overlaps} ${cy} (${ltrText(`${fmt(y.start)}–${fmt(y.end)}`)}) ${S.on} ${joinDays(days, lang)}.`;
    }
    // single-day clashes stay abbreviated inline (matches §4's own usage:
    // "Sat"/"Wed" in a table cell), full names only when joining several days
    const d = dayShort(days[0], lang);
    return `${cx} (${d} ${ltrText(`${fmt(x.start)}–${fmt(x.end)}`)}) ${S.overlaps} ${cy} (${d} ${ltrText(`${fmt(y.start)}–${fmt(y.end)}`)}).`;
  }).join(" ");
}

// Live stat strip for the selected combo in the active view.
export function statsHTML(combo, view, lang = "en") {
  const S = STRINGS[lang];
  const s = combo[view];
  const cell = (key, val) => `<span><b>${val}</b> ${S.stat[key]}</span>`;
  return `<div class="stats">
    ${cell("worstDayMin", ltr(fmt(s.worstDayMin)))}
    ${cell("deadMin", ltr(fmt(s.deadMin)))}
    ${cell("classMin", ltr(fmt(s.classMin)))}
    ${cell("totalSpanMin", ltr(fmt(s.totalSpanMin)))}
    ${cell("avgStartMin", ltr(fmt(s.avgStartMin)))}
    ${cell("avgEndMin", ltr(fmt(s.avgEndMin)))}
    ${cell("earlyDays", num(s.earlyDays, lang))}
    ${cell("lateDays", num(s.lateDays, lang))}
  </div>`;
}

// ---- STEP 5: badges + sibling nudge -------------------------
// Every badge is computed from the ACTIVE view, never hardcoded,
// so it recomputes on the Full/Lecture-week toggle. Ties share.
// Labels themselves live in STRINGS[lang].labels (§19).

// Both options always visible, inactive one dimmed — never a single
// button that toggles (§19). Rendered on every screen so the language
// can be switched from wherever the student currently is; index.html
// wires the click regardless of which screen is showing.
export function langToggleHTML(lang) {
  return `<div class="langtoggle" role="group" aria-label="Language">
    <button data-lang="ar" aria-pressed="${lang === "ar"}">العربية</button>
    <span class="langsep" aria-hidden="true">|</span>
    <button data-lang="en" aria-pressed="${lang === "en"}">English</button>
  </div>`;
}

// ---- §9 (original spec): print stylesheet + PDF export --------
// Everything below renders only inside @media print (see styles.css) —
// hidden on screen behind .printonly, always present in the DOM so
// window.print() needs no beforeprint plumbing to populate it.

// "Section 2 · Labs 21", view mode, generated date.
export function printHeaderHTML(combo, view, lang) {
  const S = STRINGS[lang];
  const date = new Date().toISOString().slice(0, 10);
  return `<div class="printheader">
    <div class="printtitle">${esc(S.printSectionLabs(ltrText(num(combo.section, lang)), ltrText(num(combo.labCode, lang))))}</div>
    <div class="printmeta">${esc(view === "withLabs" ? S.fullWeek : S.lectureWeek)} · ${esc(S.printGenerated(ltrText(date)))}</div>
  </div>`;
}

// Portrait print narrows grid blocks to a two-letter course id (colour
// carries the rest) — this one-line legend under the grid is what makes
// that readable. Order follows COURSES' own declaration order, which
// matches the [data-course] hue hooks in styles.css.
export function printLegendHTML(lang) {
  const pairs = Object.entries(courses)
    .map(([id, c]) => `${ltr(id)} ${esc(c[lang])}`)
    .join(lang === "ar" ? " · " : " · ");
  return `<div class="printlegend">${pairs}</div>`;
}

// One row per meeting, sorted by day then start. Labs drop out entirely
// when printing the Lecture-week view, same filtering every other
// view-aware computation in the app already applies. `days` narrows to a
// subset — unused by default (portrait stacks one full-width table), kept
// as an escape hatch if a future combo's row count ever needs the old
// Sat–Mon | Tue–Wed side-by-side split.
export function scheduleTableHTML(combo, view, lang, days = SETTINGS.days) {
  const S = STRINGS[lang];
  const items = [...combo.lectures, ...(view === "withLabs" ? combo.labs : [])]
    .filter((m) => days.includes(m.day))
    .slice()
    .sort((a, b) => SETTINGS.days.indexOf(a.day) - SETTINGS.days.indexOf(b.day) || a.start - b.start);
  const rows = items.map((m) => {
    const room = m.room === null ? ltr("⌁") : ltr(esc(m.room));
    return `<tr>
      <td>${esc(dayFull(m.day, lang))}</td>
      <td>${ltr(fmt(m.start))}</td>
      <td>${ltr(fmt(m.end))}</td>
      <td>${ltr(durText(m.end - m.start, lang))}</td>
      <td>${esc(courseName(m.course, lang))}</td>
      <td>${m.kind === "lab" ? esc(S.typeLab) : esc(S.typeLecture)}</td>
      <td>${room}</td>
      <td>${esc(instructorOf(m, lang))}</td>
    </tr>`;
  }).join("");
  return `<table class="printtable">
    <thead><tr>
      <th>${esc(S.printDay)}</th><th>${esc(S.printStart)}</th><th>${esc(S.printEnd)}</th>
      <th>${esc(S.printDuration)}</th><th>${esc(S.printCourse)}</th><th>${esc(S.printType)}</th><th>${esc(S.printRoom)}</th><th>${esc(S.printInstructor)}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// Per-day totals + a week-total row. First/Last on the total row read as
// "earliest you're ever on campus" / "latest you ever leave" (the same
// earliestStart/latestEnd already computed for badges), since there's no
// single first/last class across a whole week.
export function dailyTotalsHTML(combo, view, lang) {
  const S = STRINGS[lang];
  const s = combo[view];
  const rows = SETTINGS.days.map((d) => {
    const b = s.byDay[d];
    if (!b) return `<tr><td>${esc(dayFull(d, lang))}</td><td colspan="5" class="printfree">${esc(S.freeDay)}</td></tr>`;
    return `<tr>
      <td>${esc(dayFull(d, lang))}</td>
      <td>${ltr(fmt(b.start))}</td>
      <td>${ltr(fmt(b.end))}</td>
      <td>${ltr(durText(b.spanMin, lang))}</td>
      <td>${ltr(durText(b.classMin, lang))}</td>
      <td>${ltr(durText(b.gapMin, lang))}</td>
    </tr>`;
  }).join("");
  const totalRow = `<tr class="printtotal">
    <td>${esc(S.printWeekTotal)}</td>
    <td>${ltr(fmt(s.earliestStart))}</td>
    <td>${ltr(fmt(s.latestEnd))}</td>
    <td>${ltr(durText(s.totalSpanMin, lang))}</td>
    <td>${ltr(durText(s.classMin, lang))}</td>
    <td>${ltr(durText(s.deadMin, lang))}</td>
  </tr>`;
  return `<table class="printtable">
    <thead><tr>
      <th>${esc(S.printDay)}</th><th>${esc(S.printFirstClass)}</th><th>${esc(S.printLastClass)}</th>
      <th>${esc(S.printOnCampus)}</th><th>${esc(S.printInClass)}</th><th>${esc(S.printWaiting)}</th>
    </tr></thead>
    <tbody>${rows}${totalRow}</tbody>
  </table>`;
}

export function printFooterHTML(lang) {
  const S = STRINGS[lang];
  return `<div class="printfooter">
    <div>${esc(S.printFooterNote)}</div>
    <div>${esc(S.disclaimer)}</div>
  </div>`;
}
