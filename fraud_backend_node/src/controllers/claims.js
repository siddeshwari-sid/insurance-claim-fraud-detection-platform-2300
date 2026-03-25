const claimsStore = require('../store/claimsStore');
const { parseCsvToObjects } = require('../utils/csv');
const { normalizeClaim, scoreClaim } = require('../services/fraudScoring');

class ClaimsController {
  /**
   * Upload claims CSV (as text) and store scored claims in memory.
   * Expected body: { csvText: string, filename?: string }
   */
  upload(req, res) {
    const { csvText, filename } = req.body || {};
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'csvText is required and must be a string',
      });
    }

    const queueItem = claimsStore.createQueueItem({
      status: 'processing',
      filename: typeof filename === 'string' && filename.trim() ? filename.trim() : 'claims.csv',
    });

    claimsStore.updateQueueItem(queueItem.id, { startedAt: new Date().toISOString() });

    try {
      const { records } = parseCsvToObjects(csvText);
      const toInsert = [];

      for (const raw of records) {
        const canonical = normalizeClaim(raw);
        const scoring = scoreClaim(canonical);
        toInsert.push({
          ...canonical,
          ...scoring,
          createdAt: new Date().toISOString(),
        });
      }

      const { inserted } = claimsStore.insertMany(toInsert);

      claimsStore.updateQueueItem(queueItem.id, {
        status: 'done',
        finishedAt: new Date().toISOString(),
        totalRows: records.length,
        successCount: inserted,
        failureCount: records.length - inserted,
      });

      return res.status(200).json({
        status: 'ok',
        message: 'Upload processed',
        inserted,
        totalRows: records.length,
        queueId: queueItem.id,
      });
    } catch (e) {
      claimsStore.updateQueueItem(queueItem.id, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: e && e.message ? e.message : 'Unknown error',
      });

      return res.status(500).json({
        status: 'error',
        message: 'Failed to parse/process CSV',
      });
    }
  }

  /**
   * List all claims.
   * Query params: minScore, maxScore, status, sortBy, sortDir
   */
  list(req, res) {
    const minScore = req.query.minScore !== undefined ? Number(req.query.minScore) : undefined;
    const maxScore = req.query.maxScore !== undefined ? Number(req.query.maxScore) : undefined;

    const claims = claimsStore.list({
      minScore: Number.isFinite(minScore) ? minScore : undefined,
      maxScore: Number.isFinite(maxScore) ? maxScore : undefined,
      status: req.query.status,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    });

    // Return a lighter list view
    const items = claims.map((c) => ({
      id: c.id,
      externalId: c.externalId,
      claimantName: c.claimantName,
      policyId: c.policyId,
      claimAmount: c.claimAmount,
      incidentType: c.incidentType,
      status: c.status,
      fraudScore: c.fraudScore,
      riskLevel: c.riskLevel,
      createdAt: c.createdAt,
    }));

    return res.status(200).json({ status: 'ok', items });
  }

  /**
   * Get claim detail by id.
   */
  getById(req, res) {
    const id = req.params.id;
    const claim = claimsStore.getById(id);
    if (!claim) {
      return res.status(404).json({ status: 'error', message: 'Claim not found' });
    }
    return res.status(200).json({ status: 'ok', claim });
  }
}

module.exports = new ClaimsController();
