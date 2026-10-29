import type { Metadata } from "next";
import { Header } from "../components/header";
import { getSessionUser } from "../lib/auth";
import { prisma } from "../infra/prisma";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abud Flights",
  description: "Pesquisa e monitoramento de preços de passagens com um provedor simulado.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const unread = user
    ? await prisma.notification.count({ where: { userId: user.id, channel: "IN_APP", readAt: null } })
    : 0;
  return (
    <html lang="pt-BR">
      <body>
        <Header userName={user?.name ?? null} unread={unread} />
        <main className="shell">{children}</main>
        <footer className="site-footer">
          <p>
            Abud Flights mostra preços de demonstração enquanto não há um fornecedor autorizado. O monitoramento roda no servidor a cada 12 horas e pode perder promoções mais curtas.
          </p>
        </footer>
      </body>
    </html>
  );
}
