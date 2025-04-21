#!/bin/env bash
TSKMPC="$(dirname -- "$( readlink -f -- "$0"; )";)"

pushd "$TSKMPC/../" >> /dev/null

if [ -x "$(command -v bun)" ]; then
	bun run "src/index.ts" $@
	exit
fi

echo "TSKMPC requires bun to be installed."
exit 1
