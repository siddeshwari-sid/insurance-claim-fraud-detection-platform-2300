/**
 * Convert a string to a number safely.
 * @param {string|number} value
 * @returns {number}
 */
function toNumber(value) {
  if (typeof value === 'number') return value;
  const n = Number(String(value || '').replace(/[$,]/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse date-like value safely (supports ISO, yyyy-mm-dd, etc.).
 * @param {string} value
 * @returns {Date|null}
 */
function toDate(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize raw CSV object into a canonical claim model.
 * We accept multiple likely header names.
 * @param {object} raw
 * @returns {object} canonical claim (without id)
 */
function normalizeClaim(raw) {
  const get = (...keys) => {
    for (const k of keys) {
      if (raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== '') return raw[k];
      // case-insensitive support
      const found = Object.keys(raw).find((rk) => rk.toLowerCase() === String(k).toLowerCase());
      if (found && raw[found] !== undefined && raw[found] !== null && String(raw[found]).trim() !== '') return raw[found];
    }
    return '';
  };

  const claimAmount = toNumber(get('claimAmount', 'claim_amount', 'amount', 'Claim Amount', 'Total Amount'));
  const incidentDate = toDate(get('incidentDate', 'incident_date', 'lossDate', 'loss_date', 'Incident Date', 'Loss Date'));
  const filedDate = toDate(get('filedDate', 'filed_date', 'reportDate', 'report_date', 'Filed Date', 'Report Date'));
  const claimantAge = toNumber(get('claimantAge', 'claimant_age', 'age', 'Claimant Age'));
  const priorClaims = toNumber(get('priorClaims', 'prior_claims', 'previousClaims', 'previous_claims', 'Prior Claims'));

  return {
    externalId: String(get('claimId', 'claim_id', 'id', 'Claim ID')).trim() || null,
    claimantName: String(get('claimantName', 'claimant_name', 'name', 'Claimant Name')).trim() || 'Unknown',
    policyId: String(get('policyId', 'policy_id', 'Policy ID')).trim() || 'Unknown',
    claimAmount,
    incidentType: String(get('incidentType', 'incident_type', 'type', 'Incident Type')).trim() || 'Unknown',
    incidentDate: incidentDate ? incidentDate.toISOString() : null,
    filedDate: filedDate ? filedDate.toISOString() : null,
    claimantAge,
    priorClaims,
    description: String(get('description', 'Description', 'details', 'Details')).trim() || '',
    status: String(get('status', 'Status')).trim() || 'Open',
    raw,
  };
}

/**
 * Compute a rule-based fraud score (0-100) and reasons.
 * @param {object} claim canonical claim
 * @returns {{fraudScore: number, riskLevel: 'Low'|'Medium'|'High', reasons: string[]}}
 */
function scoreClaim(claim) {
  let score = 0;
  const reasons = [];

  // Rule 1: high claim amount
  if (claim.claimAmount >= 10000) {
    score += 25;
    reasons.push('High claim amount (>= 10,000)');
  } else if (claim.claimAmount >= 5000) {
    score += 15;
    reasons.push('Moderately high claim amount (>= 5,000)');
  }

  // Rule 2: short filing delay
  if (claim.incidentDate && claim.filedDate) {
    const inc = new Date(claim.incidentDate);
    const filed = new Date(claim.filedDate);
    const days = (filed.getTime() - inc.getTime()) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(days) && days >= 0 && days <= 1) {
      score += 20;
      reasons.push('Filed within 1 day of incident');
    } else if (Number.isFinite(days) && days < 0) {
      score += 10;
      reasons.push('Filed date is before incident date');
    }
  }

  // Rule 3: prior claims
  if (claim.priorClaims >= 3) {
    score += 20;
    reasons.push('Multiple prior claims (>= 3)');
  } else if (claim.priorClaims === 2) {
    score += 10;
    reasons.push('Two prior claims');
  }

  // Rule 4: claimant age extremes
  if (claim.claimantAge > 0 && (claim.claimantAge < 21 || claim.claimantAge > 75)) {
    score += 10;
    reasons.push('Claimant age in higher-risk band (<21 or >75)');
  }

  // Rule 5: suspicious incident types
  const t = String(claim.incidentType || '').toLowerCase();
  const suspiciousTypes = ['theft', 'fire', 'arson', 'staged', 'fraud'];
  if (suspiciousTypes.some((kw) => t.includes(kw))) {
    score += 15;
    reasons.push('Incident type matches higher-risk category');
  }

  // Cap 0..100
  score = Math.max(0, Math.min(100, score));

  let riskLevel = 'Low';
  if (score >= 70) riskLevel = 'High';
  else if (score >= 40) riskLevel = 'Medium';

  return { fraudScore: score, riskLevel, reasons };
}

module.exports = { normalizeClaim, scoreClaim };
