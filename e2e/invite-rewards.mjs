import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { chromium } from 'playwright'
import messages from '../web/src/i18n/invite-messages.json' with { type: 'json' }

const base = process.argv[2] || 'http://127.0.0.1:4198'
assert.equal(new URL(base).hostname,'127.0.0.1','The financial lab must never target production')
const password = 'InviteLab123!'
const browser = await chromium.launch({channel:'msedge',headless:true})
const contexts=[]
async function request(context,path,method='GET',data,headers={}) {
  const response=await context.request.fetch(base+path,{method,data,headers})
  let body;try{body=await response.json()}catch{body={}}
  return {status:response.status(),body}
}
async function account(name,aff='') {
  const context=await browser.newContext();contexts.push(context)
  if(name!=='labroot'){
    const r=await request(context,'/api/user/register','POST',{username:name,password,aff_code:aff})
    assert.equal(r.body.success,true,`registration ${name}`)
  }
  const login=await request(context,'/api/user/login','POST',{username:name,password})
  assert.equal(login.body.success,true,`login ${name}`)
  const token=login.body.data.access_token
  assert(token,'Real login must issue an access token')
  await context.setExtraHTTPHeaders({Authorization:`Bearer ${token}`})
  return context
}
async function state(name){const r=await fetch(`${base}/lab/user/${name}`);return (await r.json()).data}
try {
  const bootstrap=await browser.newContext();contexts.push(bootstrap)
  assert.equal((await request(bootstrap,'/api/setup','POST',{username:'labroot',password,confirmPassword:password})).body.success,true)
  const admin=await account('labroot')
  for (const [key,value] of [['SystemName','94API'],['Logo','https://94api.dev/94api-logo-transparent.png']]) {
    assert.equal((await request(admin,'/api/option/','PUT',{key,value})).body.success,true)
  }
  assert.equal((await request(admin,'/api/option/payment_compliance','POST',{confirmed:true})).body.success,true)
  const a=await account('invitea');const sa=await state('invitea')
  const b=await account('inviteb',sa.code);const sb=await state('inviteb');assert.equal(sb.inviter_id,sa.id)
  const c=await account('invitec',sb.code);const sc=await state('invitec')
  const d=await account('invited')
  let program=(await request(admin,'/api/option/invite-rewards')).body.data
  const setProgram=async patch=>{const result=await request(admin,'/api/option/invite-rewards','PUT',{...program,...patch});assert.equal(result.body.success,true);program=result.body.data}
  await setProgram({enabled:true,mode:'first',rate_bps:800,hold_hours:0})
  for(const [path,method,data] of [['/api/option/invite-rewards','GET'],['/api/option/invite-rewards','PUT',{...program,rate_bps:9000}],['/api/option/invite-rewards/funding','GET'],['/api/option/invite-rewards/reverse','POST',{source:'admin:fake',refunded_quota:1}]]) {
    assert.equal((await request(b,path,method,data)).status,403,`user denied ${method} ${path}`)
  }
  const forged=(await request(b,`/api/user/invite-rewards?user_id=${sa.id}`)).body.data
  assert.equal(forged.code,sb.code,'Query parameter cannot select another account')
  const credit=async(id,value,key=randomUUID(),mode='add')=>request(admin,'/api/user/manage','POST',{id,action:'add_quota',mode,value},{'Idempotency-Key':key})
  const key=randomUUID()
  assert.equal((await credit(sb.id,5000000,key)).body.success,true)
  assert.equal((await credit(sb.id,5000000,key)).body.success,true)
  assert.equal((await state('invitea')).aff_quota,400000)
  assert.equal((await state('inviteb')).quota,5400000)
  assert.equal((await credit(sb.id,500000)).body.success,true)
  assert.equal((await state('invitea')).aff_quota,400000,'first only across funding sources')
  assert.equal((await request(admin,'/api/option/invite-rewards','PUT',{...program,mode:'all'})).status,400,'Repeat rewards are rejected even for an administrator')
  assert.equal((await request(admin,'/api/option/invite-rewards')).body.data.mode,'first')
  const before=await state('inviteb')
  assert.equal((await credit(sa.id,500000)).body.success,true)
  assert.equal((await state('inviteb')).quota,before.quota,'A credit never rewards B')
  assert.equal((await credit(sc.id,500000)).body.success,true)
  assert.equal((await state('invitea')).aff_quota,400000,'No second-level commission')
  assert.equal((await state('inviteb')).aff_quota,40000)
  const transferKey=randomUUID()
  const ta=await request(a,'/api/user/invite-rewards/transfer','POST',{user_id:sb.id,quota:99999999},{'Idempotency-Key':transferKey})
  assert.equal(ta.body.data.quota,400000,'Only server-resolved balance can be transferred')
  assert.equal((await request(a,'/api/user/invite-rewards/transfer','POST',{}, {'Idempotency-Key':transferKey})).body.success,true)
  assert.equal((await state('invitea')).quota,900000,'Repeated transfer does not credit twice')
  await account('payfriend',sa.code); const paymentUser=await state('payfriend')
  const redeemUser=await account('redeemfriend',sa.code)
  await account('holdfriend',sa.code); const heldUser=await state('holdfriend')
  // Actual Stripe webhook controller, signed payload and a lab-only pending order.
  await request(admin,'/lab/payment','POST',{user_id:paymentUser.id,trade_no:'lab-stripe-1',amount:10})
  const payload=JSON.stringify({id:'evt_lab_1',object:'event',type:'checkout.session.completed',data:{object:{id:'cs_lab',object:'checkout.session',client_reference_id:'lab-stripe-1',customer:'cus_lab',payment_intent:'pi_lab_http',payment_status:'paid',status:'complete',amount_total:1000,currency:'usd'}}})
  const timestamp=Math.floor(Date.now()/1000)
  const signature=createHmac('sha256','invite-lab-webhook-secret').update(`${timestamp}.${payload}`).digest('hex')
  const bad=await admin.request.post(base+'/api/stripe/webhook',{data:payload,headers:{'Content-Type':'application/json','Stripe-Signature':`t=${timestamp},v1=bad`}})
  assert.equal(bad.status(),400)
  for(let i=0;i<2;i++) {const r=await admin.request.post(base+'/api/stripe/webhook',{data:payload,headers:{'Content-Type':'application/json','Stripe-Signature':`t=${timestamp},v1=${signature}`}});assert.equal(r.status(),200)}
  assert.equal((await state('invitea')).aff_quota,400000,'Signed repeated webhook rewards once')
  // A real redemption created through the administration API.
  const redeem=await request(admin,'/api/redemption/','POST',{name:'invite-lab',count:1,quota:500000})
  assert.equal(redeem.body.success,true)
  const redeemKey=redeem.body.data[0]
  assert.equal((await request(redeemUser,'/api/user/topup','POST',{key:redeemKey})).body.success,true)
  assert.equal((await state('invitea')).aff_quota,440000)
  const refundPayload=JSON.stringify({id:'evt_lab_refund',object:'event',type:'charge.refunded',data:{object:{id:'ch_lab',object:'charge',payment_intent:'pi_lab_http',amount:1000,amount_refunded:500}}})
  const refundSignature=createHmac('sha256','invite-lab-webhook-secret').update(`${timestamp}.${refundPayload}`).digest('hex')
  for(let i=0;i<2;i++){const r=await admin.request.post(base+'/api/stripe/webhook',{data:refundPayload,headers:{'Content-Type':'application/json','Stripe-Signature':`t=${timestamp},v1=${refundSignature}`}});assert.equal(r.status(),200)}
  assert.equal((await state('invitea')).aff_quota,240000,'Cumulative partial refund is recovered once')
  await setProgram({hold_hours:24})
  const heldKey=randomUUID()
  await credit(heldUser.id,500000,heldKey)
  assert.equal((await state('invitea')).aff_quota,240000)
  const themePage=await a.newPage()
  await themePage.goto(base+'/invite-rewards')
  await themePage.getByRole('button',{name:'Toggle theme',exact:true}).click()
  await themePage.getByRole('menuitem',{name:'Dark',exact:true}).click()
  await themePage.waitForFunction(()=>document.documentElement.classList.contains('dark'))
  await themePage.reload()
  await themePage.locator('#invite-link').waitFor()
  assert.equal(await themePage.locator('html').evaluate(el=>el.classList.contains('dark')),true,'Theme persists on reload')
  await themePage.getByRole('button',{name:'Toggle theme',exact:true}).click()
  await themePage.getByRole('menuitem',{name:'Light',exact:true}).click()
  await themePage.waitForFunction(()=>document.documentElement.classList.contains('light'))
  await themePage.getByRole('button',{name:'Toggle theme',exact:true}).click()
  await themePage.getByRole('menuitem',{name:'System',exact:true}).click()
  await themePage.close()
  assert.equal((await request(admin,'/lab/release','POST',{hours:25})).body.success,true)
  assert.equal((await state('invitea')).aff_quota,280000)
  assert.equal((await request(admin,'/api/option/invite-rewards/reverse','POST',{source:`admin:${heldKey}`,refunded_quota:500000})).body.success,true)
  assert.equal((await state('invitea')).aff_quota,240000)
  await credit(heldUser.id,500000)
  await request(admin,'/lab/release','POST',{hours:25})
  assert.equal((await state('invitea')).aff_quota,240000,'Refunding the first credit never creates another first credit')
  for(const [language,copy] of Object.entries(messages)){
    const page=await a.newPage()
    await page.addInitScript(lang=>localStorage.setItem('i18nextLng',lang),language)
    for(const width of [320,390,768,1024,1440]){
      await page.setViewportSize({width,height:1000})
      await page.goto(base+'/invite-rewards')
      await page.getByRole('heading',{name:copy['Invite friends'],exact:true}).waitFor()
      await page.locator('#invite-link').waitFor()
      const stats=page.locator('[data-slot=invite-stats]')
      assert.equal(await stats.locator('svg').count(),6,'Each statistic has a decorative icon')
      assert.equal(await stats.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>=1440?4:width>=640?2:1)
      assert.equal(await page.locator('[data-slot=invite-hero]').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>=1440?2:1,'Hero uses side-by-side panels on desktop')
      assert.equal(await page.locator('[data-slot=invite-steps] > li').count(),3)
      const copyButton = page.getByRole('button',{name:copy['Copy link'],exact:true})
      assert.equal(await copyButton.evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'Copy label must fit inside its button')
      assert.equal(await page.locator('#invite-mode').count(),0,'No administrator settings on user page')
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${language} ${width} overflow`)
      await page.emulateMedia({colorScheme:'dark'})
      await page.waitForFunction(()=>document.documentElement.classList.contains('dark'))
      await page.emulateMedia({colorScheme:'light'})
      await page.waitForFunction(()=>document.documentElement.classList.contains('light'))
      if(process.env.SCREENSHOT_DIR && width===1440){await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/94api-invite-${language}.png`})}
    }
    await page.close()
  }
  const adminPage=await admin.newPage();await adminPage.goto(base+'/system-settings/billing/invite-rewards');await adminPage.locator('#invite-rate').waitFor();assert.equal(await adminPage.locator('#invite-mode').count(),0,'No editable repeat-award setting')
  const deniedPage=await b.newPage();await deniedPage.goto(base+'/system-settings/billing/invite-rewards');await deniedPage.waitForURL('**/403');assert.equal(await deniedPage.locator('#invite-mode').count(),0)
  console.log(JSON.stringify({passed:true,firstOnly:true,realLogin:true,realAPIs:true,signedPaymentWebhook:true,signedPartialRefund:true,redemption:true,adminCredits:true,directions:true,replayProtection:true,authorization:true,holdAndReversal:true,languages:7,responsiveWidths:[320,390,768,1024,1440],themes:['light','dark'],themeButtonAndPersistence:true,statIcons:6}))
} finally {for(const c of contexts)await c.close();await browser.close()}
