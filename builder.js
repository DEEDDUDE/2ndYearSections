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
    title: "My schedule", printTitle: "My schedule",
    mySection: "Section", myGroup: "Lab group", lec1: "Lecture 1", lec2: "Lecture 2",
    clearAll: "Clear all", clear: "Clear", share: "Copy link", copied: "Copied",
    search: "Search", onlyFit: "Only what fits", sameDoc: "Same doctor only", lecture: "Lecture", lab: "Lab", labs: "Labs", sec: "Sec",
    clashWith: (x, d, t) => `× ${x} · ${d} ${t}`, more: (n) => ` +${n}`,
    yourClash: "Clash", noMatch: "No match", anyDoctor: "Any", doctor: "Doctor",
    fullWeek: "Full week", lectureWeek: "Lecture week", roomNone: "TBA",
    ics: "Calendar", week: "Week", close: "Close",
    foot: "Student-made, not official · data from the registration portal",
  },
  ar: {
    title: "جدولي", printTitle: "جدولي",
    mySection: "الشعبة", myGroup: "مجموعة المختبر", lec1: "محاضرة 1", lec2: "محاضرة 2",
    clearAll: "مسح الكل", clear: "مسح", share: "نسخ الرابط", copied: "تم النسخ",
    search: "بحث", onlyFit: "المناسب فقط", sameDoc: "نفس الدكتور فقط", lecture: "محاضرة", lab: "مختبر", labs: "المختبرات", sec: "شعبة",
    clashWith: (x, d, t) => `× ${x} · ${d} ${t}`, more: (n) => ` +${n}`,
    yourClash: "تعارض", noMatch: "لا نتائج", anyDoctor: "الكل", doctor: "الدكتور",
    fullWeek: "الأسبوع كامل", lectureWeek: "المحاضرات فقط", roomNone: "غير معلنة",
    ics: "التقويم", week: "الأسبوع", close: "إغلاق",
    foot: "من إعداد طالب وليس تطبيقًا رسميًا · البيانات من بوابة التسجيل",
  },
};

// ---- options ---------------------------------------------------
const COURSE_IDS = Object.keys(courses);
const lecOpts = (c) => SETTINGS.sectionsAvailable.filter((s) => lectures.some((l) => l.course === c && l.section === s));
const labOpts = (c) => [...new Set(labs.filter((l) => l.course === c).map((l) => l.labCode))].sort((a, b) => a - b);
const byDayOrder = (a, b) => SETTINGS.days.indexOf(a.day) - SETTINGS.days.indexOf(b.day) || a.start - b.start;
// a section's lecture meetings in week order: index 0 = first lecture, 1 = second
const lecMeetings = (c, sec) => lectures.filter((l) => l.course === c && l.section === sec)
  .map((l) => ({ ...l, kind: "lecture" })).sort(byDayOrder);
const meetingsFor = (c, kind, id) => kind === "lec"
  ? lecMeetings(c, id)
  : labs.filter((l) => l.course === c && l.labCode === id).map((l) => ({ ...l, kind: "lab" }));
const slotsOf = (p) => (p && p.l) || [null, null];
const doctorOf = (c, s, lang) => instructors[`${c}-${s}`]?.[lang] ?? "";

