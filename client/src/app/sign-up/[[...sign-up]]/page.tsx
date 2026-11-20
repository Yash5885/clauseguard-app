import {SignUp} from '@clerk/nextjs';
import {AuthPage} from '@/components/AuthPage';
export default function Page(){return <AuthPage>{process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?<SignUp/>:null}</AuthPage>;}
