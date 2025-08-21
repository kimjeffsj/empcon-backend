#!/bin/bash
set -e

echo "Starting application..."

# Run database migrations
npx prisma migrate deploy

# Start the application
exec node dist/server.js

backend/scripts/migrate.sh:
#!/bin/bash
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Generating Prisma Client..."
npx prisma generate
