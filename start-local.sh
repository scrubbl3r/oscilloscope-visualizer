#!/bin/sh
set -eu

cd "$(dirname "$0")"
exec python3 -m http.server 8128 --bind 127.0.0.1
