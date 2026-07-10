# Deploying GlaciaNav Workspace

Four containers, one command, auto-deploy on every commit.

```
push to main  →  GitHub Actions builds image  →  pushes to GHCR  →  Watchtower on your server pulls + restarts
```

## Services (docker-compose.yml)

| Service | Image | Role |
| --- | --- | --- |
| `web` | `ghcr.io/nimaema/glacianav_webapp:latest` | Next.js app and durable Nova job coordinator |
| `nova-worker` | `ghcr.io/nimaema/glacianav_nova-worker:latest` | Networkless Python file lab |
| `minio` | `minio/minio` | Local S3-compatible storage for recording audio, private bucket |
| `tunnel` | `cloudflare/cloudflared` | Cloudflare Tunnel → app.glacianav.com, no open ports |
| `watchtower` | `containrrr/watchtower` | Watches `web`, redeploys when a new image is published |

Unlike the CRM app, there's **no local Postgres container** — this app's database is
hosted on Supabase (`DATABASE_URL` in `.env` points there directly).

## One-time server setup

1. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER   # log out/in to pick this up
   ```
2. **Clone and configure:**
   ```bash
   git clone https://github.com/nimaema/Glacianav_Webapp.git
   cd Glacianav_Webapp
   cp .env.example .env
   # edit .env — Supabase values (same as your local .env.local),
   # S3_ACCESS_KEY/S3_SECRET_KEY (pick strong values), TUNNEL_TOKEN
   ```
3. **Cloudflare Tunnel:** in the Zero Trust dashboard, create a tunnel, add a public
   hostname `app.glacianav.com` pointing at `http://web:3000`, and copy the tunnel
   token into `TUNNEL_TOKEN`.
4. **Authenticate to GHCR** so the server can pull the image:
   ```bash
   echo $GHCR_PAT | docker login ghcr.io -u nimaema --password-stdin
   ```
   (Or make the GHCR package public and skip this.)
5. **Azure AD redirect URI:** if this is a new environment, make sure
   `https://<your-supabase-ref>.supabase.co/auth/v1/callback` is registered as a
   redirect URI on the Entra app registration (Authentication providers don't change
   per-deployment — this is a one-time Supabase-side thing, already done for the
   `GlaciaNav_workspace` project).
6. **Start it:**
   ```bash
   docker compose up -d
   ```

## Continuous deployment

`.github/workflows/deploy.yml` builds and pushes `ghcr.io/nimaema/glacianav_webapp:latest`
on every push to `main`. Two repo secrets are required (Settings → Secrets and
variables → Actions) since `NEXT_PUBLIC_*` values get inlined into the client bundle
at **build** time, not read at container runtime:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Watchtower polls every 60s (`WATCHTOWER_INTERVAL`) and rolling-restarts `web` when the
image changes. It also updates the isolated Nova worker image. So: **commit → push →
it's live in a minute or two.**

Nova’s durable queue processor starts with the `web` server. It does not require a
separate Compose service, so normal Watchtower image updates also deploy queue changes.
Set `NOVA_PROCESSOR_DISABLED=true` only when an external coordinator intentionally owns
queue consumption; the authenticated internal processing route remains available for
manual recovery.

## Nova sandbox

Nova's Python jobs never run inside the web process. The `nova-worker` container has
no network, no application `.env`, no database connection, a read-only root
filesystem, an ephemeral `/workspace`, and explicit CPU, memory, file-size, and PID
limits. The web app and worker exchange bounded JSON jobs through the private
`novajobs` Docker volume. The worker image includes pandas, Polars, NumPy, SciPy,
openpyxl, XlsxWriter, python-docx, python-pptx, ReportLab, pypdf, pdfplumber,
PyMuPDF, Matplotlib, Seaborn, Plotly/Kaleido, Pillow, LibreOffice, and Poppler.

For local development, start the same networkless worker with:

```bash
./scripts/setup_nova_sandbox.sh
```

## Secrets

Everything sensitive comes from `.env` (git-ignored): `SUPABASE_SERVICE_ROLE_KEY`,
`DATABASE_URL`, `S3_ACCESS_KEY`/`S3_SECRET_KEY`, `TUNNEL_TOKEN`.

## Audio storage

Recording audio lives in the `minio` container's private bucket (`S3_BUCKET`, default
`audio`) — never exposed directly to the internet. The app is expected to proxy audio
bytes through an authenticated API route with Range-request support (for seeking),
same pattern as the Notes app's `src/app/api/recordings/[id]/audio/route.ts` — that
wiring is separate follow-up work; this stack just gets MinIO running and reachable
from `web` on the compose network.

## Local production test

```bash
cp .env.example .env    # fill in Supabase + MinIO values
WEB_IMAGE=glacianav-web docker compose build web \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
docker compose up -d
```
