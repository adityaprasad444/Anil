FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Bundle app source
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Define environment variables (defaults, can be overridden)
ENV NODE_ENV=production
ENV PORT=3001

# Command to run the application
CMD [ "node", "tracker-app.js" ]
