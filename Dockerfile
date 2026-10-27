FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && chown -R node:node /app
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["node","src/server.js"]
