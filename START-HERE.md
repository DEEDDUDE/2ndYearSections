# START HERE

Everything you need is in this folder. Follow the steps in order.
Total time: about 10 minutes of your work, plus however long Claude Code takes.

---

## What's in this folder

| File | What it is | Do you touch it? |
|---|---|---|
| `index.html` | The page | Claude Code edits it |
| `app.js` | The engine — parses data, finds conflicts, computes stats | Claude Code edits it |
| `schedule-data.js` | **All the timetable data** | **Yes — this is your file** |
| `BUILD-SPEC.md` | Full instructions for Claude Code | You just point at it |
| `UPDATING-DATA.md` | How you and your friends edit data later | Read it when data changes |
| `.gitignore` | Junk filter | No |

**Step 1 is already built and tested.** Open the page and you'll see a plain table of all 21 options with the math already correct. It's ugly on purpose — design is step 6.

---

## Step A — Run it on your computer first

Open a terminal in this folder and run:

```
python3 -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

You should see a table: **15 valid, 6 unavailable**.

> ⚠️ Don't just double-click `index.html`. It will show a blank page.
> The file uses modules, and browsers block those unless a server is serving them.
> This is the single most common way to think the build is broken when it isn't.

Leave that terminal running the whole time you work. To stop it: `Ctrl + C`.

---

## Step B — Build the rest with Claude Code

Open Claude Code in this same folder. Send these one at a time.
**Wait for each to finish and check the page before sending the next.**

1. `Read BUILD-SPEC.md. Step 1 is already done and verified — don't redo it. Build step 2: the week grid geometry. Blocks positioned correctly, no styling.`
2. `Step 3: the option rail and the live stat strip.`
3. `Step 4: the Full week / Lecture week toggle. Stats and badges must recompute live.`
4. `Step 5: badges and the sibling nudge.`
5. `Step 6: the visual pass. Follow section 8 of the spec exactly — don't substitute the palette or the fonts.`
6. `Step 7: the print stylesheet and PDF export.`
7. `Step 8: the Arabic/English toggle and RTL layout.`

After each one, refresh **http://localhost:8000** and look at it.

**If something breaks:** tell Claude Code what you see, and add
`don't change schedule-data.js` — the data is verified, the bug is in the code.

---

## Step C — Test before uploading

- [ ] Switch Full week ↔ Lecture week — the numbers change
- [ ] Pick section 7 or 8 — greyed out, explains why
- [ ] Switch to Arabic — layout flips, nothing overlaps
- [ ] Save as PDF in English — one page, readable
- [ ] Save as PDF in Arabic — **letters connected, not backwards**
- [ ] Narrow the window to phone width — still usable

The Arabic PDF is the one that quietly breaks. Check it properly.

---

## Step D — Put it online

1. On GitHub: **New repository** → name it `section-picker` → **Public** → don't add a README → Create
2. Back in your terminal, in this folder:

```
git init
git add .
git commit -m "Section picker v1"
git branch -M main
git remote add origin https://github.com/YOURNAME/section-picker.git
git push -u origin main
```

Replace `YOURNAME` with your GitHub username.

3. On GitHub: **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: **main** / **/ (root)** → Save
4. Wait ~1 minute. Your link appears at the top of that Pages screen.

That link is what you send your friends.

---

## Step E — Later, when data changes

Nobody needs to clone anything or run anything. On GitHub:

**`schedule-data.js`** → pencil icon → fix the line → Commit.

The site updates itself in about 30 seconds. Everything recalculates — conflicts, badges, which sections are valid.

Details and examples are in `UPDATING-DATA.md`. Send that file to whoever helps you maintain it.
