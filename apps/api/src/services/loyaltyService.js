const Loyalty = require('../models/Loyalty');

const POINTS_PER_RUPEE = 0.1; // 1 point per ₹10 spent
const POINTS_TO_RUPEE = 0.5;  // 1 point = ₹0.50 (redeemed value)

async function earnPoints(userId, orderAmount, orderId) {
  const points = Math.floor(orderAmount * POINTS_PER_RUPEE);
  if (points <= 0) return;
  let loyalty = await Loyalty.findOne({ user: userId });
  if (!loyalty) loyalty = new Loyalty({ user: userId });
  loyalty.earn(points, `Purchase reward for order`, orderId);
  await loyalty.save();
  return points;
}

async function redeemPoints(userId, points, orderId) {
  let loyalty = await Loyalty.findOne({ user: userId });
  if (!loyalty) throw new Error('No loyalty account');
  loyalty.redeem(points, 'Redeemed at checkout', orderId);
  await loyalty.save();
  return pointsToRupees(points);
}

function pointsToRupees(points) {
  return points * POINTS_TO_RUPEE;
}

async function getBalance(userId) {
  const loyalty = await Loyalty.findOne({ user: userId });
  return loyalty?.balance || 0;
}

async function adjustPoints(userId, points, description) {
  let loyalty = await Loyalty.findOne({ user: userId });
  if (!loyalty) loyalty = new Loyalty({ user: userId });
  const absPoints = Math.abs(points);
  if (points > 0) {
    loyalty.earn(absPoints, description || 'Admin adjustment');
  } else {
    if (loyalty.balance < absPoints) throw new Error('Insufficient balance');
    loyalty.redeem(absPoints, description || 'Admin adjustment');
  }
  await loyalty.save();
}

module.exports = { earnPoints, redeemPoints, getBalance, pointsToRupees, adjustPoints, POINTS_PER_RUPEE, POINTS_TO_RUPEE };
