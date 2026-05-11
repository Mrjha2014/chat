FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY server.js ./

EXPOSE 4000

CMD ["npm", "start"]
