#!/bin/sh
set -e

# Postgres is already reported healthy by compose's depends_on, but the very
# first `prisma migrate deploy` can still race the socket — retry briefly.
echo "Applying database migrations..."
until npx prisma migrate deploy; do
  echo "Migration failed, retrying in 2s..."
  sleep 2
done

echo "Regenerating Prisma client..."
npx prisma generate

echo "Seeding demo data (safe to run repeatedly)..."
npm run seed || echo "Seed step failed or already applied — continuing."

exec "$@"
