FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm run install:all

COPY backend ./backend
COPY frontend ./frontend

RUN npm run build:frontend
RUN npm run init:db

EXPOSE 3001

CMD ["npm", "run", "start"]
