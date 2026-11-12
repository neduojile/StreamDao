export function getTaskCycle(now = new Date()) {
  const cycleStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const nextReset = new Date(cycleStart.getTime() + 24 * 60 * 60 * 1000);

  return { cycleStart, nextReset };
}