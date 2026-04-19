// Browser mirror of connectivity.py.
//
// Issues HEAD requests in parallel via fetch({mode: 'no-cors'}) and times
// each round-trip with performance.now(). Because no-cors responses are
// opaque, we cannot read status codes — any resolved fetch counts as
// success, any rejected fetch counts as failure (matching the spirit of
// the CLI, which treats all HTTP responses including 4xx/5xx as success).

const DEFAULT_TIMEOUT_MS = 30000;

export async function loadUrl(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startAt = performance.now();
  try {
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return { url, startAt, endAt: performance.now(), error: null };
  } catch (e) {
    const endAt = performance.now();
    const error = e.name === 'AbortError' ? 'Timeout' : 'NetworkError';
    return { url, startAt, endAt, error, errorMessage: e.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function runConcurrent(urls, options = {}) {
  const { maxWorkers = 6, timeoutMs, onProgress } = options;
  const list = Array.from(urls);
  const results = [];
  let next = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= list.length) return;
      const r = await loadUrl(list[i], timeoutMs);
      results.push(r);
      done++;
      if (onProgress) onProgress(done, list.length, r);
    }
  }

  const poolSize = Math.max(1, Math.min(maxWorkers, list.length));
  await Promise.all(Array.from({ length: poolSize }, worker));

  return summarize(results);
}

function duration(r) {
  return r.endAt - r.startAt;
}

function median(sortedMs) {
  if (sortedMs.length === 0) return null;
  const mid = Math.floor(sortedMs.length / 2);
  return sortedMs.length % 2 === 0
    ? (sortedMs[mid - 1] + sortedMs[mid]) / 2
    : sortedMs[mid];
}

function summarize(results) {
  const successful = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  successful.sort((a, b) => duration(a) - duration(b));

  const times = successful.map(duration);
  const med = median(times);
  const medianRange = med === null
    ? []
    : [...successful].sort(
        (a, b) => Math.abs(duration(a) - med) - Math.abs(duration(b) - med),
      );

  return {
    total: results.length,
    successful,
    failed,
    fastest: successful.slice(0, 5),
    slowest: [...successful].reverse().slice(0, 5),
    medianRange: medianRange.slice(0, 5),
    medianMs: med,
  };
}
