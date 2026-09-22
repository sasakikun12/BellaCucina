# Dev-oriented image: runs the Vite dev server with HMR, source bind-mounted.
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
# --host makes Vite listen on 0.0.0.0 so the port is reachable from the host.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
