describe('Vendor dashboard', () => {
  beforeEach(() => {
    cy.loginAs('vendor');
    cy.mockCatalog();
  });

  context('Auth guard', () => {
    it('redirects customers away from vendor dashboard', () => {
      cy.loginAs('customer');
      cy.visit('/dashboard/vendor');
      cy.url().should('not.include', '/dashboard/vendor').and('match', /\/dashboard\/customer|login/);
    });
  });

  context('Vendor overview', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/vendors/stats*', {
        body: { stats: { totalProducts: 5, totalOrders: 12, totalRevenue: 45000, pendingOrders: 2 } },
      }).as('vendorStats');
      cy.visit('/dashboard/vendor');
    });

    it('shows vendor business name', () => {
      cy.contains('Tools & Co').should('be.visible');
    });

    it('has vendor sidebar navigation', () => {
      cy.contains(/products/i).should('be.visible');
      cy.contains(/orders/i).should('be.visible');
      cy.contains(/settlements/i).should('be.visible');
    });
  });

  context('Vendor products', () => {
    beforeEach(() => {
      cy.fixture('products').then((p) => {
        cy.intercept('GET', '/api/vendors/products*', {
          body: { products: p.list, pagination: { total: 3, page: 1, pages: 1 } },
        }).as('vendorProducts');
        cy.intercept('GET', '/api/admin/categories', { body: { categories: [] } });
      });
      cy.visit('/dashboard/vendor/products');
    });

    it('shows product list', () => {
      cy.wait('@vendorProducts');
      cy.contains('Heavy Duty Drill Machine').should('be.visible');
    });

    it('has add product button', () => {
      cy.contains(/add product|new product/i).should('be.visible');
    });

    it('shows product status badges', () => {
      cy.wait('@vendorProducts');
      cy.get('[class*="approved"], [class*="pending"]').should('exist');
    });
  });

  context('Vendor orders', () => {
    beforeEach(() => {
      cy.fixture('orders').then((o) => {
        cy.intercept('GET', '/api/vendors/orders*', {
          body: { orders: o.list, pagination: o.pagination },
        }).as('vendorOrders');
      });
      cy.visit('/dashboard/vendor/orders');
    });

    it('shows orders list', () => {
      cy.wait('@vendorOrders');
      cy.contains('ORD-1234567890').should('be.visible');
    });

    it('shows order status', () => {
      cy.wait('@vendorOrders');
      cy.contains(/shipped/i).should('be.visible');
    });
  });

  context('Vendor inventory', () => {
    beforeEach(() => {
      cy.fixture('products').then((p) => {
        cy.intercept('GET', '/api/vendors/inventory*', {
          body: { products: p.list, pagination: { total: 3, page: 1, pages: 1 } },
        }).as('vendorInventory');
      });
      cy.visit('/dashboard/vendor/inventory');
    });

    it('shows inventory table', () => {
      cy.wait('@vendorInventory');
      cy.contains('Heavy Duty Drill Machine').should('be.visible');
    });

    it('shows stock numbers', () => {
      cy.wait('@vendorInventory');
      cy.contains('20').should('exist');
    });
  });

  context('Vendor settlements', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/vendors/settlements*', {
        body: {
          commissions: [],
          summary: { pending: 0, approved: 5000, paid: 15000 },
          pagination: { total: 0 },
        },
      }).as('vendorSettlements');
      cy.visit('/dashboard/vendor/settlements');
    });

    it('shows settlement summary cards', () => {
      cy.wait('@vendorSettlements');
      cy.contains(/pending|approved|paid/i).should('be.visible');
    });
  });

  context('Vendor KYC', () => {
    beforeEach(() => cy.visit('/dashboard/vendor/kyc'));

    it('shows KYC page', () => {
      cy.contains(/kyc|verification/i).should('be.visible');
    });

    it('shows document upload sections', () => {
      cy.contains(/gst|pan|bank/i).should('be.visible');
    });
  });

  context('Vendor ads', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/vendors/ads*', {
        body: { campaigns: [], pagination: { total: 0 } },
      }).as('vendorAds');
      cy.fixture('products').then((p) => {
        cy.intercept('GET', '/api/vendors/products*', { body: { products: p.list } });
      });
      cy.visit('/dashboard/vendor/ads');
    });

    it('shows ad campaigns page', () => {
      cy.contains(/ad|campaign/i).should('be.visible');
    });

    it('has create campaign button', () => {
      cy.contains(/create|new campaign/i).should('be.visible');
    });
  });
});
