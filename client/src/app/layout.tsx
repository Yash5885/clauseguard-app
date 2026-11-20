import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import styles from '@/components/app.module.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'ClauseGuard | Contract clarity',
  description: 'Understand contract risk, one clause at a time.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = (
    <html lang="en">
      <body>
        <div className={styles.app}>
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          {children}
        </div>
      </body>
    </html>
  );
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
    <ClerkProvider signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      {content}
    </ClerkProvider>
  ) : (
    content
  );
}
