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
        return result

    result.end_at = time.monotonic()
    result.result = r

    return result


def connectivity_test_concurrent(urls):
    s = requests.Session()
    all_results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=40) as executor:
        future_to_url = {executor.submit(load_url, s, url): url for url in urls}

        for future in concurrent.futures.as_completed(future_to_url):
            result = future.result()
            if result.result != None:
                print("%s,%s,%f" % (result.url, result.end_at - result.start_at, result.result.elapsed.total_seconds()))
                all_results.append(result)
     
    all_times = list(map(lambda x: x.end_at - x.start_at, all_results))
    pprint.pprint(all_times)

    print("sorted:")

    all_results_sorted = sorted(all_results, key=lambda x: x.end_at - x.start_at)

    for result in all_results_sorted:
            print("%s,%s" % (result.url, result.end_at - result.start_at))




if __name__ == "__main__":
    connectivity_test_concurrent(database.ALL_URLS)
    #connectivity_test_concurrent(database.URLS2)
    #connectivity_test_concurrent(database.URL_TOP100_HTTPS)

