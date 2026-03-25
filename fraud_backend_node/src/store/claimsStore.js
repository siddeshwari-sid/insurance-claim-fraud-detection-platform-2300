const { randomUUID } = require('crypto');

/**
 * Simple in-memory store for claims during the active server session.
 * NOTE: Data will reset whenever the server restarts.
 */
class ClaimsStore {
  constructor() {
    this._claimsById = new Map();
    this._claims = [];
    this._uploadQueue = [];
    this._nextQueueId = 1;
  }

  /**
   * Create a queue item for an upload operation.
   * @param {object} item - Queue item fields.
   * @returns {object} queue item
   */
  createQueueItem(item) {
    const queueItem = {
      id: String(this._nextQueueId++),
      status: item.status || 'queued', // queued|processing|done|failed
      filename: item.filename || 'claims.csv',
      receivedAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      error: null,
    };
    this._uploadQueue.unshift(queueItem); // newest first
    return queueItem;
  }

  /**
   * Update a queue item.
   * @param {string} id
   * @param {object} patch
   * @returns {object|null}
   */
  updateQueueItem(id, patch) {
    const idx = this._uploadQueue.findIndex((q) => q.id === String(id));
    if (idx === -1) return null;
    this._uploadQueue[idx] = { ...this._uploadQueue[idx], ...patch };
    return this._uploadQueue[idx];
  }

  /**
   * Get queue items (newest first).
   * @returns {object[]}
   */
  getQueue() {
    return this._uploadQueue;
  }

  /**
   * Insert many claims, generating stable IDs.
   * @param {Array<object>} claims
   * @returns {{inserted: number, ids: string[]}}
   */
  insertMany(claims) {
    const ids = [];
    for (const claim of claims) {
      const id = randomUUID();
      const full = { ...claim, id };
      this._claimsById.set(id, full);
      this._claims.push(full);
      ids.push(id);
    }
    return { inserted: claims.length, ids };
  }

  /**
   * List claims, optionally filtered and sorted.
   * @param {object} opts
   * @returns {object[]}
   */
  list(opts = {}) {
    const { minScore, maxScore, status, sortBy = 'score', sortDir = 'desc' } = opts;

    let arr = [...this._claims];

    if (typeof minScore === 'number') arr = arr.filter((c) => c.fraudScore >= minScore);
    if (typeof maxScore === 'number') arr = arr.filter((c) => c.fraudScore <= maxScore);
    if (status) arr = arr.filter((c) => String(c.status || '').toLowerCase() === String(status).toLowerCase());

    const dir = String(sortDir).toLowerCase() === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (av === undefined && bv === undefined) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });

    return arr;
  }

  /**
   * Get a claim by id.
   * @param {string} id
   * @returns {object|null}
   */
  getById(id) {
    return this._claimsById.get(String(id)) || null;
  }

  /**
   * Compute summary report across all stored claims.
   * @returns {object}
   */
  getSummary() {
    const total = this._claims.length;
    if (total === 0) {
      return {
        totalClaims: 0,
        avgFraudScore: 0,
        riskBuckets: { low: 0, medium: 0, high: 0 },
        topRisky: [],
      };
    }

    let sum = 0;
    const buckets = { low: 0, medium: 0, high: 0 };

    for (const c of this._claims) {
      sum += c.fraudScore;
      if (c.riskLevel === 'High') buckets.high += 1;
      else if (c.riskLevel === 'Medium') buckets.medium += 1;
      else buckets.low += 1;
    }

    const topRisky = [...this._claims]
      .sort((a, b) => b.fraudScore - a.fraudScore)
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        claimantName: c.claimantName,
        claimAmount: c.claimAmount,
        fraudScore: c.fraudScore,
        riskLevel: c.riskLevel,
      }));

    return {
      totalClaims: total,
      avgFraudScore: Math.round((sum / total) * 10) / 10,
      riskBuckets: buckets,
      topRisky,
    };
  }
}

module.exports = new ClaimsStore();
