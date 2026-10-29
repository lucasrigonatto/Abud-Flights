"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "../app/actions";

const links = [
  { href: "/busca", label: "Busca" },
  { href: "/monitoramentos", label: "Monitoramentos" },
  { href: "/alertas", label: "Alertas" },
  { href: "/consumo", label: "Consumo" },
  { href: "/configuracoes", label: "Configurações" },
];

export function Header({ userName, unread }: { userName: string | null; unread: number }) {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href={userName ? "/monitoramentos" : "/"} className="brand">
          <span className="brand-mark">AF</span>
          <span>Abud Flights</span>
        </Link>
        {userName ? (
          <nav className="nav">
            {links.map((link) => (
              <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) ? "page" : undefined}>
                {link.label}
                {link.href === "/alertas" && unread > 0 ? <span className="count">{unread}</span> : null}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="header-account">
          {userName ? (
            <>
              <span className="muted">{userName}</span>
              <form action={logoutAction}>
                <button className="btn btn-secondary" type="submit">
                  Sair
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="btn btn-secondary" href="/entrar">
                Entrar
              </Link>
              <Link className="btn" href="/criar-conta">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
