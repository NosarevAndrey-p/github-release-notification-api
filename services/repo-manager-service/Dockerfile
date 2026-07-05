FROM node:22-alpine

WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json ./

# Copy shared packages
COPY packages ./packages

# Copy service directory
COPY services/repo-manager-service ./services/repo-manager-service

# Install dependencies for the workspace
RUN npm ci

# Build the TypeScript files
RUN npm run build -w services/repo-manager-service

EXPOSE 3002

CMD ["npm", "run", "start:repo-manager"]
