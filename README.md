# The Tipsy Toss Tournament

Signup site, prelim scheduler and bracket for the annual tipsy toss tournament, live at **https://tipsytoss.abbykrishnan.com**. One Cloudflare Worker serves both the React app and a small JSON API, backed by a D1 (SQLite) database.

- **`/`**: event info, the frisbee animation, a rules video, signup (team or solo), and who's in
- **`/live`**: prelim games, standings and the bracket. It refreshes itself every 15s, so people can leave it open on their phones.
- **`/admin`**: password-protected tools for running the day

## Running the day (admin)

1. **Entrants & teams**: tick two free agents and hit *Make team* (or *Randomly pair everyone*). Add walk-ups here too. Remove no-shows *before* drawing round 1.
2. **Prelims & scores**: *Generate round 1 matchups* (random draw), enter scores as games finish, then *Generate round 2 matchups*. Round 2 pairs teams with similar records and avoids rematches. With an odd number of teams, one team sits out each round. A bye counts as a win.
3. **Seeding & bracket**: seeding is calculated from the prelims (wins, then point differential, then points scored). You can nudge teams up or down, or uncheck a team that left, before you hit *Create bracket*. The bracket is padded to the next power of two, so with fewer than 16 teams the top seeds get first-round byes. Tap a team to send them through, and tap the winner again to undo. Entering a score is optional.

Every game is played to 11 except the final, which goes to 21. Those numbers live in `shared/tournament.ts`.

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars        # sets the local admin password
npm run db:migrate:local
npm run dev                           # http://localhost:5173
npm test                              # tournament logic tests
```

## Deploying to Cloudflare

```sh
npx wrangler login
npm run launch
```

`npm run launch` creates the `tipsy-toss` D1 database (first run only, and it writes the id into `wrangler.jsonc`), applies migrations, deploys, and asks you to pick the admin password if one isn't set yet. After that, `npm run deploy` is all you need. To change the admin password, run `npx wrangler secret put ADMIN_PASSWORD`.

## Layout

| Path | What |
| --- | --- |
| `shared/tournament.ts` | Pure logic: phone normalization, standings, pairing, seeding, bracket layout and advancing |
| `worker/` | Hono API: signup + dedupe, admin auth, and admin endpoints |
| `migrations/` | D1 schema |
| `src/` | React app: pages, admin tabs, the `TossScene` animation, and the bracket |
