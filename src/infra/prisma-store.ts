import { Prisma, type PrismaClient } from "@prisma/client";
import { isoFromUtcDate, utcDate } from "../domain/dates";
import type { ProviderOffer } from "../domain/provider";
import type {
  ObservationDraft,
  ObservationRecord,
  ProviderRequestDraft,
  RoundStore,
  RouteStatDraft,
  RunRecord,
  RunSlot,
  SearchDefinitionRecord,
} from "../domain/store";

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function asOffers(value: Prisma.JsonValue | null): ProviderOffer[] | null {
  if (!Array.isArray(value)) return null;
  return value as ProviderOffer[];
}

function mapRun(row: {
  id: string;
  monitorId: string | null;
  userId: string | null;
  scheduledFor: Date | null;
  filtersVersion: number | null;
  requestKey: string | null;
  status: RunRecord["status"];
  combinationsPlanned: number;
  combinationsQueried: number;
  combinationsSkipped: number;
  partial: boolean;
  datesPassed: boolean;
  hadProviderFailure: boolean;
  stoppedByBudget: boolean;
  nextCursor: number;
  offerCount: number;
  startedAt: Date;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempt: number;
}): RunRecord {
  return {
    ...row,
    scheduledFor: row.scheduledFor ? row.scheduledFor.toISOString() : null,
  };
}

