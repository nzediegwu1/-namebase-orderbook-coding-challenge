const fs = require('fs');

const toolbox = {
  sell: {
    isBuyOrder: false,
    condition: (order, price) => order.price > price,
    sortFunc: (a, b) => b.price - a.price,
  },
  buy: {
    isBuyOrder: true,
    condition: (order, price) => order.price < price,
    sortFunc: (a, b) => a.price - b.price,
  },
};

const readOrders = (type) =>
  JSON.parse(fs.readFileSync(`./db/${type}Orders.json`));


/**
 * @description Use to write data to file database
 *
 * @param {Array} orders List of orders to write to file
 * @param {String} type The type of order to write to file: buy | sell
 */
const writeOrders = (orders, type) =>
  fs.writeFileSync(`./db/${type}Orders.json`, JSON.stringify(orders));

/**
 * @description Handles posting sell or buy orders
 *
 * @param {Number} quantity The quantity of items in order
 * @param {Number} price The price of a unit of an order
 * @param {String} type The type of order to post: buy | sell
 *
 * @returns {Object} Details of the order created
 */
function postOrder(quantity, price, type) {
  let qty = quantity;
  let [buyOrders, sellOrders] = [readOrders('buy'), readOrders('sell')];
  const target = type === 'sell' ? buyOrders : sellOrders;

  const matchedOrder = target.filter((order) =>
    toolbox[type].condition(order, price)
  );
  let [filled, reduced] = [{}, {}];

  const sortedMatched = matchedOrder.sort(toolbox[type].sortFunc);

  for (const matched of sortedMatched) {
    const newExecuted = matched.executedQuantity + qty;

    if (newExecuted >= matched.quantity) {
      qty = newExecuted - matched.quantity;
      filled[matched.id] = matched;
    } else {
      reduced = {
        id: matched.id,
        executedQuantity: matched.executedQuantity + qty,
      };
      qty = 0;
      break;
    }
  }

  // only update target orderList if there was a matching
  if (Object.keys(filled).length || reduced.id) {
    const updateMatched = target.reduce((result, order) => {
      if (order.id === reduced.id) {
        order.executedQuantity = reduced.executedQuantity;
      }
      if (!filled[order.id] && order.executedQuantity !== order.quantity) {
        result.push(order);
      }
      return result;
    }, []);

    if (type === 'sell') writeOrders(updateMatched, 'buy');
    if (type === 'buy') writeOrders(updateMatched, 'sell');
  }

  const newOrder = {
    id: `${type}-${(+new Date()).toString(36) + Math.random()}`,
    isBuyOrder: toolbox[type].isBuyOrder,
    quantity,
    price,
    executedQuantity: qty < 0 ? quantity : quantity - qty,
  };

  if (qty) {
    if (type === 'sell') {
      sellOrders.push(newOrder);
      writeOrders(sellOrders, 'sell');
    } else {
      buyOrders.push(newOrder);
      writeOrders(buyOrders, 'buy');
    }
  }
  return newOrder;
}

/**
 * @description Returns the latest state of order book
 *
 * @returns {Object} Object which contains buyOrder and sellOrder list
 */
const handleSync = () => {
  const [buyOrders, sellOrders] = [readOrders('buy'), readOrders('sell')];
  return {
    buyOrders,
    sellOrders,
  };
};

/**
 * @description Retrieves the total quantity at a given price
 *
 * @param {Number} price Get the total quantity of orders at this price
 *
 * @returns {Number} Total quantity of orders at the price given
 */
const handleGetQuantity = (price) => {
  const buyOrders = readOrders('buy');
  let orders = buyOrders.filter((order) => order.price === +price);

  if (!orders.length) {
    const sellOrders = readOrders('sell');
    orders = sellOrders.filter((order) => order.price === +price);
  }
  return orders.reduce(
    (sum, order) => sum + order.quantity - order.executedQuantity,
    0
  );
};

/**
 * @description Get an order by given id
 *
 * @param {String} id Unique identifier for retrieving orders
 * 
 * @returns {Object} Retrieved order details or undefined if not found
 */
const getOrderById = (id) => {
  const [type] = id.split('-');
  const model = type === 'sell' ? readOrders('sell') : readOrders('buy');

  return model.find((order) => order.id === id);
};

module.exports = {
  postOrder,
  handleSync,
  handleGetQuantity,
  getOrderById,
};
