# Stage 1: Build application
FROM node:18.6-alpine as builder

# Create a directory to hold your service and relevant modules with owner being node and define the working directory of your Docker container.
RUN mkdir -p /app/node_modules && chown -R node:node /app
WORKDIR /app

# Let us copy our package file into the working directory to make it the root directory from which we will install our dependency packages.
COPY package*.json ./

# Next we ensure that the package installer should never drop into user and group switching when installing our apps.
RUN npm config set unsafe-perm true

# Since we are all good let us, install our dependencies
RUN npm install -g npm
RUN npm install -g typescript
RUN npm install -g ts-node
RUN chown node:node -R /app
USER node
RUN npm install

# Copy our project into our working container and initiate build
COPY --chown=node:node . .

# Prepare runtime image
FROM node:18.6-alpine

RUN mkdir -p /app/node_modules && chown -R node:node /app
WORKDIR /app
COPY package*.json ./
RUN chown -R node:node /app

USER node
COPY --from=builder /app .
EXPOSE 8080
EXPOSE 8443

ENV IP=
ENV PORT=8080
ENV HTTPS_PORT=8443
ENV REDIS_URL=
ENV SOCKET_TIMEOUT=
ENV SSL_KEY=
ENV SSL_CERT=

CMD [ "npx", "ts-node", "proxy.ts" ]
