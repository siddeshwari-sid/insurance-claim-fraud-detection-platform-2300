const claimsStore = require('../store/claimsStore');

class ReportsController {
  /**
   * Summary report across all claims stored in memory.
   */
  summary(req, res) {
    const summary = claimsStore.getSummary();
    return res.status(200).json({ status: 'ok', summary });
  }
}

module.exports = new ReportsController();
