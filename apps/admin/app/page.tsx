import { cookies } from 'next/headers';import { redirect } from 'next/navigation';
export default async function Home(){const jar=await cookies();redirect(jar.has('admin_access')||jar.has('admin_refresh')?'/produtos':'/login');}
