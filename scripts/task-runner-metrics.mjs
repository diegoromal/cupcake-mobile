function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}

// Keep the runner's historical denominator and percentile rules in one place.
export function calculateMetrics(history) {
  const count = history.length;
  const cycles = history.map((entry) => entry.cycle_minutes);
  return {
    count,
    cycle_mean: count ? cycles.reduce((sum, value) => sum + value, 0) / count : null,
    cycle_median: percentile(cycles, 0.5),
    cycle_p75: percentile(cycles, 0.75),
    active_mean: count ? history.reduce((sum, row) => sum + row.active_minutes, 0) / count : null,
    first_pass_rate: count ? 100 * history.filter((row) => row.first_pass).length / count : null,
    fix_loops_mean: count ? history.reduce((sum, row) => sum + row.fix_loops, 0) / count : null,
    insufficient_sample: count > 0 && count < 10,
  };
}
