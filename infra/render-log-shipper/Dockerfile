FROM --platform=linux/amd64 node:22-alpine

WORKDIR /app
COPY package.json index.js ./

USER node

CMD ["node", "index.js"]
