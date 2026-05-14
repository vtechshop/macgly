describe('Public utility pages', () => {
  beforeEach(() => {
    cy.guestSetup();
    cy.mockCatalog();
  });

  context('Track Order', () => {
    beforeEach(() => cy.visit('/track-order'));

    it('renders the track order form', () => {
      cy.contains(/track.*order|your order/i).should('be.visible');
      cy.get('input[placeholder*="order" i], input[name*="order" i]').should('be.visible');
      cy.get('input[placeholder*="phone" i], input[name*="phone" i]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('shows error for unknown order', () => {
      cy.intercept('GET', '/api/orders/track*', {
        statusCode: 404,
        body: { error: { message: 'Order not found' } },
      }).as('trackFail');

      cy.get('input[placeholder*="order" i], input[name*="order" i]').type('ORD-9999999');
      cy.get('input[placeholder*="phone" i], input[name*="phone" i]').type('9999999999');
      cy.get('button[type="submit"]').click();
      cy.wait('@trackFail');
      cy.contains(/not found|check|invalid/i).should('be.visible');
    });

    it('shows order status on valid lookup', () => {
      cy.fixture('orders').then((o) => {
        cy.intercept('GET', '/api/orders/track*', {
          statusCode: 200,
          body: { order: { orderId: 'ORD-1234567890', status: 'shipped', createdAt: new Date().toISOString(), items: o.list[0].items, tracking: o.list[0].tracking } },
        }).as('trackOk');
      });

      cy.get('input[placeholder*="order" i], input[name*="order" i]').type('ORD-1234567890');
      cy.get('input[placeholder*="phone" i], input[name*="phone" i]').type('9876543210');
      cy.get('button[type="submit"]').click();
      cy.wait('@trackOk');
      cy.contains(/shipped/i).should('be.visible');
    });
  });

  context('Warranty Check', () => {
    beforeEach(() => cy.visit('/warranty-check'));

    it('renders the warranty check form', () => {
      cy.contains(/warranty/i).should('be.visible');
      cy.get('input[placeholder*="serial" i], input[placeholder*="imei" i]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('shows error for unknown serial', () => {
      cy.intercept('GET', '/api/warranties/check/*', {
        statusCode: 404,
        body: { error: { message: 'No warranty found for this serial number' } },
      }).as('warrantyFail');

      cy.get('input[placeholder*="serial" i], input[placeholder*="imei" i]').type('INVALID-SN-001');
      cy.get('button[type="submit"]').click();
      cy.wait('@warrantyFail');
      cy.contains(/no warranty|not found/i).should('be.visible');
    });

    it('shows active warranty details', () => {
      cy.intercept('GET', '/api/warranties/check/*', {
        statusCode: 200,
        body: {
          warranty: {
            serialNumber: 'SN-2024-ABCD1234',
            status: 'active',
            purchaseDate: '2024-01-01T00:00:00Z',
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            warrantyPeriodMonths: 24,
            product: { title: 'Heavy Duty Drill Machine', images: [] },
          },
        },
      }).as('warrantyOk');

      cy.get('input[placeholder*="serial" i], input[placeholder*="imei" i]').type('SN-2024-ABCD1234');
      cy.get('button[type="submit"]').click();
      cy.wait('@warrantyOk');
      cy.contains(/warranty valid/i).should('be.visible');
    });
  });

  context('Blog', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/blog*', {
        body: {
          posts: [
            { _id: 'post001', title: 'Top 5 Drills for 2024', slug: 'top-5-drills-2024', excerpt: 'Best drills this year', tags: ['tools'], author: { name: 'Admin' }, publishedAt: '2024-01-01T00:00:00Z' },
          ],
          pagination: { page: 1, pages: 1 },
        },
      }).as('getBlog');
      cy.visit('/blog');
    });

    it('renders the blog listing page', () => {
      cy.contains(/blog/i).should('be.visible');
    });

    it('shows blog post cards', () => {
      cy.wait('@getBlog');
      cy.contains('Top 5 Drills for 2024').should('be.visible');
    });

    it('has a search input', () => {
      cy.get('input[placeholder*="search" i]').should('exist');
    });

    it('navigates to post detail on click', () => {
      cy.wait('@getBlog');
      cy.intercept('GET', '/api/blog/top-5-drills-2024', {
        body: { post: { _id: 'post001', title: 'Top 5 Drills for 2024', slug: 'top-5-drills-2024', content: '<p>Full article content here</p>', tags: ['tools'], author: { name: 'Admin' }, publishedAt: '2024-01-01T00:00:00Z' } },
      }).as('getPost');

      cy.contains('Top 5 Drills for 2024').click();
      cy.wait('@getPost');
      cy.url().should('include', 'top-5-drills-2024');
      cy.contains('Full article content here').should('be.visible');
    });
  });

  context('Vendor Store', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/vendors/vend001/public', {
        body: { vendor: { _id: 'vend001', name: 'Tools & Co', storeName: 'Tools & Co Store', productCount: 3, rating: 4.2 } },
      }).as('getVendorStore');
      cy.intercept('GET', '/api/catalog/products*vendor=vend001*', {
        body: { products: [], pagination: { total: 0 } },
      });
      cy.visit('/store/vend001');
    });

    it('shows vendor store name', () => {
      cy.wait('@getVendorStore');
      cy.contains('Tools & Co').should('be.visible');
    });

    it('shows product count', () => {
      cy.wait('@getVendorStore');
      cy.contains(/product/i).should('be.visible');
    });
  });
});
