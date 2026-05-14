describe('Authentication', () => {
  beforeEach(() => {
    cy.guestSetup();
    cy.mockCatalog();
  });

  context('Login page', () => {
    beforeEach(() => cy.visit('/login'));

    it('renders the login form', () => {
      cy.get('input[type="email"], input[name="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('shows an error for invalid credentials', () => {
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 401,
        body: { error: { message: 'Invalid email or password' } },
      }).as('loginFail');

      cy.get('input[type="email"], input[name="email"]').type('wrong@test.com');
      cy.get('input[type="password"]').type('wrongpass');
      cy.get('button[type="submit"]').click();

      cy.wait('@loginFail');
      cy.contains(/invalid|incorrect|wrong/i).should('be.visible');
    });

    it('redirects to dashboard after successful login', () => {
      cy.fixture('user').then((users) => {
        cy.intercept('POST', '/api/auth/login', {
          statusCode: 200,
          body: { user: users.customer },
        }).as('loginOk');
        cy.intercept('GET', '/api/auth/me', { body: { user: users.customer } });
      });

      cy.get('input[type="email"], input[name="email"]').type('rajan@test.com');
      cy.get('input[type="password"]').type('Password123');
      cy.get('button[type="submit"]').click();

      cy.wait('@loginOk');
      cy.url().should('match', /dashboard|\/$/);
    });

    it('has a link to register', () => {
      cy.get('a[href="/register"]').should('exist');
    });

    it('has a forgot password link', () => {
      cy.get('a[href="/forgot-password"]').should('exist');
    });
  });

  context('Register page', () => {
    beforeEach(() => cy.visit('/register'));

    it('renders the registration form', () => {
      cy.get('input[name="name"], input[placeholder*="name" i]').should('be.visible');
      cy.get('input[type="email"], input[name="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('shows error for duplicate email', () => {
      cy.intercept('POST', '/api/auth/register', {
        statusCode: 409,
        body: { error: { message: 'Email already in use' } },
      }).as('regFail');

      cy.get('input[name="name"], input[placeholder*="name" i]').first().type('Test User');
      cy.get('input[type="email"], input[name="email"]').type('existing@test.com');
      cy.get('input[type="password"]').first().type('Password123');
      cy.get('button[type="submit"]').click();

      cy.wait('@regFail');
      cy.contains(/already|exists|duplicate/i).should('be.visible');
    });
  });

  context('Forgot password page', () => {
    it('renders the forgot password form', () => {
      cy.visit('/forgot-password');
      cy.get('input[type="email"], input[name="email"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });

    it('shows confirmation after submitting', () => {
      cy.intercept('POST', '/api/auth/forgot-password', {
        statusCode: 200,
        body: { message: 'Reset email sent' },
      }).as('forgotOk');

      cy.visit('/forgot-password');
      cy.get('input[type="email"], input[name="email"]').type('rajan@test.com');
      cy.get('button[type="submit"]').click();
      cy.wait('@forgotOk');
      cy.contains(/sent|check.*email|reset/i).should('be.visible');
    });
  });
});
