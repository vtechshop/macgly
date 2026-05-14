/**
 * cy.loginAs('customer' | 'vendor' | 'admin')
 * Mocks /api/auth/me and /api/cart so the app thinks the user is logged in.
 */
Cypress.Commands.add('loginAs', (role) => {
  cy.fixture('user').then((users) => {
    const user = users[role];
    cy.intercept('GET', '/api/auth/me', { statusCode: 200, body: { user } }).as('authMe');
  });
  cy.fixture('cart').then((cart) => {
    cy.intercept('GET', '/api/cart', { statusCode: 200, body: { cart: cart.empty } }).as('getCart');
  });
});

/**
 * cy.mockCatalog()
 * Mocks product listing + categories + banners.
 */
Cypress.Commands.add('mockCatalog', () => {
  cy.fixture('products').then((p) => {
    cy.intercept('GET', '/api/catalog/products*', { statusCode: 200, body: { products: p.list, pagination: p.pagination } }).as('getProducts');
  });
  cy.fixture('categories').then((c) => {
    cy.intercept('GET', '/api/catalog/categories*', { statusCode: 200, body: { categories: c.list } }).as('getCategories');
  });
  cy.intercept('GET', '/api/catalog/banners', { statusCode: 200, body: { banners: [] } }).as('getBanners');
  cy.intercept('GET', '/api/catalog/featured', { statusCode: 200, body: { products: [] } }).as('getFeatured');
  cy.intercept('GET', '/api/flash-sales*', { statusCode: 200, body: { sales: [] } }).as('getFlashSales');
  cy.intercept('GET', '/api/recommendations*', { statusCode: 200, body: { products: [] } }).as('getRecommendations');
  cy.intercept('GET', '/api/blog*', { statusCode: 200, body: { posts: [], pagination: { pages: 0 } } }).as('getBlog');
});

/**
 * cy.guestSetup()
 * Mocks auth as unauthenticated guest.
 */
Cypress.Commands.add('guestSetup', () => {
  cy.intercept('GET', '/api/auth/me', { statusCode: 401, body: { error: { message: 'Not authenticated' } } }).as('authMe');
  cy.intercept('GET', '/api/cart', { statusCode: 401, body: {} }).as('getCart');
});

/**
 * cy.mockOrders()
 * Mocks the orders API for customer dashboard.
 */
Cypress.Commands.add('mockOrders', () => {
  cy.fixture('orders').then((o) => {
    cy.intercept('GET', '/api/orders*', { statusCode: 200, body: { orders: o.list, pagination: o.pagination } }).as('getOrders');
    cy.intercept('GET', `/api/orders/${o.list[0]._id}`, { statusCode: 200, body: { order: o.list[0] } }).as('getOrder');
  });
});
