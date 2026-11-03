export class NotFoundError extends Error {
  constructor(message = "Monitoramento não encontrado.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function assertCanAccessMonitor(userId: string, monitor: { userId: string }): void {
  if (monitor.userId !== userId) throw new NotFoundError();
}
