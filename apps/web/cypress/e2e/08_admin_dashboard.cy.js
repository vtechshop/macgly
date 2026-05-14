describe('Admin dashboard', () => {
  beforeEach(() => {
    cy.loginAs('admin');
    cy.mockCatalog();
  });

  context('Auth guard', () => {
    it('redirects non-admins to their own dashboard', () => {
      cy.loginAs('customer');
      cy.visit('/dashboard/admin');
      cy.url().should('not.include', '/dashboard/admin');
    });
  });

  context('Admin overview', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/admin/stats*', {
        body: {
          stats: {
            totalRevenue: 250000, totalOrders: 150, totalUsers: 80,
            totalProducts: 45, pendingOrders: 5, pendingKYC: 2,
            revenueChart: [], ordersChart: [],
          },
        },
      }).as('adminStats');
      cy.visit('/dashboard/admin');
    });

    it('shows admin user name', () => {
      cy.contains('Admin User').should('be.visible');
    });

    it('shows stat cards', () => {
      cy.wait('@adminStats');
      cy.contains(/revenue|orders|users|products/i).should('be.visible');
    });

    it('has full sidebar navigation', () => {
      cy.contains(/products/i).should('be.visible');
      cy.contains(/orders/i).should('be.visible');
      cy.contains(/users/i).should('be.visible');
      cy.contains(/vendors/i).should('be.visible');
    });
  });

  context('Admin orders', () => {
    beforeEach(() => {
      cy.fixture('orders').then((o) => {
        cy.intercept('GET', '/api/admin/orders*', {
          body: { orders: o.list, pagination: { total: 1, page: 1, pages: 1 } },
        }).as('adminOrders');
      });
      cy.visit('/dashboard/admin/orders');
    });

    it('shows orders table', () => {
      cy.wait('@adminOrders');
      cy.contains('ORD-1234567890').should('be.visible');
    });

    it('order ID is a link to detail page', () => {
      cy.wait('@adminOrders');
      cy.get('a').filter((i, el) => el.href.includes('/dashboard/admin/orders/')).should('exist');
    });
  });

  context('Admin order detail', () => {
    beforeEach(() => {
      cy.fixture('orders').then((o) => {
        cy.intercept('GET', `/api/admin/orders/${o.list[0]._id}`, {
          body: { order: { ...o.list[0], user: { name: 'Rajan Kumar', email: 'rajan@test.com', phone: '9876543210' } } },
        }).as('adminOrderDetail');
        cy.visit(`/dashboard/admin/orders/${o.list[0]._id}`);
      });
    });

    it('shows order detail page', () => {
      cy.wait('@adminOrderDetail');
      cy.contains('ORD-1234567890').should('be.visible');
    });

    it('shows customer info', () => {
      cy.wait('@adminOrderDetail');
      cy.contains('Rajan Kumar').should('be.visible');
    });

    it('shows status update buttons', () => {
      cy.wait('@adminOrderDetail');
      cy.contains(/confirmed|processing|shipped|delivered/i).should('be.visible');
    });

    it('shows tracking section', () => {
      cy.wait('@adminOrderDetail');
      cy.contains(/tracking/i).should('be.visible');
    });
  });

  context('Admin products', () => {
    beforeEach(() => {
      cy.fixture('products').then((p) => {
        cy.intercept('GET', '/api/admin/products*', {
          body: { products: p.list, pagination: { total: 3, page: 1, pages: 1 } },
        }).as('adminProducts');
      });
      cy.visit('/dashboard/admin/products');
    });

    it('shows products table', () => {
      cy.wait('@adminProducts');
      cy.contains('Heavy Duty Drill Machine').should('be.visible');
    });

    it('has approve/reject controls', () => {
      cy.wait('@adminProducts');
      cy.contains(/approve|reject|status/i).should('be.visible');
    });
  });

  context('Admin users', () => {
    beforeEach(() => {
      cy.fixture('user').then((users) => {
        cy.intercept('GET', '/api/admin/users*', {
          body: { users: Object.values(users), pagination: { total: 3, page: 1, pages: 1 } },
        }).as('adminUsers');
      });
      cy.visit('/dashboard/admin/users');
    });

    it('shows users list', () => {
      cy.wait('@adminUsers');
      cy.contains('Rajan Kumar').should('be.visible');
    });

    it('shows user roles', () => {
      cy.wait('@adminUsers');
      cy.contains(/customer|vendor|admin/i).should('be.visible');
    });
  });

  context('Admin vendors', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/admin/users*role=vendor*', {
        body: { users: [], pagination: { total: 0 } },
      }).as('adminVendors');
      cy.visit('/dashboard/admin/vendors');
    });

    it('shows vendors page', () => {
      cy.contains(/vendor/i).should('be.visible');
    });
  });

  context('Admin commissions', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/admin/commissions*', {
        body: { commissions: [], summary: { pendingAmount: 0, paidAmount: 0 }, pagination: { total: 0 } },
      }).as('adminCommissions');
      cy.visit('/dashboard/admin/commissions');
    });

    it('shows commissions page with summary cards', () => {
      cy.contains(/commission/i).should('be.visible');
    });
  });

  context('Admin flash sales', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/admin/flash-sales*', {
        body: { sales: [], pagination: { total: 0 } },
      }).as('flashSales');
      cy.visit('/dashboard/admin/flash-sales');
    });

    it('shows flash sales page', () => {
      cy.contains(/flash sale/i).should('be.visible');
    });

    it('has create flash sale button', () => {
      cy.contains(/create|add|new/i).should('be.visible');
    });
  });

  context('Admin carousel', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/admin/carousel', { body: { slides: [] } }).as('carousel');
      cy.visit('/dashboard/admin/carousel');
    });

    it('shows carousel management page', () => {
      cy.contains(/carousel/i).should('be.visible');
    });

    it('has add slide button', () => {
      cy.contains(/add slide/i).should('be.visible');
    });
  });

  context('Admin gamification', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/admin/gamification/spin', { body: { config: { isEnabled: false, slices: [] } } });
      cy.intercept('GET', '/api/admin/gamification/quiz', { body: { questions: [] } });
      cy.intercept('GET', '/api/admin/gamification/loyalty-config', { body: { config: {} } });
      cy.visit('/dashboard/admin/gamification');
    });

    it('shows gamification page with tabs', () => {
      cy.contains(/spin/i).should('be.visible');
      cy.contains(/quiz/i).should('be.visible');
      cy.contains(/loyalty/i).should('be.visible');
    });
  });

  context('Admin blog', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/admin/blog*', { body: { posts: [], pagination: { total: 0 } } });
      cy.visit('/dashboard/admin/blog');
    });

    it('shows blog management page', () => {
      cy.contains(/blog/i).should('be.visible');
    });
  });

  context('Admin KYC review', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/admin/kyc*', { body: { users: [], pagination: { total: 0 } } });
      cy.visit('/dashboard/admin/kyc');
    });

    it('shows KYC review page', () => {
      cy.contains(/kyc/i).should('be.visible');
    });
  });
});
