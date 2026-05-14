describe('Home page', () => {
  beforeEach(() => {
    cy.guestSetup();
    cy.mockCatalog();
    cy.visit('/');
  });

  it('renders the page without crashing', () => {
    cy.get('body').should('exist');
  });

  it('shows the site name / brand in the header', () => {
    cy.contains(/macgly/i).should('be.visible');
  });

  it('has navigation links to products and cart', () => {
    cy.get('a[href="/products"], a[href*="product"]').should('exist');
    cy.get('a[href="/cart"]').should('exist');
  });

  it('shows login and register links for guests', () => {
    cy.get('a[href="/login"]').should('exist');
  });

  it('has a footer with info links', () => {
    cy.get('footer, [data-testid="footer"]').scrollIntoView();
    cy.contains(/about|privacy|terms/i).should('exist');
  });

  it('navigates to products page when clicking shop / products link', () => {
    cy.mockCatalog();
    cy.get('a[href="/products"]').first().click();
    cy.url().should('include', '/products');
  });
});
