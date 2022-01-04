#!/usr/bin/env python3
import connectivity
import random
import argparse

def parse_csv_file(file):
    result = set()
    for line in file:
        l = line.rstrip()
        (popularity, domain) = l.split(',')
        result.add("http://%s" % domain)
    return result




parser = argparse.ArgumentParser(description='Process some integers.')

parser.add_argument('--csvfile', type=open)
parser.add_argument('--limiturl', type=int)


args = parser.parse_args()

urls=set()

if args.csvfile:
    urls = parse_csv_file(args.csvfile)

if args.limiturl:
    urls = random.sample(urls, args.limiturl)



connectivity.connectivity_test_concurrent(urls)
