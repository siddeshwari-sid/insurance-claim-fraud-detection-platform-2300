const express = require('express');
const claimsController = require('../controllers/claims');
const reportsController = require('../controllers/reports');
const queueController = require('../controllers/queue');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Claims
 *     description: Upload and manage claims in the current in-memory session
 *   - name: Reports
 *     description: Aggregated reporting endpoints
 *   - name: Queue
 *     description: Upload processing queue (in-memory)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UploadClaimsRequest:
 *       type: object
 *       required: [csvText]
 *       properties:
 *         csvText:
 *           type: string
 *           description: Raw CSV content (first row must be headers)
 *         filename:
 *           type: string
 *           description: Optional filename for queue display
 *     UploadClaimsResponse:
 *       type: object
 *       properties:
 *         status: { type: string, example: ok }
 *         message: { type: string, example: Upload processed }
 *         inserted: { type: integer, example: 25 }
 *         totalRows: { type: integer, example: 25 }
 *         queueId: { type: string, example: "1" }
 *     ClaimListItem:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         externalId: { type: string, nullable: true }
 *         claimantName: { type: string }
 *         policyId: { type: string }
 *         claimAmount: { type: number }
 *         incidentType: { type: string }
 *         status: { type: string }
 *         fraudScore: { type: number }
 *         riskLevel: { type: string, enum: [Low, Medium, High] }
 *         createdAt: { type: string, format: date-time }
 *     ClaimDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/ClaimListItem'
 *         - type: object
 *           properties:
 *             incidentDate: { type: string, nullable: true, format: date-time }
 *             filedDate: { type: string, nullable: true, format: date-time }
 *             claimantAge: { type: number }
 *             priorClaims: { type: number }
 *             description: { type: string }
 *             reasons:
 *               type: array
 *               items: { type: string }
 *     QueueItem:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         status: { type: string, enum: [queued, processing, done, failed] }
 *         filename: { type: string }
 *         receivedAt: { type: string, format: date-time }
 *         startedAt: { type: string, nullable: true, format: date-time }
 *         finishedAt: { type: string, nullable: true, format: date-time }
 *         totalRows: { type: integer }
 *         successCount: { type: integer }
 *         failureCount: { type: integer }
 *         error: { type: string, nullable: true }
 *     SummaryReport:
 *       type: object
 *       properties:
 *         totalClaims: { type: integer }
 *         avgFraudScore: { type: number }
 *         riskBuckets:
 *           type: object
 *           properties:
 *             low: { type: integer }
 *             medium: { type: integer }
 *             high: { type: integer }
 *         topRisky:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string }
 *               claimantName: { type: string }
 *               claimAmount: { type: number }
 *               fraudScore: { type: number }
 *               riskLevel: { type: string }
 */

/**
 * @swagger
 * /api/claims/upload:
 *   post:
 *     tags: [Claims]
 *     summary: Upload a claims CSV (text) and run fraud scoring
 *     description: Stores parsed claims in memory for the active server session.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UploadClaimsRequest' }
 *     responses:
 *       200:
 *         description: Upload processed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UploadClaimsResponse' }
 *       400:
 *         description: Bad request
 */
router.post('/claims/upload', claimsController.upload.bind(claimsController));

/**
 * @swagger
 * /api/claims:
 *   get:
 *     tags: [Claims]
 *     summary: List claims
 *     parameters:
 *       - in: query
 *         name: minScore
 *         schema: { type: number }
 *         description: Minimum fraud score (0-100)
 *       - in: query
 *         name: maxScore
 *         schema: { type: number }
 *         description: Maximum fraud score (0-100)
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Filter by status (case-insensitive)
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, example: fraudScore }
 *         description: Field to sort by (default fraudScore)
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc], example: desc }
 *     responses:
 *       200:
 *         description: Claim list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ClaimListItem' }
 */
router.get('/claims', claimsController.list.bind(claimsController));

/**
 * @swagger
 * /api/claims/{id}:
 *   get:
 *     tags: [Claims]
 *     summary: Get claim detail
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Claim detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 claim: { $ref: '#/components/schemas/ClaimDetail' }
 *       404:
 *         description: Not found
 */
router.get('/claims/:id', claimsController.getById.bind(claimsController));

/**
 * @swagger
 * /api/reports/summary:
 *   get:
 *     tags: [Reports]
 *     summary: Get aggregated summary report
 *     responses:
 *       200:
 *         description: Summary report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 summary: { $ref: '#/components/schemas/SummaryReport' }
 */
router.get('/reports/summary', reportsController.summary.bind(reportsController));

/**
 * @swagger
 * /api/queue:
 *   get:
 *     tags: [Queue]
 *     summary: Get upload processing queue
 *     responses:
 *       200:
 *         description: Queue items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 items:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/QueueItem' }
 */
router.get('/queue', queueController.list.bind(queueController));

module.exports = router;
