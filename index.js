const express = require('express');
const volleyball = require('volleyball');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const routes = require('./routes');

dotenv.config();
const { PORT } = process.env;

// Defining the Port Variable
const port = PORT || 8000;

// Set up the express app
const app = express();
app.use(cors());

// Log requests to the console.
app.use(volleyball);

// parse request body content
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/', routes);

// Setup a default catch-all route that sends back a welcome message in JSON format.
app.get('*', (req, res) => res.status(404).json({ message: 'Page not found' }));


app.listen(port, () => {
  console.log(`Server is running at port ${port}`);
});
