# Book Club App

## Project Overview

A full-stack book club application with independently deployable Frontend, Backend, and Database services. The entire stack runs via Docker Compose for local development.

## Architecture

```
bookClubBackend/
├── Frontend/          # React 19 SPA (Bun + Tailwind CSS)
├── Backend/           # Fastify API server (Bun)
├── docker-compose.yml # Orchestrates all services
├── .env               # Environment variables (not committed)
└── CLAUDE.MD
```

### Services

- **Frontend**: React 19 with Bun runtime, Tailwind CSS v4, Radix UI components, React Hook Form + Zod validation. Entry point: `Frontend/src/index.tsx`. Dev server: `bun --hot src/index.tsx`.
- **Backend**: Fastify v5 API server running on Bun. Entry point: `Backend/` (needs index/server file).
- **Database**: External database service (configured via Docker Compose, not an in-memory DB).

Each service is its own independent app — no Next.js API routes, no shared runtimes.

## Tech Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Runtime  | Bun                                             |
| Frontend | React 19, Tailwind CSS v4, Radix UI, Zod        |
| Backend  | Fastify v5                                      |
| DB       | TBD (Postgres recommended)                      |
| Infra    | Docker, Docker Compose, DockerHub               |

## Local Development

The only requirements to run the project locally:

```bash
git clone <repo-url>
cp .env.example .env   # Edit .env with your values
docker compose up
```

All three services (Frontend, Backend, DB) start from a single `docker compose up` command.

## Docker Strategy

### Development
- `docker-compose.yml` defines all three services with hot-reload for FE/BE
- Volumes mount source code for live development

### Production
- Custom optimized production Docker images for Frontend and Backend
- Multi-stage builds to minimize image size
- Images published to DockerHub

## CI/CD (Automated Deployments)

### Application Changes (Frontend or Backend)
1. Push to main triggers CI pipeline
2. Builds new Docker image for the changed service
3. Pushes image to DockerHub
4. Redeploys to production cloud host

### Base Image Changes
1. Changes to base custom Docker image trigger a separate pipeline
2. Builds and deploys to a **staging environment** first (not production)

## Environment Variables

All configuration is managed via `.env` file at the project root. Never commit `.env` — use `.env.example` as a template.

Expected variables (update as the project evolves):
- `DATABASE_URL` — connection string for the database
- `API_PORT` — port for the Backend API
- `FRONTEND_PORT` — port for the Frontend dev server
- `NODE_ENV` — development | production

## Commands

| Task              | Command                          |
| ----------------- | -------------------------------- |
| Start all services | `docker compose up`             |
| Start with rebuild | `docker compose up --build`     |
| Frontend dev only  | `cd Frontend && bun run dev`    |
| Frontend build     | `cd Frontend && bun run build`  |
| Backend dev only   | `cd Backend && bun run dev`     |

## Code Conventions

- **Package manager**: Bun (use `bun add`, not `npm install`)
- **Language**: TypeScript throughout
- **Frontend components**: Use Radix UI primitives + `class-variance-authority` for variants, `clsx`/`tailwind-merge` for classname merging (utility in `Frontend/src/lib/`)
- **API**: RESTful endpoints via Fastify
- **Validation**: Zod schemas (shared where possible between FE/BE)
