#!/usr/bin/env node
// First-time Cloudflare setup + deploy. Safe to re-run: it reuses the existing
// D1 database, applies any new migrations, deploys, and only asks for the admin
// password if it hasn't been set yet.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const CONFIG = new URL("../wrangler.jsonc", import.meta.url);
const DB_NAME = "tipsy-toss";
const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const capture = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

try {
  capture("npx wrangler whoami");
} catch {
  console.error("Not logged in to Cloudflare. Run `npx wrangler login`, then try again.");
  process.exit(1);
}

let config = readFileSync(CONFIG, "utf8");
if (config.includes(PLACEHOLDER)) {
  const existing = JSON.parse(capture("npx wrangler d1 list --json")).find((db) => db.name === DB_NAME);
  let id = existing?.uuid;
  if (!id) {
    console.log(`Creating D1 database "${DB_NAME}"…`);
    id = capture(`npx wrangler d1 create ${DB_NAME}`).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
  }
  if (!id) throw new Error("Couldn't figure out the D1 database id – check `npx wrangler d1 list`.");
  config = config.replace(PLACEHOLDER, id);
  writeFileSync(CONFIG, config);
  console.log(`Using D1 database ${id}`);
}

run("npm run deploy");

const secrets = JSON.parse(capture("npx wrangler secret list"));
if (!secrets.some((s) => s.name === "ADMIN_PASSWORD")) {
  console.log("\nPick a password for the admin page:");
  run("npx wrangler secret put ADMIN_PASSWORD");
}

console.log("\nAll set! Your site is live at the workers.dev URL printed above.");
