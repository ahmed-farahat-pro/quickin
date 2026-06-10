
import { performance } from 'perf_hooks';

// Mock adjustment type
interface Adjustment {
  applies_to_days: string[];
}

const weekendDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function currentImplementation(adjustments: Adjustment[]) {
  const weekendAdjustedDates: Date[] = [];
  const today = new Date();
  // Fixed start date for consistency in benchmark
  today.setFullYear(2024, 0, 1);
  today.setHours(0, 0, 0, 0);

  for (const adj of adjustments || []) {
    // Check applies_to_days for recurring day-based adjustments (weekends)
    if (adj.applies_to_days && adj.applies_to_days.length > 0) {
      for (let i = 0; i < 180; i++) { // Next 6 months
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const dayName = weekendDays[date.getDay()].toLowerCase();
        if (adj.applies_to_days.includes(dayName)) {
          // Check if not already in the array
          if (!weekendAdjustedDates.some(d => d.toDateString() === date.toDateString())) {
            weekendAdjustedDates.push(date);
          }
        }
      }
    }
  }
  return weekendAdjustedDates;
}

function optimizedImplementation(adjustments: Adjustment[]) {
  const weekendAdjustedDates: Date[] = [];
  const today = new Date();
  // Fixed start date for consistency
  today.setFullYear(2024, 0, 1);
  today.setHours(0, 0, 0, 0);

  // 1. Collect all applicable days into a Set for O(1) lookup
  const applicableDays = new Set<string>();
  for (const adj of adjustments || []) {
    if (adj.applies_to_days && adj.applies_to_days.length > 0) {
      for (const day of adj.applies_to_days) {
        applicableDays.add(day.toLowerCase());
      }
    }
  }

  // 2. Iterate the 180 days only ONCE
  if (applicableDays.size > 0) {
    for (let i = 0; i < 180; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayName = weekendDays[date.getDay()].toLowerCase();

      if (applicableDays.has(dayName)) {
        weekendAdjustedDates.push(date);
      }
    }
  }

  return weekendAdjustedDates;
}

// Generate test data
const adjustments: Adjustment[] = [];
// Simulate 50 adjustments, some overlapping
for (let i = 0; i < 50; i++) {
  adjustments.push({ applies_to_days: ['friday', 'saturday'] });
  adjustments.push({ applies_to_days: ['sunday'] });
  adjustments.push({ applies_to_days: ['monday', 'tuesday'] });
}

console.log(`Benchmarking with ${adjustments.length} adjustments...`);

// Warmup
currentImplementation(adjustments.slice(0, 5));
optimizedImplementation(adjustments.slice(0, 5));

// Measure Current
const startCurrent = performance.now();
const resultCurrent = currentImplementation(adjustments);
const endCurrent = performance.now();
const timeCurrent = endCurrent - startCurrent;

// Measure Optimized
const startOptimized = performance.now();
const resultOptimized = optimizedImplementation(adjustments);
const endOptimized = performance.now();
const timeOptimized = endOptimized - startOptimized;

console.log(`Current Implementation: ${timeCurrent.toFixed(4)} ms`);
console.log(`Optimized Implementation: ${timeOptimized.toFixed(4)} ms`);
console.log(`Improvement: ${(timeCurrent / timeOptimized).toFixed(2)}x faster`);

// Verify Correctness
const datesCurrent = resultCurrent.map(d => d.toISOString().split('T')[0]).sort();
const datesOptimized = resultOptimized.map(d => d.toISOString().split('T')[0]).sort();

if (JSON.stringify(datesCurrent) === JSON.stringify(datesOptimized)) {
  console.log('✅ Correctness Verified: Output matches');
} else {
  console.error('❌ Correctness Failed: Outputs differ');
  console.log('Current count:', resultCurrent.length);
  console.log('Optimized count:', resultOptimized.length);
}
