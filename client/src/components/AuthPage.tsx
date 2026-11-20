import Link from 'next/link';
import { Brand } from './Brand';
export function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="auth-page">
      <Brand />
      <div className="auth-intro">
        <span className="eyebrow">YOUR NEXT SIGNATURE, BETTER INFORMED</span>
        <h1>
          A little clarity
          <br />
          goes a long way.
        </h1>
        <p>Your contracts. Your private workspace.</p>
      </div>
      {children || (
        <div className="auth-unavailable">
          <h2>Sign-in is currently unavailable.</h2>
          <p>Please contact your workspace administrator to enable access.</p>
          <Link href="/" className="button secondary">
            Back to home
          </Link>
        </div>
      )}
      <p className="muted micro">Informational analysis. Not legal advice.</p>
    </main>
  );
}
