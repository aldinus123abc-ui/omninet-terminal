# Step 1: Build the React app
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Step 2: Serve the app using Nginx
FROM nginx:stable-alpine
# Copy the built files from the previous step to the Nginx folder
COPY --from=build /app/dist /usr/share/nginx/html

# Open the standard web port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]