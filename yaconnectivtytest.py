#!/usr/bin/env python3
import connectivity
import database
import random
import argparse

def parse_csv_file(file):
    result = set()
    for line in file:
        l = line.rstrip()
        (popularity, domain) = l.split(',')
        result.add("http://%s" % domain)
    return result




def main():
    parser = argparse.ArgumentParser(
        description='Yet Another Connectivity Test - concurrent HTTP latency tester. '
                    'Sends HEAD requests to a list of URLs and reports response times sorted by latency.'
    )

    parser.add_argument('--csvfile', type=open,
                        help='CSV file with "popularity,domain" rows to test (domains are prefixed with http://)')
    parser.add_argument('--embedded', action='store_true',
                        help='run test using the embedded list of ~375 URLs')
    parser.add_argument('--limiturl', type=int,
                        help='randomly sample N URLs from the list instead of testing all')

    args = parser.parse_args()

    urls=set()

    if args.csvfile:
        urls = parse_csv_file(args.csvfile)
    elif args.embedded:
        urls = database.ALL_URLS

    if args.limiturl:
        urls = random.sample(list(urls), args.limiturl)

    connectivity.connectivity_test_concurrent(urls)


if __name__ == "__main__":
    main()
