describe('Checkout flow', () => {
  beforeEach(() => {
    cy.loginAs('customer');
    cy.mockCatalog();
    cy.fixture('cart').then((cart) => {
      cy.intercept('GET', '/api/cart', { body: { cart: cart.withItems } }).as('getCart');
    });
  });

  context('Access control', () => {
    it('redirects guest to login', () => {
      cy.guestSetup();
      cy.visit('/checkout');
      cy.url().should('include', '/login');
    });
  });

  context('Checkout page', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/users/addresses', {
        body: {
          addresses: [
            { _id: 'addr001', name: 'Rajan Kumar', line1: '12 Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', phone: '9876543210', isDefault: true },
          ],
        },
      }).as('getAddresses');
      cy.intercept('GET', '/api/config*', { body: {} });
      cy.visit('/checkout');
    });

    it('shows checkout page', () => {
      cy.contains(/checkout|order summary/i).should('be.visible');
    });

    it('shows cart items in summary', () => {
      cy.contains('Heavy Duty Drill Machine').should('be.visible');
    });

    it('shows total amount', () => {
      cy.contains('9,000').should('be.visible');
    });

    it('shows address section', () => {
      cy.wait('@getAddresses');
      cy.contains(/delivery|address|ship/i).should('be.visible');
    });

    it('shows payment options', () => {
      cy.contains(/payment|razorpay|cod|cash/i).should('be.visible');
    });

    it('has a coupon input', () => {
      cy.get('input[placeholder*="coupon" i], input[placeholder*="promo" i]').should('exist');
    });

    it('shows error for invalid coupon', () => {
      cy.intercept('POST', '/api/checkout/validate-coupon', {
        statusCode: 400,
        body: { error: { message: 'Invalid or expired coupon' } },
      }).as('invalidCoupon');

      cy.get('input[placeholder*="coupon" i], input[placeholder*="promo" i]').type('FAKECODE');
      cy.get('button').filter((i, el) => /apply/i.test(el.textContent)).first().click();
      cy.wait('@invalidCoupon');
      cy.contains(/invalid|expired/i).should('be.visible');
    });

    it('applies valid coupon and shows discount', () => {
      cy.intercept('POST', '/api/checkout/validate-coupon', {
        statusCode: 200,
        body: { discount: 900, coupon: { code: 'SAVE10', type: 'percentage', value: 10 } },
      }).as('validCoupon');

      cy.get('input[placeholder*="coupon" i], input[placeholder*="promo" i]').type('SAVE10');
      cy.get('button').filter((i, el) => /apply/i.test(el.textContent)).first().click();
      cy.wait('@validCoupon');
      cy.contains(/discount|900/i).should('be.visible');
    });
  });
});
