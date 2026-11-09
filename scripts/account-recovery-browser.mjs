import assert from 'node:assert/strict';

// The password/platform identity can outlive the club session. Restore the
// original destination even when unrelated dashboard resources are unavailable.
export async function checkAccountRecovery(browser,profile,origin){
  const context=await browser.newContext({...profile,locale:'en-CA'});
  try{
    const member={id:'fixture-parent',name:'Fixture Parent',email:'parent@example.test',role:'parent',status:'active'};
    let restored=false,signedIn=true;
    const calls=[];
    await context.route('**/api/**',async route=>{
      const url=new URL(route.request().url());
      const action=url.pathname==='/api/member'?url.searchParams.get('action'):url.pathname;
      calls.push(action);
      if(action==='identity')return route.fulfill({json:{identity:signedIn?{name:member.name,email:member.email,provider:'password'}:null}});
      if(action==='/api/auth/config')return route.fulfill({json:{deliveryConfigured:false,registrationConfigured:false}});
      if(action==='/api/auth/sign-in/username'){
        signedIn=true;
        return route.fulfill({json:{user:{id:member.id}}});
      }
      if(action==='session'&&route.request().method()==='POST'){
        restored=true;
        return route.fulfill({json:{member}});
      }
      if(action==='me')return restored
        ?route.fulfill({json:{member,skaterIds:[],preferredSkaterIds:[],claims:[]}})
        :route.fulfill({status:401,json:{error:'Club session expired'}});
      return route.fulfill({status:503,json:{error:'Schedule unavailable'}});
    });
    const page=await context.newPage();
    await page.goto(origin+'/?tab=account',{waitUntil:'domcontentloaded'});
    await page.locator('.member-account-panel,.member-heading').first().waitFor();
    assert.equal(new URL(page.url()).search,'?tab=account','Restoring the club session must retain the requested account page');
    await page.locator('.member-account-panel').getByRole('button',{name:'Sign out',exact:true}).waitFor();
    assert.deepEqual(calls,['identity','me','session','me']);

    restored=false;
    calls.length=0;
    const target='view=events&event=fixture-final';
    await page.goto(origin+'/?'+new URLSearchParams({schedule:target}),{waitUntil:'domcontentloaded'});
    await page.waitForURL(origin+'/workspace?'+target);
    assert.deepEqual(calls.filter(action=>action!=='/api/club'),['identity','me','session','me']);

    signedIn=false;restored=false;calls.length=0;
    await page.goto(origin+'/?'+new URLSearchParams({schedule:target}),{waitUntil:'domcontentloaded'});
    await page.getByLabel('Email or username').fill('fixture.parent');
    await page.getByLabel('Password',{exact:true}).fill('fixture-member-password');
    await page.locator('#hsc-login form').first().getByRole('button',{name:'Sign in',exact:true}).click();
    await page.waitForURL(origin+'/workspace?'+target);
    assert.deepEqual(calls.filter(action=>!['/api/auth/config','/api/club'].includes(action)),['identity','/api/auth/sign-in/username','session']);
  }finally{await context.close();}
}
