'use client';
import Link from 'next/link';
export default function ErrorBoundary({reset}:{error:Error;reset:()=>void}){return <main id="main-content" className="state-panel"><h1>Something went wrong.</h1><p>Your workspace couldn’t load. Please try again.</p><button className="button" onClick={reset}>Try again</button><Link className="text-link" href="/dashboard">Return to workspace</Link></main>;}
