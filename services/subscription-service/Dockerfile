FROM node:22-alpine

WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json ./

# Copy service directory
COPY services/subscription-service ./services/subscription-service

# Install dependencies for the workspace
RUN npm ci

EXPOSE 3000

CMD ["npm", "run", "start:subscription"]
