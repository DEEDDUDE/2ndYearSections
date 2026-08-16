// ============================================================
//  STEP 1 — data engine. No styling yet.
//  Parses schedule-data.js, builds all 21 combos, computes stats.
//  Everything downstream reads from buildCombos().
// ============================================================

import { COURSES, LECTURES, LABS, SETTINGS } from "./schedule-data.js";

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
function stats(blocks) {
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

const overlaps = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;

// ---- combos -------------------------------------------------
export function buildCombos() {
  const list = [];
  for (const section of SETTINGS.sectionsAvailable) {
    for (const group of SETTINGS.labGroups) {
      const labCode = section * 10 + group;
      const lec = lectures.filter((l) => l.section === section).map((l) => ({ ...l, kind: "lecture" }));
      const lb = labs.filter((l) => l.labCode === labCode).map((l) => ({ ...l, kind: "lab" }));
      const all = [...lec, ...lb];
      const conflicts = [];
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++)
          if (overlaps(all[i], all[j])) conflicts.push([all[i], all[j]]);
      list.push({ id: `${section}-${labCode}`, section, group, labCode,
        valid: conflicts.length === 0, conflicts,
        lectures: lec, labs: lb,
        withLabs: stats(all), lecturesOnly: stats(lec) });
    }
  }
  // twins — identical timings
  const sig = {};
  list.filter((c) => c.valid).forEach((c) => {
    // signature = shape of the week only. Lab codes differ by definition,
    // so compare start/end/span per day, never the items themselves.
    const k = SETTINGS.days.map((d) => {
      const x = c.withLabs.byDay[d];
      return x ? `${d}:${x.start}-${x.end}:${x.classMin}` : `${d}:-`;
    }).join("|");
    (sig[k] ||= []).push(c);
  });
  Object.values(sig).forEach((g) => {
    if (g.length > 1) g.forEach((c) => (c.identicalTo = g.filter((x) => x !== c).map((x) => x.id)));
  });
  return list;
}

// ============================================================
//  UI LAYER (steps 2–5, phase 2 steps 1–7). Reads buildCombos()
//  output only. Does NOT touch the parser, stats(), overlaps(),
//  or buildCombos().
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
const ltrText = (s) => `⁦${s}⁩`;

// All meetings of a combo, lectures + labs, each already tagged .kind.
const blocksFor = (combo) => [...combo.lectures, ...combo.labs];

// ---- §19: bilingual strings + digit/duration helpers ---------

