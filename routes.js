const express = require('express');
const exchange = require('./lib');

const app = express.Router();

app.get('/', (_, res) =>
  res.status(200).send('Welcome to Orderbook Coding Challenge api')
);

app.get('/sync', (req, res) => {
  const message = 'Successfully fetched order book';
  return res.status(200).json({ message, data: exchange.sync() });
});

app.post('/buy', (req, res) => {
  const { quantity, price } = req.body;

  const message = 'Successfully placed your order';
  return res.status(200).json({ message, data: exchange.buy(quantity, price) });
});

app.post('/sell', (req, res) => {
  const { quantity, price } = req.body;

  const message = 'Successfully placed your order';
  return res
    .status(200)
    .json({ message, data: exchange.sell(quantity, price) });
});

app.get('/quantity', (req, res) => {
  const { price } = req.query;

  const message = 'Retrieved total quantity at given price';
  return res
    .status(200)
    .json({ message, data: exchange.getQuantityAtPrice(price) });
});

app.get('/order/:id', (req, res) => {
  const { id } = req.params;

  const data = exchange.getOrder(id);
  if (!data) {
    return res.status(404).json({ message: 'Order not found' });
  }
  const message = 'Successfully fetched order details';
  return res.status(200).json({ message, data });
});

module.exports = app;
