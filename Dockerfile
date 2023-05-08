FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
COPY . .
RUN yarn run build

FROM node:18
WORKDIR /app
COPY package* ./
COPY --from=builder ./app/build/src ./build/src
EXPOSE 8080
CMD ["yarn", "start"]