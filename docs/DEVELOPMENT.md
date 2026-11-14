# Development

How to set up a working copy, run the app locally, run tests, and make common changes. For deploying, see [DEPLOYMENT.md](DEPLOYMENT.md); for how the pieces fit together, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Setup

Requirements: Node.js 22+ (`.tool-versions` pins 24.11.0 for asdf/mise), npm, and git. The AWS CLI, SAM CLI, and jq are only needed to deploy a backend.

```bash
git clone https://github.com/onemorepereira/guitar-collection.git
cd guitar-collection
make install      # npm install in the repo root and backend/src
make init-hooks   # optional: enable the secret-scanning pre-commit hook
cd backend && npm install && cd ..   # test tooling (jest) for the backend
```

---

## Running the frontend

```bash
make dev          # = npm run dev → http://localhost:5173
```

The frontend needs a backend API. It reads one variable from `.env` at the repo root:

```bash
VITE_API_URL=https://<your-api-url>
```

**The API must be a non-production stack.** The API allows CORS from exactly one origin (`AllowedOrigin`), and CSRF checks accept `localhost` only when `Environment` is not `prod` (`backend/src/lib/csrf.js`). A production stack rejects requests from `localhost:5173`.

To create a dev backend (one-time, needs the AWS prerequisites from [DEPLOYMENT.md](DEPLOYMENT.md#prerequisites)):

```bash
make init                    # if you don't have backend/samconfig.toml yet
# backend/samconfig.toml's [dev] section sets the stack name (my-app-backend-dev)
# and Environment=dev AllowedOrigin='http://localhost:5173'; other parameters
# fall back to the template defaults, which are fine for local work
make install
cd backend && sam build && sam deploy --config-env dev \
  --capabilities CAPABILITY_NAMED_IAM --resolve-s3 && cd ..

# point the frontend at it
echo "VITE_API_URL=$(aws cloudformation describe-stacks --stack-name <dev-stack-name> \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)" > .env
```

Note that `make deploy-backend` (production) **overwrites `.env`** with the production API URL, so recreate it before going back to local work.

### Running Lambda handlers locally

`cd backend && npm run local:api` runs `sam local start-api` on port 3001. The handlers still use real AWS resources (DynamoDB tables, Cognito, S3), so you need a deployed dev stack and an `env.json` with its resource names. `backend/scripts/local-setup.sh` generates one, but it assumes a stack named `guitar-collection-backend-dev`; edit `STACK_NAME` to match yours. Sample events are in `backend/events/`.

---

## Tests and checks

| Check | Command | Runs in CI |
|-------|---------|------------|
| Frontend unit tests (Vitest, jsdom) | `npm test` (or `npm run test:watch`) | yes |
| Type check | `npx tsc --noEmit` | yes |
| Production build | `npm run build` | yes |
| Lint (ESLint, zero warnings allowed) | `npm run lint` | yes, informational |
| Backend unit tests (Jest) | `cd backend && npm test` | yes |
| CloudFormation lint ([cfn-lint](https://github.com/aws-cloudformation/cfn-lint), `pip install cfn-lint`) | `cfn-lint backend/template.yaml frontend-infrastructure.yaml` | yes |

Frontend tests live next to the code (`src/**/*.test.ts(x)`); backend tests live in `backend/tests/unit/`. CI is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and runs on every pull request to `main`.

`make test` runs the frontend suite only and does not fail on test failures; use the commands above for a real pass/fail result.

---

## Project layout

```
src/                      React SPA
  components/             UI (condition/ holds the condition-diagram subsystem)
  context/                AuthContext, ThemeContext
  hooks/                  e.g. useGuitarSuggestions (fuse.js autocomplete)
  data/guitarKnowledge.json  model specs used by autocomplete
  services/               one API client module per domain
  utils/api.ts            HTTP wrapper (base URL, JWT, CSRF header)
  types/                  shared TypeScript types
backend/
  template.yaml           SAM template: every AWS resource and route
  src/handlers/<domain>/  Lambda code: index.js router + one file per operation
  src/lib/                shared validation, sanitization, AWS clients, logging
  src/package.json        Lambda runtime dependencies (what SAM ships)
  package.json            test tooling only
  tests/unit/             Jest tests
  events/                 sample events for sam local
frontend-infrastructure.yaml  S3 + CloudFront + ACM + security headers
Makefile                  setup, build, deploy, logs
docs/                     this documentation
```

---

## Common changes

### Add a guitar field

1. Add it to the `Guitar` type in `src/types/guitar.ts` and to the form/detail components.
2. Add it to `ALLOWED_GUITAR_FIELDS` in `backend/src/lib/validation.js`. **Required**: unknown fields are rejected with a 400.
3. If it should be shareable, add it to `SharedFields` and to the filter in `backend/src/handlers/shares/public-get.js`.
4. Document it in [API_CONTRACT.md](API_CONTRACT.md).

### Add an API endpoint

1. Add an event (path, method, `Auth.Authorizer`) to the domain's function in `backend/template.yaml`.
2. Add the route match in `backend/src/handlers/<domain>/index.js`.
3. Implement it in a new operation file in that folder. Use `lib/response.js` for responses, `lib/validation.js` for input, call `validateCSRF` for state-changing requests, and scope every query to the caller's `userId`.
4. Call it from the domain's module in `src/services/` through `authenticatedRequest`/`apiRequest`, not raw `fetch`.
5. Add a unit test in `backend/tests/unit/` and update [API_CONTRACT.md](API_CONTRACT.md).

### Add a backend dependency

Install it in **`backend/src/`** (`cd backend/src && npm install <pkg>`). SAM ships that folder as-is; a dependency added only to `backend/package.json` is missing at runtime.

### Gotchas

- Buttons inside a `<form>` default to `type="submit"`. Always set `type="button"` on non-submit buttons.
- Images on shares are re-rendered with `sharp`, which comes from a Lambda layer (`backend/layers/sharp`), not `node_modules`.
- `VITE_API_URL` is baked in at build time. Rebuild after changing it.

---

## Debugging

```bash
make logs FUNC=guitars        # tail a function's CloudWatch logs (suffixes listed in DEPLOYMENT.md)
make status                   # show config and cached stack outputs
```

- **401 from the API**: token expired or missing. ID tokens last 6 hours; the client refreshes through `/auth/refresh`.
- **403 `Missing required security header`**: the request didn't go through `src/utils/api.ts`.
- **CORS errors in the browser**: the page origin doesn't match the stack's `AllowedOrigin`.
- **Document extraction stuck in `processing`**: check `make logs FUNC=document-extraction` and the extraction dead-letter queues in SQS.
