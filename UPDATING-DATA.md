# Updating the schedule data
# تحديث بيانات الجدول

You only ever edit **`schedule-data.js`**. Nothing else.
تعدّل ملف **`schedule-data.js`** فقط، ولا شيء غيره.

---

## The format

One meeting per line, fields separated by `|`:

```
PH | 1 | Sun | 09:30 | 10:50 | ST215
↑    ↑   ↑     ↑       ↑       ↑
course section day   start    end   room
```

Labs use the lab code instead of the section:

```
BC | 21 | Wed | 08:00 | 10:50 | 0601
```

Course ids: `PH` `MB` `BC` `MC` `PA` `PM` — listed at the top of the file.

## Rules

| | |
|---|---|
| Days | `Sat` `Sun` `Mon` `Tue` `Wed` — exactly these spellings |
| Times | 24-hour, `HH:MM`, always two digits — `08:00` not `8:00` |
| Room unknown | write `?` |
| Room is a guess | add `~` after it — `ST238 ~` |
| Comment out a line | put `#` at the start |

## Making a change

1. Open `schedule-data.js` on GitHub → pencil icon
2. Edit the line
3. Commit
4. Wait ~30 seconds, refresh the site

Everything recalculates on its own — conflicts, badges, which sections are valid, all of it. There is no build step and no script to run.

## If you break something

A red banner appears at the top of the page telling you the line number and what's wrong:

```
⚠ Line 47: day "Thurs" not recognised — use Sat Sun Mon Tue Wed
```

The bad line is skipped and the rest of the site keeps working. Fix the line, commit, refresh.

## Common edits

**A lecture moved:** find the line, change the day/time.

**A room was confirmed:** replace `?` with the room, or delete the ` ~` if it's now certain.

**A section was removed:** delete all 2 lines for that course+section, and its 3 lab lines if it has labs. Then remove the number from `sectionsAvailable` in `SETTINGS` at the bottom.

**Sections 7 and 8 got fixed:** just correct the clashing lines. They'll turn from grey to selectable by themselves — nothing else to change.

**A new section appeared:** add 2 lines per course (12 total), plus 3 lab lines per lab course if it has labs, and add the number to `sectionsAvailable`.

## What NOT to do

- Don't remove the backticks (`` ` ``) at the start and end of each block
- Don't add extra `|` inside a field
- Don't reorder the fields
- Don't edit `app.js` to fix data — if the site shows something wrong, the data line is wrong
