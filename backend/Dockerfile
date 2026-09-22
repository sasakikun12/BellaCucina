# Dev-oriented image: runs `node --watch` with the source bind-mounted from the host.
FROM node:20-slim

# Prisma needs openssl at runtime for its query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so this layer is cached until package.json changes.
COPY package.json package-lock.json ./
RUN npm ci

# Prisma client is generated into node_modules at build time; the entrypoint
# regenerates it on boot too, in case schema.prisma changed since the build.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Strip any CRLF (in case the file was checked out on Windows) and make executable.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
