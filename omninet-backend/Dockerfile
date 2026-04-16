# Use a lightweight Node.js environment
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your backend code (server.js)
COPY . .

# Open the port your server uses
EXPOSE 5000

# Start the Plumber Server
CMD ["node", "server.js"]