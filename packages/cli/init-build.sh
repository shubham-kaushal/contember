#!/usr/bin/env sh
set -e

npx lerna bootstrap \
  --ignore @contember/benchmark \
  --ignore @contember/engine-api-tester \
  --ignore @contember/engine-server \
  --ignore @contember/engine-s3-plugin \
  --ignore @contember/engine-content-api \
  --ignore @contember/engine-system-api \
  --ignore @contember/engine-tenant-api \
  --ignore @contember/database-tester \
  --ignore @contember/template-* \
  --ci -- --no-optional --production


rm -rf packages/*/node_modules/.bin
rm -rf packages/*/dist/**/tsconfig.tsbuildinfo
find packages/*/dist -type f -name '*.map' -exec rm -r {} +

SYMLINKS=$(find ./packages/cli/node_modules/@contember -maxdepth 1 -type l)

for SYMLINK in $SYMLINKS; do
	REALPATH=$(readlink -f $SYMLINK)
	rm $SYMLINK
	rm -rf $REALPATH/node_modules/@contember
	if [ -e $REALPATH/node_modules ]; then
	  cp -Rn $REALPATH/node_modules ./packages/cli/
	fi
	rm -rf $REALPATH/node_modules
	cp -R $REALPATH $SYMLINK
done