// Numbers stay Western digits in both languages — counts, section/lab
// codes, combo ids, and durations. `lang` stays in these signatures so
// call sites are uniform; it just no longer selects a digit script.
export const num = (n, lang) => String(n);
const cid = (id, lang) => ltr(id);   // e.g. combo id "5-51" — section-labCode, LTR data

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
    appTitle: "Section Picker",
    subtitle: (ch, courseN, validN) => `${ch} CH · ${courseN} courses · ${validN} valid options`,
    fullWeek: "Full week",
    lectureWeek: "Lecture week",
    sort: { section: "Section", deadMin: "Waiting time", worstDayMin: "Shortest day",
            avgStartMin: "Start time", avgEndMin: "Finish time" },
    sortGroupLabel: "Sort by",
    sortBy: (label) => `Sort by ${label}`,
    hasClash: "Has a clash",
    stat: { worstDayMin: "worst day", deadMin: "waiting", classMin: "in class",
            totalSpanMin: "on campus", avgStartMin: "avg start", avgEndMin: "avg end",
            earlyDays: "early days", lateDays: "late days" },
    labels: { bestOverall: "Best overall",
              latestMornings: "Latest mornings", earliestFinishes: "Earliest finishes",
              mostEven: "Most even days", leastWaiting: "Least waiting",
              shortDay: "Has a short day", betterExists: "Better version exists",
              notAvailable: "Not available" },
    labTag: "LAB · not weekly",
    labTagShort: "LAB",
    typeLecture: "Lecture",
    typeLab: "Lab",
    backToList: "Back to list",
    backToHome: "Back to home",
    universityName: "Al-Quds University",
    close: "Close",
    roomUnknown: "Room not published yet",
    roomAssumed: "Room assumed for both days — confirm with registration",
    noCombo: "No combo.",
    problems: (n) => `${n} problem${n > 1 ? "s" : ""} in schedule-data.js`,
    overlaps: "overlaps",
    on: "on",
    sectionHasClash: (n) => `Section ${n} has a clash.`,
    cantTakeSection: "You can't take this section as it stands. It may be corrected in a later timetable release.",
    identicalLectures: (a, b, d) => `${a} and ${b} have identical lectures. The only difference is the labs — and ${a} adds ${d} of waiting.`,
    switchTo: (id) => `Switch to ${id}`,
    sameTimings: (ids) => `Same timings as ${ids} — different seat only.`,
    sameTotals: (a, dayA, b, dayB) => `Same totals — ${a} loads ${dayA}, ${b} loads ${dayB}.`,
    // intro (§13)
    offeredSections: "Offered sections",
    browseAll: "Browse all sections",
    startFrom: "Or start from what matters to you",
    footerNote: "Labs do not run every week. Timings from the registration system — verify before registering.",
    disclaimer: "Made by a student, not an official university tool. All data is copied from the university's registration portal — nothing here is made up. This tool only organizes what registration already shows you.",
    andNOther: (n) => `and ${n} other${n > 1 ? "s" : ""}`,
    quickNothingBefore: (t) => `nothing before ${t}`,
    quickNeverPast: (t) => `never past ${t}`,
    quickOfGaps: (d) => `${d} of gaps`,
    quickOneBlock: (day, d) => `${day} is one ${d} block`,
    quickNoDayOver: (d) => `no day over ${d}`,
    quickBestOverall: (dead, worst) => `${dead} waiting · no day over ${worst}`,
    // §9 (original spec) — print stylesheet + PDF export
    saveAsPdf: "Save as PDF",
    landscapeHint: "Best saved in landscape",
    printDialogHint: "Turn off \"Headers and footers\" in the print dialog for a clean page",
    printSectionLabs: (section, labCode) => `Section ${section} · Labs ${labCode}`,
    printGenerated: (date) => `Generated ${date}`,
    printDay: "Day", printStart: "Start", printEnd: "End", printDuration: "Duration",
    printCourse: "Course", printType: "Type", printRoom: "Room",
    printFirstClass: "First class", printLastClass: "Last class",
    printOnCampus: "On campus", printInClass: "In class", printWaiting: "Waiting",
    printWeekTotal: "Week total",
    printFooterNote: "Labs do not run every week. Rooms marked ⌁ are unconfirmed. Timings from the registration system — verify before registering.",
  },
  ar: {
    appTitle: "اختيار الشعبة",
    subtitle: (ch, courseN, validN) => `${ch} ساعة معتمدة · ${courseN} مواد · ${validN} خياراً متاحاً`,
    fullWeek: "أسبوع كامل",
    lectureWeek: "أسبوع بدون مختبر",
    sort: { section: "الشعبة", deadMin: "وقت الانتظار", worstDayMin: "أقصر يوم",
            avgStartMin: "وقت البداية", avgEndMin: "وقت النهاية" },
    sortGroupLabel: "ترتيب حسب",
    sortBy: (label) => `ترتيب حسب ${label}`,
    hasClash: "فيه تعارض",
    stat: { worstDayMin: "أطول يوم", deadMin: "الانتظار", classMin: "داخل الصف",
            totalSpanMin: "في الجامعة", avgStartMin: "متوسط البداية", avgEndMin: "متوسط النهاية",
            earlyDays: "أيام مبكرة", lateDays: "أيام متأخرة" },
    labels: { bestOverall: "الأفضل إجمالاً",
              latestMornings: "الأكثر تأخرًا", earliestFinishes: "أبكر نهاية",
              mostEven: "الأكثر توازنًا", leastWaiting: "أقل انتظار",
              shortDay: "فيه يوم قصير", betterExists: "يوجد خيار أفضل",
              notAvailable: "غير متاح" },
    labTag: "مختبر · ليس أسبوعيًا",
    labTagShort: "مختبر",
    typeLecture: "محاضرة",
    typeLab: "مختبر",
    backToList: "الرجوع إلى القائمة",
    backToHome: "الرجوع إلى الرئيسية",
    universityName: "جامعة القدس",
    close: "إغلاق",
    roomUnknown: "القاعة غير معلنة بعد",
    roomAssumed: "القاعة مفترضة لليومين — تأكد من التسجيل",
    noCombo: "لا يوجد خيار.",
    problems: (n) => `${n} مشكلة في بيانات الجدول`,
    overlaps: "يتعارض مع",
    on: "في",
    sectionHasClash: (n) => `الشعبة ${n} فيها تعارض.`,
    cantTakeSection: "لا يمكنك اختيار هذه الشعبة كما هي حاليًا. قد يتم تصحيحها في نسخة لاحقة من الجدول.",
    identicalLectures: (a, b, d) => `لكل من ${a} و${b} نفس المحاضرات تمامًا. الفرق الوحيد هو المختبر — وتضيف ${a} ${d} من وقت الانتظار.`,
    switchTo: (id) => `التبديل إلى ${id}`,
    sameTimings: (ids) => `نفس التوقيت في ${ids} — فقط مقعد مختلف.`,
    sameTotals: (a, dayA, b, dayB) => `نفس الإجمالي — ${a} يُحمَّل يوم ${dayA}، و${b} يوم ${dayB}.`,
    // intro (§13)
    offeredSections: "الشعب المطروحة",
    browseAll: "تصفح جميع الشعب",
    startFrom: "أو ابدأ بما يهمك",
    footerNote: "لا تُعقد المختبرات كل أسبوع. التوقيتات من نظام التسجيل — يرجى التأكد منها قبل التسجيل.",
    disclaimer: "هذه أداة أنشأها طالب، وليست أداة رسمية تابعة للجامعة. جميع البيانات منسوخة من بوابة التسجيل الجامعية — لا شيء هنا من تأليفنا. مهمة الأداة الوحيدة هي تنظيم ما يعرضه نظام التسجيل أصلاً.",
    andNOther: (n) => `و${n} أخرى`,
    quickNothingBefore: (t) => `لا شيء قبل ${t}`,
    quickNeverPast: (t) => `لا يتجاوز ${t}`,
    quickOfGaps: (d) => `${d} انتظار`,
    quickOneBlock: (day, d) => `${day} كتلة واحدة مدتها ${d}`,
    quickNoDayOver: (d) => `لا يوم يتجاوز ${d}`,
    quickBestOverall: (dead, worst) => `${dead} انتظار · لا يوم يتجاوز ${worst}`,
    // §9 (original spec) — print stylesheet + PDF export. Digits stay
    // Western here too (§19's later decision overrides this doc's own
    // original Arabic-Indic example, "الشعبة ٢ · مختبرات ٢١").
    saveAsPdf: "حفظ كملف PDF",
    landscapeHint: "يُفضّل الحفظ بالوضع الأفقي",
    printDialogHint: "أوقف «الرؤوس والتذييلات» في نافذة الطباعة للحصول على صفحة نظيفة",
    printSectionLabs: (section, labCode) => `الشعبة ${section} · مختبرات ${labCode}`,
    printGenerated: (date) => `أُنشئ في ${date}`,
    printDay: "اليوم", printStart: "البداية", printEnd: "النهاية", printDuration: "المدة",
    printCourse: "المادة", printType: "النوع", printRoom: "القاعة",
    printFirstClass: "أول حصة", printLastClass: "آخر حصة",
    printOnCampus: "في الجامعة", printInClass: "داخل الصف", printWaiting: "الانتظار",
    printWeekTotal: "إجمالي الأسبوع",
    printFooterNote: "لا تُعقد المختبرات كل أسبوع. القاعات المشار إليها بـ⌁ غير مؤكدة. التوقيتات من نظام التسجيل — يرجى التأكد منها قبل التسجيل.",
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
        : `<span class="br${b.roomUncertain ? " assumed" : ""}"${
            b.roomUncertain ? ` title="${esc(S.roomAssumed)}"` : ""
          }>${ltr(esc(b.room))}</span>`;
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
                   data-room="${b.room === null ? "" : esc(b.room)}" data-room-uncertain="${b.roomUncertain ? "1" : "0"}"
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
              <div class="daybody">${voids}${blocks}</div>
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
// room ("" for unknown), roomUncertain, labCode}.
export function blockPopoverHTML(info, lang) {
  const S = STRINGS[lang];
  const name = courseName(info.course, lang);
  const type = info.kind === "lab" ? S.typeLab : S.typeLecture;
  const day = dayFull(info.day, lang);
  const time = ltr(`${fmt(+info.start)}–${fmt(+info.end)}`);
  const roomBlock = info.room === ""
    ? `<div class="popoverwarn">${esc(S.roomUnknown)}</div>`
    : info.roomUncertain === "1"
      ? `<div class="popoverroom">${ltr(esc(info.room))}</div><div class="popoverwarn">${esc(S.roomAssumed)}</div>`
      : `<div class="popoverroom">${ltr(esc(info.room))}</div>`;
  const labLine = info.kind === "lab"
    ? `<div class="popoverlab">${esc(S.labTag)} · ${ltr(num(info.labCode, lang))}</div>` : "";
  return `<button class="popoverclose" data-popover-close aria-label="${esc(S.close)}">×</button>
    <div class="popoverbc">${esc(name)}</div>
    <div class="popovermeta">${esc(type)} · ${esc(day)} ${time}</div>
    ${roomBlock}
    ${labLine}`;
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

// ---- sort control (§16) --------------------------------------
// Single mode, always ascending: waiting time least→most, shortest day
// first, start time earliest first, finish time earliest first.
export const SORTS = [
  { key: "section" },
  { key: "deadMin" },
  { key: "worstDayMin" },
  { key: "avgStartMin" },
  { key: "avgEndMin" },
];

function sortValue(c, view, key) {
  return key === "section" ? c.section * 10 + c.group : c[view][key];
}

export function sortCombos(list, view, key) {
  return [...list].sort((a, b) => sortValue(a, view, key) - sortValue(b, view, key));
}

export function sortControlHTML(sortKey, lang = "en") {
  const S = STRINGS[lang];
  return `<div class="sortctl" role="group" aria-label="${esc(S.sortGroupLabel)}">
    ${SORTS.map((s) => {
      const active = s.key === sortKey;
      const label = S.sort[s.key];
      return `<button data-sort="${s.key}" aria-pressed="${active}" title="${esc(S.sortBy(label))}">
        ${esc(label)}
      </button>`;
    }).join("")}
  </div>`;
}

// Rail lists Available combos first, sorted by the active control (tier
// order overrides sort). The clashing tier is always last, in fixed
// section order — it has no stats to sort by — and is viewable, not
// selectable-for-PDF, but IS clickable to view. `badges` is an
// id→[labelKey] map from computeBadges().
export function railHTML(combos, view, selectedId, badges = {}, sortKey = "section", lang = "en") {
  const S = STRINGS[lang];
  const available = sortCombos(combos.filter((c) => c.valid), view, sortKey);
  const clashing = combos.filter((c) => !c.valid)
    .sort((a, b) => a.section - b.section || a.group - b.group);
  const codeText = (c) => ltr(`${num(c.section, lang)} / ${num(c.labCode, lang)}`);

  // §21 — mobile rows also show two stats (waiting, longest day); CSS
  // hides .rowstats on desktop where the rail stays compact.
  const item = (c) => {
    const s = c[view];
    const labels = (badges[c.id] || [])
      .map((k) => `<span class="badge">${esc(S.labels[k])}</span>`).join("");
    return `<li class="item${c.id === selectedId ? " selected" : ""}"
                data-id="${c.id}" role="button" tabindex="0">
              <span class="code">${codeText(c)}</span>
              <span class="rowstats">
                <span><b>${ltr(fmt(s.deadMin))}</b> ${S.stat.deadMin}</span>
                <span><b>${ltr(fmt(s.worstDayMin))}</b> ${S.stat.worstDayMin}</span>
              </span>
              ${labels ? `<span class="badges">${labels}</span>` : ""}
            </li>`;
  };

  const clashItem = (c) => `<li class="item clash${c.id === selectedId ? " selected" : ""}"
              data-id="${c.id}" role="button" tabindex="0"
              title="${esc(conflictSentence(c, lang))}">
            <span class="code">${codeText(c)}</span>
            <span class="badges"><span class="badge status">${esc(S.labels.notAvailable)}</span></span>
          </li>`;

  return `<ul>${available.map(item).join("")}</ul>
    ${clashing.length ? `<div class="railhead">${esc(S.hasClash)}</div>
      <ul>${clashing.map(clashItem).join("")}</ul>` : ""}`;
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

export function computeBadges(combos, view) {
  const valid = combos.filter((c) => c.valid);
  const S = (c) => c[view];
  const vals = (key) => valid.map((c) => S(c)[key]);
  const min = (key) => Math.min(...vals(key));
  const max = (key) => Math.max(...vals(key));

  // lightest day = smallest single-day spanMin anywhere across combos
  const lightestDay = (c) => Math.min(...SETTINGS.days
    .map((d) => S(c).byDay[d]?.spanMin ?? Infinity));
  const minLightest = Math.min(...valid.map(lightestDay));

  const lateStart = max("avgStartMin");   // latestMornings
  const earlyEnd  = min("avgEndMin");      // earliestFinishes
  const bestWorst = min("worstDayMin");    // mostEven
  const bestDead  = min("deadMin");        // leastWaiting

  const map = {};
  for (const c of valid) {
    const s = S(c), b = [];
    if (s.avgStartMin === lateStart) b.push("latestMornings");
    if (s.avgEndMin === earlyEnd) b.push("earliestFinishes");
    if (s.worstDayMin === bestWorst) b.push("mostEven");
    if (s.deadMin === bestDead) b.push("leastWaiting");
    if (lightestDay(c) === minLightest) b.push("shortDay");
    // betterExists: a sibling in the same section beats it on deadMin
    if (valid.some((x) => x !== c && x.section === c.section && S(x).deadMin < s.deadMin))
      b.push("betterExists");
    map[c.id] = b;
  }
  return map;
}

// Sibling comparison inside the same section — same lectures, only the
// lab group differs. Returns the best sibling (lowest deadMin) or null.
export function computeNudge(combo, combos, view) {
  if (!combo.valid) return null;
  const S = (c) => c[view];
  const better = combos
    .filter((c) => c.valid && c.section === combo.section && c !== combo &&
                   S(c).deadMin < S(combo).deadMin)
    .sort((a, b) => S(a).deadMin - S(b).deadMin);
  if (!better.length) return null;
  const target = better[0];
  return { targetId: target.id, diffMin: S(combo).deadMin - S(target).deadMin };
}

// Near-twins: same-section combos that tie on deadMin AND worstDayMin but
// distribute their spans across different days — same totals, different
// shape. Returns one chip per distinct sibling shape (byte-identical twins
// are excluded; they get the twin chip instead). No better/worse framing.
export function computeShapeChips(combo, combos, view, lang = "en") {
  if (!combo.valid) return [];
  const S = (c) => c[view];
  const span = (c, d) => S(c).byDay[d]?.spanMin ?? 0;
  const shapeSig = (c) => SETTINGS.days.map((d) => span(c, d)).join(",");

  const seen = new Set();
  const chips = [];
  for (const s of combos) {
    if (!s.valid || s.section !== combo.section || s === combo) continue;
    if (S(s).deadMin !== S(combo).deadMin || S(s).worstDayMin !== S(combo).worstDayMin) continue;
    const sig = shapeSig(s);
    if (sig === shapeSig(combo) || seen.has(sig)) continue;   // identical shape → skip / dedupe
    seen.add(sig);
    // the day each combo carries most heavily relative to the other
    const heaviest = (a, b) => SETTINGS.days
      .reduce((best, d) => (span(a, d) - span(b, d) > span(a, best) - span(b, best) ? d : best),
              SETTINGS.days[0]);
    chips.push({
      selfDay: dayFull(heaviest(combo, s), lang),
      siblingId: s.id,
      siblingDay: dayFull(heaviest(s, combo), lang),
    });
  }
  return chips;
}

// Nudge card + quiet twin / shape chips for the selected combo.
export function nudgeHTML(combo, combos, view, lang = "en") {
  const S = STRINGS[lang];
  let out = "";
  const n = computeNudge(combo, combos, view);
  if (n) {
    out += `<div class="nudge">
      <b>${S.labels.betterExists}.</b>
      <div>${S.identicalLectures(cid(combo.id, lang), cid(n.targetId, lang), ltr(durText(n.diffMin, lang)))}</div>
      <button data-switch="${n.targetId}">${S.switchTo(cid(n.targetId, lang))}</button>
    </div>`;
  }
  if (combo.identicalTo?.length) {
    out += `<div class="twinchip">${S.sameTimings(combo.identicalTo.map((id) => cid(id, lang)).join(", "))}</div>`;
  }
  for (const s of computeShapeChips(combo, combos, view, lang)) {
    out += `<div class="shapechip">${S.sameTotals(cid(combo.id, lang), s.selfDay, cid(s.siblingId, lang), s.siblingDay)}</div>`;
  }
  return out;
}

// ---- STEP 4: clash notice (§14) ------------------------------
// Shown above the grid only for the clashing tier. Generated entirely
// from combo.conflicts — if the data is corrected and the section comes
// back clean, combo.valid flips true and this returns "" on its own.
export function noticeHTML(combo, lang = "en") {
  if (combo.valid) return "";
  const S = STRINGS[lang];
  return `<div class="clashnotice">
    <b>${esc(S.sectionHasClash(ltrText(num(combo.section, lang))))}</b>
    <div>${esc(conflictSentence(combo, lang))}</div>
    <div>${esc(S.cantTakeSection)}</div>
  </div>`;
}

// ---- §13: intro screen — computed quick-picks -----------------
// Quick picks reuse the same ranking logic as computeBadges(), always
// against Full week: the intro has no view toggle, and its own mockup
// numbers are unambiguously Full-week figures (verified against §5).
const QUICK_ORDER = ["bestOverall", "latestMornings", "earliestFinishes", "leastWaiting", "shortDay", "mostEven"];

// "Best overall" isn't any single badge — every other card is the winner
// on ONE axis, which is exactly what makes it not a well-rounded pick on
// its own. This combines the two headline stats (deadMin, the tool's own
// stated primary cost; worstDayMin, the balance/evenness measure behind
// "mostEven") into one score: rank each combo on each axis by its DISTINCT
// value (so ties share a rank), sum the two ranks, lowest total wins.
// Ties broken by section number, same as every other quick-pick category.
function computeBestOverall(combos, view) {
  const valid = combos.filter((c) => c.valid);
  const S = (c) => c[view];
  const rankOf = (key) => {
    const distinct = [...new Set(valid.map((c) => S(c)[key]))].sort((a, b) => a - b);
    return (c) => distinct.indexOf(S(c)[key]);
  };
  const rankDead = rankOf("deadMin"), rankWorst = rankOf("worstDayMin");
  let best = null, bestScore = Infinity;
  for (const c of valid) {
    const score = rankDead(c) + rankWorst(c);
    const better = score < bestScore ||
      (score === bestScore && best && c.section * 10 + c.group < best.section * 10 + best.group);
    if (best === null || better) { bestScore = score; best = c; }
  }
  return best;
}

// On a tie, the first pick is by section number; each LATER category
// skips any combo already used as an earlier category's headline, so
// the cards point at distinct combos ("start from what matters to you"
// — several different starting points, not one repeated).
export function computeQuickPicks(combos, lang = "en") {
  const S = STRINGS[lang];
  const badges = computeBadges(combos, "withLabs");
  const byKey = {};
  for (const [id, keys] of Object.entries(badges)) for (const k of keys) (byKey[k] ||= []).push(id);
  const combo = (id) => combos.find((c) => c.id === id);
  const bySectionGroup = (ids) => [...ids].sort((a, b) => {
    const ca = combo(a), cb = combo(b);
    return ca.section - cb.section || ca.group - cb.group;
  });
  const bestOverall = computeBestOverall(combos, "withLabs");

  const used = new Set();
  return QUICK_ORDER.map((key) => {
    const tie = key === "bestOverall"
      ? (bestOverall ? [bestOverall.id] : [])
      : bySectionGroup(byKey[key] || []);
    if (!tie.length) return null;
    const winnerId = tie.find((id) => !used.has(id)) ?? tie[0];
    used.add(winnerId);
    const winner = combo(winnerId);
    const s = winner.withLabs;
    // fact strings get esc()'d as a whole in introHTML, so embedded
    // times/durations use ltrText() (invisible isolate chars), not the
    // <span>-based ltr() used where content is inserted as raw HTML.
    let fact;
    if (key === "bestOverall") fact = S.quickBestOverall(ltrText(durText(s.deadMin, lang)), ltrText(durText(s.worstDayMin, lang)));
    else if (key === "latestMornings") fact = S.quickNothingBefore(ltrText(fmt(s.earliestStart)));
    else if (key === "earliestFinishes") fact = S.quickNeverPast(ltrText(fmt(s.latestEnd)));
    else if (key === "leastWaiting") fact = S.quickOfGaps(ltrText(durText(s.deadMin, lang)));
    else if (key === "mostEven") fact = S.quickNoDayOver(ltrText(durText(s.worstDayMin, lang)));
    else {   // shortDay — name the specific day that's light
      const day = SETTINGS.days.reduce((best, d) =>
        (s.byDay[d]?.spanMin ?? Infinity) < (s.byDay[best]?.spanMin ?? Infinity) ? d : best, SETTINGS.days[0]);
      fact = S.quickOneBlock(dayFull(day, lang), ltrText(durText(s.byDay[day].spanMin, lang)));
    }
    return { key, comboId: winnerId, extraCount: key === "bestOverall" ? 0 : tie.length - 1, fact };
  }).filter(Boolean);
}

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

// Intro screen: header, "Browse all sections", and the computed
// quick-pick cards. Cards carry data-combo for click wiring in
// index.html; the language toggle itself is wired there too.
export function introHTML(combos, lang = "en") {
  const S = STRINGS[lang];
  const valid = combos.filter((c) => c.valid);
  const totalCH = Object.values(courses).reduce((sum, c) => sum + c.ch, 0);
  const courseCount = Object.keys(courses).length;
  const picks = computeQuickPicks(combos, lang);

  const cards = picks.map((p) => {
    const c = combos.find((x) => x.id === p.comboId);
    return `<div class="pickcard" data-combo="${p.comboId}" role="button" tabindex="0">
      <span class="pickbadge">${esc(S.labels[p.key])}</span>
      <span class="pickcode">${ltr(`${num(c.section, lang)} / ${num(c.labCode, lang)}`)}</span>
      <span class="pickfact">${esc(p.fact)}</span>
      ${p.extraCount > 0 ? `<span class="pickmore">${esc(S.andNOther(num(p.extraCount, lang)))}</span>` : ""}
    </div>`;
  }).join("");

  return `<div class="intro">
    ${langToggleHTML(lang)}
    <div class="introhead">
      <div class="universityname">${esc(S.universityName)}</div>
      <div class="introyear">${esc(SETTINGS.year[lang])}</div>
      <h1>${esc(S.offeredSections)}</h1>
      <div class="introterm">${esc(SETTINGS.term[lang])}</div>
      <div class="introsub">${esc(S.subtitle(num(totalCH, lang), num(courseCount, lang), num(valid.length, lang)))}</div>
    </div>
    <button class="browseall" data-browse>
      <span>${esc(S.browseAll)}</span><span class="arrow" aria-hidden="true">→</span>
    </button>
    <div class="startfrom">${esc(S.startFrom)}</div>
    <div class="pickgrid">${cards}</div>
    <div class="introfooter">${esc(S.footerNote)}</div>
    <div class="disclaimer">${esc(S.disclaimer)}</div>
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

// One row per meeting, sorted by day then start. Labs drop out entirely
// when printing the Lecture-week view, same filtering every other
// view-aware computation in the app already applies. `days` narrows to a
// subset (print splits Sat–Mon | Tue–Wed into two side-by-side tables
// so a 15-row combo doesn't blow the page budget); omit it for all days.
export function scheduleTableHTML(combo, view, lang, days = SETTINGS.days) {
  const S = STRINGS[lang];
  const items = [...combo.lectures, ...(view === "withLabs" ? combo.labs : [])]
    .filter((m) => days.includes(m.day))
    .slice()
    .sort((a, b) => SETTINGS.days.indexOf(a.day) - SETTINGS.days.indexOf(b.day) || a.start - b.start);
  const rows = items.map((m) => {
    const room = m.room === null ? ltr("⌁") : m.roomUncertain ? ltr(`${esc(m.room)} ⌁`) : ltr(esc(m.room));
    return `<tr>
      <td>${esc(dayFull(m.day, lang))}</td>
      <td>${ltr(fmt(m.start))}</td>
      <td>${ltr(fmt(m.end))}</td>
      <td>${ltr(durText(m.end - m.start, lang))}</td>
      <td>${esc(courseName(m.course, lang))}</td>
      <td>${m.kind === "lab" ? esc(S.typeLab) : esc(S.typeLecture)}</td>
      <td>${room}</td>
    </tr>`;
  }).join("");
  return `<table class="printtable">
    <thead><tr>
      <th>${esc(S.printDay)}</th><th>${esc(S.printStart)}</th><th>${esc(S.printEnd)}</th>
      <th>${esc(S.printDuration)}</th><th>${esc(S.printCourse)}</th><th>${esc(S.printType)}</th><th>${esc(S.printRoom)}</th>
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
    if (!b) return "";
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
