// Isolated real-login/browser lab; no financial operations or external speed tests.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const require=createRequire(import.meta.url)
const base=process.argv[2]||'http://127.0.0.1:4198'
assert.equal(new URL(base).hostname,'127.0.0.1','This lab must never target production')
const apiURL=base+'/v1'
const description='Recommended for everyday use, with support for longer non-streaming requests.'
const locales={en:'en',vi:'vi',fr:'fr',ru:'ru',ja:'ja',zhCN:'zh',zhTW:'zh-TW'}
const password='ApiInfoLab123!'
const browser=await chromium.launch({channel:'msedge',headless:true})
let oldClipboard
let page

async function request(context,path,method='GET',data){
  const response=await context.request.fetch(base+path,{method,data})
  const body=await response.json()
  assert.equal(body.success,true,`${method} ${path}: ${body.message||response.status()}`)
  return body.data
}

async function checkLayout(row){
  const state=await row.evaluate(el=>{
    const name=el.querySelector('[data-slot=api-route-name]')
    const desc=el.querySelector('[data-slot=api-route-description]')
    const url=el.querySelector('[data-slot=api-route-url]')
    const n=name.getBoundingClientRect(),d=desc.getBoundingClientRect(),u=url.getBoundingClientRect()
    const style=getComputedStyle(desc)
    return {ordered:d.top>=n.bottom&&u.top>=d.bottom,visible:style.display!=='none'&&d.height>0,wrap:style.whiteSpace!=='nowrap',description:desc.textContent,clipped:desc.scrollWidth>desc.clientWidth+1||desc.scrollHeight>desc.clientHeight+1,rowOverflow:el.scrollWidth>el.clientWidth+1,buttons:el.querySelectorAll('button').length,externalLinks:el.querySelectorAll('a[target="_blank"]').length}
  })
  assert.equal(state.ordered,true,'Name, description and URL must be separate stacked lines')
  assert.equal(state.visible,true,'Description is visible on mobile and desktop')
  assert.equal(state.wrap,true)
  assert.equal(state.description,description)
  assert.equal(state.clipped,false,'Full description fits without clipping')
  assert.equal(state.rowOverflow,false)
  assert.equal(state.buttons,2)
  assert.equal(state.externalLinks,0)
}

try {
  const admin=await browser.newContext()
  await request(admin,'/api/setup','POST',{username:'apiroot',password,confirmPassword:password})
  const root=await request(admin,'/api/user/login','POST',{username:'apiroot',password})
  await admin.setExtraHTTPHeaders({Authorization:`Bearer ${root.access_token}`})
  await request(admin,'/api/option/','PUT',{key:'console_setting.api_info',value:JSON.stringify([{id:1,route:'94API Main Route',description,url:apiURL,color:'green'}])})
  await request(admin,'/api/user/register','POST',{username:'apiuser',password})
  const context=await browser.newContext()
  const login=await request(context,'/api/user/login','POST',{username:'apiuser',password})
  await context.setExtraHTTPHeaders({Authorization:`Bearer ${login.access_token}`})
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base})
  await context.addCookies([{name:'vite-ui-theme',value:'system',url:base}])
  page=await context.newPage();page.setDefaultTimeout(15000)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  let popups=0;page.on('popup',()=>popups++)
  await page.goto(base+'/dashboard/overview')
  await page.locator('[data-slot=api-info-item]').waitFor()
  oldClipboard=await page.evaluate(()=>navigator.clipboard.readText()).catch(()=>undefined)
  const self=await request(context,'/api/user/self');assert.equal(self.role,1)
  for(const [language,file] of Object.entries(locales)){
    const copy=require(`../web/src/i18n/locales/${file}.json`).translation
    await page.evaluate(lang=>localStorage.setItem('i18nextLng',lang),language)
    await page.reload()
    const row=page.locator('[data-slot=api-info-item]');await row.waitFor()
    assert.equal(await row.locator('[data-slot=api-route-name]').innerText(),'94API Main Route')
    for(const width of [320,390,768,1024,1440]){
      await page.setViewportSize({width,height:1000})
      for(const theme of ['light','dark']){
        await page.emulateMedia({colorScheme:theme})
        await page.waitForFunction(theme=>document.documentElement.classList.contains(theme),theme,{polling:100})
        await row.scrollIntoViewIfNeeded()
        await checkLayout(row)
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
        const zap=row.getByRole('button',{name:copy['Test Latency'],exact:true})
        const head=page.waitForRequest(r=>r.url()===apiURL&&r.method()==='HEAD')
        await zap.click();await head
        await row.locator('[data-slot=status-badge]').filter({hasText:/^\d+/}).waitFor()
        const latency=await row.locator('[data-slot=status-badge]').innerText()
        assert(latency.endsWith(copy.ms||'ms'))
        assert.equal(await zap.isDisabled(),false)
        const button=row.getByRole('button').nth(1)
        assert([copy['Copy URL'],copy.Copied].includes(await button.getAttribute('aria-label')))
        await button.click()
        await row.getByRole('button',{name:copy.Copied,exact:true}).waitFor()
        assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),apiURL)
        await checkLayout(row)
        if(process.env.SCREENSHOT_DIR&&['en','vi'].includes(language)&&[390,1440].includes(width))await row.screenshot({path:`${process.env.SCREENSHOT_DIR}/94api-api-info-${language}-${width}-${theme}.png`})
      }
    }
    console.log(JSON.stringify({language,widths:[320,390,768,1024,1440],themes:['light','dark'],fullDescription:true,twoActions:true,realHeadRequest:true,clipboardExact:true}))
  }
  // Hold only the HEAD request to reliably observe the pending state.
  await page.evaluate(()=>localStorage.setItem('i18nextLng','en'));await page.reload()
  await page.setViewportSize({width:320,height:1000})
  const row=page.locator('[data-slot=api-info-item]');await row.waitFor()
  const zap=row.getByRole('button',{name:'Test Latency',exact:true})
  let unblock
  const gate=new Promise(resolve=>{unblock=resolve})
  await page.route(apiURL,async route=>{await gate;await route.continue()})
  const started=page.waitForRequest(r=>r.url()===apiURL&&r.method()==='HEAD')
  await zap.click();await started
  await row.getByText('Testing...',{exact:true}).waitFor()
  assert.equal(await zap.isDisabled(),true)
  await checkLayout(row)
  unblock()
  await row.locator('[data-slot=status-badge]').filter({hasText:/^\d+/}).waitFor()
  await page.unroute(apiURL)
  await page.route(apiURL,route=>route.abort('failed'))
  await zap.click();await row.getByText('N/A',{exact:true}).waitFor()
  assert.equal(await zap.isDisabled(),false)
  await page.unroute(apiURL)
  await zap.focus();await page.keyboard.press('Enter')
  await row.locator('[data-slot=status-badge]').filter({hasText:/^\d+/}).waitFor()
  assert.equal(popups,0)
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,realUser:true,latencyPendingDisabled:true,networkFailureAndRetry:true,keyboard:true,externalPopups:0,pageErrors:0}))
} finally {
  if(oldClipboard!==undefined&&page&&!page.isClosed())await page.evaluate(text=>navigator.clipboard.writeText(text),oldClipboard).catch(()=>{})
  await browser.close()
}
