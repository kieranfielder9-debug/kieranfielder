// STAGE 6: THE ACTION
// This file is the whole back end. It does three jobs:
//   1. opens the database        (section A)
//   2. holds the app's rules     (section B)
//   3. answers the browser       (section C)
// Run it with:  node server.js   then open http://localhost:3000

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// ---------- A. Database ----------
const db = new DatabaseSync(path.join(__dirname, 'nudge.db'));
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// ---------- Date helpers ----------
// Dates are stored as text like 2026-11-13, so they sort and compare correctly.
function format(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function today() {
  return format(new Date());
}
function addDays(dateText, days) {
  const [y, m, d] = dateText.split('-').map(Number);
  return format(new Date(y, m - 1, d + days));
}

// ---------- B. The rules ----------

// THE CORE RULE: a lead is due when it is still open
// and its follow-up date is today or earlier.
function getEverything() {
  const t = today();
  return {
    today: t,
    due: db
      .prepare("SELECT * FROM leads WHERE status = 'open' AND next_follow_up <= ? ORDER BY next_follow_up")
      .all(t),
    upcoming: db
      .prepare("SELECT * FROM leads WHERE status = 'open' AND next_follow_up > ? ORDER BY next_follow_up")
      .all(t),
    // STAGE 7: the number that tells us if the hypothesis holds.
    score: db
      .prepare(
        `SELECT COUNT(*) AS chased,
                COALESCE(SUM(done_on <= was_due_on), 0) AS on_time
         FROM follow_ups`
      )
      .get(),
  };
}

function addLead({ name, about, next_follow_up }) {
  name = String(name || '').trim();
  about = String(about || '').trim();
  if (!name) throw new Error('Give the lead a name.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next_follow_up || '')) throw new Error('Pick a follow-up date.');
  db.prepare('INSERT INTO leads (name, about, next_follow_up, created_on) VALUES (?, ?, ?, ?)').run(
    name,
    about,
    next_follow_up,
    today()
  );
}

// "Chased" does two things at once: it logs the chase, and it sets the
// next date. That way an open lead always has a next date.
function markChased(id, days) {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ? AND status = 'open'").get(id);
  if (!lead) throw new Error('That lead is not open.');
  if (![3, 7].includes(days)) throw new Error('Chase again in 3 or 7 days.');
  db.prepare('INSERT INTO follow_ups (lead_id, was_due_on, done_on) VALUES (?, ?, ?)').run(
    id,
    lead.next_follow_up,
    today()
  );
  db.prepare('UPDATE leads SET next_follow_up = ? WHERE id = ?').run(addDays(today(), days), id);
}

function closeLead(id, status) {
  if (!['won', 'lost'].includes(status)) throw new Error('Status must be won or lost.');
  const result = db.prepare("UPDATE leads SET status = ? WHERE id = ? AND status = 'open'").run(status, id);
  if (result.changes === 0) throw new Error('That lead is not open.');
}

// ---------- C. Answer the browser ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let text = '';
    req.on('data', (chunk) => (text += chunk));
    req.on('end', () => {
      try {
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error('Could not read that request.'));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const send = (code, data) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  try {
    // The page itself
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
    }

    // Read everything
    if (req.method === 'GET' && req.url === '/api/leads') {
      return send(200, getEverything());
    }

    // Add a lead
    if (req.method === 'POST' && req.url === '/api/leads') {
      addLead(await readBody(req));
      return send(200, getEverything());
    }

    // Chased, or closed:  /api/leads/5/chased   /api/leads/5/close
    const match = req.url.match(/^\/api\/leads\/(\d+)\/(chased|close)$/);
    if (req.method === 'POST' && match) {
      const id = Number(match[1]);
      const body = await readBody(req);
      if (match[2] === 'chased') markChased(id, Number(body.days));
      else closeLead(id, body.status);
      return send(200, getEverything());
    }

    send(404, { error: 'Not found.' });
  } catch (err) {
    send(400, { error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Nudge is running at http://localhost:${PORT}`));
