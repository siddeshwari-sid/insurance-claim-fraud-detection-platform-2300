const claimsStore = require('../store/claimsStore');

class QueueController {
  /**
   * Returns upload processing queue items (newest first).
   */
  list(req, res) {
    return res.status(200).json({ status: 'ok', items: claimsStore.getQueue() });
  }
}

module.exports = new QueueController();
