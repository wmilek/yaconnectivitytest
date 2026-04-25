# yaconnectivitytest

Yet Another Connectivity Test - a concurrent HTTP latency tester. Measures DNS resolution and HTTP connection times across many URLs in parallel, helping you evaluate your network environment.

Available as a Python CLI and as a browser-based test page.

## Browser version

[**http://yaconnectivitytest.surge.sh**](http://yaconnectivitytest.surge.sh)

The same test running entirely in your browser — no install, no Python. Pick a corpus, click **Run test**, and get the same fastest / slowest / median breakdown. Output includes a self-contained header (run time, page URL, user agent, parameters) so you can copy/paste a full, reproducible report.

Notes:

- The page is deliberately served over **HTTP** (not HTTPS). Browsers won't make requests from an `https://` page to `http://` URLs (mixed-content rule), and most of the embedded corpus is `http://` on purpose. If your browser auto-upgrades the URL, disable HTTPS-Only Mode for this site.
- Requests use `mode: 'no-cors'`, so responses are opaque — the browser measures round-trip time but can't read status codes (same liberal "any response = success" rule as the CLI).
- Some URLs (Meta, Yahoo, Yandex, TikTok, Reddit, Quora, etc.) are blocked by Firefox Enhanced Tracking Protection or strict site CSP rather than by real connectivity problems. A **"Skip URLs known to fail in browsers"** checkbox (on by default) removes them from the run. The CLI tests them normally.

### Sending reports

After a run, you can publish the rendered output to an MQTT topic via WebSockets. Defaults: broker `wss://test.mosquitto.org:8081/mqtt`, topic `yaconnectivitytest/reports`. Both are public — change the topic to something unique if you want privacy.

Subscribe with any MQTT client, for example:

```bash
mosquitto_sub -h test.mosquitto.org -t yaconnectivitytest/reports -v
```

(Or use MQTT Explorer / IoT MQTT Panel on mobile.)

## Install

```bash
pip install git+https://github.com/wmilek/yaconnectivitytest.git
```

### Android (Termux)

```bash
pkg update && pkg install python git
pip install git+https://github.com/wmilek/yaconnectivitytest.git
```

### Upgrade

```bash
pip install --upgrade git+https://github.com/wmilek/yaconnectivitytest.git
```

## Usage

```bash
# Run against the embedded list of ~330 popular URLs
yaconnectivitytest --embedded

# Limit to a random sample of 20 URLs
yaconnectivitytest --embedded --limiturl 20

# Control parallelism (default: 6, similar to Firefox)
yaconnectivitytest --embedded --parallel 12

# Use your own URL list from a CSV file (format: popularity,domain)
yaconnectivitytest --csvfile domains.csv

# Combine options
yaconnectivitytest --embedded --limiturl 50 --parallel 10
```

## Output

The tool prints a summary at the end:

- **Top 5 fastest** - best DNS + connection times
- **Top 5 slowest** - worst performers
- **Top 5 average (median range)** - URLs closest to the median response time
- **Failed** - URLs that couldn't be reached, with error type (ConnectionError, ReadTimeout, Timeout)

Any HTTP response (including 4xx/5xx) counts as success - the tool tests your client's ability to resolve DNS and establish HTTP connections, not server content.

## Embedded URL lists

The tool includes several built-in URL sets:

| List | URLs | Description |
|---|---|---|
| URLS | ~20 | Popular global websites |
| SPECIAL_URLS | ~10 | Captive portal and test endpoints |
| LIBS_URLS | ~40 | CDN-hosted JavaScript libraries |
| URLS2 | ~100 | Top US websites |
| URL_TOP100_HTTPS | ~100 | Top global HTTPS sites |
| TOP_100_PL | ~100 | Top Polish websites |
| ALL_URLS | ~330 | Union of all the above |
| BROWSER_EXCLUDED | ~28 | URLs skipped by the web frontend (browser-only blockers: ETP, strict CSP, etc.). CLI ignores this list. |

## Requirements

- Python 3.8+
- `requests`

