FROM public.ecr.aws/lambda/nodejs:20
RUN npm install -g npm@latest

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/

CMD ["src/handler.handler"]
