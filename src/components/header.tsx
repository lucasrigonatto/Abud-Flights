"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "../app/actions";

const links = [
  { href: "/", label: "Início", exact: true },
  { href: "/busca", label: "Busca", exact: false },
  { href: "/monitoramentos", label: "Monitoramentos", exact: false },
  { href: "/alertas", label: "Alertas", exact: false },
  { href: "/consumo", label: "Consumo", exact: false },
  { href: "/configuracoes", label: "Configurações", exact: false },
];

export function Header({ userName, unread }: { userName: string | null; unread: number }) {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">AF</span>
          <span>Abud Flights</span>
        </Link>
        {userName ? (
          <nav className="nav">
            {links.map((link) => (
              <Link key={link.href} href={link.href} aria-current={(link.exact ? pathname === link.href : pathname.startsWith(link.href)) ? "page" : undefined}>
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
