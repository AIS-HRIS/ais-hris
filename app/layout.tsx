import type { Metadata, Viewport } from 'next';
import './globals.css';
import './redesign.css';
import './experience.css';
export const metadata: Metadata = { title:'AIS People | HRIS & Operations', description:'Satu workspace untuk karyawan, tim, dan operasional AIS.', manifest:'/manifest.webmanifest', appleWebApp:{capable:true,title:'AIS People',statusBarStyle:'default'},icons:{icon:'/favicon.svg',apple:'/icons/icon-192.png'} };
export const viewport: Viewport = { width:'device-width',initialScale:1,themeColor:'#DD7A0F' };
export default function RootLayout({children}:{children:React.ReactNode}){ return <html lang="id"><body>{children}</body></html>; }
