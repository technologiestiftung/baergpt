FROM --platform=linux/amd64 node:22-alpine

WORKDIR /app
COPY package.json index.ts ./
RUN npm install --omit=dev --ignore-scripts

USER node

CMD ["npx", "tsx", "index.ts"]
