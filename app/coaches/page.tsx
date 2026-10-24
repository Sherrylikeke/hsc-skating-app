import CoachEditor from '../coach-editor';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {requestMember} from '../../lib/member-runtime';
import {AccessError} from '../../lib/member-access';
import {productionOrigin} from '../../lib/password-auth';
export const dynamic='force-dynamic';
export default async function Coaches(){
  try{await requestMember(new Request(productionOrigin+'/coaches',{headers:await headers()}),['admin']);}
  catch(error){if(error instanceof AccessError&&(error.status===401||error.status===403))redirect('/');throw error;}
  return <CoachEditor/>;
}
