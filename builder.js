// ============================================================
//  BUILDER — pick any lecture section per course and any lab code per
//  lab course (or nothing), see clashes live, and search/filter the
//  options. UI layer only: reads the parsed data and reuses app.js
//  renderers by adapting the picks into a combo-shaped object.
// ============================================================

import { SETTINGS } from "./schedule-data.js";
import {
  courses, lectures, labs, instructors, stats, overlaps,
  gridHTML, statsHTML, instructorsHTML, conflictSentence, langToggleHTML, ltr, fmt,
  printLegendHTML, scheduleTableHTML, dailyTotalsHTML, printFooterHTML, STRINGS,
} from "./app.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const DAY_AR = { Sat: "السبت", Sun: "الأحد", Mon: "الاثنين", Tue: "الثلاثاء", Wed: "الأربعاء" };
const dayName = (d, lang) => (lang === "ar" ? DAY_AR[d] : d);
const cname = (c, lang) => courses[c]?.[lang] || c;
const range = (m) => `${fmt(m.start)}–${fmt(m.end)}`;

export const BSTR = {
  en: {
    title: "Build your own schedule", printTitle: "My schedule",
    sub: "Pick any section per course. Clashes show up as you go.",
    back: "Back to home", tabPick: "Pick", tabWeek: "Week",
    mySection: "My section", myGroup: "Lab group", fill: "Fill from section", fillHint: "Fills every course from that section, then edit any course.",
    clear: "Clear all", share: "Copy link", copied: "Link copied",
    search: "Search doctor, course, room, day…", onlyFit: "Only what fits",
    notTaking: "Not taking", lecture: "Lecture", lab: "Lab", labs: "Labs", section: "Section",
    fits: "Fits", overlaps: (x, d, t) => `Overlaps ${x} · ${d} ${t}`, more: (n) => ` +${n}`,
    yourClash: "Your picks clash.", empty: "Pick a section to see your week.",
    noMatch: "Nothing matches — clear the search or the filters.",
    picked: (n, m) => `${n} of ${m} courses`, anyDoctor: "Any doctor", doctor: "Doctor",
    fullWeek: "Full week", lectureWeek: "Lecture week", roomNone: "room not published",
    ics: "Add to calendar (.ics)",
  },
  ar: {
    title: "ابنِ جدولك بنفسك", printTitle: "جدولي",
    sub: "اختر أي شعبة لكل مادة. يظهر التعارض فور اختيارك.",
    back: "العودة للرئيسية", tabPick: "الاختيار", tabWeek: "الأسبوع",
    mySection: "شعبتي", myGroup: "مجموعة المختبر", fill: "املأ من الشعبة", fillHint: "يملأ كل المواد من تلك الشعبة، ثم عدّل أي مادة.",
    clear: "مسح الكل", share: "نسخ الرابط", copied: "تم نسخ الرابط",
    search: "ابحث عن دكتور أو مادة أو قاعة أو يوم…", onlyFit: "المناسب فقط",
    notTaking: "لن أدرسها", lecture: "محاضرة", lab: "مختبر", labs: "المختبرات", section: "شعبة",
    fits: "مناسبة", overlaps: (x, d, t) => `تتعارض مع ${x} · ${d} ${t}`, more: (n) => ` +${n}`,
    yourClash: "اختياراتك متعارضة.", empty: "اختر شعبة لترى أسبوعك.",
    noMatch: "لا نتائج — امسح البحث أو المرشحات.",
    picked: (n, m) => `${n} من ${m} مواد`, anyDoctor: "أي دكتور", doctor: "الدكتور",
    fullWeek: "الأسبوع كامل", lectureWeek: "أسبوع المحاضرات", roomNone: "القاعة غير معلنة",
    ics: "أضف إلى التقويم (.ics)",
  },
};

// ---- options ---------------------------------------------------
const COURSE_IDS = Object.keys(courses);
const lecOpts = (c) => SETTINGS.sectionsAvailable.filter((s) => lectures.some((l) => l.course === c && l.section === s));
const labOpts = (c) => [...new Set(labs.filter((l) => l.course === c).map((l) => l.labCode))].sort((a, b) => a - b);
const meetingsFor = (c, kind, id) => kind === "lec"
  ? lectures.filter((l) => l.course === c && l.section === id).map((l) => ({ ...l, kind: "lecture" }))
  : labs.filter((l) => l.course === c && l.labCode === id).map((l) => ({ ...l, kind: "lab" }));
const doctorOf = (c, s, lang) => instructors[`${c}-${s}`]?.[lang] ?? "";

