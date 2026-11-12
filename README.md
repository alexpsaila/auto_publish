# Menoro auto-publisher

Posts scheduled content to the Menoro Facebook Page and Instagram account. You add a post by adding one entry to `content/posts.json`; a GitHub Action checks every hour and publishes whatever is due.

TikTok is not included: its posting API needs an app review, and the Menoro TikTok account is a personal one.

## What's here

| Path | What it is |
| --- | --- |
| `content/posts.json` | The schedule: one entry per post (id, date and time, platforms, media file, caption). Pre-filled with three weeks of posts from 16 Nov 2026. |
| `media/` | The images (JPEG) and videos (MP4, with the original background track) the posts use. |
| `publish.mjs` | The publisher. No dependencies; needs Node 20 or later. |
| `state/published.json` | Record of what has been posted, so nothing is ever posted twice. The Action updates it. |
| `.github/workflows/publish.yml` | Runs the publisher every hour. |
| `get-ids.mjs` | One-off helper that prints the three secrets you need. |

## Set-up (about 30 minutes, once)

1. **Create the repository.** On GitHub, create a new **public** repository called `menoro-publisher` and push this folder to it. It must be public for free GitHub Pages; it holds only marketing content, never secrets.
2. **Turn on GitHub Pages.** Repository → Settings → Pages → Source "Deploy from a branch" → branch `main`, folder `/ (root)`. After a minute it shows your site address, like `https://YOUR-NAME.github.io/menoro-publisher`. This is how Instagram and Facebook fetch the media.
3. **Create a Meta app.** At developers.facebook.com → My Apps → Create App. Choose the business option and attach the Menoro business portfolio. Note the App ID and App Secret (App settings → Basic).
4. **Get a user token.** Open Tools → Graph API Explorer, select your app, choose "Get User Access Token" and tick: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`. Approve, and copy the token.
5. **Get the three values.** On your own computer, in this folder:
   ```
   APP_ID=... APP_SECRET=... USER_TOKEN=... node get-ids.mjs
   ```
   It prints `META_PAGE_ID`, `IG_USER_ID` and `META_PAGE_TOKEN` for the Menoro Page. If `IG_USER_ID` says no Instagram account is linked, open the Menoro Page on Facebook → Settings → Linked accounts → Instagram → connect `menoroapp`, then run it again.
6. **Store them in GitHub.** Repository → Settings → Secrets and variables → Actions.
   - Secrets: `META_PAGE_ID`, `META_PAGE_TOKEN`, `IG_USER_ID`
   - Variables: `MEDIA_BASE_URL` = your Pages address from step 2 (no trailing slash)
7. **Test without posting.** Actions → "Publish due posts" → Run workflow, with "Preview only" ticked. The log lists what it would post.
8. **Go live.** Nothing more to do: it runs every hour and posts what is due.

## Adding a post

1. Put the image (`.jpg`) or video (`.mp4`) in `media/`. Instagram accepts only JPEG images.
2. Add an entry to `content/posts.json`:
   ```json
   {
     "id": "w4-new-customer",
     "at": "2026-12-09T09:30:00+01:00",
     "platforms": ["facebook", "instagram"],
     "media": "my-new-post.jpg",
     "caption": "Now on Menoro: ..."
   }
   ```
   `id` must be unique. `at` is Malta time; use `+01:00` in winter and `+02:00` in summer.
3. Commit and push. It publishes at the next hourly run after `at`.

## Safety rules built in

- Never posts the same item twice, even if a run crashes half-way.
- At most 2 posts per run, so a mistake in the schedule cannot flood the feed.
- Anything more than 72 hours overdue is skipped, not posted late.
- If one platform fails, the other still posts, the failed one is retried next hour, and the run shows as failed in Actions so you notice.

## Good to know

- The publisher has been tested against a simulator of Meta's API, not yet against the real thing. Do the preview run in step 7, then watch the first real post.
- Posts made this way cannot use Instagram's music library, which is why the videos in `media/` carry their own track.
- The Page token from `get-ids.mjs` is long-lived, but Meta can still invalidate it (for example if you change your Facebook password). If posts start failing with a token error, repeat steps 4 to 6.
- Meta changes API versions about twice a year. The publisher uses `v27.0`; to change it, add a repository variable `GRAPH_VERSION`.
- Instagram allows a limited number of API posts per day (at least 50). This schedule uses four a week.
