describe('Customer dashboard', () => {
  beforeEach(() => {
    cy.loginAs('customer');
    cy.mockCatalog();
    cy.mockOrders();
  });

  context('Auth guard', () => {
    it('redirects to login when not authenticated', () => {
      cy.guestSetup();
      cy.visit('/dashboard/customer');
      cy.url().should('include', '/login');
    });
  });

  context('Dashboard overview', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/orders*', { body: { orders: [], pagination: { total: 0 } } });
      cy.intercept('GET', '/api/loyalty*', { body: { loyalty: { balance: 150, totalEarned: 200 } } });
      cy.visit('/dashboard/customer');
    });

    it('shows the customer name', () => {
      cy.contains('Rajan Kumar').should('be.visible');
    });

    it('shows sidebar navigation', () => {
      cy.contains(/orders/i).should('be.visible');
      cy.contains(/wishlist/i).should('be.visible');
      cy.contains(/settings/i).should('be.visible');
    });
  });

  context('Orders list', () => {
    beforeEach(() => {
      cy.mockOrders();
      cy.visit('/dashboard/customer/orders');
    });

    it('shows order ID', () => {
      cy.wait('@getOrders');
      cy.contains('ORD-1234567890').should('be.visible');
    });

    it('shows order status', () => {
      cy.wait('@getOrders');
      cy.contains(/shipped/i).should('be.visible');
    });

    it('shows order total', () => {
      cy.wait('@getOrders');
      cy.contains('9,000').should('be.visible');
    });

    it('has a View Details link', () => {
      cy.wait('@getOrders');
      cy.contains(/view details/i).should('be.visible');
    });
  });

  context('Order detail', () => {
    beforeEach(() => {
      cy.fixture('orders').then((o) => {
        cy.intercept('GET', `/api/orders/${o.list[0]._id}`, {
          body: { order: o.list[0] },
        }).as('getOrderDetail');
        cy.visit(`/dashboard/customer/orders/${o.list[0]._id}`);
      });
    });

    it('shows order ID on detail page', () => {
      cy.wait('@getOrderDetail');
      cy.contains('ORD-1234567890').should('be.visible');
    });

    it('shows shipping address', () => {
      cy.wait('@getOrderDetail');
      cy.contains('Chennai').should('be.visible');
    });

    it('shows tracking history', () => {
      cy.wait('@getOrderDetail');
      cy.contains(/shipment history|tracking/i).should('be.visible');
    });

    it('shows invoice download button', () => {
      cy.wait('@getOrderDetail');
      cy.contains(/invoice/i).should('be.visible');
    });

    it('has back to orders link', () => {
      cy.wait('@getOrderDetail');
      cy.get('a[href="/dashboard/customer/orders"]').should('exist');
    });
  });

  context('Wishlist', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/users/wishlist', { body: { wishlist: [] } }).as('getWishlist');
      cy.visit('/dashboard/customer/wishlist');
    });

    it('shows wishlist page', () => {
      cy.contains(/wishlist/i).should('be.visible');
    });
  });

  context('Addresses', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/users/addresses', { body: { addresses: [] } }).as('getAddresses');
      cy.visit('/dashboard/customer/addresses');
    });

    it('shows addresses page', () => {
      cy.contains(/address/i).should('be.visible');
    });

    it('has add address button', () => {
      cy.contains(/add.*address|new address/i).should('be.visible');
    });
  });

  context('Settings', () => {
    beforeEach(() => cy.visit('/dashboard/customer/settings'));

    it('shows settings page with profile form', () => {
      cy.contains(/settings|profile/i).should('be.visible');
    });

    it('shows customer email', () => {
      cy.contains('rajan@test.com').should('be.visible');
    });
  });
});
