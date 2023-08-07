
# Expense Splitter App

The Expense Splitter App is a simple CRUD service built using Node.js, Express, and MongoDB. It allows users to manage expenses, split bills among friends, and track balances between users.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [License](#license)

## Features

- Create and manage user profiles.
- Add expenses and split bills among friends.
- Record repayments to adjust balances between friends.
- Fetch balance information for each user.

## Installation

1. Clone this repository to your local machine.
2. Navigate to the project directory:

   ```bash
   cd Expense-Splitter-App
   ```bash
   npm install
   npm start

The server will be running at http://localhost:3000

## Usage

- Use API endpoints to create users, add expenses, record repayments, and check balances.
- Test the endpoints using tools like Postman or your preferred API client.
- Refer to the API documentation or Swagger documentation for detailed endpoint information.

## API Endpoints

- **POST /users**: Create a new user.
- **GET /users**: Fetch all users.
- **POST /expenses**: Create a new expense and split it among friends.
- **POST /repayments**: Record a repayment between friends.
- **GET /balances/:userId**: Fetch balance information for a specific user.
- Refer to the API documentation or Swagger documentation for detailed request and response formats.

## Technologies Used

- Node.js
- Express
- MongoDB (with Mongoose)
- Caching (JavaScript Map)

