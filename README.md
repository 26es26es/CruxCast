# CruxCast

A bouldering logbook. Every climb you log is a *crux*: its climb ID, hold colour, area in the gym, the gym's grade and your own grade, a description, how you found it, tips, and a video of your ascent.

Coming next: **How should I work on this crux?**, a machine-learning model that suggests your next move from a photo or video of where you came off.

## Features

- Accounts: everyone signs up and sees only their own cruxes
- Log, edit, search and delete cruxes
- Favorites
- Upload and play back ascent videos
- English and Dutch
- Light and dark mode

## Technologies

### Frontend

| Technology | Used for |
|---|---|
| [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org) | The UI |
| [Vite](https://vite.dev) | Dev server and build |
| [React Router](https://reactrouter.com) | Pages and navigation |
| [i18next](https://www.i18next.com) / [react-i18next](https://react.i18next.com) | English/Dutch translations |
| [GSAP](https://gsap.com) | Title animations |
| Plain CSS with CSS variables | Styling and the light/dark themes |
| [oxlint](https://oxc.rs) | Linting |

### Backend

| Technology | Used for |
|---|---|
| [Python 3.13](https://www.python.org) | Language, chosen so the future ML model can live alongside the API |
| [FastAPI](https://fastapi.tiangolo.com) + [Uvicorn](https://www.uvicorn.org) | REST API and server |
| [Pydantic](https://docs.pydantic.dev) | Request validation |
| [SQLAlchemy 2](https://www.sqlalchemy.org) | Database access (ORM) |
| [Alembic](https://alembic.sqlalchemy.org) | Database migrations |
| [psycopg 3](https://www.psycopg.org) | PostgreSQL driver |
| [pwdlib](https://github.com/frankie567/pwdlib) (Argon2) | Password hashing |
| [PyJWT](https://pyjwt.readthedocs.io) | Signed login sessions, stored in an httpOnly cookie |
| [uv](https://docs.astral.sh/uv) | Python package and version management |

### Infrastructure

| Technology | Used for |
|---|---|
| [PostgreSQL 17](https://www.postgresql.org) | Database |
| [Docker](https://www.docker.com) + Docker Compose | Running the database, backend and frontend together |

Uploaded videos are stored on a Docker volume; the database stores only their file names.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on Windows, enable WSL integration)
- For working on the code outside Docker: [Node.js](https://nodejs.org) 24 and [uv](https://docs.astral.sh/uv)

## Running it

```bash
docker compose up --build
```

Then open http://localhost:5173 and sign up.

| Service | URL |
|---|---|
| App | http://localhost:5173 |
| API docs (Swagger) | http://localhost:8000/docs |
| Postgres | `localhost:5432`, user/password/db `cruxcast` |

Code changes reload automatically in both the frontend and the backend.

Stop with `Ctrl+C`, or `docker compose down`. Your data lives in Docker volumes and survives restarts; `docker compose down -v` wipes the database and uploaded videos.

## Project layout

```
backend/
  app/
    main.py          FastAPI app, mounts everything under /api
    models.py        Database tables (User, Crux)
    schemas.py       Request/response shapes and validation
    security.py      Password hashing and the session cookie
    storage.py       Saving uploaded videos to disk
    routers/         auth.py and cruxes.py endpoints
  migrations/        Alembic database migrations
frontend/
  src/
    pages/           One component per screen
    components/      Shared UI (nav, cards, form, video upload, background grid)
    i18n/            en.ts and nl.ts translations
    api.ts           Calls to the backend
docker-compose.yml
```

## Common tasks

**Change the database schema.** Edit `backend/app/models.py`, then generate and apply a migration:

```bash
docker compose run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp backend \
  alembic revision --autogenerate -m "describe the change"
docker compose restart backend   # applies it on startup
```

**Add a backend package.** `cd backend && uv add <package>`, then `docker compose up --build`.

**Add a frontend package.** `cd frontend && npm install <package>`, then `docker compose up --build -V frontend`.

**Add or change text.** Edit both `frontend/src/i18n/en.ts` and `nl.ts`. TypeScript reports an error if a key is missing from Dutch.
