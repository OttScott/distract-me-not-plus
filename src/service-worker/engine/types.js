/**
 * Block Decision Types Module
 *
 * Defines the BlockDecision type and factory functions for creating
 * typed decision objects. Enables rich diagnostics and rule attribution.
 */

// ============================================================================
// Type Definitions (JSDoc)
// ============================================================================

/**
 * The decision action: allow, block, or neutral (no opinion)
 * @typedef {'allow' | 'block' | 'neutral'} BlockAction
 */

/**
 * The source that produced the decision.
 * Used for diagnostics, analytics, and "why was this blocked?" features.
 *
 * @typedef {'teamPolicy' | 'subscribedList' | 'permanentRule' | 'temporaryRule' | 'legacyDenylist' | 'legacyAllowlist' | 'keyword' | 'schedule' | 'timer' | 'tempAllow' | 'system'} BlockSource
 */

/**
 * A typed decision object returned by the decision engine.
 *
 * @typedef {Object} BlockDecision
 * @property {BlockAction} action - The decision: allow, block, or neutral
 * @property {boolean} blocked - Backward-compat: true if action is 'block'
 * @property {string} reason - Human-readable explanation
 * @property {BlockSource} source - What rule/system produced this decision
 * @property {string} [ruleId] - Optional identifier for the specific rule
 * @property {string} [matchedPattern] - The pattern that matched (if pattern-based)
 * @property {string} [matchedKeyword] - The keyword that matched (if keyword-based)
 */

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a block decision
 *
 * @param {string} reason - Human-readable reason for blocking
 * @param {BlockSource} source - What rule/system produced this decision
 * @param {Object} [opts] - Optional properties
 * @param {string} [opts.matchedPattern] - The pattern that matched
 * @param {string} [opts.matchedKeyword] - The keyword that matched
 * @param {string} [opts.ruleId] - Identifier for the specific rule
 * @returns {BlockDecision}
 */
export function blockDecision(
  reason,
  source,
  { matchedPattern, matchedKeyword, ruleId } = {},
) {
  return {
    action: 'block',
    blocked: true,
    reason,
    source,
    matchedPattern: matchedPattern ?? null,
    matchedKeyword: matchedKeyword ?? null,
    ruleId: ruleId ?? null,
  };
}

/**
 * Create an allow decision
 *
 * @param {string} reason - Human-readable reason for allowing
 * @param {BlockSource} source - What rule/system produced this decision
 * @param {Object} [opts] - Optional properties
 * @param {string} [opts.matchedPattern] - The pattern that matched
 * @param {string} [opts.matchedKeyword] - The keyword that matched
 * @param {string} [opts.ruleId] - Identifier for the specific rule
 * @returns {BlockDecision}
 */
export function allowDecision(
  reason,
  source,
  { matchedPattern, matchedKeyword, ruleId } = {},
) {
  return {
    action: 'allow',
    blocked: false,
    reason,
    source,
    matchedPattern: matchedPattern ?? null,
    matchedKeyword: matchedKeyword ?? null,
    ruleId: ruleId ?? null,
  };
}

/**
 * Create a neutral decision (no opinion)
 *
 * Used when a rule source has no opinion on the URL.
 * Neutral decisions are treated as "allow" for backward compat.
 *
 * @param {string} reason - Human-readable reason
 * @param {BlockSource} source - What rule/system produced this decision
 * @returns {BlockDecision}
 */
export function neutralDecision(reason, source) {
  return {
    action: 'neutral',
    blocked: false,
    reason,
    source,
    matchedPattern: null,
    matchedKeyword: null,
    ruleId: null,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a decision is a block
 * @param {BlockDecision} decision
 * @returns {boolean}
 */
export function isBlockDecision(decision) {
  return decision?.action === 'block' || decision?.blocked === true;
}

/**
 * Check if a decision is an allow
 * @param {BlockDecision} decision
 * @returns {boolean}
 */
export function isAllowDecision(decision) {
  return decision?.action === 'allow';
}

/**
 * Check if a decision is neutral
 * @param {BlockDecision} decision
 * @returns {boolean}
 */
export function isNeutralDecision(decision) {
  return decision?.action === 'neutral';
}

/**
 * Get a summary string for a decision (for logging)
 * @param {BlockDecision} decision
 * @returns {string}
 */
export function decisionSummary(decision) {
  if (!decision) return 'no decision';
  const match = decision.matchedPattern || decision.matchedKeyword || '';
  return `${decision.action}[${decision.source}]: ${decision.reason}${match ? ` (${match})` : ''}`;
}
