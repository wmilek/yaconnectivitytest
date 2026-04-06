# yaconnectivitytest

Yet Another Connectivity Test - a concurrent HTTP latency tester. Measures DNS resolution and HTTP connection times across many URLs in parallel, helping you evaluate your network environment.

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

## Requirements

- Python 3.8+
- `requests`
