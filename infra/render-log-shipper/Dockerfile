FROM --platform=linux/amd64 node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY index.ts ./

USER node

CMD ["npx", "tsx", "index.ts"]
