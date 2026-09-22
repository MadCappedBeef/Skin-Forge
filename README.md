# SkinForge

A skin JSON editor and approximate 3D dinosaur viewer for The Isle.
Includes colour locks, camouflage palettes, an experimental offspring generator,
JSON validation and optional Discord issue reports.

## Run locally

Install Node.js 22 or later. Run **Start SkinForge.bat**, or:

```sh
npm ci
npm start
```

Open http://localhost:8001. Models and textures are included in `r2/`.
The local server serves those files directly; Cloudflare is not needed for previews.

## Development and checks

- `public/`: website, viewer, report endpoint and bundled Three.js.
- `r2/`: original models and textures; do not modify their bytes without updating the manifest and catalog URLs.
- `scripts/`: local server and asset validation/upload.
- `asset-manifest.json`: asset paths and SHA-256 hashes.

```sh
npm ci
npm run check
```

GitHub Actions runs these checks on pushes and pull requests. Skin previews are approximate, and the
egg generator does not claim to reproduce standard Evrima inheritance.

## Cloudflare deployment

GitHub hosts this repository; keep using Cloudflare for the website. GitHub
Pages alone cannot run the report endpoint or R2 asset proxy.

For your own deployment, change the Pages project name and R2 bucket in
`wrangler.jsonc`. The included names are defaults, not credentials. Use
**Cloudflare.bat** to log in, create the bucket, upload assets and deploy.
**Update Site.bat** deploys website changes without reuploading the assets.

Set `DISCORD_REPORT_WEBHOOK` as a secret on the matching Cloudflare Pages
environment, containing the full webhook URL, then redeploy. Never commit the
URL. For local reports, set the same environment variable before starting the
server. The report endpoint uses a best-effort per-instance cooldown.

## Licence

SkinForge's own code is MIT licensed; see [LICENSE](LICENSE).
Three.js retains its licence at `public/vendor/three/LICENSE`.
Other dependencies retain their respective licences.

The Isle models and textures in `r2/` are third-party game assets, included
at the maintainer's direction based on developer permission to share them.
They are **not** covered by SkinForge's MIT licence; their original owners
retain their rights. Permission to share these files does not make them MIT
licensed or transfer ownership.

## Community skins

Run **Setup Community.bat** once after logging in with Cloudflare.bat. It creates
the D1 database, adds its COMMUNITY_DB binding to wrangler.jsonc and applies the
migrations. Then deploy the website. The existing R2 bucket is unchanged.

Steam sign-in uses OpenID; visitors sign in on Steam, not on SkinForge. No Steam
API key is required. COMMUNITY_ORIGIN must match the public HTTPS site URL.
ADMIN_STEAM_IDS lists owner SteamID64s in the deployment configuration. The owner
can grant or revoke additional admins from the community moderation panel. For
a fork, replace the configured owner ID and origin before deployment.

Anyone can browse and use community skins in the existing viewer. Steam sign-in
is required to publish or report. Publishing is immediate, limited to five skins
per hour per SteamID. Basic title filtering is applied; it cannot catch every
inappropriate name. Only canonical skin fields are published. Reports appear
in the private moderation panel. Skin removals are reversible. Ban blocks
submissions; Ban and hide all also hides that account's skins. Unban and restore
account skins are separate actions. Admin changes and moderation are audited.

Public records include the skin name, species, skin JSON, SteamID and profile
link. Sessions expire after seven days; signing out revokes the current session.
The local preview server does not emulate Steam or D1. Use the deployed site for
Steam login, or Wrangler local development with a separate local database for
backend development. Do not expose test sessions or test admin bypasses publicly.

Community cost control

The configured owner can use Community skins > Community database > Pause community.
The switch blocks new community D1 queries, including sign-ins and profile lookups,
before accessing the database. Requests already in flight may finish. No skins are deleted.
The editor, local saved skins, reports and model assets remain available.
This is a manual pause, not an automatic spending cap. Stored D1 data, Workers
requests and R2 operations can still incur charges. Each community request reads
one small control object from the existing R2 bucket; the switch does not query D1
while paused.

Resume in the same browser within seven days. If the browser cookie expires or is
cleared, open Cloudflare R2 > skinforge-assets and delete only the object
_skinforge/community-control.json to resume. Do not delete the bucket or assets.
For an emergency configuration override, set COMMUNITY_DISABLED to true in
Cloudflare Pages variables and redeploy. This blocks community requests before
R2 or D1 access; remove the override and redeploy to return to the saved switch state.

Server support requests use a separate DISCORD_SERVER_REQUEST_WEBHOOK secret.
Set it to the full Discord webhook URL in the matching Cloudflare Pages environment
and redeploy. Issue reports continue to use DISCORD_REPORT_WEBHOOK. Server requests
will not fall back to the issue-report webhook if their secret is missing.
