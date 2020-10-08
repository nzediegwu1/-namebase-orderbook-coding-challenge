const {
  handleGetQuantity,
  handleSync,
  postOrder,
  getOrderById,
} = require('./util');

class Exchange {
  static sync() {
    return handleSync();
  }

  static buy(quantity, price) {
    return postOrder(quantity, price, 'buy');
  }

  static sell(quantity, price) {
    return postOrder(quantity, price, 'sell');
  }

  static getQuantityAtPrice(price) {
    return handleGetQuantity(price);
  }

  static getOrder(id) {
    return getOrderById(id);
  }
}

module.exports = Exchange;
