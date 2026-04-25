import { runConcurrent } from './connectivity.js';
import * as db from './database.js';

const runBtn = document.getElementById('run');
const output = document.getElementById('output');
const progress = document.getElementById('progress');
const corpusSel = document.getElementById('corpus');
const limitInp = document.getElementById('limit');
const parallelInp = document.getElementById('parallel');
const skipExcludedInp = document.getElementById('skipExcluded');
const sendBtn = document.getElementById('sendReport');
const sendStatus = document.getElementById('sendStatus');
const mqttBrokerInp = document.getElementById('mqttBroker');
const mqttTopicInp = document.getElementById('mqttTopic');
const reportNotesInp = document.getElementById('reportNotes');

let lastReport = null;

const STORAGE_PREFIX = 'yaconn-mqtt-';
for (const [el, key] of [[mqttBrokerInp, 'broker'], [mqttTopicInp, 'topic']]) {
  const saved = localStorage.getItem(STORAGE_PREFIX + key);
  if (saved) el.value = saved;
  el.addEventListener('change', () => localStorage.setItem(STORAGE_PREFIX + key, el.value));
}

function sample(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function fmtSecs(r) {
  return ((r.endAt - r.startAt) / 1000).toFixed(3) + 's';
}

function renderTop(label, rows) {
  const lines = [`\n${label}:`];
  rows.forEach((r, i) => {
    lines.push(`  ${i + 1}. ${fmtSecs(r).padStart(7)}  ${r.url}`);
  });
  return lines.join('\n');
}

function render(summary, elapsed, params) {
  const out = [];
  out.push('=== yaconnectivitytest (web) ===');
  out.push(`Run at:            ${new Date().toISOString()}`);
  out.push(`Page:              ${location.protocol}//${location.host}${location.pathname}`);
  out.push(`User agent:        ${navigator.userAgent}`);
  out.push('');
  out.push('Parameters:');
  out.push(`  Corpus:          ${params.corpus} (${params.corpusSize} URLs)`);
  out.push(`  Limit:           ${params.limit ? params.limit + ' (random sample)' : 'none (all after filtering)'}`);
  out.push(`  Parallel:        ${params.parallel} workers`);
  out.push(
    `  Skip excluded:   ${params.skipExcluded ? `yes (${params.skippedCount} URLs from BROWSER_EXCLUDED removed)` : 'no'}`,
  );
  out.push('');
  if (location.protocol === 'https:') {
    out.push(
      'WARNING: page is loaded over https: — mixed-content rules will block every http:// URL.',
    );
    out.push('Re-open as http://' + location.host + '/ (and disable Firefox HTTPS-Only Mode for this site).');
    out.push('');
  }
  out.push(`=== Summary (elapsed: ${elapsed.toFixed(2)}s) ===`);
  out.push(
    `Tested: ${summary.total} | Successful: ${summary.successful.length} | Failed: ${summary.failed.length}`,
  );
  if (summary.successful.length) {
    out.push(renderTop('Top 5 fastest', summary.fastest));
    out.push(renderTop('Top 5 slowest', summary.slowest));
    out.push(renderTop('Top 5 average (median range)', summary.medianRange));
  }
  if (summary.failed.length) {
    const byReason = {};
    for (const r of summary.failed) {
      const key = r.errorMessage || r.error;
      (byReason[key] = byReason[key] || []).push(r);
    }
    out.push(`\nFailed (${summary.failed.length}) — grouped by error:`);
    for (const [reason, rows] of Object.entries(byReason)) {
      out.push(`  [${rows.length}] ${reason}`);
    }
    out.push('');
    const sorted = summary.failed.slice().sort((a, b) => a.url.localeCompare(b.url));
    for (const r of sorted) {
      const msg = r.errorMessage ? `${r.error}: ${r.errorMessage}` : r.error;
      out.push(`  ${r.url.padEnd(48)} ${msg}`);
    }
  }
  return out.join('\n');
}

runBtn.addEventListener('click', async () => {
  const corpus = corpusSel.value;
  const urlsSource = db[corpus];
  if (!urlsSource) {
    output.textContent = `Unknown corpus: ${corpus}`;
    return;
  }

  let urls = Array.from(urlsSource);
  const corpusSize = urls.length;
  let skippedCount = 0;
  const skipExcluded = skipExcludedInp.checked && !!db.BROWSER_EXCLUDED;
  if (skipExcluded) {
    const excluded = new Set(db.BROWSER_EXCLUDED);
    const before = urls.length;
    urls = urls.filter(u => !excluded.has(u));
    skippedCount = before - urls.length;
  }
  const limitRaw = parseInt(limitInp.value, 10);
  const limit = (!Number.isNaN(limitRaw) && limitRaw > 0) ? limitRaw : null;
  if (limit) {
    urls = sample(urls, limit);
  }
  const parallel = parseInt(parallelInp.value, 10) || 6;
  const params = { corpus, corpusSize, limit, parallel, skipExcluded, skippedCount };

  runBtn.disabled = true;
  progress.hidden = false;
  progress.value = 0;
  progress.max = urls.length;
  const skipNote = skippedCount ? ` (skipped ${skippedCount} browser-excluded URLs)` : '';
  output.textContent = `Testing ${urls.length} URLs with ${parallel} parallel workers${skipNote}...\n`;

  const t0 = performance.now();
  try {
    const summary = await runConcurrent(urls, {
      maxWorkers: parallel,
      onProgress: (doneCount) => {
        progress.value = doneCount;
      },
    });
    const elapsed = (performance.now() - t0) / 1000;
    const text = render(summary, elapsed, params);
    output.textContent = text;
    lastReport = { text, summary, elapsed, params };
    sendBtn.disabled = false;
    sendStatus.textContent = '';
  } catch (e) {
    output.textContent = `Error: ${e.message}\n${e.stack || ''}`;
  } finally {
    runBtn.disabled = false;
  }
});

sendBtn.addEventListener('click', async () => {
  if (!lastReport) return;
  if (typeof mqtt === 'undefined') {
    sendStatus.textContent = 'mqtt.js failed to load (CDN blocked?)';
    return;
  }
  const broker = mqttBrokerInp.value.trim();
  const topic = mqttTopicInp.value.trim();
  const notes = reportNotesInp.value.trim();
  if (!broker || !topic) {
    sendStatus.textContent = 'Broker and topic are required.';
    return;
  }

  const payload = notes
    ? `Notes: ${notes}\n\n${lastReport.text}`
    : lastReport.text;

  sendBtn.disabled = true;
  sendStatus.textContent = `Connecting to ${broker}...`;

  const client = mqtt.connect(broker, {
    connectTimeout: 10000,
    reconnectPeriod: 0,
    clientId: 'yaconn-' + Math.random().toString(16).slice(2, 10),
  });

  let done = false;
  const finish = (msg, ok) => {
    if (done) return;
    done = true;
    sendStatus.textContent = msg;
    sendBtn.disabled = false;
    try { client.end(true); } catch {}
  };

  client.on('connect', () => {
    sendStatus.textContent = `Publishing to ${topic}...`;
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) finish('Publish failed: ' + err.message, false);
      else finish(`Sent (${payload.length} bytes) to ${topic} on ${broker}`, true);
    });
  });
  client.on('error', (e) => finish('Connection error: ' + e.message, false));
  setTimeout(() => finish('Timed out after 15s', false), 15000);
});
