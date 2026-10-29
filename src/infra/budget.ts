import { isoDateInTimeZone, saoPauloMonth } from "../domain/dates";
import { LIMITS } from "../domain/limits";
import { prisma } from "./prisma";

export async function providerBudgetRemaining(now: Date): Promise<number> {
  const month = saoPauloMonth(now);
  const dayStart = new Date(`${isoDateInTimeZone(now)}T00:00:00.000-03:00`);
  const [day, monthSpend] = await Promise.all([
    prisma.providerRequest.aggregate({
      where: { charged: true, createdAt: { gte: dayStart } },
      _sum: { costMinor: true },
    }),
    prisma.providerRequest.aggregate({
      where: { charged: true, createdAt: { gte: month.start } },
      _sum: { costMinor: true },
    }),
  ]);
  const dayRemaining = LIMITS.dailyProviderBudgetMinor - (day._sum.costMinor ?? 0);
  const monthRemaining = LIMITS.monthlyProjectCapMinor - (monthSpend._sum.costMinor ?? 0);
  return Math.max(0, Math.min(dayRemaining, monthRemaining));
}
