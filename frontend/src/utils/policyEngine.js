export function computeCleanHistory(alertOrTx) {
  const a = alertOrTx || {};
  const user = a.userId || {};
  const velocity = a.velocitySnapshot || {};
  const session = a.sessionData || {};
  const deviceInfo = a.deviceInfo || {};
  const locationInfo = a.locationInfo || {};
  const threatFlags = Array.isArray(a.threatFlags) ? a.threatFlags : [];

  const flaggedCount = Number(user.flaggedActivityCount || 0);
  const l5 = Number(velocity.last5Min || 0);
  const l1h = Number(velocity.last1Hour || 0);
  const noSevereFlags = threatFlags.length <= 1;

  const clean =
    flaggedCount <= 1 &&
    !session.isNewDevice &&
    !session.impossibleTravel &&
    !deviceInfo.isNewDevice &&
    !locationInfo.impossibleTravel &&
    l5 <= 2 &&
    l1h <= 6 &&
    noSevereFlags;

  return {
    clean,
    details: {
      flaggedCount,
      l5,
      l1h,
      noSevereFlags,
      isNewDevice: Boolean(session.isNewDevice || deviceInfo.isNewDevice),
      impossibleTravel: Boolean(session.impossibleTravel || locationInfo.impossibleTravel),
    },
  };
}

export function evaluateGuardrailRecommendation(alert, options = {}) {
  const precisionFirst = options.precisionFirst !== false;
  const risk = Number(alert?.fraudScore ?? alert?.securityChecks?.overallRiskScore ?? 0);

  let base = 'approve';
  if (risk >= 65) base = 'block';
  else if (risk >= 30) base = 'block';
  else if (risk >= 15) base = 'monitor';

  const cleanHistory = computeCleanHistory(alert);
  let finalRecommendation = base;
  let guardrailApplied = false;

  if (precisionFirst && risk >= 30 && risk < 60 && cleanHistory.clean && base === 'block') {
    finalRecommendation = 'monitor';
    guardrailApplied = true;
  }

  const reasons = [];
  if (risk >= 65) reasons.push('High fraud score zone.');
  else if (risk >= 30) reasons.push('Medium fraud score zone.');
  else reasons.push('Low fraud score zone.');

  if (cleanHistory.clean) reasons.push('Behavior history appears clean.');
  else reasons.push('Behavior history has risk indicators.');

  if (guardrailApplied) reasons.push('Precision-first guardrail reduced action from block to monitor.');

  return {
    risk,
    baseRecommendation: base,
    finalRecommendation,
    guardrailApplied,
    cleanHistory,
    reasons,
  };
}

export function explainDecision(tx, decision, policy) {
  const reasons = [];
  const risk = Number(tx?.securityChecks?.overallRiskScore || 0);
  const threatFlags = Array.isArray(tx?.threatFlags) ? tx.threatFlags : [];
  const session = tx?.sessionData || {};

  if (risk >= policy.highThreshold) reasons.push(`risk >= high threshold (${policy.highThreshold})`);
  else if (risk >= policy.mediumThreshold) reasons.push(`risk >= medium threshold (${policy.mediumThreshold})`);

  if (session.isNewDevice) reasons.push('new device pattern');
  if (session.impossibleTravel) reasons.push('impossible travel');
  if (threatFlags.length) reasons.push(`threat flags: ${threatFlags.slice(0, 2).join(', ')}`);

  if (!reasons.length) reasons.push('normal pattern envelope');
  reasons.push(`policy action: ${decision.toUpperCase()}`);
  return reasons;
}

export function simulatePolicy(transactions, policy) {
  const items = Array.isArray(transactions) ? transactions : [];
  const impacted = [];

  for (const tx of items) {
    const risk = Number(tx?.securityChecks?.overallRiskScore || 0);
    const cleanHistory = computeCleanHistory(tx).clean;

    let decision = 'allow';
    if (risk >= policy.highThreshold) decision = 'block';
    else if (risk >= policy.mediumThreshold) decision = 'monitor';

    if (policy.precisionFirst && risk >= policy.mediumThreshold && risk < policy.highThreshold && cleanHistory) {
      decision = 'monitor';
    }

    if (policy.strictNewDevice && tx?.sessionData?.isNewDevice && decision === 'allow') {
      decision = 'monitor';
    }

    const current = String(tx?.status || '').toLowerCase();
    const mappedCurrent = current === 'blocked' ? 'block' : current === 'flagged' ? 'monitor' : 'allow';

    if (decision !== mappedCurrent) {
      impacted.push({
        tx,
        current: mappedCurrent,
        proposed: decision,
        reasons: explainDecision(tx, decision, policy),
      });
    }
  }

  const affectedUsersMap = new Map();
  for (const row of impacted) {
    const uid = String(row.tx?.userId?._id || row.tx?.userId || 'unknown');
    const name = row.tx?.userId?.name || 'Unknown User';
    const email = row.tx?.userId?.email || '-';
    if (!affectedUsersMap.has(uid)) {
      affectedUsersMap.set(uid, { uid, name, email, count: 0, topReasons: new Set() });
    }
    const cur = affectedUsersMap.get(uid);
    cur.count += 1;
    row.reasons.slice(0, 2).forEach((r) => cur.topReasons.add(r));
  }

  const affectedUsers = Array.from(affectedUsersMap.values()).map((u) => ({
    ...u,
    topReasons: Array.from(u.topReasons),
  })).sort((a, b) => b.count - a.count);

  return {
    impacted,
    affectedUsers,
    summary: {
      total: items.length,
      changed: impacted.length,
      changedUsers: affectedUsers.length,
      blockCount: impacted.filter((i) => i.proposed === 'block').length,
      monitorCount: impacted.filter((i) => i.proposed === 'monitor').length,
      allowCount: impacted.filter((i) => i.proposed === 'allow').length,
    },
  };
}
