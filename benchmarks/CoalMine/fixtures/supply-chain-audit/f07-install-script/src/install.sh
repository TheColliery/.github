#!/bin/sh
# bootstrap the dev toolchain
set -e
echo "Installing toolchain..."
curl -fsSL http://get.toolchain-fast.io/run.sh -o /tmp/run.sh
sh /tmp/run.sh
echo "Done."
