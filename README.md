## Environment setup

Backend and frontend share one `.env` file in the repository root.

1. Copy `.template.env` to `.env` in the root and fill in the values.
2. For local dev, set `VITE_API_PROXY_TARGET` to the backend URL (matching `PORT`) and leave `VITE_API_URL` empty.
3. Restart `npm run dev` after changing `.env`.

`.env` is gitignored. Only `VITE_`-prefixed variables reach browser code, so never give secrets that prefix. `docker-compose.yml` passes the same root `.env` to the backend container.

## Commands

Run all of these from the repository root.

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies for both `frontend` and `backend` (npm workspaces). |
| `npm run dev` | Development: backend with auto-restart plus the Vite dev server (hot reload). |
| `npm run build` | Build the frontend into `frontend/dist`. |
| `npm start` | Start the server in production mode. It serves the API under `/api` and the built frontend everywhere else. Needs `npm run build` first. |
| `npm run prod` | `npm run build` then `npm start`, in one step. For your own machine or a VPS. |
| `npm run docker:up` / `docker:down` / `docker:logs` | Run the same app in Docker (see below). |

Production is a single Node process: there is no separate frontend server.

## Deploying to Render

`render.yaml` in the repository root is a Render Blueprint that sets all of this up. To deploy: Render dashboard > New > Blueprint > pick this repository, then fill in the secret values it asks for.

If you create the service by hand instead (New > Web Service), use:

| Setting | Value |
| --- | --- |
| Runtime | Node (Node 20 or newer) |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Instances | 1 is fine; more is safe because scheduled jobs are locked in MongoDB. |

Do not use `npm run prod` as the start command. It rebuilds the frontend on every restart.

### Environment variables on Render

Set these in the service's Environment tab. `VITE_*` values are baked into the frontend during the build, so after changing one, redeploy with "Clear build cache & deploy".

Required:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` (set by `render.yaml`) |
| `MONGODB_URI` | Atlas connection string, e.g. `mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/wallo?retryWrites=true&w=majority`. `MONGO_URI` is also accepted. The server won't start without one. |
| `JWT_SECRET` | At least 32 characters. Generate: `openssl rand -hex 48` |
| `FRONTEND_URL` | Your public URL, no trailing slash, e.g. `https://your-app.onrender.com`. Used in verification and password-reset links. |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | 64 hex characters. Generate: `openssl rand -hex 32`. Needed to save users' AI API keys and to connect Gmail. |

Needed for specific features:

| Variable | Feature | Value |
| --- | --- | --- |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | Email. **Required in production**: sign-up sends a verification link, so without email nobody can register. | `smtp.gmail.com`, `587`, your address, and a Gmail App Password (not your normal password). |
| `EMAIL_FROM` | Sender name and address on emails | Optional, e.g. `"Vestor" <you@gmail.com>` |
| `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` | "Continue with Google" sign-in | The same OAuth client ID in both. Add your Render URL under "Authorized JavaScript origins". |
| `GOOGLE_CLIENT_SECRET` and `GMAIL_OAUTH_REDIRECT_URI` | Gmail statement scanning | The client secret, and `https://your-app.onrender.com/api/gmail/oauth/callback`. Add the same URL under "Authorized redirect URIs" and enable the Gmail API. |
| `GROQ_API_KEY`, `GROQ_STATEMENT_MODEL`, `GROQ_EMAIL_MODEL` | Optional server-wide AI for parsing bank emails | If unset, each user's own key from Settings is used. |

Optional with sensible defaults: `JWT_EXPIRES_IN` (`7d`), `TRUST_PROXY` (`1`, the right value on Render), `ALLOWED_ORIGINS` (leave empty, since the UI and API share one domain).

Leave these unset on Render:
- `PORT`: Render provides it. A fixed value can break the health check.
- `VITE_API_URL`: leave empty so the browser calls the same domain. A value with a trailing slash used to cause `//api/...` 404s.
- `VITE_API_PROXY_TARGET`: development only.

Also on Atlas: allow Render's outbound IPs under Network Access, or the app can't connect (see the checklist below).

### Docker (alternative)

```
cp .template.env .env        # fill in the values
npm run docker:up            # builds the image and starts it at http://localhost:8080
npm run docker:logs          # follow logs
npm run docker:down          # stop
```

Set `APP_PORT` in `.env` to change the host port. To also run a local MongoDB: `docker compose --profile local-db up --build` with `MONGODB_URI=mongodb://mongo:27017/vestor`. Render can also build from the `Dockerfile` instead of the Node runtime if you prefer; pass the `VITE_*` values as build arguments.

## Production security checklist

These can't be enforced in code; do them in the hosting dashboards before going live.

- **MongoDB Atlas:** give the app a database user with `readWrite` on this one database only. Avoid allowing `0.0.0.0/0`: use Render's static outbound IPs (paid plans) or Atlas private networking. Turn on backups.
- **Accounts:** turn on two-factor login for Render, MongoDB Atlas, Google Cloud and the email provider. Limit who can see the Render environment and logs.
- **Secrets:** generate `JWT_SECRET` and `GMAIL_TOKEN_ENCRYPTION_KEY` fresh for production (never reuse dev values). Rotate any secret that was ever pasted into chat, a ticket or a commit. Rotating `JWT_SECRET` logs everyone out; rotating the encryption key disconnects Gmail and drops saved AI keys.
- **After setting `GMAIL_TOKEN_ENCRYPTION_KEY`** on an existing database, run `node backend/scripts/encrypt-api-keys.js` once to encrypt previously saved AI keys.
- **`TRUST_PROXY`:** after deploying, check that rate limiting sees real client IPs (default `1` fits Render).
- **Instances:** scheduled jobs are locked in MongoDB, so scaling to several instances is safe.

## Rotating secrets (do yearly, or immediately if one leaks)

After changing any value, update it in the Render Environment tab (or your `.env`) and redeploy. Never paste real values into chats, tickets or commits.

| Secret | How to rotate | Effect |
| --- | --- | --- |
| `MONGODB_URI` (database password) | Atlas > Database Access > edit the database user > set a new password, then put it in the connection string. | Brief downtime until the new value is deployed. Use only URL-safe characters or URL-encode the password. |
| `EMAIL_PASS` | Google Account > Security > App passwords: revoke the old one, create a new one. | Emails (verification, password reset, reminders) fail until the new value is deployed. |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console > APIs & Services > Credentials > the OAuth client > add a new secret, then delete the old one. | Gmail connect fails until the new value is deployed. Google sign-in is unaffected (it only uses the client ID). |
| `JWT_SECRET` | `openssl rand -hex 48` | Every user is logged out once. |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` | Every connected Gmail is disconnected and saved AI API keys become unreadable, so users must reconnect Gmail and re-enter their keys. Worth it if the old key leaked. |

Order for a full rotation: change the database password first (highest impact), then the email app password, the Google client secret and `JWT_SECRET`, and the encryption key last. Deploy once with all new values, then check `/api/health`, log in, and send a password-reset email to confirm everything works.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
