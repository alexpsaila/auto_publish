// One-off helper: turns a short-lived user token into a long-lived Page token and prints the three values to store as secrets.
// Run on your own computer:  APP_ID=... APP_SECRET=... USER_TOKEN=... node get-ids.mjs
const { APP_ID, APP_SECRET, USER_TOKEN, GRAPH_VERSION = "v27.0" } = process.env;
if (!APP_ID || !APP_SECRET || !USER_TOKEN) { console.error("Set APP_ID, APP_SECRET and USER_TOKEN"); process.exit(1); }
const G = `https://graph.facebook.com/${GRAPH_VERSION}`;
const j = async (u) => { const r = await fetch(u); const d = await r.json(); if (d.error) throw new Error(d.error.message); return d; };
const long = await j(`${G}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${USER_TOKEN}`);
const pages = await j(`${G}/me/accounts?fields=name,id,access_token,instagram_business_account{id,username}&access_token=${long.access_token}`);
for (const p of pages.data) {
  console.log(`\nPage: ${p.name}`);
  console.log(`META_PAGE_ID     ${p.id}`);
  console.log(`IG_USER_ID       ${p.instagram_business_account?.id || "(no Instagram account linked to this Page)"}  ${p.instagram_business_account?.username || ""}`);
  console.log(`META_PAGE_TOKEN  ${p.access_token}`);
}
console.log("\nCopy the three values for the Menoro Page into GitHub → Settings → Secrets. Do not share or commit them.");
