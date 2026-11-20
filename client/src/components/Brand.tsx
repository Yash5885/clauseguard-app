import Link from 'next/link';
import {ShieldCheck} from 'lucide-react';
export function Brand(){return <Link className="brand" href="/" aria-label="ClauseGuard home"><span className="brand-icon"><ShieldCheck size={23} strokeWidth={1.8}/></span>Clause<span className="brand-light">Guard</span></Link>;}
