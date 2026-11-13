# 01 · Nudge

App 1 of the practice run. A follow-up list for freelancers, built to show the full
process from hypothesis to working app. The brief is an invented example.

## Run it

Needs Node 22.13 or newer. Nothing to install.

```
cd 01-nudge
node server.js
```

Then open http://localhost:3000. Data is saved in `nudge.db`, which is created on first run.
Delete that file to start again with an empty app.

## The files

| File | Stage | What it is |
|---|---|---|
| `schema.sql` | 5 | The two database tables |
| `server.js` | 6 | The rules, and the code that answers the browser |
| `public/index.html` | 4, 7 | The screen and what happens on a click |
| `build-log.html` | all | Source of the walkthrough page (stages, PM calls, live demo) |

## The seven stages, in short

**Brief.** Freelancers send quotes, forget to chase, and lose the lead. Hypothesis: if they
could open one list of who to chase today, they would follow up on time. Proof: 3 of 5
freelancers open it on 3 separate days in a week and chase 80% of leads on the due day.

1. **Mechanism.** When a freelancer logs a lead with a follow-up date, the app puts that
   lead on a Today list when the date arrives, so they chase the right person without
   having to remember.
2. **Scope.** Must: add a lead, Today list, Chased button, won/lost, on-time count.
   Later: login, reminders, editing, notes, hosting. Never for this test: pipeline stages,
   inbox reading, teams, invoicing.
3. **User journey.** Open and see today's list → add a lead → days pass → open again, lead
   is due → chase and press Chased → client replies, mark won or lost.
   Risk: nothing brings the user back during "days pass".
4. **Wireframe.** One screen, four zones: Chase today, Add a lead, Coming up, score.
5. **Database.** `leads` (who, what, next date, status) and `follow_ups` (one row per chase,
   with the date it was due and the date it was done).
6. **Action.** A lead is due when `status = 'open'` and `next_follow_up <= today`.
   Chased logs a follow-up and moves the date on. Won/Lost changes the status.
7. **Output and test.** The Today list, plus "Chased on time: X of Y". The app works.
   The hypothesis is untested until real freelancers use it.

## Three exercises, easiest first

Try each one yourself before asking for help. Restart the server (Ctrl+C, then
`node server.js`) after changing `server.js` or `schema.sql`.

1. **Change one word.** In `public/index.html`, rename the "Won" button to "Booked".
   Touches one file. Teaches you where screen text lives.
2. **Add an option.** Add "Chased, again in 2 weeks". One new button in `index.html`,
   and one changed line in `markChased` in `server.js`. Teaches you how a click reaches a rule.
3. **Add a field.** Store the client's email address and show it on each lead. You will
   change `schema.sql`, `addLead` in `server.js`, and the form and list in `index.html`.
   Delete `nudge.db` first so the new table is created. Teaches you how all three layers connect.