export function createPrismaStore(prisma: PrismaClient): RoundStore {
  return {
    async findRunBySlot(slot: RunSlot) {
      if (slot.monitorId && slot.scheduledFor) {
        const row = await prisma.searchRun.findFirst({
          where: {
            monitorId: slot.monitorId,
            scheduledFor: new Date(slot.scheduledFor),
            filtersVersion: slot.filtersVersion,
          },
        });
        return row ? mapRun(row) : null;
      }
      if (!slot.requestKey) return null;
      const row = await prisma.searchRun.findUnique({ where: { requestKey: slot.requestKey } });
      return row ? mapRun(row) : null;
    },

    async createRun(run) {
      const row = await prisma.searchRun.create({
        data: {
          monitorId: run.monitorId,
          userId: run.userId,
          scheduledFor: run.scheduledFor ? new Date(run.scheduledFor) : null,
          filtersVersion: run.filtersVersion,
          requestKey: run.requestKey,
          status: run.status,
          combinationsPlanned: run.combinationsPlanned,
          combinationsQueried: run.combinationsQueried,
          combinationsSkipped: run.combinationsSkipped,
          partial: run.partial,
          datesPassed: run.datesPassed,
          hadProviderFailure: run.hadProviderFailure,
          stoppedByBudget: run.stoppedByBudget,
          nextCursor: run.nextCursor,
          offerCount: run.offerCount,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          errorCode: run.errorCode,
          errorMessage: run.errorMessage,
          attempt: run.attempt,
        },
      });
      return mapRun(row);
    },

    async updateRun(id, patch) {
      await prisma.searchRun.update({
        where: { id },
        data: {
          status: patch.status,
          combinationsPlanned: patch.combinationsPlanned,
          combinationsQueried: patch.combinationsQueried,
          combinationsSkipped: patch.combinationsSkipped,
          partial: patch.partial,
          datesPassed: patch.datesPassed,
          hadProviderFailure: patch.hadProviderFailure,
          stoppedByBudget: patch.stoppedByBudget,
          nextCursor: patch.nextCursor,
          offerCount: patch.offerCount,
          finishedAt: patch.finishedAt,
          errorCode: patch.errorCode,
          errorMessage: patch.errorMessage,
          attempt: patch.attempt,
          scheduledFor: patch.scheduledFor ? new Date(patch.scheduledFor) : undefined,
        },
      });
    },

    async upsertSearchDefinition(definition): Promise<SearchDefinitionRecord> {
      const data = {
        key: definition.key,
        provider: definition.provider,
        providerVersion: definition.providerVersion,
        origin: definition.origin,
        destination: definition.destination,
        departDate: utcDate(definition.departDate),
        returnDate: utcDate(definition.returnDate),
        adults: definition.adults,
        childAges: definition.childAges,
        cabin: definition.cabin,
        checkedBags: definition.checkedBags,
        currency: definition.currency,
        market: definition.market,
        maxStops: definition.maxStops,
        maxDurationMinutes: definition.maxDurationMinutes,
      };
      const row = await prisma.searchDefinition.upsert({
        where: { key: definition.key },
        create: data,
        update: {},
      });
      return {
        id: row.id,
        key: row.key,
        provider: row.provider,
        providerVersion: row.providerVersion,
        origin: row.origin,
        destination: row.destination,
        departDate: isoFromUtcDate(row.departDate),
        returnDate: isoFromUtcDate(row.returnDate),
        adults: row.adults,
        childAges: row.childAges,
        cabin: row.cabin,
        checkedBags: row.checkedBags,
        currency: row.currency,
        market: row.market,
        maxStops: row.maxStops,
        maxDurationMinutes: row.maxDurationMinutes,
      };
    },

    async linkMonitorSearch(monitorId, searchDefinitionId, filtersVersion) {
      await prisma.monitorSearch.upsert({
        where: {
          monitorId_searchDefinitionId_filtersVersion: { monitorId, searchDefinitionId, filtersVersion },
        },
        create: { monitorId, searchDefinitionId, filtersVersion },
        update: {},
      });
    },

    async recordProviderRequest(request: ProviderRequestDraft) {
      await prisma.providerRequest.create({
        data: {
          searchRunId: request.searchRunId,
          searchDefinitionId: request.searchDefinitionId,
          userId: request.userId,
          monitorId: request.monitorId,
          provider: request.provider,
          definitionKey: request.definitionKey,
          attempt: request.attempt,
          latencyMs: request.latencyMs,
          cacheHit: request.cacheHit,
          charged: request.charged,
          costMinor: request.costMinor,
          costCurrency: request.costCurrency,
          status: request.status,
          errorCode: request.errorCode,
          offersJson: request.offersJson === null ? Prisma.JsonNull : (request.offersJson as unknown as Prisma.InputJsonValue),
          createdAt: request.createdAt,
        },
      });
    },

    async findCache(definitionKey, provider, now, ttlMs) {
      const rows = await prisma.providerRequest.findMany({
        where: {
          definitionKey,
          provider,
          status: "ok",
          cacheHit: false,
          createdAt: { gte: new Date(now.getTime() - ttlMs) },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      const row = rows.find((item) => asOffers(item.offersJson));
      const offers = row ? asOffers(row.offersJson) : null;
      if (!row || !offers) return null;
      return { collectedAt: row.createdAt, offers };
    },

    async insertObservation(observation: ObservationDraft): Promise<{ inserted: boolean; observation: ObservationRecord }> {
      const itineraryId = await ensureItinerary(prisma, observation);
      try {
        const row = await prisma.priceObservation.create({
          data: {
            dedupKey: observation.dedupKey,
            collectedAt: observation.collectedAt,
            sourceCollectedAt: observation.sourceCollectedAt,
            provider: observation.provider,
            providerVersion: observation.providerVersion,
            priceKind: observation.priceKind,
            searchDefinitionId: observation.searchDefinitionId,
            searchRunId: observation.searchRunId,
            monitorId: observation.monitorId,
            filtersVersion: observation.filtersVersion,
            userId: observation.userId,
            origin: observation.origin,
            destination: observation.destination,
            departDate: utcDate(observation.departDate),
            returnDate: utcDate(observation.returnDate),
            itineraryId,
            stops: observation.stops,
            adults: observation.adults,
            childAges: observation.childAges,
            cabin: observation.cabin,
            baggageKnown: observation.baggageKnown,
            baggageIncluded: observation.baggageIncluded,
            checkedBags: observation.checkedBags,
            totalAmountMinor: observation.totalAmountMinor,
            currency: observation.currency,
            market: observation.market,
            offerExpiresAt: observation.offerExpiresAt,
            providerOfferId: observation.providerOfferId,
            providerLink: observation.providerLink,
            fromCache: observation.fromCache,
          },
        });
        return { inserted: true, observation: { ...observation, id: row.id } };
      } catch (error) {
        if (!isUnique(error)) throw error;
        const existing = await prisma.priceObservation.findUniqueOrThrow({ where: { dedupKey: observation.dedupKey } });
        return { inserted: false, observation: { ...observation, id: existing.id } };
      }
    },

    async insertNotification(notification) {
      try {
        await prisma.notification.create({ data: notification });
        return { inserted: true };
      } catch (error) {
        if (!isUnique(error)) throw error;
        return { inserted: false };
      }
    },

    async upsertRouteDailyStat(stat: RouteStatDraft) {
      const identity = {
        statDate: utcDate(stat.statDate),
        origin: stat.origin,
        destination: stat.destination,
        cabin: stat.cabin,
        currency: stat.currency,
        baggageSignature: stat.baggageSignature,
        passengerSignature: stat.passengerSignature,
        priceKind: stat.priceKind,
      };
      const existing = await prisma.routeDailyStat.findFirst({ where: identity });
      if (!existing) {
        try {
          await prisma.routeDailyStat.create({
            data: {
              ...identity,
              minAmountMinor: stat.amountMinor,
              sampleCount: 1,
              departureDates: [stat.departDate],
            },
          });
          return;
        } catch (error) {
          if (!isUnique(error)) throw error;
        }
      }
      const current = existing ?? (await prisma.routeDailyStat.findFirst({ where: identity }));
      if (!current) return;
      const departureDates = current.departureDates.includes(stat.departDate)
        ? current.departureDates
        : [...current.departureDates, stat.departDate];
      await prisma.routeDailyStat.update({
        where: { id: current.id },
        data: {
          minAmountMinor: Math.min(current.minAmountMinor, stat.amountMinor),
          sampleCount: current.sampleCount + 1,
          departureDates,
        },
      });
    },
  };
}

async function ensureItinerary(prisma: PrismaClient, observation: ObservationDraft): Promise<string> {
  const existing = await prisma.itinerary.findUnique({ where: { key: observation.itineraryKey } });
  if (existing) return existing.id;
  try {
    const created = await prisma.itinerary.create({
      data: {
        key: observation.itineraryKey,
        stops: observation.stops,
        durationMinutes: observation.durationMinutes,
        segments: {
          create: observation.segments.map((segment, index) => ({
            sequence: index,
            origin: segment.origin,
            destination: segment.destination,
            airline: segment.airline,
            airlineName: segment.airlineName,
            flightNumber: segment.flightNumber,
            departLocal: segment.departLocal,
            arriveLocal: segment.arriveLocal,
          })),
        },
      },
    });
    return created.id;
  } catch (error) {
    if (!isUnique(error)) throw error;
    const again = await prisma.itinerary.findUniqueOrThrow({ where: { key: observation.itineraryKey } });
    return again.id;
  }
}
