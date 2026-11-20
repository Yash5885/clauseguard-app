'use client';
import Link from 'next/link';
import { Show, UserButton } from '@clerk/nextjs';
export function AuthControls() {
  return (
    <>
      <Show when="signed-out">
        <Link href="/sign-in" className="text-link">
          Sign in
        </Link>
        <Link href="/sign-up" className="button small">
          Get started
        </Link>
      </Show>
      <Show when="signed-in">
        <Link href="/dashboard" className="button small">
          Open workspace
        </Link>
        <UserButton />
      </Show>
    </>
  );
}
