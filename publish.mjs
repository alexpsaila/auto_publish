// Menoro auto-publisher: posts due items from content/posts.json to the Facebook Page and Instagram.
// No dependencies. Node 20+.  Run:  node publish.mjs      (DRY_RUN=1 to preview without posting)
import { readFileSync, writeFileSync } from "node:fs";

const env = process.env;
const DRY = env.DRY_RUN === "1";
const GRAPH = (env.GRAPH_BASE || "https://graph.facebook.com") + "/" + (env.GRAPH_VERSION || "v27.0");
const MEDIA = (env.MEDIA_BASE_URL || "").replace(/\/$/, "");
const MAX_PER_RUN = Number(env.MAX_POSTS_PER_RUN || 2);      // safety: never flood the feed
const STALE_HOURS = Number(env.STALE_HOURS || 72);            // skip items this far overdue instead of posting late
const POLL_MS = Number(env.POLL_MS || 15000), POLL_TRIES = Number(env.POLL_TRIES || 40);
const now = env.NOW ? new Date(env.NOW) : new Date();

const need = (k) => { if (!env[k] && !DRY) { console.error(`Missing ${k}`); process.exit(1); } return env[k] || `<${k}>`; };
const PAGE_ID = need("META_PAGE_ID"), TOKEN = need("META_PAGE_TOKEN"), IG_ID = need("IG_USER_ID");
if (!MEDIA && !DRY) { console.error("Missing MEDIA_BASE_URL"); process.exit(1); }

const posts = JSON.parse(readFileSync("content/posts.json", "utf8")).posts;
const statePath = "state/published.json";
const state = JSON.parse(readFileSync(statePath, "utf8"));
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");

async function call(path, params) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`${path}: ${json.error?.message || res.status}`);
  return json;
}
async function get(path, fields) {
  const res = await fetch(`${GRAPH}/${path}?fields=${fields}&access_token=${encodeURIComponent(TOKEN)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`${path}: ${json.error?.message || res.status}`);
  return json;
}
const isVideo = (f) => /\.mp4$/i.test(f);
const url = (f) => `${MEDIA}/media/${encodeURIComponent(f)}`;

async function toFacebook(p) {
  if (isVideo(p.media)) return (await call(`${PAGE_ID}/videos`, { file_url: url(p.media), description: p.caption })).id;
  return (await call(`${PAGE_ID}/photos`, { url: url(p.media), caption: p.caption })).post_id;
}
async function toInstagram(p) {
  if (!isVideo(p.media) && !/\.jpe?g$/i.test(p.media)) throw new Error("Instagram images must be JPEG");
  const params = isVideo(p.media)
    ? { media_type: "REELS", video_url: url(p.media), caption: p.caption, share_to_feed: "true" }
    : { image_url: url(p.media), caption: p.caption };
  const { id } = await call(`${IG_ID}/media`, params);
  for (let i = 0; i < POLL_TRIES; i++) {                        // wait until Instagram has fetched and processed the file
    const { status_code } = await get(id, "status_code");
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`Instagram container ${status_code}`);
    if (i === POLL_TRIES - 1) throw new Error("Instagram took too long to process the media");
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return (await call(`${IG_ID}/media_publish`, { creation_id: id })).id;
}
const SEND = { facebook: toFacebook, instagram: toInstagram };

let done = 0, failed = 0;
const ids = new Set();
for (const p of posts) {
  if (ids.has(p.id)) { console.error(`Duplicate id ${p.id}`); process.exit(1); } ids.add(p.id);
  const at = new Date(p.at);
  if (isNaN(at)) { console.error(`Bad date on ${p.id}`); process.exit(1); }
  if (at > now) continue;
  const ageH = (now - at) / 36e5;
  for (const platform of p.platforms) {
    const key = `${p.id}:${platform}`;
    if (state[key]) continue;
    if (!SEND[platform]) { console.error(`Unknown platform ${platform} on ${p.id}`); continue; }
    if (ageH > STALE_HOURS) { if (!DRY) { state[key] = { skipped: "stale", at: now.toISOString() }; save(); } console.log(`SKIP  ${key} (was due ${p.at}, too old to post)`); continue; }
    if (done >= MAX_PER_RUN * p.platforms.length) { console.log(`LATER ${key} (per-run limit)`); continue; }
    if (DRY) { console.log(`WOULD POST ${key}\n  media: ${url(p.media)}\n  caption: ${p.caption.split("\n")[0]}…`); done++; continue; }
    try {
      const id = await SEND[platform](p);
      state[key] = { id, at: new Date().toISOString() }; save();   // saved after every post so a crash never causes a repeat
      console.log(`POSTED ${key} → ${id}`); done++;
    } catch (e) { failed++; console.error(`FAILED ${key}: ${e.message}`); }
  }
}
console.log(`${DRY ? "Dry run" : "Done"}: ${done} ${DRY ? "would be posted" : "posted"}, ${failed} failed.`);
if (failed) process.exit(1);
