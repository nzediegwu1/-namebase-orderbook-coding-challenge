const fs = require('fs');
const path = require('path');
const Exchange = require('../lib/index');

const writeOrders = (orders, type) =>
  fs.writeFileSync(
    path.join(__dirname, `../db/${type}Orders.json`),
    JSON.stringify(orders)
  );

const resetDB = () => {
  writeOrders([], 'buy');
  writeOrders([], 'sell');
};

beforeAll(resetDB);
afterAll(resetDB);

describe('Test that sync function works', () => {
  test('It should return an object containing buyOrders and sellOrders', () => {
    expect(Exchange.sync()).toHaveProperty('buyOrders');
    expect(Exchange.sync()).toHaveProperty('sellOrders');
  });
  test('It should return buyOrders and sellOrders arrays', () => {
    expect(Exchange.sync().buyOrders).toBeInstanceOf(Array);
    expect(Exchange.sync().sellOrders).toBeInstanceOf(Array);
  });
  test('It should return buyOrders containing created order details', () => {
    Exchange.buy(10, 50);
    const [newOrder] = Exchange.sync().buyOrders;

    expect(newOrder).toHaveProperty('id');
    expect(newOrder.id.startsWith('buy')).toEqual(true);
    expect(newOrder).toHaveProperty('price', 50);
    expect(newOrder).toHaveProperty('quantity', 10);
    expect(newOrder).toHaveProperty('isBuyOrder', true);
    expect(newOrder).toHaveProperty('executedQuantity', 0);
  });
  test('It should return sellOrders containing created order details', () => {
    Exchange.sell(15, 60);
    const [newOrder] = Exchange.sync().sellOrders;
    expect(newOrder).toHaveProperty('id');
    expect(newOrder.id.startsWith('sell')).toEqual(true);
    expect(newOrder).toHaveProperty('price', 60);
    expect(newOrder).toHaveProperty('quantity', 15);
    expect(newOrder).toHaveProperty('isBuyOrder', false);
    expect(newOrder).toHaveProperty('executedQuantity', 0);
  });
});

