import './commands';

// Suppress uncaught exceptions from the app under test
Cypress.on('uncaught:exception', (err) => {
  // React hot reload / non-critical errors shouldn't fail tests
  if (err.message.includes('ResizeObserver') || err.message.includes('Loading chunk')) return false;
});
