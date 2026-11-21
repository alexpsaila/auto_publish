// Cloudflare Worker that starts "Publish due posts" on GitHub at minute 2 of every hour.
// GitHub's own timer often runs only every 4-9 hours, so posts went out hours late.
// Needs one secret, GITHUB_TOKEN: a fine-grained GitHub token for alexpsaila/auto_publish
// with only "Actions: Read and write". Set-up steps: README.md → "On-time trigger".
const DISPATCH_URL =
  "https://api.github.com/repos/alexpsaila/auto_publish/actions/workflows/publish.yml/dispatches";

export default {
  async scheduled(_event, env) {
    const res = await fetch(DISPATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "menoro-publisher-trigger",
        "Content-Type": "application/json",
      },
      // dry_run "false" = really post (a manual run from GitHub defaults to preview only).
      body: JSON.stringify({ ref: "main", inputs: { dry_run: "false" } }),
    });
    if (!res.ok) throw new Error(`GitHub refused the start (${res.status}): ${await res.text()}`);
  },

  // The Worker's web address does nothing, so nobody can start runs by visiting it.
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