function pickedMeetings(picks, skip) {
  const out = [];
  for (const c of COURSE_IDS) {
    const p = picks[c] || {};
    if (p.lec != null && !(skip && skip.c === c && skip.k === "lec")) out.push(...meetingsFor(c, "lec", p.lec));
    if (p.lab != null && !(skip && skip.c === c && skip.k === "lab")) out.push(...meetingsFor(c, "lab", p.lab));
  }
  return out;
}

// ---- adapter: picks -> the combo shape every app.js renderer reads ----
export function comboFromPicks(picks) {
  const all = pickedMeetings(picks);
  const conflicts = [];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++)
      if (overlaps(all[i], all[j])) conflicts.push([all[i], all[j]]);
  const lec = all.filter((m) => m.kind === "lecture");
  const lb = all.filter((m) => m.kind === "lab");
  return {
    id: "custom", section: 0, group: 0, labCode: 0,
    valid: conflicts.length === 0, conflicts, lectures: lec, labs: lb,
    withLabs: stats(all), lecturesOnly: stats(lec), count: all.length,
  };
}
const hasMeetings = (combo, view) => SETTINGS.days.some((d) => combo[view].byDay[d]);

// ---- clash status of one option against everything else picked --------
function clashesFor(picks, c, kind, id) {
  const others = pickedMeetings(picks, { c, k: kind });
  const out = [];
  for (const m of meetingsFor(c, kind, id))
    for (const o of others) if (overlaps(m, o)) out.push({ other: o, mine: m });
  return out;
}

// ---- hash <-> picks ("MB7,BC4,BCL41") -----------------------------
export function picksToHash(picks) {
  const t = [];
  for (const c of COURSE_IDS) {
    const p = picks[c] || {};
    if (p.lec != null) t.push(`${c}${p.lec}`);
    if (p.lab != null) t.push(`${c}L${p.lab}`);
  }
  return t.join(",");
}
export function hashToPicks(str) {
  const picks = {};
  for (const tok of String(str || "").split(",")) {
    const m = /^([A-Z]{2})(L?)(\d+)$/.exec(tok);
    if (!m || !courses[m[1]]) continue;
    const id = +m[3];
    if (m[2] === "L") {
      if (courses[m[1]].hasLab && labOpts(m[1]).includes(id)) (picks[m[1]] ||= {}).lab = id;
    } else if (lecOpts(m[1]).includes(id)) (picks[m[1]] ||= {}).lec = id;
  }
  return picks;
}

export function createBuilderState(hashStr) {
  let picks = hashToPicks(hashStr);
  if (!Object.keys(picks).length) {
    try { picks = hashToPicks(localStorage.getItem("picks")); } catch { /* storage blocked */ }
  }
  return { picks, view: "withLabs", q: "", instr: {}, onlyFit: false, open: null, tab: "pick" };
}
export function persist(b) {
  try { localStorage.setItem("picks", picksToHash(b.picks)); } catch { /* storage blocked */ }
}

// ---- search ---------------------------------------------------------
const norm = (s) => String(s).toLowerCase().normalize("NFKD")
  .replace(/[ً-ٰٟـ]/g, "")
  .replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

function haystack(c, kind, id) {
  const ms = meetingsFor(c, kind, id);
  const parts = [c, courses[c].en, courses[c].ar, courses[c].code, String(id)];
  if (kind === "lec") parts.push(doctorOf(c, id, "en"), doctorOf(c, id, "ar"));
  for (const m of ms) parts.push(m.day, DAY_AR[m.day], m.room ?? "", range(m));
  return norm(parts.join(" "));
}
function matches(q, c, kind, id) {
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const h = haystack(c, kind, id);
  return tokens.every((t) => h.includes(t));
}

// ---- rendering --------------------------------------------------------
function whenHTML(c, kind, id, lang) {
  const byTime = new Map();
  for (const m of meetingsFor(c, kind, id)) {
    const k = range(m);
    (byTime.get(k) || byTime.set(k, []).get(k)).push(m.day);
  }
  return [...byTime.entries()].map(([t, days]) =>
    `${days.sort((a, b) => SETTINGS.days.indexOf(a) - SETTINGS.days.indexOf(b)).map((d) => esc(dayName(d, lang))).join(" · ")} ${ltr(t)}`
  ).join(" / ");
}
function roomsHTML(c, kind, id, lang) {
  const S = BSTR[lang];
  const rooms = meetingsFor(c, kind, id).map((m) => (m.room === null ? S.roomNone : m.room));
  return [...new Set(rooms)].map((r) => ltr(esc(r))).join(" · ");
}

