import { runConcurrent } from './connectivity.js';
import * as db from './database.js';

const runBtn = document.getElementById('run');
const output = document.getElementById('output');
const progress = document.getElementById('progress');
const corpusSel = document.getElementById('corpus');
const limitInp = document.getElementById('limit');
const parallelInp = document.getElementById('parallel');

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

function render(summary, elapsed) {
  const out = [];
  out.push(`Page scheme: ${location.protocol}//${location.host}`);
  if (location.protocol === 'https:') {
    out.push(
      'WARNING: page is loaded over https: — mixed-content rules will block every http:// URL.',
    );
    out.push('Re-open as http://' + location.host + '/ (and disable Firefox HTTPS-Only Mode for this site).');
  }
  out.push('');
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
  const limit = parseInt(limitInp.value, 10);
  if (!Number.isNaN(limit) && limit > 0) {
    urls = sample(urls, limit);
  }
  const parallel = parseInt(parallelInp.value, 10) || 6;

  runBtn.disabled = true;
  progress.hidden = false;
  progress.value = 0;
  progress.max = urls.length;
  output.textContent = `Testing ${urls.length} URLs with ${parallel} parallel workers...\n`;

  const t0 = performance.now();
  try {
    const summary = await runConcurrent(urls, {
      maxWorkers: parallel,
      onProgress: (doneCount) => {
        progress.value = doneCount;
      },
    });
    const elapsed = (performance.now() - t0) / 1000;
    output.textContent = render(summary, elapsed);
  } catch (e) {
    output.textContent = `Error: ${e.message}\n${e.stack || ''}`;
  } finally {
    runBtn.disabled = false;
  }
});
