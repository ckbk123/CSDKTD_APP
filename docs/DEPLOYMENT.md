# Static web build and Cloudflare deployment

Prepared 29 October 2026. The deployment configuration serves the Vite build from `dist/` using **Cloudflare Workers Static Assets**. The browser runs the application. Hosting needs no server-rendered pages, application server, server API, database, account system or persistent Worker process.

This task prepares the repository and local deployment checks. It does not create a Cloudflare project, connect a production branch or publish a website. The commands below that authenticate or deploy are the future publishing procedure.

## Build locally

Use Node.js 24 LTS (24.15+), matching CI. The locked dependencies also support Node 22.22.2+. Node and npm are build/development tools; users of the published app need a compatible browser, not Node.

From the repository root, install the committed lockfile and verify the application:

```sh
npm ci
npm run check
npm test
npm run build
```

`npm run build` produces `dist/`. The built entry point and bundled JavaScript/CSS are static files. Vite also copies `public/_headers` into the output.

For normal development, use `npm run dev`. For a quick view of the production bundle, use `npm run preview`. Vite's preview server does not implement Cloudflare's `_headers` rules, so use the Wrangler preview below to test hosting behavior.

## Check the Cloudflare package without publishing

Wrangler is a development dependency pinned through the lockfile. After building, validate its deployment package without an account or upload:

```sh
npx wrangler deploy --dry-run
```

To serve the actual static-asset configuration locally, run:

```sh
npx wrangler dev
```

Open the local URL printed by Wrangler. Check the home page, navigation, asset requests and browser console. A path selected after `#` stays in the browser and does not become a server route. Reloading that hash route therefore requests the same HTML entry point.

On the tested Windows/OneDrive workspace, rebuilding `dist/` while Wrangler was
watching it could disable the asset watcher with an `EPERM` message. Restart
Wrangler after rebuilding in that case, then reload the browser. Use Vite's
`npm run dev` for normal live editing. This is a local preview limitation, not
a production deployment requirement.

The configuration intentionally uses `assets.not_found_handling: "none"`. An unknown server path or missing asset should return a normal 404 rather than silently returning the HTML page. No `_redirects` rewrite or server router is necessary for the hash-route interface. The asset directory is the only required deployment setting; an assets binding and Worker entry script are optional capabilities that this application does not use. [Cloudflare asset configuration](https://developers.cloudflare.com/workers/static-assets/binding/)

## Deploy later from a local machine

When publishing has been requested and the target Cloudflare account is known:

```sh
npm ci
npm run check
npm test
npm run build
npx wrangler login
npx wrangler deploy
```

Wrangler's login is interactive and stores local authentication outside this repository. `wrangler.jsonc` sets the deployment name to `csdktd-app`; change that name deliberately if another Worker already uses it. Do not add account credentials, API tokens or local authentication files to source control.

The account's Workers configuration determines the resulting public URL or custom domain. Preparing `wrangler.jsonc` does not reserve a URL or establish that a deployment has succeeded.

## Git-connected Cloudflare build settings

For Cloudflare's Workers Git integration, connect this repository and choose the production branch deliberately. Use the following settings:

| Setting | Value |
|---|---|
| Project/Worker name | `csdktd-app` |
| Root directory | Repository root |
| Production branch | `main`, when production publication is authorized |
| Node version | Set the build environment to Node.js 24 LTS |
| Build command | `npm ci && npm run check && npm test && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Asset directory | `./dist`, from `wrangler.jsonc` |
| Server entry point | None |
| Database/storage bindings | None |

Cloudflare automatically installs dependencies in its build environment; the explicit `npm ci` in the command makes the lockfile installation policy visible and reproducible. It may repeat that installation. If you remove the explicit step to reduce build time, first confirm the integration's install behavior and keep the lockfile committed.

Cloudflare separates build and deploy commands and uses the installed Wrangler dependency. Its generated build authentication belongs in the platform's settings. GitHub Actions in this repository only checks the code; it does not authenticate to Cloudflare or publish. [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build environment versions](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)

## Cache and content policies

`public/_headers` keeps the HTML entry point revalidating with `Cache-Control: no-cache`. Vite's content-hashed files under `/assets/` are immutable for one year. New builds change those asset names; an HTML reload discovers the new names. Place only content-hashed build output under `/assets/`; keep hand-maintained, unversioned files elsewhere or revise this rule.

The broad rule contains security headers only, while the HTML and asset rules contain their respective cache policy. This avoids accidentally applying two conflicting cache values to a response. Cloudflare joins duplicate matching header values, and it parses `_headers` from the final asset directory. [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/)

The production content policy allows local module scripts, local styles/fonts and generated inline styles. It blocks inline JavaScript and string evaluation. Images may use local, data or blob URLs. No external CDN, font provider or analytics service is required. The policy prohibits embedding the app in an iframe; revise that decision explicitly if an LMS embedding requirement appears later.

There is no service worker or PWA cache in this version. This avoids an additional application-update/cache mechanism during the first iteration. Browser HTTP caching alone does not guarantee offline availability. A future WebAssembly mathematics module may require the narrowly scoped `wasm-unsafe-eval` script source permission; add it only with that actual dependency and verify the resulting policy, rather than enabling general `unsafe-eval` now.

## Hosting cost and limits

Cloudflare currently documents requests served directly as static assets as **free and unlimited**, with no separate asset-storage charge. Worker script execution uses different request/CPU pricing. This assets-only package has no Worker script to execute and does not enable `run_worker_first`. Git-connected build quotas are a separate product limit. [Static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Workers Builds limits and pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)

As checked on 29 October 2026, Workers Free allows **20,000 static files per version**, with a **25 MiB maximum individual file size**. The paid file-count limit is 100,000, and the individual-file size limit is unchanged. These are platform limits, not a reason to add a paid service to this small static app. Recheck the current account and documentation before a release. [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/#static-assets)

## Continuous integration

`.github/workflows/ci.yml` checks pushes to `main` and pull requests on GitHub-hosted Ubuntu with Node.js 24. It installs with `npm ci`, checks types, runs tests and builds the static output. The job has read-only repository permissions and does not persist checkout credentials. Its verified current action majors are [`actions/checkout@v7`](https://github.com/actions/checkout/releases) and [`actions/setup-node@v7`](https://github.com/actions/setup-node/releases). A self-hosted runner would require a sufficiently current runner release for these actions.

CI is validation only. A successful build is not a deployed site, and it does not certify every browser/device or every mathematical exercise. Before a requested release, use the built assets with Wrangler to inspect navigation, console errors, headers and missing-file responses, then record the actual deployment URL after Cloudflare reports success.
