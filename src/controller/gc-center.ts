let gcTimer = null;

// Run gc every 5 minutes.
if (global.gc)
  setInterval(collectGarbage.bind(null, true), 5 * 60 * 1000);

export function collectGarbage(immediate = false) {
  if (!global.gc)
    return;
  if (gcTimer)
    clearTimeout(gcTimer);
  if (!immediate) {  // gc after action can cause lagging
    gcTimer = setTimeout(collectGarbage.bind(null, true), 5 * 1000);
    return;
  }
  global.gc();
}