function optionHTML(b, c, kind, id, lang) {
  const S = BSTR[lang];
  const sel = (b.picks[c] || {})[kind] === id;
  const clashes = clashesFor(b.picks, c, kind, id);
  const fits = clashes.length === 0;
  if (b.onlyFit && !fits && !sel) return "";
  const first = clashes[0];
  const status = fits
    ? `<span class="bstat ok">${esc(S.fits)}</span>`
    : `<span class="bstat bad">${S.overlaps(esc(cname(first.other.course, lang)), esc(dayName(first.mine.day, lang)), ltr(range(first.other)))}${clashes.length > 1 ? esc(S.more(clashes.length - 1)) : ""}</span>`;
  const doc = kind === "lec" ? doctorOf(c, id, lang) : "";
  return `<button class="bopt${sel ? " sel" : ""}${fits ? "" : " clash"}" data-pick data-course="${c}" data-kind="${kind}" data-id="${id}" aria-pressed="${sel}">
    <span class="bnum">${ltr(String(id))}</span>
    <span class="bmain">
      ${doc ? `<span class="bdoc">${esc(doc)}</span>` : ""}
      <span class="bwhen">${whenHTML(c, kind, id, lang)}</span>
      <span class="bwhere">${roomsHTML(c, kind, id, lang)}</span>
    </span>
    ${status}
  </button>`;
}

function courseHTML(b, c, lang) {
  const S = BSTR[lang];
  const p = b.picks[c] || {};
  const lecIds = lecOpts(c).filter((id) => matches(b.q, c, "lec", id)
    && (!b.instr[c] || doctorOf(c, id, "en") === b.instr[c]));
  const labIds = courses[c].hasLab ? labOpts(c).filter((id) => matches(b.q, c, "lab", id)) : [];
  const searching = !!b.q.trim();
  const open = b.open === c || (searching && (lecIds.length || labIds.length));
  if (searching && !lecIds.length && !labIds.length) return "";
  const summary = [
    p.lec != null ? `${S.lecture} ${ltr(String(p.lec))}` : `${S.lecture}: ${S.notTaking}`,
    courses[c].hasLab ? (p.lab != null ? `${S.lab} ${ltr(String(p.lab))}` : `${S.lab}: ${S.notTaking}`) : "",
  ].filter(Boolean).join(" · ");

  const doctors = [...new Set(lecOpts(c).map((id) => doctorOf(c, id, "en")).filter(Boolean))];
  const doctorChips = doctors.length > 1 ? `<div class="bdocs" role="group" aria-label="${esc(S.doctor)}">
      <button class="bdocchip" data-doc="${c}" data-name="" aria-pressed="${!b.instr[c]}">${esc(S.anyDoctor)}</button>
      ${doctors.map((n) => {
        const ar = instructors[Object.keys(instructors).find((k) => k.startsWith(c + "-") && instructors[k].en === n)]?.ar;
        return `<button class="bdocchip" data-doc="${c}" data-name="${esc(n)}" aria-pressed="${b.instr[c] === n}">${esc(lang === "ar" ? ar || n : n)}</button>`;
      }).join("")}
    </div>` : "";

  return `<section class="bcourse${open ? " open" : ""}" data-course="${c}">
    <button class="bhead" data-open="${c}" aria-expanded="${!!open}">
      <span class="bdot"></span>
      <span class="btitle">${esc(cname(c, lang))}</span>
      <span class="bsum">${summary}</span>
    </button>
    ${open ? `<div class="bbody">
      ${doctorChips}
      <div class="bgroup"><div class="bgrouphead">${esc(S.lecture)}
        ${p.lec != null ? `<button class="bnone" data-none="${c}" data-kind="lec">${esc(S.notTaking)}</button>` : ""}</div>
        ${lecIds.map((id) => optionHTML(b, c, "lec", id, lang)).join("") || `<p class="bempty">${esc(S.noMatch)}</p>`}
      </div>
      ${courses[c].hasLab ? `<div class="bgroup"><div class="bgrouphead">${esc(S.labs)}
        ${p.lab != null ? `<button class="bnone" data-none="${c}" data-kind="lab">${esc(S.notTaking)}</button>` : ""}</div>
        ${labIds.map((id) => optionHTML(b, c, "lab", id, lang)).join("") || `<p class="bempty">${esc(S.noMatch)}</p>`}
      </div>` : ""}
    </div>` : ""}
  </section>`;
}

