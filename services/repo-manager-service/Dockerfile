FROM node:22-alpine

WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json ./

# Copy service directory
COPY services/notification-service ./services/notification-service

# Install dependencies for the workspace
RUN npm ci

# Build the TypeScript files
RUN npm run build -w services/notification-service

EXPOSE 3002

CMD ["npm", "run", "start:notification"]
