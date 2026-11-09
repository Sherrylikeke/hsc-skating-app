import assert from 'node:assert/strict';

// The Worker suite checks real delivery outcomes. This fixture checks what a
// phone user can see and operate for each outcome without sending any email.
export async function checkRegistrationFeedback(browser,profile,origin){
  const context=await browser.newContext({...profile,locale:'en-CA'});
  const email='registration@example.test';
  let outcome='requested',resends=0,mail='enabled';
  try{
    await context.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.pathname==='/api/member'&&url.searchParams.get('action')==='identity')return route.fulfill({json:{identity:null}});
      if(url.pathname==='/api/auth/config'){
        if(mail==='unavailable')return route.fulfill({status:503,json:{message:'Configuration unavailable'}});
        return route.fulfill({json:{deliveryConfigured:mail==='enabled',registrationConfigured:mail==='enabled'}});
      }
      if(url.pathname==='/api/auth/sign-up/email')return route.fulfill({json:{user:{email},token:null,registrationMode:'verification',verificationDelivery:outcome}});
      if(url.pathname==='/api/auth/send-verification-email'&&request.method()==='POST'){
        assert.equal(request.postDataJSON().email,email);
        resends++;
        return route.fulfill({json:{status:true}});
      }
      return route.fulfill({status:404,json:{message:'Unknown test route'}});
    });
    const page=await context.newPage();
    for(outcome of ['requested','retry-needed']){
      await page.goto(origin);
      await page.getByRole('button',{name:'Create an account',exact:true}).tap();
      await page.getByLabel('Username',{exact:true}).fill('registration.fixture');
      await page.getByLabel('Password',{exact:true}).fill('Registration-Fixture-Only');
      await page.getByLabel('Confirm password',{exact:true}).fill('Registration-Fixture-Only');
      await page.getByLabel('Your email',{exact:true}).fill(email);
      await page.getByLabel("Skater's name on the club list",{exact:true}).fill('Fixture Skater');
      await page.getByRole('button',{name:'Check name and create account'}).tap();
      const heading=page.getByRole('heading',{name:'Verify your email',exact:true});
      await heading.waitFor();
      await page.waitForFunction(el=>{
        const rect=el.getBoundingClientRect();
        return document.activeElement===el&&rect.top>=0&&rect.bottom<=innerHeight;
      },await heading.elementHandle());
      assert.equal(await page.locator('input[type="password"]').count(),0,'A completed registration must replace the editable form');
      if(outcome==='retry-needed'){
        await page.getByRole('alert').filter({hasText:'could not send the first verification email'}).waitFor();
        await page.getByRole('button',{name:'Resend verification email'}).tap();
        await page.getByRole('status').filter({hasText:'a verification email has been requested'}).waitFor();
        assert.equal(resends,1);
      }
    }
    mail='unavailable';
    await page.goto(origin);
    const recovery=page.locator('details').filter({has:page.getByText('Forgot your password?',{exact:true})});
    await recovery.locator('summary').tap();
    await recovery.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('Email or username',{exact:true}).isEnabled(),true);
    mail='disabled';
    await recovery.getByRole('button',{name:'Try again'}).tap();
    await recovery.getByText(/Please contact the club/).waitFor();
    assert.equal(await recovery.locator('input[type="email"]').count(),0);
    const verification=page.locator('details').filter({has:page.getByText('Need to verify your email?',{exact:true})});
    await verification.locator('summary').tap();
    await verification.getByText(/Please contact the club/).waitFor();
    assert.equal(await verification.locator('input[type="email"]').count(),0);
    for(const pathname of ['/reset-password?error=INVALID_TOKEN','/verify-email?error=INVALID_TOKEN']){
      await page.goto(new URL(pathname,origin).href);
      await page.getByText(/Please contact the club/).waitFor();
      assert.equal(await page.locator('input').count(),0);
    }
  }finally{await context.close();}
}
