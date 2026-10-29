import { formatDateTime } from "../../domain/dates";
import { markAlertReadAction } from "../actions";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../infra/prisma";

export default async function AlertsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const inApp = notifications.filter((notification) => notification.channel === "IN_APP");
  const outbox = notifications.filter((notification) => notification.channel === "EMAIL");
  return (
    <div className="stack">
      <h1>Alertas</h1>
      <section className="stack">
        <h2>No site</h2>
        {inApp.length === 0 ? <p className="muted">Nenhum alerta no site.</p> : null}
        {inApp.map((notification) => (
          <article key={notification.id} className="card stack">
            <h3>{notification.title}</h3>
            <p>{notification.body}</p>
            <p className="muted">{formatDateTime(notification.createdAt)}</p>
            {notification.readAt ? (
              <p className="muted">Lido em {formatDateTime(notification.readAt)}</p>
            ) : (
              <form action={markAlertReadAction}>
                <input type="hidden" name="notificationId" value={notification.id} />
                <button className="btn btn-secondary" type="submit">
                  Marcar como lido
                </button>
              </form>
            )}
          </article>
        ))}
      </section>
      <section className="stack">
        <h2>Caixa de saída de e-mail</h2>
        <p className="muted">Não há servidor de e-mail. O alerta fica registrado aqui, sem ser enviado.</p>
        {outbox.length === 0 ? <p className="muted">Nenhum e-mail registrado.</p> : null}
        {outbox.map((notification) => (
          <article key={notification.id} className="card stack">
            <h3>{notification.title}</h3>
            <p>{notification.body}</p>
            <p className="muted">Registrado em {formatDateTime(notification.createdAt)} · status {notification.status === "RECORDED" ? "na caixa de saída" : notification.status}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
