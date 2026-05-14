const autoReleaseTransfers = require('./autoReleaseTransfers');
const reconcilePayments = require('./reconcilePayments');
const reviewRequestJob = require('./reviewRequestJob');
const trackingSyncJob = require('./trackingSyncJob');
const abandonedCartService = require('../services/abandonedCartService');
const inventoryAlertService = require('../services/inventoryAlertService');

function schedule(name, fn, intervalMs) {
  fn().catch((e) => console.error(`[Job:${name}] startup error:`, e.message));
  setInterval(() => {
    fn().catch((e) => console.error(`[Job:${name}] error:`, e.message));
  }, intervalMs);
}

function startJobs() {
  if (process.env.DISABLE_JOBS === 'true') {
    console.log('[Jobs] Background jobs disabled via DISABLE_JOBS=true');
    return;
  }

  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;

  schedule('TrackingSync', () => trackingSyncJob.run(), 15 * MINUTE);
  schedule('AutoRelease', () => autoReleaseTransfers.run(), 4 * HOUR);
  schedule('Reconcile', () => reconcilePayments.run(), 2 * HOUR);
  schedule('ReviewRequests', () => reviewRequestJob.run(), 6 * HOUR);
  schedule('AbandonedCart', () => abandonedCartService.detectAndSave(), HOUR);
  schedule('AbandonedCartEmail', () => abandonedCartService.sendRecoveryEmails(), 6 * HOUR);
  schedule('InventoryAlert', () => inventoryAlertService.checkAndAlert(), 12 * HOUR);

  console.log('[Jobs] Background jobs started');
}

module.exports = { startJobs };
