FROM node:16-buster-slim

WORKDIR /app

# Install node packages
COPY package.json .
RUN npm install -y

# Copy over config files
COPY webpack.config.js .
COPY tsconfig.json .

# Mount source code and web resources
VOLUME /app/src
VOLUME /app/docs

EXPOSE 8080

ENTRYPOINT ["npm", "run"]
CMD ["start"]
