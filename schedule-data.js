// ============================================================
//  SCHEDULE DATA  —  this is the ONLY file you edit
//  بيانات الجدول — هذا هو الملف الوحيد الذي تعدّله
// ============================================================
//  Rules / القواعد:
//    · one meeting per line, separated by |  
//    · days: Sat Sun Mon Tue Wed
//    · times: 24-hour, HH:MM
//    · unknown room: write  ?
//    · room assumed for both days: add  ~  after the room
//    · lines starting with # are ignored (comments)
//  After editing, just refresh the page. Everything recalculates.
// ============================================================

export const COURSES = `
# id | course number | English name | الاسم العربي | credit hours | has lab
PH | 6106211 | Public Health | الصحة العامة | 3 | no
MB | 6105221 | Molecular Biology & Genetics | الأحياء الجزيئية وعلم الوراثة | 4 | no
BC | 6105212 | Metabolic Biochemistry | الكيمياء الحيوية الأيضية | 3 | yes
MC | 6104211 | General Microbiology | علم الأحياء الدقيقة العام | 3 | yes
PA | 6103221 | General Pathology | علم الأمراض العام | 3 | yes
PM | 6102231 | General Pharmacology | علم الأدوية العام | 3 | no
`;

export const LECTURES = `
# course | section | day | start | end | room

# --- Public Health ---
PH | 1 | Sun | 09:30 | 10:50 | ST215
PH | 1 | Tue | 09:30 | 10:50 | ST215
PH | 2 | Sun | 14:00 | 15:20 | ST236
PH | 2 | Tue | 14:00 | 15:20 | ST236
PH | 4 | Sun | 11:00 | 12:20 | ST215
PH | 4 | Tue | 11:00 | 12:20 | ST215
PH | 5 | Sat | 09:30 | 10:50 | ST236
PH | 5 | Mon | 09:30 | 10:50 | ST238
PH | 6 | Sun | 08:00 | 09:20 | ST240
PH | 6 | Tue | 08:00 | 09:20 | ST240
PH | 7 | Sat | 12:30 | 13:50 | ST215 ~
PH | 7 | Wed | 12:30 | 13:50 | ST215 ~
PH | 8 | Mon | 11:00 | 12:20 | ?
PH | 8 | Wed | 11:00 | 12:20 | ?

# --- Molecular Biology & Genetics ---
MB | 1 | Sun | 11:00 | 12:50 | AR-117
MB | 1 | Tue | 11:00 | 12:50 | ST231
MB | 2 | Sat | 13:00 | 14:50 | ST237
MB | 2 | Wed | 13:00 | 14:50 | ST240
MB | 4 | Mon | 13:00 | 14:50 | ST236
MB | 4 | Wed | 13:00 | 14:50 | ST233
MB | 5 | Sun | 14:00 | 15:50 | ST233
MB | 5 | Tue | 14:00 | 15:50 | ST233
MB | 6 | Sat | 09:00 | 10:50 | HC131
MB | 6 | Wed | 09:00 | 10:50 | HC131
MB | 7 | Sat | 12:00 | 13:50 | HC118
MB | 7 | Wed | 12:00 | 13:50 | HC118
MB | 8 | Sun | 09:00 | 10:50 | ST231
MB | 8 | Tue | 09:00 | 10:50 | ST231

# --- Metabolic Biochemistry ---
BC | 1 | Mon | 11:00 | 11:50 | ?
BC | 1 | Wed | 11:00 | 12:20 | ?
BC | 2 | Mon | 12:30 | 13:50 | ST238 ~
BC | 2 | Tue | 11:00 | 11:50 | ST238 ~
BC | 4 | Sun | 09:30 | 10:50 | ST233
BC | 4 | Wed | 10:00 | 10:50 | ST231
BC | 5 | Sat | 08:30 | 09:20 | ST236 ~
BC | 5 | Tue | 09:30 | 10:50 | ST236 ~
BC | 6 | Sun | 13:00 | 13:50 | ?
BC | 6 | Wed | 14:00 | 15:20 | ?
BC | 7 | Sat | 11:00 | 11:50 | ST231 ~
BC | 7 | Mon | 11:00 | 12:20 | ST231 ~
BC | 8 | Sun | 14:00 | 15:20 | ST238
BC | 8 | Tue | 14:00 | 14:50 | ST234

# --- General Microbiology ---
MC | 1 | Mon | 13:00 | 13:50 | ST237
MC | 1 | Wed | 09:00 | 10:20 | ST233
MC | 2 | Sat | 12:00 | 12:50 | ST237 ~
MC | 2 | Wed | 11:00 | 12:20 | ST237 ~
MC | 4 | Sat | 13:00 | 13:50 | ST233
MC | 4 | Tue | 09:30 | 10:50 | ST233
MC | 5 | Mon | 08:30 | 09:20 | ST238
MC | 5 | Tue | 12:30 | 13:50 | ST233
MC | 6 | Mon | 11:00 | 11:50 | HC131 ~
MC | 6 | Tue | 09:30 | 10:50 | HC131 ~
MC | 7 | Sun | 09:30 | 10:50 | ST240
MC | 7 | Wed | 11:00 | 11:50 | ST238
MC | 8 | Sat | 09:00 | 09:50 | ST237 ~
MC | 8 | Wed | 10:00 | 11:20 | ST237 ~

# --- General Pathology ---
PA | 1 | Sun | 14:00 | 14:50 | ST234
PA | 1 | Tue | 14:00 | 15:20 | ST231
PA | 2 | Sun | 09:30 | 10:50 | ST237
PA | 2 | Tue | 09:30 | 10:20 | ST237
PA | 4 | Sat | 09:30 | 10:50 | ST238
PA | 4 | Wed | 11:00 | 11:50 | ES118
PA | 5 | Sat | 14:00 | 15:20 | ST238
PA | 5 | Wed | 10:00 | 10:50 | ST215
PA | 6 | Sat | 14:00 | 14:50 | ST233
PA | 6 | Sun | 11:00 | 12:20 | HC118
PA | 7 | Mon | 13:00 | 13:50 | ST231 ~
PA | 7 | Tue | 11:00 | 12:20 | ST231 ~
PA | 8 | Sat | 13:00 | 13:50 | ST236
PA | 8 | Wed | 12:30 | 13:50 | ST231

# --- General Pharmacology ---
PM | 1 | Sat | 09:00 | 10:50 | ST215
PM | 1 | Mon | 09:00 | 10:50 | ST215
PM | 2 | Sun | 12:30 | 13:50 | ?
PM | 2 | Tue | 12:30 | 13:50 | ?
PM | 4 | Sat | 11:00 | 12:20 | ST236
PM | 4 | Mon | 11:00 | 12:20 | ST236
PM | 5 | Sun | 11:00 | 12:20 | ST237 ~
PM | 5 | Wed | 12:30 | 13:50 | ST237 ~
PM | 6 | Sat | 12:30 | 13:50 | ST240
PM | 6 | Mon | 12:30 | 13:50 | ST240
PM | 7 | Sun | 14:00 | 15:20 | ST240
PM | 7 | Tue | 14:00 | 15:20 | ST240
PM | 8 | Mon | 09:30 | 10:50 | ST240 ~
PM | 8 | Wed | 08:00 | 09:20 | ST240 ~
`;

