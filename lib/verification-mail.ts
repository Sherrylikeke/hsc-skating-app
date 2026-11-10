export type VerificationDelivery={enabled:boolean;registrationEnabled?:boolean;send?:(email:string,url:string)=>Promise<void>;sendReset?:(email:string,url:string)=>Promise<void>};
export type MailEnvironment={HSC_EMAIL_VERIFICATION_ENABLED?:string;HSC_PUBLIC_REGISTRATION_ENABLED?:string;HSC_EMAIL_VERIFICATION_GRACE_USERS?:string;RESEND_API_KEY?:string;HSC_EMAIL_FROM?:string};
export function verificationDelivery(runtime:MailEnvironment):VerificationDelivery {
  if(runtime.HSC_EMAIL_VERIFICATION_ENABLED!=='true'||!runtime.RESEND_API_KEY||!runtime.HSC_EMAIL_FROM)return {enabled:false};
  async function deliver(email:string,url:string,reset=false){
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:'Bearer '+runtime.RESEND_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({from:runtime.HSC_EMAIL_FROM,to:[email],subject:reset?'Reset your HSC password / 重设 HSC 密码':'Verify your HSC email / 验证 HSC 邮箱',text:(reset?'Reset your password using the link below. This link expires in one hour and can only be used once. If you did not request this, ignore this email.\n请使用下方链接重设密码，链接一小时后过期且只能使用一次。如非本人申请，请忽略。\n\n':'Verify your email using the link below. This link expires in one hour. If you did not request this, ignore this email.\n请使用下方链接验证邮箱，链接一小时后过期。如非本人申请，请忽略。\n\n')+url}),
      signal:AbortSignal.timeout(15000),
    });
    if(!response.ok)throw new Error('Verification email could not be sent. Please retry later.');
  }
  return {enabled:true,registrationEnabled:runtime.HSC_PUBLIC_REGISTRATION_ENABLED==='true',send:(email,url)=>deliver(email,url),sendReset:(email,url)=>deliver(email,url,true)};
}
