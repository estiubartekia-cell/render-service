FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY scripts/ ./scripts/
COPY templates/ ./templates/

EXPOSE 3000

CMD ["node", "scripts/server.js"]