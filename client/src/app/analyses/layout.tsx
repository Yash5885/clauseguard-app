import { Workspace } from '@/components/Workspace';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Analysis report | ClauseGuard',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect('/sign-in');
  return <Workspace>{children}</Workspace>;
}