// skip = { c, k: "lec"|"lab", slot?: 0|1 } leaves that part out (used to ask
// "would this option clash with everything ELSE I picked?")
function pickedMeetings(picks, skip) {
  const out = [];
  for (const c of COURSE_IDS) {
    const p = picks[c] || {};
    slotsOf(p).forEach((sec, i) => {
      if (sec == null) return;
      if (skip && skip.c === c && skip.k === "lec" && (skip.slot == null || skip.slot === i)) return;
      const m = lecMeetings(c, sec)[i];
      if (m) out.push(m);
    });
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
function clashesFor(picks, c, kind, id, slot) {
  const others = pickedMeetings(picks, { c, k: kind, slot });
  const mine = kind === "lec" && slot != null ? [lecMeetings(c, id)[slot]].filter(Boolean) : meetingsFor(c, kind, id);
  const out = [];
  for (const m of mine)
    for (const o of others) if (overlaps(m, o)) out.push({ other: o, mine: m });
  return out;
}

// ---- hash <-> picks ("MB7,BC4,BCL41") -----------------------------
// "MB7" = both lectures from section 7; "MB7.4" = 1st lecture from 7, 2nd from 4;
// "MB7." / "MB.4" = only one of the two; "BCL41" = lab 41
export function picksToHash(picks) {
  const t = [];
  for (const c of COURSE_IDS) {
    const p = picks[c] || {};
    const [a, b2] = slotsOf(p);
    if (a != null || b2 != null) t.push(a === b2 ? `${c}${a}` : `${c}${a ?? ""}.${b2 ?? ""}`);
    if (p.lab != null) t.push(`${c}L${p.lab}`);
  }
  return t.join(",");
}
export function hashToPicks(str) {
  const picks = {};
  for (const tok of String(str || "").split(",")) {
    const m = /^([A-Z]{2})(L?)(\d*)(?:\.(\d*))?$/.exec(tok);
    if (!m || !courses[m[1]]) continue;
    const c = m[1];
    if (m[2] === "L") {
      const id = +m[3];
      if (m[3] && m[4] === undefined && courses[c].hasLab && labOpts(c).includes(id)) (picks[c] ||= {}).lab = id;
      continue;
    }
    const ok = (v) => (v && lecOpts(c).includes(+v) ? +v : null);
    const l = m[4] === undefined ? [ok(m[3]), ok(m[3])] : [ok(m[3]), ok(m[4])];
    if (l[0] != null || l[1] != null) (picks[c] ||= {}).l = l;
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
function meetLine(m, lang) {
  const S = BSTR[lang];
  return `${esc(dayName(m.day, lang))} ${ltr(range(m))}<span class="bmeetroom"> · ${ltr(esc(m.room === null ? S.roomNone : m.room))}</span>`;
}
function statusHTML(clashes, lang) {
  const S = BSTR[lang];
  if (!clashes.length) return "";
  const f = clashes[0];
  return `<span class="bstat bad">${S.clashWith(ltr(esc(f.other.course)), esc(dayName(f.mine.day, lang)), ltr(range(f.other)))}${clashes.length > 1 ? esc(S.more(clashes.length - 1)) : ""}</span>`;
}
function roomsHTML(c, kind, id, lang) {
  const S = BSTR[lang];
  const rooms = meetingsFor(c, kind, id).map((m) => (m.room === null ? S.roomNone : m.room));
  return [...new Set(rooms)].map((r) => ltr(esc(r))).join(" · ");
}
function whenHTML(c, kind, id, lang) {
  return meetingsFor(c, kind, id).map((m) => `${esc(dayName(m.day, lang))} ${ltr(range(m))}`).join(" / ");
}

// lab option: one tap target
function labOptionHTML(b, c, id, lang) {
  const sel = (b.picks[c] || {}).lab === id;
  const clashes = clashesFor(b.picks, c, "lab", id);
  if (b.onlyFit && clashes.length && !sel) return "";
  return `<button class="bopt${sel ? " sel" : ""}${clashes.length ? " clash" : ""}" data-pick data-course="${c}" data-kind="lab" data-id="${id}" aria-pressed="${sel}">
    <span class="bnum">${ltr(String(id))}</span>
    <span class="bmain"><span class="bwhen">${whenHTML(c, "lab", id, lang)}</span></span>
    ${statusHTML(clashes, lang)}
  </button>`;
}

// lecture option: the whole section in one tap, or each of its two weekly
// lectures separately (so lecture 1 can come from section 7 and lecture 2 from section 4)
function lecOptionHTML(b, c, id, lang) {
  const S = BSTR[lang];
  const [s0, s1] = slotsOf(b.picks[c]);
  const whole = s0 === id && s1 === id;
  const all = clashesFor(b.picks, c, "lec", id);
  const parts = lecMeetings(c, id).map((m, i) => ({ m, i, cl: clashesFor(b.picks, c, "lec", id, i), sel: slotsOf(b.picks[c])[i] === id }));
  if (b.onlyFit && parts.every((p) => p.cl.length) && !parts.some((p) => p.sel)) return "";
  const doc = doctorOf(c, id, lang);
  return `<div class="bcard${whole ? " sel" : ""}">
    <button class="bopt${whole ? " sel" : ""}${all.length ? " clash" : ""}" data-pick data-course="${c}" data-kind="lec" data-id="${id}" aria-pressed="${whole}">
      <span class="bnum">${ltr(String(id))}</span>
      <span class="bmain"><span class="bdoc">${esc(doc)}</span></span>
    </button>
    <div class="bmeets">${parts.map(({ m, i, cl, sel }) => `<button class="bmeet${sel ? " sel" : ""}${cl.length ? " clash" : ""}" data-meet data-course="${c}" data-id="${id}" data-slot="${i}" aria-pressed="${sel}">
        <span class="bmeetn">${esc(i === 0 ? S.lec1 : S.lec2)}</span>
        <span class="bmeetw">${meetLine(m, lang)}</span>
        ${statusHTML(cl, lang)}
      </button>`).join("")}</div>
  </div>`;
}

function courseHTML(b, c, lang) {
  const S = BSTR[lang];
  const p = b.picks[c] || {};
  // "same doctor": keep only sections taught by whoever teaches the lecture(s) already picked
  const pickedDocs = new Set(slotsOf(p).filter((x) => x != null).map((x) => doctorOf(c, x, "en")));
  const lecIds = lecOpts(c).filter((id) => matches(b.q, c, "lec", id)
    && (!b.instr[c] || doctorOf(c, id, "en") === b.instr[c])
    && (!b.sameDoc || !pickedDocs.size || pickedDocs.has(doctorOf(c, id, "en"))));
  const labIds = courses[c].hasLab ? labOpts(c).filter((id) => matches(b.q, c, "lab", id)) : [];
  const searching = !!b.q.trim();
  const open = b.open === c || (searching && (lecIds.length || labIds.length));
  if (searching && !lecIds.length && !labIds.length) return "";
  const [s0, s1] = slotsOf(p);
  const lecSummary = s0 == null && s1 == null ? "—"
    : s0 === s1 ? `${S.sec} ${ltr(String(s0))}`
    : `${S.sec} ${ltr(`${s0 ?? "—"}+${s1 ?? "—"}`)}`;
  const summary = [
    lecSummary,
    courses[c].hasLab ? (p.lab != null ? `${S.lab} ${ltr(String(p.lab))}` : "") : "",
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
      <div class="bgroup"><div class="bgrouphead"><span>${esc(S.lecture)}</span>
        ${s0 != null || s1 != null ? `<button class="bnone" data-none="${c}" data-kind="lec">${esc(S.clear)}</button>` : ""}</div>
        ${lecIds.map((id) => lecOptionHTML(b, c, id, lang)).join("") || `<p class="bempty">${esc(S.noMatch)}</p>`}
      </div>
      ${courses[c].hasLab ? `<div class="bgroup"><div class="bgrouphead"><span>${esc(S.labs)}</span>
        ${p.lab != null ? `<button class="bnone" data-none="${c}" data-kind="lab">${esc(S.clear)}</button>` : ""}</div>
        <div class="blabs">${labIds.map((id) => labOptionHTML(b, c, id, lang)).join("") || `<p class="bempty">${esc(S.noMatch)}</p>`}</div>
      </div>` : ""}
    </div>` : ""}
  </section>`;
}

export function builderHTML(b, lang) {
  const S = BSTR[lang];
  const combo = comboFromPicks(b.picks);
  const show = hasMeetings(combo, b.view);
  const clashText = combo.valid ? "" : esc(conflictSentence(combo, lang));
  const notice = combo.valid ? "" : `<div class="clashnotice"><b>${esc(S.yourClash)}</b> ${clashText}</div>`;
  const courseList = COURSE_IDS.map((c) => courseHTML(b, c, lang)).join("");
  const chips = (list, attr, current) => list.map((n) =>
    `<button class="bchip" ${attr}="${n}" aria-pressed="${current === n}">${ltr(String(n))}</button>`).join("");
  return `
  <div class="buildview${b.sheet ? " sheet-open" : ""}">
    <div class="btop"><h1>${esc(S.title)}</h1>${langToggleHTML(lang)}</div>
    <div class="bunivline">${esc(STRINGS[lang].universityName)} · ${esc(SETTINGS.year[lang])} · ${esc(SETTINGS.term[lang])}</div>
    <div class="bdock">
      <div class="bmini" data-sheet role="button" tabindex="0" aria-label="${esc(S.week)}">${gridHTML(combo, b.view, false, lang)}</div>
      ${notice}
    </div>
    <div class="blayout">
      <div class="bpanel">
        <div class="btools">
          <div class="brow">
            <input class="bsearch" type="search" data-search value="${esc(b.q)}" placeholder="${esc(S.search)}" aria-label="${esc(S.search)}" enterkeyhint="search">
            <details class="bmore"><summary aria-label="…">⋯</summary>
              <div class="bmenu">
                <label class="bfit"><input type="checkbox" data-onlyfit ${b.onlyFit ? "checked" : ""}> ${esc(S.onlyFit)}</label>
                <label class="bfit"><input type="checkbox" data-samedoc ${b.sameDoc ? "checked" : ""}> ${esc(S.sameDoc)}</label>
                <button class="bbtn" data-clear>${esc(S.clearAll)}</button>
                <button class="bbtn" data-share>${esc(S.share)}</button>
                <span class="bmsg" data-msg role="status" aria-live="polite"></span>
              </div>
            </details>
          </div>
          <div class="bchiprow"><span class="bchiplabel">${esc(S.mySection)}</span><div class="bchips">${chips(SETTINGS.sectionsAvailable, "data-chipsec", b.fillSec)}</div></div>
          <div class="bchiprow"><span class="bchiplabel">${esc(S.myGroup)}</span><div class="bchips">${chips(SETTINGS.labGroups, "data-chipgrp", b.fillGrp)}</div></div>
        </div>
        <div class="bcourses">${courseList || `<p class="bempty">${esc(S.noMatch)}</p>`}</div>
      </div>
      <div class="bweek canvas">
        <div class="bsheetbar"><button class="bbtn" data-sheetclose>${esc(S.close)}</button></div>
        ${notice}
        <div class="viewtoggle" role="group">
          <button data-bview="withLabs" aria-pressed="${b.view === "withLabs"}">${esc(S.fullWeek)}</button>
          <button data-bview="lecturesOnly" aria-pressed="${b.view === "lecturesOnly"}">${esc(S.lectureWeek)}</button>
        </div>
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
          <div class="bactions">
            <button class="bbtn" data-savepdf>${esc(STRINGS[lang].saveAsPdf)}</button>
            <button class="bbtn" data-ics>${esc(S.ics)}</button>
          </div>
          <div class="savepdf-note">${esc(STRINGS[lang].printDialogHint)}</div>` : ""}
      </div>
    </div>
    <div class="bfooter">${esc(S.foot)}</div>
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
  root.querySelectorAll("[data-bview]").forEach((el) => el.addEventListener("click", () => { b.view = el.dataset.bview; h.rerender(); }));

  // phone: the docked mini week opens the full week as a sheet
  const mini = root.querySelector("[data-sheet]");
  const openSheet = () => { b.sheet = true; h.rerender(); };
  mini?.addEventListener("click", openSheet);
  mini?.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSheet(); } });
  root.querySelector("[data-sheetclose]")?.addEventListener("click", () => { b.sheet = false; h.rerender(); });

  root.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => {
    b.open = b.open === el.dataset.open ? null : el.dataset.open;
    h.rerender();
    if (b.open) requestAnimationFrame(() => document.querySelector(".bcourse.open")?.scrollIntoView({ block: "start" }));
  }));
  root.querySelectorAll("[data-pick]").forEach((el) => el.addEventListener("click", () => {
    const c = el.dataset.course, k = el.dataset.kind, id = +el.dataset.id;
    const p = (b.picks[c] ||= {});
    if (k === "lab") p.lab = p.lab === id ? null : id;
    else { const [x, y] = slotsOf(p); p.l = x === id && y === id ? [null, null] : [id, id]; }
    change();
  }));
  root.querySelectorAll("[data-meet]").forEach((el) => el.addEventListener("click", () => {
    const p = (b.picks[el.dataset.course] ||= {}), i = +el.dataset.slot, id = +el.dataset.id;
    const l = [...slotsOf(p)];
    l[i] = l[i] === id ? null : id;
    p.l = l; change();
  }));
  root.querySelectorAll("[data-none]").forEach((el) => el.addEventListener("click", () => {
    const p = (b.picks[el.dataset.none] ||= {});
    if (el.dataset.kind === "lab") p.lab = null; else p.l = [null, null];
    change();
  }));
  root.querySelectorAll("[data-doc]").forEach((el) => el.addEventListener("click", () => {
    b.instr[el.dataset.doc] = el.dataset.name && b.instr[el.dataset.doc] !== el.dataset.name ? el.dataset.name : null;
    h.rerender();
  }));
  root.querySelector("[data-samedoc]")?.addEventListener("change", (e) => { b.sameDoc = e.target.checked; h.rerender(); });
  root.querySelector("[data-onlyfit]")?.addEventListener("change", (e) => { b.onlyFit = e.target.checked; h.rerender(); });

  // section chip: fill every course from that section; lab-group chip: swap the labs only
  root.querySelectorAll("[data-chipsec]").forEach((el) => el.addEventListener("click", () => {
    const sec = +el.dataset.chipsec, grp = b.fillGrp || 1;
    b.fillSec = sec; b.fillGrp = grp;
    b.picks = {};
    for (const c of COURSE_IDS) {
      const lec = lecOpts(c).includes(sec) ? sec : null;
      const code = sec * 10 + grp;
      b.picks[c] = { l: [lec, lec], lab: courses[c].hasLab && labOpts(c).includes(code) ? code : null };
    }
    b.open = null; change();
  }));
  root.querySelectorAll("[data-chipgrp]").forEach((el) => el.addEventListener("click", () => {
    b.fillGrp = +el.dataset.chipgrp;
    if (b.fillSec) for (const c of COURSE_IDS) {
      const code = b.fillSec * 10 + b.fillGrp;
      if (courses[c].hasLab && labOpts(c).includes(code)) (b.picks[c] ||= {}).lab = code;
    }
    change();
  }));

  root.querySelector("[data-clear]")?.addEventListener("click", () => { b.picks = {}; b.instr = {}; b.q = ""; b.fillSec = b.fillGrp = null; change(); });
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
  search?.addEventListener("input", () => {
    b.q = search.value;
    const pos = search.selectionStart;
    h.rerender();
    const again = document.querySelector("[data-search]");
    again?.focus(); try { again?.setSelectionRange(pos, pos); } catch { /* not supported */ }
  });
  root.querySelector("[data-savepdf]")?.addEventListener("click", h.savePdf);
  root.querySelectorAll(".bweek .grid .block").forEach((el) => el.addEventListener("click", () => h.openPopover(el)));
}
