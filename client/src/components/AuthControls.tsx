'use client';
import Link from 'next/link';
import {SignedIn,SignedOut,UserButton} from '@clerk/nextjs';
export function AuthControls(){return <><SignedOut><Link href="/sign-in" className="text-link">Sign in</Link><Link href="/sign-up" className="button small">Get started</Link></SignedOut><SignedIn><Link href="/dashboard" className="button small">Open workspace</Link><UserButton/></SignedIn></>;}
