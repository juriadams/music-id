FROM node:alpine

WORKDIR /app

COPY package*.json ./

RUN yarn install

COPY . .

ENV PORT=3000

EXPOSE 3000

CMD [ "yarn", "start" ]