# CruxCast

A bouldering logbook. Every climb you log is a *crux*: you pick it on the gym map, which fills in its wall, hold colour and grade, then add how hard it felt to you, a description, how you found it, tips, and a video of your ascent.

Coming next: **How should I work on this crux?**, a machine-learning model that suggests your next move from a photo or video of where you came off.

## Features

- A public landing page explaining CruxCast and its improvement loop
- Accounts: everyone signs up and sees only their own cruxes
- Log, edit, search and delete cruxes
- Pick a crux on the gym's floor plan, loaded live from [TopLogger](https://toplogger.nu); this fills in its wall, colour and grade
- **My Gym**: the whole gym map, zoomable, with every current climb; tap one to see its details and log it
- Zoom the map with the scroll wheel, pinch, the +/− buttons, or by tapping a wall name
- **Training**: plan sessions in a week planner, log what you did (type, duration, effort and the climbs you tried), and get a warm-up, session plan and cool-down that adapt to your last two sessions, with the reasons explained
- **Board**: set your own cruxes on the Kilter Board Original (476 holds), Kilter-style: tap a hold and pick start, hand, top or foot only; give it a name, angle (0–70°) and grade; keep it private or share it publicly
- Filter the map like TopLogger does: grade and star-rating ranges, soft/hard, colours, styles and holds (with "Not"), circuit, wall, setter, new, almost removed, suitable for short people, and whether it's already in your logbook
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
| Canvas 2D API | The faded, animated climbing-icon background |
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
| [HTTPX](https://www.python-httpx.org) | Fetching the gym map and climbs from TopLogger |
| [PyJWT](https://pyjwt.readthedocs.io) | Signed login sessions, stored in an httpOnly cookie |
| [uv](https://docs.astral.sh/uv) | Python package and version management |
| [pytest](https://pytest.org) | Backend tests |

### Infrastructure

| Technology | Used for |
|---|---|
| [PostgreSQL 17](https://www.postgresql.org) | Database |
| [Docker](https://www.docker.com) + Docker Compose | Running the database, backend and frontend together |

Uploaded videos are stored on a Docker volume; the database stores only their file names.

The training advice is rule-based (`backend/app/training.py`): a template per session type, adjusted by how recent, hard and long your last two logged sessions were and which grades you sent. It returns structured steps and reason codes, so the frontend can translate them and an AI layer could rewrite them later.

The Kilter Board layout (`backend/app/boards/kilter_original.json`) was traced from a screenshot of the gym's board: hold positions and simplified outlines as fractions of the board's size. Lighting up the board over Bluetooth isn't supported: browsers on iPhone can't use Bluetooth, and the board's protocol isn't public.

### Gym map (TopLogger)

The gym map and its current boulders come from TopLogger's GraphQL API (`https://api.toplogger.nu/graphql`), the same unofficial API its web app uses, so it may change without notice. The backend fetches the gym set in `TOPLOGGER_GYM_SLUG` (default `beest-boulders-delft`), caches it for 10 minutes, and serves the floor plan from `/api/gym/floorplan.svg`. Nothing from TopLogger is stored in this repository. Each crux keeps its own copy of its map position, so its pin survives the gym resetting the climb.

Every response from TopLogger is validated before use. If a refresh fails (TopLogger is down, or has changed its format), the backend keeps serving the last good copy from memory and the map shows how old it is; the reason is logged in the backend output. That copy lives only in memory, so after a backend restart the map needs TopLogger to be reachable again.

## Tests

```bash
cd backend
uv run pytest                                              # unit tests
TOPLOGGER_LIVE=1 uv run pytest tests/test_toplogger_live.py  # checks TopLogger's API still matches
```

If the live check fails, TopLogger has changed its API; the fix belongs in `backend/app/toplogger.py`.

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
    models.py        Database tables (users, cruxes, board cruxes, training sessions)
    schemas.py       Request/response shapes and validation
    security.py      Password hashing and the session cookie
    storage.py       Saving uploaded videos to disk
    training.py      Rule-based session advice (context, draft and one function per rule)
    board.py         The Kilter Board layout and its rules
    gym_areas.py     Labels for the gym's non-climbing areas
    toplogger/       TopLogger integration: client, conversions, floor plan, cached service
    routers/         One module of endpoints per feature, plus shared helpers
  migrations/        Alembic database migrations
  tests/             pytest tests (one live TopLogger check, opt-in)
frontend/
  src/
    pages/           One component per screen
    components/      Reusable UI (map, filters, board, advice card, forms, ...)
    i18n/            en/ and nl/ translations, one file per feature
    styles/          CSS per feature, imported in order by index.css
    api.ts           Calls to the backend
    *Context.ts      Auth and theme state, with their hooks
    cachedResource.ts  Data fetched once and shared (gym map, board layout)
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

**Add or change text.** Edit the matching feature file in both `frontend/src/i18n/en/` and `frontend/src/i18n/nl/`. TypeScript reports an error if a key is missing from Dutch.
