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

## Publish to GitHub

1. Run **Prepare GitHub.bat** in your working folder. It creates or refreshes
   **GitHubSource**, including the original R2 assets. It excludes dependencies,
   private environment files and Cloudflare cache/state.
2. In GitHub Desktop, choose **File ? Add local repository** and select
   **GitHubSource**. If Git is installed, the preparation script has already
   initialised this repository. Otherwise use **create a repository here**.
3. Review the changes, commit them, then choose **Publish repository**.
4. Uncheck **Keep this code private** to make the repository public.

For updates, run **Prepare GitHub.bat** again, review and commit the changes in
GitHub Desktop, then **Push origin**. The script copies managed files and
preserves the exported repository's Git history. It does not commit or publish.
Make changes in the working folder rather than the generated copy. Deleted or
renamed source files must also be removed from the exported copy manually.

Use GitHub Desktop or Git rather than browser uploads: some assets exceed the
browser's 25 MiB limit. All current files are below GitHub's 100 MiB Git limit,
so Git LFS is not required for this snapshot. The exporter checks that limit.
The initial upload includes approximately 685 MiB of game assets.

[GitHub Desktop publishing instructions](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-an-existing-project-to-github-using-github-desktop)

## Development and checks

- `public/`: website, viewer, report endpoint and bundled Three.js.
- `r2/`: original models and textures; do not modify their bytes without updating the manifest and catalog URLs.
- `scripts/`: local server, asset validation/upload, report tests and source export.
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
