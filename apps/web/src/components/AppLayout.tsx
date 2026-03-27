import type { ReactNode } from "react";

type AppLayoutProps = {
  title: string;
  subtitle?: string;
  statusText?: string;
  statusClass?: string;
  footerLeft?: string;
  footerRight?: string;
  children: ReactNode;
};

export default function AppLayout({
  title,
  subtitle,
  statusText,
  statusClass = "app-status app-status--live",
  footerLeft,
  footerRight,
  children,
}: AppLayoutProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div>
            <div className="app-title">{title}</div>
            {subtitle && <div className="app-subtitle">{subtitle}</div>}
          </div>

          {statusText && <div className={statusClass}>{statusText}</div>}
        </div>
      </header>

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        <div className="app-footer__inner">
          <div>{footerLeft ?? title}</div>
          <div>{footerRight ?? ""}</div>
        </div>
      </footer>
    </div>
  );
}