#!/usr/bin/env python3
import database
import requests
import time
import statistics
import concurrent.futures

import pprint 

class MeasureResult:
    pass


def connectivity_test(urls):
    s = requests.Session()
    for k in urls:
        print("requesting %s" % k)
        r = s.get(k)
        print(k)


def load_url(session, url):
    result = MeasureResult()
    result.start_at = time.monotonic()
    result.url = url
    try:
        r = session.head(url, timeout=30, allow_redirects=False)
    except requests.exceptions.ConnectionError:
        result.end_at = time.monotonic()
        result.result = None
        result.error = "ConnectionError"
        return result
    except requests.exceptions.ReadTimeout:
        result.end_at = time.monotonic()
        result.result = None
        result.error = "ReadTimeout"
        return result
    except requests.exceptions.Timeout:
        result.end_at = time.monotonic()
        result.result = None
        result.error = "Timeout"
        return result

    result.end_at = time.monotonic()
    result.result = r
    result.error = None

    return result


def print_top(label, results, count=5):
    print("\n%s:" % label)
    for i, r in enumerate(results[:count], 1):
        print("  %d.  %.3fs  %s" % (i, r.end_at - r.start_at, r.url))


def connectivity_test_concurrent(urls, max_workers=6):
    s = requests.Session()
    successful = []
    failed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {executor.submit(load_url, s, url): url for url in urls}

        for future in concurrent.futures.as_completed(future_to_url):
            result = future.result()
            if result.error is None:
                successful.append(result)
            else:
                failed.append(result)

    total = len(successful) + len(failed)
    print("\n=== Summary ===")
    print("Tested: %d URLs | Successful: %d | Failed: %d" % (total, len(successful), len(failed)))

    if successful:
        sorted_results = sorted(successful, key=lambda x: x.end_at - x.start_at)

        print_top("Top 5 fastest", sorted_results)
        print_top("Top 5 slowest", list(reversed(sorted_results)))

        median_time = statistics.median([r.end_at - r.start_at for r in sorted_results])
        median_sorted = sorted(sorted_results, key=lambda x: abs((x.end_at - x.start_at) - median_time))
        print_top("Top 5 average (median range)", median_sorted)

    if failed:
        print("\nFailed (%d):" % len(failed))
        for r in sorted(failed, key=lambda x: x.url):
            print("  %-40s %s" % (r.url, r.error))




if __name__ == "__main__":
    connectivity_test_concurrent(database.ALL_URLS)
    #connectivity_test_concurrent(database.URLS2)
    #connectivity_test_concurrent(database.URL_TOP100_HTTPS)