describe('Test that buy function works', () => {
  test('It should add new order to buyOrders list if no matching occurs', () => {
    const order = Exchange.buy(12, 52);
    const buyOrders = Exchange.sync().buyOrders;

    expect(buyOrders).toBeInstanceOf(Array);
    expect(buyOrders).toHaveLength(2);
    const newOrder = buyOrders[1];

    expect(newOrder).toHaveProperty('id');
    expect(newOrder.id.startsWith('buy')).toEqual(true);
    expect(newOrder).toHaveProperty('price', 52);
    expect(newOrder).toHaveProperty('quantity', 12);
    expect(newOrder).toHaveProperty('isBuyOrder', true);
    expect(newOrder).toHaveProperty('executedQuantity', 0);

    expect(order).toHaveProperty('id');
    expect(order.id).toEqual(newOrder.id);
    expect(order.price).toEqual(newOrder.price);
    expect(order.quantity).toEqual(newOrder.quantity);
    expect(order.isBuyOrder).toBe(true);
    expect(order.executedQuantity).toEqual(newOrder.executedQuantity);
  });
  test('It should completely match sellOrder with buyOrder', () => {
    const {
      sellOrders: oldSellOrders,
      buyOrders: oldBuyOrders,
    } = Exchange.sync();

    // second order with higher price: 52 will be matched
    const buyOrderToBeMatched = oldBuyOrders[1];

    const order = Exchange.sell(5, 49);

    expect(order.price).toEqual(49);
    expect(order.quantity).toEqual(5);
    expect(order.isBuyOrder).toEqual(false);
    expect(order.executedQuantity).toEqual(5);
    expect(order.quantity - order.executedQuantity).toEqual(0);

    const { buyOrders, sellOrders } = Exchange.sync();
    const [unmatchedOrder, matchedBuyOrder] = buyOrders;

    expect(sellOrders.length).toEqual(oldSellOrders.length);

    expect(buyOrderToBeMatched.price).toEqual(52);
    expect(buyOrderToBeMatched.executedQuantity).toEqual(0);
    expect(buyOrderToBeMatched.quantity).toEqual(12);

    // test that matched buy order has 5 executed quantity
    expect(matchedBuyOrder.price).toEqual(52);
    expect(matchedBuyOrder.executedQuantity).toEqual(5);

    //test the remaining quantity of matched buy order is accurate
    expect(matchedBuyOrder.quantity - matchedBuyOrder.executedQuantity).toBe(7);

    // buy order with lower price has no executedQuantity
    expect(unmatchedOrder.price).toEqual(50);
    expect(unmatchedOrder.executedQuantity).toEqual(0);
  });

  test('It should remove a completed buyOrder and execute next order', () => {
    const {
      sellOrders: oldSellOrders,
      buyOrders: oldBuyOrders,
    } = Exchange.sync();

    // second order with higher price: 52 which has 7 left will be filled and removed
    // order with quantity will then have 3 executedQuantity and 6 left
    expect(oldBuyOrders.length).toEqual(2);

    const order = Exchange.sell(11, 45);

    expect(order.price).toEqual(45);
    expect(order.quantity).toEqual(11);
    expect(order.isBuyOrder).toEqual(false);
    expect(order.executedQuantity).toEqual(11);
    expect(order.quantity - order.executedQuantity).toEqual(0);

    const { buyOrders, sellOrders } = Exchange.sync();
    expect(buyOrders.length).toEqual(1); // instead of 2

    const [reducedBuyOrder] = buyOrders;

    // sell order length is unchanged since its completely matched
    expect(sellOrders.length).toEqual(oldSellOrders.length);

    // test that matched buy order has 5 executed quantity
    expect(reducedBuyOrder.price).toEqual(50);
    expect(reducedBuyOrder.executedQuantity).toEqual(4);

    //test the remaining quantity of matched buy order is accurate
    expect(reducedBuyOrder.quantity - reducedBuyOrder.executedQuantity).toBe(6);
  });
  test('It should execute older order before new one at same price', () => {
    const {
      sellOrders: oldSellOrders,
      buyOrders: oldBuyOrders,
    } = Exchange.sync();

    expect(oldBuyOrders.length).toEqual(1);

    const [firstBuy] = oldBuyOrders;
    expect(firstBuy.price).toEqual(50);
    expect(firstBuy.quantity).toEqual(10);
    expect(firstBuy.executedQuantity).toEqual(4);

    const firstOrderId = firstBuy.id;

    // post new buy orders with same price of 50
    const secondBuy = Exchange.buy(8, 50);
    const thirdBuy = Exchange.buy(7, 50);

    const { buyOrders: updatedBuyOrders } = Exchange.sync();

    expect(updatedBuyOrders).toHaveLength(3); // instead of initial 1

    const sellOrder = Exchange.sell(10, 45);

    expect(sellOrder.executedQuantity).toEqual(10);
    expect(sellOrder.quantity - sellOrder.executedQuantity).toEqual(0);

    const { buyOrders, sellOrders } = Exchange.sync();
    // sell order length is unchanged since its completely matched
    expect(sellOrders.length).toEqual(oldSellOrders.length);

    expect(buyOrders.length).toEqual(2); // after completing the first

    const noFirstOrderId = buyOrders.some((order) => order.id !== firstOrderId);
    expect(noFirstOrderId).toBe(true); // first order id has been removed

    const [reducedBuyOrder, thirdBuyOrder] = buyOrders; // the second buy

    // test that matched buy order has 5 executed quantity
    expect(reducedBuyOrder.id).toEqual(secondBuy.id);
    expect(reducedBuyOrder.executedQuantity).toEqual(4);
    //test the remaining quantity of matched buy order is accurate: 8 - 4
    expect(reducedBuyOrder.quantity - reducedBuyOrder.executedQuantity).toBe(4);

    expect(thirdBuyOrder.id).toEqual(thirdBuy.id);
    // third buy order was not excuted
    expect(thirdBuyOrder.executedQuantity).toEqual(0);
  });
  test('It should match all buyorders & create new sellorder with remaining quantity', () => {
    const {
      sellOrders: oldSellOrders,
      buyOrders: oldBuyOrders,
    } = Exchange.sync();

    expect(oldBuyOrders.length).toEqual(2);
    const oldSellOrderSize = oldSellOrders.length;

    // mega sell order will match all buy orders and add the remaininig as a new sell order
    // new sell order created will have executedQuantity of 11
    const order = Exchange.sell(20, 45);

    expect(order.price).toEqual(45);
    expect(order.quantity).toEqual(20);
    expect(order.isBuyOrder).toEqual(false);
    expect(order.executedQuantity).toEqual(11);
    expect(order.quantity - order.executedQuantity).toEqual(9);

    const { buyOrders, sellOrders } = Exchange.sync();
    expect(buyOrders.length).toEqual(0); // no buyOrders left
    expect(sellOrders.length - oldSellOrderSize).toEqual(1); // size incremented

    const executedSell = sellOrders[1];

    // test that remaining sell order has 11 executed quantity
    expect(executedSell.price).toEqual(45);
    expect(executedSell.quantity).toEqual(20);
    expect(executedSell.executedQuantity).toEqual(11);
  });

  test('It should match the sell order with lowest price', () => {
    const {
      sellOrders: oldSellOrders,
      buyOrders: oldBuyOrders,
    } = Exchange.sync();

    const [higherPriced, lowerPriced] = oldSellOrders;

    expect(higherPriced.price).toEqual(60);
    expect(higherPriced.quantity).toEqual(15);
    expect(higherPriced.executedQuantity).toEqual(0);

    expect(lowerPriced.price).toEqual(45);
    expect(lowerPriced.quantity).toEqual(20);
    expect(lowerPriced.executedQuantity).toEqual(11);

    expect(oldBuyOrders.length).toEqual(0);
    const order = Exchange.buy(5, 61);

    expect(order.isBuyOrder).toEqual(true);
    expect(order.executedQuantity).toEqual(5);
    expect(order.quantity - order.executedQuantity).toEqual(0);

    const { buyOrders, sellOrders } = Exchange.sync();
    expect(buyOrders.length).toEqual(0); // no buyOrders created

    const [newHigherPriced, newLowerPriced] = sellOrders;

    expect(newHigherPriced.executedQuantity).toEqual(0); // none executed
    expect(newLowerPriced.executedQuantity).toEqual(
      lowerPriced.executedQuantity + 5 // five more executed =16
    );
  });
  test('It should complete lowest sellorders and match some of higher sell order', () => {
    const { sellOrders: oldSellOrders } = Exchange.sync();

    expect(oldSellOrders.length).toEqual(2);

    const [higherPriced, lowerPriced] = oldSellOrders;

    expect(higherPriced.price).toEqual(60);
    expect(higherPriced.quantity).toEqual(15);
    expect(higherPriced.executedQuantity).toEqual(0);

    expect(lowerPriced.price).toEqual(45);
    expect(lowerPriced.quantity).toEqual(20);
    expect(lowerPriced.executedQuantity).toEqual(16);

    // big buy order will match all of smaller sell orders and fill some of the higher sell order
    const order = Exchange.buy(8, 61);

    expect(order.price).toEqual(61);
    expect(order.quantity).toEqual(8);
    expect(order.isBuyOrder).toEqual(true);
    expect(order.executedQuantity).toEqual(8);

    const { buyOrders, sellOrders } = Exchange.sync();
    expect(buyOrders.length).toEqual(0); // no buyOrders created due to full matching
    expect(sellOrders.length).toEqual(1); // size decremented after matching

    const [remainingSell] = sellOrders;

    // test that remaining higher sell order has 5 executed
    expect(remainingSell.price).toEqual(60);
    expect(remainingSell.quantity).toEqual(15);
    expect(remainingSell.executedQuantity).toEqual(4); // 11 sell left
  });

  test('It should match all sellorders & create new buyorder with remaining quantity', () => {
    const {
      sellOrders: oldSellOrders,
      buyOrders: oldBuyOrders,
    } = Exchange.sync();

    expect(oldSellOrders.length).toEqual(1);
    expect(oldBuyOrders.length).toEqual(0);

    // big buy order will fully match existing sell order and add new buy order
    // new buy order created will have executedQuantity of 11
    const order = Exchange.buy(16, 61);

    expect(order.price).toEqual(61);
    expect(order.quantity).toEqual(16);
    expect(order.isBuyOrder).toEqual(true);
    expect(order.executedQuantity).toEqual(11);
    expect(order.quantity - order.executedQuantity).toEqual(5);

    const { buyOrders, sellOrders } = Exchange.sync();
    expect(sellOrders.length).toEqual(0); // no sellOrders left
    expect(buyOrders.length).toEqual(1); // added new buy order

    const [executedBuy] = buyOrders;

    // test that remaining sell order has 11 executed quantity
    expect(executedBuy.price).toEqual(61);
    expect(executedBuy.quantity).toEqual(16);
    expect(executedBuy.executedQuantity).toEqual(11);
  });
});

