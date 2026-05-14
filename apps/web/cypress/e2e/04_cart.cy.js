describe('Cart', () => {
  beforeEach(() => {
    cy.guestSetup();
    cy.mockCatalog();
  });

  context('Empty cart', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/cart', { body: { cart: { items: [], total: 0 } } }).as('getCart');
      cy.visit('/cart');
    });

    it('shows empty cart message', () => {
      cy.contains(/empty|no items|nothing/i).should('be.visible');
    });

    it('has a link to continue shopping', () => {
      cy.get('a[href="/products"]').should('exist');
    });
  });

  context('Cart with items', () => {
    beforeEach(() => {
      cy.fixture('cart').then((cart) => {
        cy.intercept('GET', '/api/cart', { body: { cart: cart.withItems } }).as('getCart');
      });
      cy.visit('/cart');
    });

    it('shows cart items', () => {
      cy.wait('@getCart');
      cy.contains('Heavy Duty Drill Machine').should('be.visible');
    });

    it('shows item quantity', () => {
      cy.wait('@getCart');
      cy.contains('2').should('exist');
    });

    it('shows total price', () => {
      cy.wait('@getCart');
      cy.contains('9,000').should('be.visible');
    });

    it('has update quantity controls', () => {
      cy.wait('@getCart');
      cy.get('button').filter((i, el) => /\+|-|increase|decrease/i.test(el.textContent)).should('exist');
    });

    it('updates quantity on + button click', () => {
      cy.intercept('PUT', '/api/cart*', { body: { cart: { items: [], total: 0 } } }).as('updateCart');
      cy.wait('@getCart');
      cy.get('button').contains('+').first().click();
      cy.wait('@updateCart');
    });

    it('removes item when quantity reaches 0', () => {
      cy.intercept('DELETE', '/api/cart*', { body: { cart: { items: [], total: 0 } } }).as('removeItem');
      cy.wait('@getCart');
      cy.get('button').filter((i, el) => /remove|delete|trash/i.test(el.getAttribute('title') || el.textContent)).first().click();
      cy.wait('@removeItem');
    });

    it('has a proceed to checkout button', () => {
      cy.wait('@getCart');
      cy.contains(/checkout|proceed/i).should('be.visible');
    });
  });

  context('Add to cart from product page', () => {
    it('redirects guest to login on add to cart', () => {
      cy.fixture('products').then((p) => {
        const product = p.list[0];
        cy.intercept('GET', `/api/catalog/products/${product.slug}`, {
          body: { product: { ...product, description: 'Test', reviews: [] } },
        });
        cy.intercept('GET', '/api/reviews*', { body: { reviews: [] } });
        cy.intercept('GET', '/api/recommendations*', { body: { products: [] } });
        cy.intercept('POST', '/api/cart', {
          statusCode: 401,
          body: { error: { message: 'Not authenticated' } },
        }).as('addToCart');

        cy.visit(`/product/${product.slug}`);
        cy.contains(/add to cart/i).click();
      });
    });

    it('adds item to cart when logged in', () => {
      cy.loginAs('customer');
      cy.fixture('products').then((p) => {
        const product = p.list[0];
        cy.intercept('GET', `/api/catalog/products/${product.slug}`, {
          body: { product: { ...product, description: 'Test', reviews: [] } },
        });
        cy.intercept('GET', '/api/reviews*', { body: { reviews: [] } });
        cy.intercept('GET', '/api/recommendations*', { body: { products: [] } });
        cy.intercept('POST', '/api/cart', {
          statusCode: 200,
          body: { cart: { items: [{ product: product._id, quantity: 1, price: product.price }], total: product.price } },
        }).as('addToCart');

        cy.visit(`/product/${product.slug}`);
        cy.contains(/add to cart/i).click();
        cy.wait('@addToCart');
      });
    });
  });
});
