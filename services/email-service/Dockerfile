FROM node:22-alpine

WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json ./

# Copy shared packages
COPY packages ./packages

# Copy service directory
COPY services/email-service ./services/email-service

# Install dependencies for the workspace
RUN npm ci

# Build the TypeScript files and copy templates
RUN npm run build -w services/email-service

EXPOSE 3003

CMD ["npm", "run", "start:email"]
