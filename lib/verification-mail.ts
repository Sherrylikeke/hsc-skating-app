export type VerificationDelivery={enabled:boolean;send?:(email:string,url:string)=>Promise<void>};
export type MailEnvironment={HSC_EMAIL_VERIFICATION_ENABLED?:string;RESEND_API_KEY?:string;HSC_EMAIL_FROM?:string};
export function verificationDelivery(runtime:MailEnvironment):VerificationDelivery {
  if(runtime.HSC_EMAIL_VERIFICATION_ENABLED!=='true'||!runtime.RESEND_API_KEY||!runtime.HSC_EMAIL_FROM)return {enabled:false};
  return {enabled:true,async send(email,url){
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:'Bearer '+runtime.RESEND_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({from:runtime.HSC_EMAIL_FROM,to:[email],subject:'Verify your HSC email / 验证 HSC 邮箱',text:'Verify your email using the link below. This link expires in one hour. If you did not request this, ignore this email.\n请使用下方链接验证邮箱，链接一小时后过期。如非本人申请，请忽略。\n\n'+url}),
      signal:AbortSignal.timeout(15000),
    });
    if(!response.ok)throw new Error('Verification email could not be sent. Please retry later.');
  }};
}
