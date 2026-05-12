const slugifyLib = require('slugify');
const { v4: uuidv4 } = require('uuid');

function slugify(text) {
  return slugifyLib(text, { lower: true, strict: true });
}

function generateSKU(prefix = 'SKU') {
  return `${prefix}-${uuidv4().split('-')[0].toUpperCase()}`;
}

function generateOrderId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

module.exports = { slugify, generateSKU, generateOrderId };
