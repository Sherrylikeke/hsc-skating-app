import {passwordAuth} from '../../../../lib/member-runtime';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  const auth = passwordAuth(request);
  if (!auth) return Response.json({error:{message:'Password registration is not configured yet. Please contact the club administrator.'}},{status:503});
  return auth.handler(request);
}
export const GET = handle;
export const POST = handle;
