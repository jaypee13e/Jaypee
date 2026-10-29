FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /data && chown node:node /data
COPY server ./server
COPY --from=build /app/dist ./dist
USER node
VOLUME /data
EXPOSE 3001
CMD ["node", "server/index.js"]