export const LABS = `
# course | lab code | day | start | end | room

# --- Metabolic Biochemistry labs ---
BC | 11 | Sat | 14:00 | 16:50 | 0601
BC | 12 | Sat | 14:00 | 16:50 | 0601
BC | 13 | Mon | 14:00 | 16:50 | 0601
BC | 21 | Wed | 08:00 | 10:50 | 0601
BC | 22 | Sat | 08:00 | 10:50 | 0601
BC | 23 | Sat | 08:00 | 10:50 | 0601
BC | 41 | Mon | 08:00 | 10:50 | 0601
BC | 42 | Sun | 14:00 | 16:50 | 0601
BC | 43 | Sun | 14:00 | 16:50 | 0601
BC | 51 | Mon | 11:00 | 13:50 | 0601
BC | 52 | Mon | 11:00 | 13:50 | 0601
BC | 53 | Mon | 14:00 | 16:50 | 0601
BC | 61 | Tue | 14:00 | 16:50 | 0601
BC | 62 | Wed | 11:00 | 13:50 | 0601
BC | 63 | Tue | 14:00 | 16:50 | 0601
BC | 71 | Sun | 11:00 | 13:50 | 0601
BC | 72 | Sun | 11:00 | 13:50 | 0601
BC | 73 | Sun | 11:00 | 13:50 | 0601
BC | 81 | Tue | 11:00 | 13:50 | 0601
BC | 82 | Tue | 11:00 | 13:50 | 0601
BC | 83 | Mon | 14:00 | 16:50 | 0601

# --- General Microbiology labs ---
MC | 11 | Wed | 14:00 | 16:50 | 0601
MC | 12 | Wed | 14:00 | 16:50 | 0601
MC | 13 | Wed | 14:00 | 16:50 | 0601
MC | 21 | Sat | 08:00 | 10:50 | 0601
MC | 22 | Wed | 08:00 | 10:50 | 0601
MC | 23 | Wed | 08:00 | 10:50 | 0601
MC | 41 | Tue | 14:00 | 16:50 | 0601
MC | 42 | Sat | 14:00 | 16:50 | 0601
MC | 43 | Sat | 14:00 | 16:50 | 0601
MC | 51 | Sun | 08:00 | 10:50 | 0601
MC | 52 | Sat | 11:00 | 13:50 | 0601
MC | 53 | Sat | 11:00 | 13:50 | 0601
MC | 61 | Tue | 11:00 | 13:50 | 0601
MC | 62 | Tue | 11:00 | 13:50 | 0601
MC | 63 | Wed | 11:00 | 13:50 | 0601
MC | 71 | Sat | 14:00 | 16:50 | 0601
MC | 72 | Sat | 14:00 | 16:50 | 0601
MC | 73 | Tue | 08:00 | 10:50 | 0601
MC | 81 | Sun | 11:00 | 13:50 | 0601
MC | 82 | Sun | 11:00 | 13:50 | 0601
MC | 83 | Tue | 11:00 | 13:50 | 0601

# --- General Pathology labs ---
PA | 11 | Sat | 11:00 | 13:50 | 0601
PA | 12 | Sat | 11:00 | 13:50 | 0601
PA | 13 | Sat | 11:00 | 13:50 | 0601
PA | 21 | Mon | 14:00 | 16:50 | 0601
PA | 22 | Mon | 08:00 | 10:50 | 0601
PA | 23 | Mon | 08:00 | 10:50 | 0601
PA | 41 | Sat | 14:00 | 16:50 | 0601
PA | 42 | Tue | 14:00 | 16:50 | 0601
PA | 43 | Tue | 14:00 | 16:50 | 0601
PA | 51 | Sat | 11:00 | 13:50 | 0601
PA | 52 | Sun | 08:00 | 10:50 | 0601
PA | 53 | Sun | 08:00 | 10:50 | 0601
PA | 61 | Wed | 11:00 | 13:50 | 0601
PA | 62 | Sun | 14:00 | 16:50 | 0601
PA | 63 | Sun | 14:00 | 16:50 | 0601
PA | 71 | Tue | 08:00 | 10:50 | 0601
PA | 72 | Tue | 08:00 | 10:50 | 0601
PA | 73 | Mon | 14:00 | 16:50 | 0601
PA | 81 | Mon | 14:00 | 16:50 | 0601
PA | 82 | Mon | 14:00 | 16:50 | 0601
PA | 83 | Sun | 11:00 | 13:50 | 0601
`;

export const SETTINGS = {
  days:               ["Sat", "Sun", "Mon", "Tue", "Wed"],
  sectionsAvailable:  [1, 2, 4, 5, 6, 7, 8],   // section 3 does not exist
  labGroups:          [1, 2, 3],
  gridStart:          "08:00",
  gridEnd:            "17:00",
  labsAreWeekly:      false,   // labs do not run every week

  // intro-screen header (§13) — a one-line edit each term, same as the
  // rest of SETTINGS.
  year: { en: "Second year · First semester", ar: "السنة الثانية · الفصل الأول" },
  term: { en: "Spring 2026 / 2027",            ar: "ربيع 2026 / 2027" },
};
