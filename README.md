# Mini-Dokploy

A self-hosted deployment platform that takes a Git repo URL + Dockerfile, builds the image, runs it as a Docker Swarm service, and exposes it through Traefik on a generated subdomain. Minimalistic approach with several nice-to-have follow ups!

---

## 1. Setup

### Prerequisites

- Node.js >= 20
- Docker >= 24 with Swarm mode
- npm >= 10

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/victorCookeTP/mini-dokploy.git
cd mini-dokploy

# 2. Install dependencies
npm install

# 3. Initialize Docker Swarm (idempotent)
docker swarm init

# 4. Deploy the stack (Traefik + Mini-Dokploy)
docker stack deploy -c docker-compose.yml mini-dokploy

# 5. Run database migrations
npx drizzle-kit push

# 6. Start the dev server
npm run dev
```

The UI is available at `http://localhost:3001`.  
The Traefik dashboard is available at `http://localhost:8080`.


### Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `./mini-dokploy.db` | Path to SQLite database |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker socket path |

---

An example .env is at `.env.example`

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   User Browser                      │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────┐
│                  Traefik v3                         │
│         (Docker Swarm service, port 80)             │
│   Routes by Host header using sslip.io subdomains   │
└──────┬───────────────────────────┬──────────────────┘
       │                           │
┌──────▼──────┐           ┌────────▼────────┐
│ Mini-Dokploy│           │ User Deployment │
│  Next.js    │           │  (any image)    │
│  port 3001  │           │  app-xxxx.sslip │
└──────┬──────┘           └─────────────────┘
       │
┌──────▼──────────────────────────────────────────────┐
│                  tRPC API Layer                     │
│   deployments.list / create / redeploy / remove     │
└──────┬──────────────────────────────────────────────┘
       │
┌──────▼──────┐     ┌─────────────────────────────────┐
│  SQLite DB  │     │         Docker Engine           │
│  (Drizzle)  │     │  docker build + service create  │
│             │     │  via /var/run/docker.sock       │
└─────────────┘     └─────────────────────────────────┘
```

### Key components

**Frontend** — Next.js Pages Router with tRPC React Query hooks. The deployments table polls every 3 seconds to reflect status changes during build/deploy.

**API** — tRPC procedures mapped to Docker operations. Mutations are thin orchestrators: they write to the DB and fire async build jobs.

**Build pipeline** — `buildAndDeploy()` runs asynchronously: clones the repo with `simple-git`, builds the image with `execa` shelling out to `docker build`, creates a Swarm service via `dockerode`, and updates the deployment status at each step.

**Routing** — Traefik v3 watches Docker Swarm for services with `traefik.enable=true` labels. Each deployment gets a unique subdomain via `sslip.io` (e.g. `app-abc123.127.0.0.1.sslip.io`) — no DNS or hosts file setup needed.

**State** — SQLite via Drizzle ORM tracks deployment status (`pending → cloning → building → deploying → running | failed`), service IDs, and metadata.

---

## 3. Tradeoffs and what I'd build next

### Tradeoffs made

**Fire-and-forget build jobs** — `buildAndDeploy()` is called without awaiting in the mutation. This keeps the HTTP response fast but means there's no backpressure or job queue. Under load, many concurrent builds could exhaust memory or Docker resources. A proper job queue (BullMQ, pg-boss) would be the right fix.

**SQLite over Postgres** — SQLite is perfect for a single-node local tool and has zero setup cost. The tradeoff is no concurrent writes and no horizontal scaling. Switching to Turso (libSQL) would preserve the SQLite DX while adding replication.

**Shell out to `docker build`** — Using `execa` to shell out is simpler than the Docker API's build stream, but it couples the process to the host's Docker CLI version and makes log streaming harder. The Docker Engine API (`/build` endpoint) would give more control.

**No auth** — All deployments are visible to anyone with access to the UI. Fine for local use, a problem for any shared environment.

**Subdomain generation** — `nanoid` generates the subdomain at creation time. If the service crashes mid-deploy and is redeployed, it gets a new subdomain. Idempotent deploys keyed on repo URL + branch would be better UX.

### What I'd build next

- **Add unit test** to check everything is working as expected
- **Live build logs** streamed to the UI via WebSockets — the single highest-impact UX improvement
- **BetterAuth multi-tenancy** — users own their deployments, isolated by org
- **Branch deployments** — deploy a specific branch or commit SHA, not just the default branch
- **Environment variables** — pass env vars to deployed services through the UI

---

## 4. How I used AI tools

### Where AI helped

This project was scaffolded and bolierplated with Claude (Anthropic). Specifically:

- **Initial architecture** — Claude proposed the overall structure (tRPC router shape, Drizzle schema, Docker service helper split) which I reviewed and adjusted before writing any code.
- **Boilerplate generation** — tRPC context/router setup, Drizzle config, `_app.tsx` provider wiring. These are mechanical and well-documented patterns; generating them saved time without sacrificing understanding.
- **API shape** — tRPC input schemas and Zod validation patterns.

### Where I didn't use AI

- **Docker Swarm + Traefik integration decisions** — the choice to use overlay networks, `mode: host` port binding, and Swarm-mode label placement (`deploy.labels` vs top-level) required reading official docs and iterating manually. AI suggestions here needed verification against actual Traefik v3 docs.
- **Security model** — decisions about what to expose (Docker socket, build context) were made by hand with deliberate thought about the threat model.
- **All the rest** was done without AI help!