export function builderHTML(b, lang) {
  const S = BSTR[lang];
  const combo = comboFromPicks(b.picks);
  const pickedCourses = COURSE_IDS.filter((c) => (b.picks[c] || {}).lec != null || (b.picks[c] || {}).lab != null).length;
  const show = hasMeetings(combo, b.view);
  const notice = combo.valid ? "" : `<div class="clashnotice"><b>${esc(S.yourClash)}</b><div>${esc(conflictSentence(combo, lang))}</div></div>`;
  const courseList = COURSE_IDS.map((c) => courseHTML(b, c, lang)).join("");
  return `
  <div class="buildview" data-btab="${b.tab}">
    ${langToggleHTML(lang)}
    <div class="appbar">
      <div class="bunivline">${esc(STRINGS[lang].universityName)} · ${esc(SETTINGS.year[lang])} · ${esc(SETTINGS.term[lang])}</div>
      <h1>${esc(S.title)}</h1>
      <div class="sub">${esc(S.sub)} · ${esc(S.picked(pickedCourses, COURSE_IDS.length))}</div>
    </div>
    <div class="btabs" role="tablist">
      <button data-tab="pick" aria-pressed="${b.tab === "pick"}">${esc(S.tabPick)}</button>
      <button data-tab="week" aria-pressed="${b.tab === "week"}">${esc(S.tabWeek)}${combo.valid ? "" : ` <span class="btabwarn">!</span>`}</button>
    </div>
    <div class="blayout">
      <div class="bpanel">
        <div class="btools">
          <input class="bsearch" type="search" data-search value="${esc(b.q)}" placeholder="${esc(S.search)}" aria-label="${esc(S.search)}" enterkeyhint="search">
          <div class="brow bfill">
            <select class="bsel" data-fillsec aria-label="${esc(S.mySection)}">${SETTINGS.sectionsAvailable.map((n) => `<option value="${n}">${esc(S.mySection)} ${n}</option>`).join("")}</select>
            <select class="bsel" data-fillgrp aria-label="${esc(S.myGroup)}">${SETTINGS.labGroups.map((n) => `<option value="${n}">${esc(S.myGroup)} ${n}</option>`).join("")}</select>
            <button class="bbtn" data-fill>${esc(S.fill)}</button>
          </div>
          <div class="bmsg">${esc(S.fillHint)}</div>
          <div class="brow">
            <label class="bfit"><input type="checkbox" data-onlyfit ${b.onlyFit ? "checked" : ""}> ${esc(S.onlyFit)}</label>
          </div>
          <div class="brow">
            <button class="bbtn" data-clear>${esc(S.clear)}</button>
            <button class="bbtn" data-share>${esc(S.share)}</button>
          </div>
          <div class="bmsg" data-msg role="status" aria-live="polite"></div>
        </div>
        <div class="bcourses">${courseList || `<p class="bempty">${esc(S.noMatch)}</p>`}</div>
      </div>
      <div class="bweek canvas">
        ${notice}
        <div class="viewtoggle" role="group">
          <button data-bview="withLabs" aria-pressed="${b.view === "withLabs"}">${esc(S.fullWeek)}</button>
          <button data-bview="lecturesOnly" aria-pressed="${b.view === "lecturesOnly"}">${esc(S.lectureWeek)}</button>
        </div>
        ${combo.count ? "" : `<p class="bempty">${esc(S.empty)}</p>`}
        ${gridHTML(combo, b.view, false, lang)}
        ${combo.count ? instructorsHTML(combo, lang) : ""}
        ${combo.valid && show ? statsHTML(combo, b.view, lang) : ""}
        ${combo.valid && combo.count ? `
          <div class="printonly"><div class="printheader"><div class="printtitle">${esc(S.printTitle)}</div>
            <div class="printmeta">${esc(STRINGS[lang].fullWeek)} · ${esc(STRINGS[lang].printGenerated(new Date().toISOString().slice(0, 10)))}</div></div></div>
          <div class="printonly">${printLegendHTML(lang)}</div>
          <div class="printonly">${scheduleTableHTML(combo, "withLabs", lang)}</div>
          <div class="printonly">${dailyTotalsHTML(combo, "withLabs", lang)}</div>
          <div class="printonly">${printFooterHTML(lang)}</div>
          <button class="savepdf" data-savepdf>${esc(STRINGS[lang].saveAsPdf)}</button>
          <div class="savepdf-note">${esc(STRINGS[lang].printDialogHint)}</div>` : ""}
        ${combo.count ? `<button class="bbtn bics" data-ics>${esc(S.ics)}</button>` : ""}
      </div>
    </div>
    <div class="bfooter"><div>${esc(STRINGS[lang].footerNote)}</div><div class="disclaimer">${esc(STRINGS[lang].disclaimer)}</div></div>
  </div>`;
}

