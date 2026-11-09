import {text,translate} from '../lib/i18n';

export type AuthProblem={code?:string;message?:string;error?:{message?:string}};

export function authProblem(status:number,result:AuthProblem){
  if(status===429)return 'RATE_LIMITED';
  if(result.code==='MAIL_DISABLED'||result.message?.includes('mail service setup')||result.message?.startsWith('Email service setup'))return 'MAIL_DISABLED';
  if(result.code==='MAIL_UNAVAILABLE')return 'MAIL_UNAVAILABLE';
  if(result.code==='ACCOUNT_ALREADY_EXISTS'||result.message?.startsWith('An account already uses this email.'))return 'ACCOUNT_ALREADY_EXISTS';
  if(status>=500)return 'UNAVAILABLE';
  if(['INVALID_USERNAME_OR_PASSWORD','INVALID_EMAIL_OR_PASSWORD'].includes(result.code||''))return 'BAD_CREDENTIALS';
  if(result.code==='USERNAME_IS_ALREADY_TAKEN')return 'USERNAME_TAKEN';
  return result.message||result.error?.message||'UNAVAILABLE';
}

export function authFeedback(problem:string){
  switch(problem){
    case 'RATE_LIMITED':return text('Too many attempts. Please try again later.','尝试次数过多，请稍后重试。');
    case 'MAIL_DISABLED':return text('Email delivery is not available yet. Please contact the club if you need help accessing your account.','邮件服务尚未开放。如需协助登录，请联系俱乐部。');
    case 'MAIL_UNAVAILABLE':return text('The verification email could not be sent. Please retry in a minute.','验证邮件暂未发出，请在一分钟后重试。');
    case 'UNAVAILABLE':return text('The service could not be reached. Please try again.','暂时无法连接服务，请重试。');
    case 'PASSWORD_MISMATCH':return text('The passwords do not match.','两次输入的密码不一致。');
    case 'ACCOUNT_ALREADY_EXISTS':return text('This email already has an account. Sign in, or request a verification link if you still need one.','此邮箱已有账号。请登录；如果尚未完成验证，可以申请新的验证链接。');
    case 'BAD_CREDENTIALS':
    case 'Invalid username or password':
    case 'Invalid email or password':return text('The email or username and password do not match.','邮箱或用户名与密码不匹配。');
    case 'USERNAME_TAKEN':
    case 'Username is already taken. Please try another.':return text('This username is taken. Please choose another.','此用户名已被使用，请更换。');
    default:return translate(problem);
  }
}
