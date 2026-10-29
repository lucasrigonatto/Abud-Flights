export const LIMITS = {
  maxActiveMonitorsPerUser: 5,
  maxAirportsPerSide: 3,
  allowedFlexDays: [0, 1, 3] as const,
  maxCombinationsPerRound: 8,
  maxMonitorDays: 180,
  maxAdults: 6,
  maxChildren: 4,
  dailyProviderBudgetMinor: 5_000,
  monthlyProjectCapMinor: 20_000,
  costPerSearchMinor: 25,
  intervalHours: 12,
  providerRetryAttempts: 3,
  roundRetryAttempts: 4,
  cacheTtlMs: 30 * 60 * 1000,
  lockTimeoutMs: 10 * 60 * 1000,
};

export type AllowedFlex = (typeof LIMITS.allowedFlexDays)[number];