// ---- calendar export (.ics): one weekly-recurring event per meeting -------
const ICS_DAY = { Sat: "SA", Sun: "SU", Mon: "MO", Tue: "TU", Wed: "WE" };
export function icsFor(combo, lang) {
  const pad = (n) => String(n).padStart(2, "0");
  // anchor to the coming occurrence of each weekday
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Sat: 6 };
  const now = new Date();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Section Picker//EN", "CALSCALE:GREGORIAN"];
  [...combo.lectures, ...combo.labs].forEach((m, i) => {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + ((dow[m.day] - d.getDay() + 7) % 7));
    const stamp = (min) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`;
    const doc = m.kind === "lecture" ? doctorOf(m.course, m.section, lang) : "";
    lines.push("BEGIN:VEVENT", `UID:sp-${i}-${m.course}-${m.day}@section-picker`,
      `DTSTAMP:${stamp(0)}`, `DTSTART:${stamp(m.start)}`, `DTEND:${stamp(m.end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAY[m.day]}`,
      `SUMMARY:${cname(m.course, lang)}${m.kind === "lab" ? " (Lab)" : ""}`,
      `LOCATION:${m.room ?? ""}`, doc ? `DESCRIPTION:${doc}` : "DESCRIPTION:", "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ---- wiring ------------------------------------------------------------
// h = { rerender(), setLang(l), openPopover(el), lang(), savePdf() }
export function wireBuilder(root, b, h) {
  const lang = h.lang();
  const S = BSTR[lang];
  const change = () => { persist(b); h.rerender(); };
  const msg = (t) => { const el = root.querySelector("[data-msg]"); if (el) el.textContent = t; };

  root.querySelectorAll(".langtoggle button[data-lang]").forEach((el) =>
    el.addEventListener("click", () => h.setLang(el.dataset.lang)));
  root.querySelectorAll("[data-tab]").forEach((el) => el.addEventListener("click", () => { b.tab = el.dataset.tab; h.rerender(); }));
  root.querySelectorAll("[data-bview]").forEach((el) => el.addEventListener("click", () => { b.view = el.dataset.bview; h.rerender(); }));
  root.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => {
    b.open = b.open === el.dataset.open ? null : el.dataset.open; h.rerender();
  }));
  root.querySelectorAll("[data-pick]").forEach((el) => el.addEventListener("click", () => {
    const c = el.dataset.course, k = el.dataset.kind, id = +el.dataset.id;
    const p = (b.picks[c] ||= {});
    p[k] = p[k] === id ? null : id;
    change();
  }));
  root.querySelectorAll("[data-none]").forEach((el) => el.addEventListener("click", () => {
    (b.picks[el.dataset.none] ||= {})[el.dataset.kind] = null; change();
  }));
  root.querySelectorAll("[data-doc]").forEach((el) => el.addEventListener("click", () => {
    b.instr[el.dataset.doc] = el.dataset.name && b.instr[el.dataset.doc] !== el.dataset.name ? el.dataset.name : null;
    h.rerender();
  }));
  root.querySelector("[data-onlyfit]")?.addEventListener("change", (e) => { b.onlyFit = e.target.checked; h.rerender(); });
  root.querySelector("[data-fill]")?.addEventListener("click", () => {
    const sec = +root.querySelector("[data-fillsec]").value, grp = +root.querySelector("[data-fillgrp]").value;
    b.picks = {};
    for (const c of COURSE_IDS) {
      const lec = lecOpts(c).includes(sec) ? sec : null;
      const code = sec * 10 + grp;
      b.picks[c] = { lec, lab: courses[c].hasLab && labOpts(c).includes(code) ? code : null };
    }
    b.open = null; b.tab = "week"; change();
  });
  root.querySelector("[data-clear]")?.addEventListener("click", () => { b.picks = {}; b.instr = {}; b.q = ""; change(); });
  root.querySelector("[data-share]")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); msg(S.copied); } catch { msg(location.href); }
  });
  root.querySelector("[data-ics]")?.addEventListener("click", () => {
    const blob = new Blob([icsFor(comboFromPicks(b.picks), lang)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "my-schedule.ics"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  const search = root.querySelector("[data-search]");
  if (search) {
    search.addEventListener("input", () => {
      b.q = search.value;
      const pos = search.selectionStart;
      h.rerender();
      const again = document.querySelector("[data-search]");
      again?.focus(); try { again?.setSelectionRange(pos, pos); } catch { /* not supported */ }
    });
  }
  root.querySelector("[data-savepdf]")?.addEventListener("click", h.savePdf);
  root.querySelectorAll(".grid .block").forEach((el) => el.addEventListener("click", () => h.openPopover(el)));
}
