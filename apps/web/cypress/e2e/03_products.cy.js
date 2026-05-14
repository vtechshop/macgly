describe('Product pages', () => {
  beforeEach(() => {
    cy.guestSetup();
    cy.mockCatalog();
  });

  context('Product listing (/products)', () => {
    beforeEach(() => cy.visit('/products'));

    it('shows a list of products', () => {
      cy.wait('@getProducts');
      cy.contains('Heavy Duty Drill Machine').should('be.visible');
      cy.contains('Angle Grinder 750W').should('be.visible');
    });

    it('shows product prices in INR', () => {
      cy.wait('@getProducts');
      cy.contains('₹').should('exist');
    });

    it('has a search input', () => {
      cy.get('input[placeholder*="search" i], input[type="search"]').should('exist');
    });

    it('filters products by search query', () => {
      cy.intercept('GET', '/api/catalog/products*search=drill*', {
        body: { products: [{ _id: 'prod001', title: 'Heavy Duty Drill Machine', slug: 'heavy-duty-drill-machine', price: 4500, images: [] }], pagination: { total: 1, page: 1, pages: 1 } },
      }).as('searchProducts');

      cy.get('input[placeholder*="search" i], input[type="search"]').first().type('drill');
      cy.wait('@searchProducts');
      cy.contains('Heavy Duty Drill Machine').should('be.visible');
    });

    it('navigates to product detail on card click', () => {
      cy.wait('@getProducts');
      cy.fixture('products').then((p) => {
        const product = p.list[0];
        cy.intercept('GET', `/api/catalog/products/${product.slug}`, {
          body: { product: { ...product, description: 'Professional grade drill', reviews: [] } },
        }).as('getProductDetail');

        cy.get(`a[href*="${product.slug}"]`).first().click();
        cy.url().should('include', product.slug);
      });
    });
  });

  context('Product detail page', () => {
    beforeEach(() => {
      cy.fixture('products').then((p) => {
        const product = p.list[0];
        cy.intercept('GET', `/api/catalog/products/${product.slug}`, {
          body: { product: { ...product, description: 'Professional 13mm chuck drill', reviews: [] } },
        }).as('getProductDetail');
        cy.intercept('GET', '/api/reviews*', { body: { reviews: [], pagination: { total: 0 } } });
        cy.intercept('GET', '/api/recommendations*', { body: { products: [] } });
        cy.visit(`/product/${product.slug}`);
      });
    });

    it('shows the product title', () => {
      cy.wait('@getProductDetail');
      cy.contains('Heavy Duty Drill Machine').should('be.visible');
    });

    it('shows the product price', () => {
      cy.wait('@getProductDetail');
      cy.contains('4,500').should('be.visible');
    });

    it('shows add to cart button', () => {
      cy.wait('@getProductDetail');
      cy.contains(/add to cart/i).should('be.visible');
    });

    it('shows product description', () => {
      cy.wait('@getProductDetail');
      cy.contains('Professional 13mm chuck drill').should('be.visible');
    });
  });

  context('Category page', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/catalog/categories/power-tools', {
        body: { category: { _id: 'cat001', name: 'Power Tools', slug: 'power-tools', description: 'Electric and battery-powered tools' } },
      }).as('getCategory');
      cy.mockCatalog();
      cy.visit('/category/power-tools');
    });

    it('shows the category name', () => {
      cy.wait('@getCategory');
      cy.contains('Power Tools').should('be.visible');
    });

    it('shows a filter panel', () => {
      cy.contains(/filter|price|rating/i).should('exist');
    });

    it('shows a sort dropdown', () => {
      cy.get('select').should('exist');
    });
  });
});
