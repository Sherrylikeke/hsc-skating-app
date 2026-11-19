import {notFound} from 'next/navigation';
import {portalPage} from '../../../lib/portal-content';
import PortalApp from '../portal-app';
import '../portal.css';
export const dynamic='force-dynamic';
export default async function PortalPage({params}:{params:Promise<{path?:string[]}>}){
 const {path=[]}=await params;const route='/'+path.join('/')+(path.length&&!path.at(-1)?.includes('.')?'/':'');
 if(!portalPage(route)&&!['/cart/','/admin/'].includes(route))notFound();
 return <PortalApp initialPath={route}/>;
}
