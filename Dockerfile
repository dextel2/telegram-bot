FROM node:18-slim

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY .env ./
COPY src ./src
COPY utils ./utils
COPY index.ts ./

RUN npm install

RUN npm run build

CMD ["node", "dist/index.js"]