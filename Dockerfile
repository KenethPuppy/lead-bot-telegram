# Use the official Node.js image as the base image
FROM node:20.11

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if available) to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Build TypeScript code
RUN npm run build

EXPOSE 3459

# Command to run the application
CMD ["npm", "start"]
