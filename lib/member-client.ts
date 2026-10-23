export class MemberAPIError extends Error {
  readonly status:number;
  constructor(status:number,message:string){super(message);this.name='MemberAPIError';this.status=status;}
}

export function activeMemberRole(member:{role?:string|null;status:string}|null,role:string){return member?.status==='active'&&member.role===role;}

export async function readMemberResponse<Result>(response:Response,fallback:string):Promise<Result>{
  if(!response.headers.get('content-type')?.includes('application/json'))throw new MemberAPIError(502,fallback);
  let value:Result&{error?:string};
  try{value=await response.json();}catch{throw new MemberAPIError(502,fallback);}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new MemberAPIError(502,fallback);
  if(!response.ok)throw new MemberAPIError(response.status,typeof value.error==='string'?value.error:fallback);
  return value;
}

export async function recoverMemberSession<Result>(load:()=>Promise<Result>,restore:()=>Promise<unknown>,allowed:boolean):Promise<Result>{
  try{return await load();}catch(failure){
    if(!allowed||!(failure instanceof MemberAPIError)||failure.status!==401)throw failure;
    await restore();
    return await load();
  }
}
