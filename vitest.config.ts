import { defineConfig } from 'vitest/config';

// Core tests run in two DST-observing zones, one behind UTC and one ahead of it.
// A local-time bug in date math only shows up ahead of UTC (local midnight falls
// on the previous UTC day), so New York alone would miss it.
const TIMEZONES = ['America/New_York', 'Australia/Sydney'];

export default defineConfig({
  test: {
    projects: [
      ...TIMEZONES.map((tz) => ({
        extends: true,
        test: {
          name: tz,
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/bundle.test.ts'],
          env: { TZ: tz },
        },
      })),
      { extends: true, test: { name: 'bundle', include: ['tests/bundle.test.ts'] } },
    ],
  },
});
