# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Yet Another Connectivity Test (`yaconnectivitytest`) — a concurrent HTTP latency tester. Sends `HEAD` requests to many URLs in parallel via a thread pool and reports fastest / slowest / median response times plus per-error failure summaries. Any HTTP response (including 4xx/5xx) counts as success; the tool measures DNS + connect + first response, not content correctness.

## Commands

```bash
# Install (editable / from source)
pip install .

# Install from GitHub
pip install git+https://github.com/wmilek/yaconnectivitytest.git

# Run via entry point after install
yaconnectivitytest --embedded
yaconnectivitytest --embedded --limiturl 20 --parallel 12
yaconnectivitytest --csvfile domains.csv    # CSV rows: "popularity,domain"

# Run without installing (from repo root)
python yaconnectivitytest.py --embedded

# Sanity check used by CI
python -c "import connectivity; import database; print('Imports OK')"
yaconnectivitytest --help
```

There is no test suite, linter, or formatter configured. CI (`.github/workflows/ci.yml`) only verifies imports, the CLI entry point, and runs a 3-URL live connectivity test on Python 3.10 and 3.12.

## Architecture

Three top-level Python modules, all in the repo root (flat layout, no `src/` or package dir). `pyproject.toml` declares them as `py-modules`, so they are imported unqualified (`import connectivity`, `import database`).

- `yaconnectivitytest.py` — CLI entry point. The `[project.scripts]` entry in `pyproject.toml` maps the command `yaconnectivitytest` → `yaconnectivitytest:main`, and the module is also listed under `[tool.setuptools] py-modules`. Renaming the file requires updating both spots in lockstep.
- `connectivity.py` — measurement core.
  - `load_url(session, url)` issues a `session.head(url, timeout=30, allow_redirects=False)` and returns a `MeasureResult` (ad-hoc class with attributes assigned dynamically) containing `start_at`, `end_at`, `url`, `result`, and `error`. Only `ConnectionError`, `ReadTimeout`, and `Timeout` are caught — other exceptions propagate and will crash the worker future.
  - `connectivity_test_concurrent(urls, max_workers=6)` drives a `ThreadPoolExecutor` over a shared `requests.Session`, splits results into `successful` / `failed`, and prints the summary (top 5 fastest, top 5 slowest, top 5 nearest the median, failures grouped by URL).
- `database.py` — embedded URL corpora as module-level constants. `process()` splits a multiline string and keeps lines starting with `http`. `URLS`, `SPECIAL_URLS`, `LIBS_URLS`, `URL_TOP100_HTTPS`, `TOP_100_PL`, `BROWSER_EXCLUDED` are sets; **`URLS2` is a `filter` iterator, not a set** — it is only safe to iterate once. `ALL_URLS = set.union(URL_TOP100_HTTPS, URLS2, SPECIAL_URLS, LIBS_URLS, TOP_100_PL)` materializes the union and happens to consume `URLS2`, so any code importing `URLS2` after `ALL_URLS` is referenced will see an exhausted iterator. Preserve this or fix both sites together. `BROWSER_EXCLUDED` lists URLs that fail in browsers for browser-specific reasons (Enhanced Tracking Protection, strict CSP, opaque-response blocks) rather than connectivity issues — the CLI ignores it; the web frontend offers a checkbox to skip them.

Control flow: CLI parses args → chooses URL source (CSV parse or `database.ALL_URLS`) → optional `random.sample` down to `--limiturl` → `connectivity.connectivity_test_concurrent` with `max_workers=--parallel` (default 6, chosen to match Firefox's per-host connection cap).

### Web frontend (`web/`)

A browser port of the same test, deployed to `yaconnectivitytest.surge.sh` on push to `main`.

- `web/index.html`, `web/app.js`, `web/connectivity.js` — vanilla ES-module SPA. `connectivity.js` mirrors `connectivity.py`: `fetch(url, {method: 'HEAD', mode: 'no-cors'})` timed with `performance.now()`, `runConcurrent` drives a Promise-based worker pool. Opaque responses mean status codes are unknowable — any resolved fetch is "success", reject is "failure", same as the CLI's liberal success definition. **Do not add `redirect: 'manual'`** — combined with `mode: 'no-cors'`, Firefox rejects every request instantly per the Fetch spec (opaque response tainting + non-follow redirect mode = immediate network error).
- `web/database.js` — **generated** from `database.py` by `scripts/generate_database_js.py`. Do not edit by hand; re-run the generator after changing the Python corpus. `database.py` stays the single source of truth.
- `web/CNAME` — pins the Surge domain. Changing the deploy target means editing this file.
- `.github/workflows/deploy-web.yml` — regenerates `web/database.js` then runs `npx surge ./web`. Requires repo secrets `SURGE_LOGIN` (account email) and `SURGE_TOKEN` (from `surge token`).
- Mixed-content rule: the site **must be served over `http://`** for the browser to reach the `http://` entries in the corpus. Surge's free `*.surge.sh` subdomain is HTTP-reachable (no HSTS); that's why we're not on GitHub Pages / Netlify / Vercel, all of which force HTTPS.
- Report submission: a "Send report" button in the UI publishes the rendered output text to an MQTT broker over WebSockets via `mqtt.js` (loaded from jsDelivr CDN as a global `window.mqtt`). Defaults to `wss://test.mosquitto.org:8081/mqtt` and topic `yaconnectivitytest/reports`. Broker URL and topic are persisted in `localStorage` under the `yaconn-mqtt-` prefix. WSS works from the HTTP-served page (HTTP page → HTTPS/WSS resource is allowed; only the reverse direction is blocked).

## Conventions

- Python 3.8+ compatibility is required (`pyproject.toml`). Avoid 3.9+-only syntax (e.g. `dict | dict`, `list[str]` at runtime) in module scope.
- Only runtime dependency is `requests`. Keep it that way unless adding a new capability that genuinely needs more.
- Embedded URL lists use plain `http://` on purpose for many entries — the tool is testing connectivity behavior (including redirects / captive-portal detection), not enforcing HTTPS. Don't "upgrade" them.
- Commented-out URLs with a leading `#` inside the `process()` triple-strings are intentionally excluded (the filter keeps only `http`-prefixed lines). Preserve the `#` rather than deleting the line when disabling an entry.

## Development branch

All work for this repository happens on branch `claude/add-claude-documentation-DHRlv` per the session instructions. Create it locally if missing; never push to `main`.