describe('Test functionality to get quantity at given price works', () => {
  test('It should get correct total quantity at a given price if in buyOrders', () => {
    [
      [10, 61],
      [10, 25],
      [15, 61],
      [1, 61],
      [20, 45],
    ].forEach(([qty, price]) => {
      Exchange.buy(qty, price);
    });
    // should give 26 plus left over 5 from previous test = 31
    expect(Exchange.getQuantityAtPrice(61)).toEqual(26 + 5); // 31
  });
  test('It should get correct total quantity at a given price if in sellOrders', () => {
    [
      [20, 100],
      [10, 65],
      [10, 80],
      [15, 65],
      [1, 70],
      [20, 65],
    ].forEach(([qty, price]) => {
      Exchange.sell(qty, price);
    });
    expect(Exchange.getQuantityAtPrice(65)).toEqual(45);
  });
  test('It should get correct total quantity at a given price after matching', () => {
    expect(Exchange.getQuantityAtPrice(61)).toEqual(31);
    Exchange.sell(11, 60);
    expect(Exchange.getQuantityAtPrice(61)).toEqual(20);
  });
});

describe('Test functionality to get order by id', () => {
  test('It should get correct buyOrder by id', () => {
    const newBuy = Exchange.buy(10, 50);
    const retrieved = Exchange.getOrder(newBuy.id);

    expect(newBuy.id).toEqual(retrieved.id);
    expect(newBuy.price).toEqual(retrieved.price);
    expect(newBuy.quantity).toEqual(retrieved.quantity);
  });
  test('It should get correct sellOrder by id', () => {
    const newSell = Exchange.sell(10, 85);
    const retrieved = Exchange.getOrder(newSell.id);

    expect(newSell.id).toEqual(retrieved.id);
    expect(newSell.price).toEqual(retrieved.price);
    expect(newSell.quantity).toEqual(retrieved.quantity);
  });
  test('It should not get an order when id does not exist', () => {
    const retrieved = Exchange.getOrder('unexisting-id');

    expect(retrieved).toEqual(undefined);
  });
  test('It should not find an order which has been completed and removed', () => {
    // will be matched with buy order with price above 45
    const order = Exchange.sell(5, 45);
    const retrieved = Exchange.getOrder(order.id);

    expect(retrieved).toEqual(undefined);
  });
});
