'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { LayoutDashboard, BookOpen, ShieldCheck, ExternalLink, PanelLeftClose } from 'lucide-react';
import { Brand } from './Brand';
export function Workspace({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Brand />
        <span className="workspace-label">YOUR WORKSPACE</span>
        <nav aria-label="Workspace">
          <Link
            className={path === '/dashboard' ? 'nav-item active' : 'nav-item'}
            href="/dashboard"
          >
            <LayoutDashboard size={18} />
            Overview
          </Link>
          <Link className="nav-item" href="/dashboard#history">
            <BookOpen size={18} />
            Analysis history
          </Link>
        </nav>
        <div className="sidebar-note">
          <span className="tiny-icon">
            <ShieldCheck size={20} />
          </span>
          <h3>A clearer way to sign.</h3>
          <p>Every clause deserves a closer look. Make your next review a more informed one.</p>
          <Link href="/#how-it-works">
            How ClauseGuard works
            <ExternalLink size={13} />
          </Link>
        </div>
        <div className="sidebar-footer">
          <span className="wordmark-dot" />
          Contract clarity, by design.
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <span className="breadcrumb">
            <PanelLeftClose size={18} />
            <Link href="/dashboard">Workspace</Link>
            <span>/</span>
            {path === '/dashboard' ? 'Overview' : 'Analysis report'}
          </span>
          <div className="header-account">
            <span className="muted micro">Your private workspace</span>
            <UserButton />
          </div>
        </header>
        <main className="workspace-main">{children}</main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} ClauseGuard</span>
          <span>Informational only. Not legal advice.</span>
        </footer>
      </div>
    </div>
  );
}
