FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm cache clean --force

FROM node:lts-slim
RUN apt-get update -y
RUN apt-get install -y openssl

COPY . .
    
RUN npm install
RUN npm run prisma:deploy
RUN npm run build

CMD [ "npm", "run", "start:prod" ]