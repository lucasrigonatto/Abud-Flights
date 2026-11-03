import type { ProviderOffer } from "./provider";
import type {
  NotificationDraft,
  NotificationRecord,
  ObservationDraft,
  ObservationRecord,
  ProviderRequestDraft,
  RoundStore,
  RouteStatDraft,
  RunRecord,
  RunSlot,
  SearchDefinitionRecord,
} from "./store";

function matchesSlot(run: RunRecord, slot: RunSlot): boolean {
  if (slot.monitorId && slot.scheduledFor) {
    return (
      run.monitorId === slot.monitorId &&
      run.scheduledFor === slot.scheduledFor &&
      run.filtersVersion === slot.filtersVersion
    );
  }
  return Boolean(slot.requestKey) && run.requestKey === slot.requestKey;
}

export class MemoryStore implements RoundStore {
  runs: RunRecord[] = [];
  definitions: SearchDefinitionRecord[] = [];
  links = new Set<string>();
  requests: ProviderRequestDraft[] = [];
  observations: ObservationRecord[] = [];
  notifications: NotificationRecord[] = [];
  stats: RouteStatDraft[] = [];
  private sequence = 0;

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }

  async findRunBySlot(slot: RunSlot): Promise<RunRecord | null> {
    return this.runs.find((run) => matchesSlot(run, slot)) ?? null;
  }

  async createRun(run: Omit<RunRecord, "id">): Promise<RunRecord> {
    if (this.runs.some((existing) => matchesSlot(existing, run))) {
      throw new Error("Rodada já existe para este horário.");
    }
    const created = { ...run, id: this.nextId("run") };
    this.runs.push(created);
    return created;
  }

  async updateRun(id: string, patch: Partial<RunRecord>): Promise<void> {
    const run = this.runs.find((item) => item.id === id);
    if (!run) throw new Error("Rodada não encontrada.");
    Object.assign(run, patch);
  }

  async upsertSearchDefinition(definition: Omit<SearchDefinitionRecord, "id">): Promise<SearchDefinitionRecord> {
    const existing = this.definitions.find((item) => item.key === definition.key);
    if (existing) return existing;
    const created = { ...definition, childAges: [...definition.childAges], id: this.nextId("def") };
    this.definitions.push(created);
    return created;
  }

  async linkMonitorSearch(monitorId: string, searchDefinitionId: string, filtersVersion: number): Promise<void> {
    this.links.add(`${monitorId}:${searchDefinitionId}:${filtersVersion}`);
  }

  async recordProviderRequest(request: ProviderRequestDraft): Promise<void> {
    this.requests.push({
      ...request,
      offersJson: request.offersJson ? request.offersJson.map((offer) => structuredClone(offer)) : null,
    });
  }

  async findCache(
    definitionKey: string,
    provider: string,
    now: Date,
    ttlMs: number,
  ): Promise<{ collectedAt: Date; offers: ProviderOffer[] } | null> {
    const match = [...this.requests]
      .reverse()
      .find(
        (request) =>
          request.definitionKey === definitionKey &&
          request.provider === provider &&
          request.status === "ok" &&
          !request.cacheHit &&
          request.offersJson &&
          now.getTime() - request.createdAt.getTime() <= ttlMs,
      );
    if (!match?.offersJson) return null;
    return { collectedAt: match.createdAt, offers: structuredClone(match.offersJson) };
  }

  async insertObservation(observation: ObservationDraft): Promise<{ inserted: boolean; observation: ObservationRecord }> {
    const existing = this.observations.find((item) => item.dedupKey === observation.dedupKey);
    if (existing) return { inserted: false, observation: existing };
    const created = { ...observation, childAges: [...observation.childAges], id: this.nextId("obs") };
    this.observations.push(created);
    return { inserted: true, observation: created };
  }

  async insertNotification(notification: NotificationDraft): Promise<{ inserted: boolean }> {
    if (this.notifications.some((item) => item.dedupKey === notification.dedupKey)) return { inserted: false };
    this.notifications.push({
      ...notification,
      id: this.nextId("ntf"),
      createdAt: new Date(),
      readAt: null,
    });
    return { inserted: true };
  }

  async upsertRouteDailyStat(stat: RouteStatDraft): Promise<void> {
    const existing = this.stats.find(
      (item) =>
        item.statDate === stat.statDate &&
        item.origin === stat.origin &&
        item.destination === stat.destination &&
        item.cabin === stat.cabin &&
        item.currency === stat.currency &&
        item.baggageSignature === stat.baggageSignature &&
        item.passengerSignature === stat.passengerSignature &&
        item.priceKind === stat.priceKind,
    );
    if (!existing) {
      this.stats.push(stat);
      return;
    }
    existing.amountMinor = Math.min(existing.amountMinor, stat.amountMinor);
  }
}
