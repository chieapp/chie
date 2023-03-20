// Helper to hint garbage collection.
let gcTimer = null;
export function request(immediate = false) {
  if (!gc)
    return;
  if (gcTimer)
    clearTimeout(gcTimer);
  if (!immediate) {
    // gc after action can cause lagging.
    gcTimer = setTimeout(gc.bind(null, true), 5 * 1000);
    return;
  }
  gc();
}

// Run gc every 5 minutes.
if (gc)
  setInterval(gc.bind(null), 5 * 60 * 1000);
