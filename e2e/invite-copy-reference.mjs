// Read-only editorial check against the published reference; never executes its JS.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import messages from '../web/src/i18n/invite-messages.json' with { type: 'json' }

const { parseExpressionAt } = createRequire(new URL('../web/package.json',import.meta.url))('acorn')
const response=await fetch('https://modelflare.dev/invite-rewards');assert(response.ok)
const html=await response.text()
const path=Array.from(html.matchAll(/src="([^"]+)"/g),m=>m[1]).find(x=>x.includes('/index.')&&x.endsWith('.js'))
assert(path,'Reference entry bundle must be identifiable')
const url=new URL(path,'https://modelflare.dev').href
const bundle=await fetch(url);assert(bundle.ok)
const source=await bundle.text()
const dictionaries=[]
let position=0
while((position=source.indexOf('JSON.parse(',position))>=0){
  position+=11
  if(!source.slice(position,position+30).includes('translation'))continue
  const literal=parseExpressionAt(source,position,{ecmaVersion:'latest'})
  assert.equal(typeof literal.value,'string')
  const value=JSON.parse(literal.value).translation
  if(value)dictionaries.push(value)
  position=literal.end
}
const titles={en:'Invite friends',vi:'Mời bạn bè',fr:'Inviter des amis',ru:'Пригласить друзей',ja:'友達を招待する',zhCN:'好友邀请',zhTW:'好友邀請'}
const aliases={
  '{{amount}} pending Credits':'{{quota}} pending Credits',
  'Invite friends. You both get {{rate}} of the first eligible credit in Credits.':'Invite friends. You both get {{rate}} of the first wallet top-up in Credits.',
  'Share your link. Your friend registers through it, then tops up, redeems a code, or receives an admin credit.':'Share your personal link. Your friend must register through it and complete their first eligible wallet top-up.',
  'Generate link':'Get your invitation link',
  'Each of you receives':"Each of you receives this share of your friend's first top-up",
  'Example: {{amount}} is credited to your friend':"Reward example: your friend's first top-up is US$100",
  'Rewards from my referrals':'Invite Rewards',
  'Both invitation roles are included. Rewards already added to Credits cannot be transferred again.':'After the safety period, your reward becomes transferable and your friend receives usable Credits.',
  'Transferable rewards':'Reward balance',
  'No transferable rewards':'No reward balance yet',
  'Transfer all rewards':'Add rewards to credits',
  'Qualified credits':'Qualified first top-ups',
  'Your link records who invited your friend when they register.':'Your link securely carries the referral when your friend registers.',
  'Your friend registers and receives an eligible credit':'Your friend registers through the link and completes their first top-up',
  'Only their first eligible credit earns rewards for both of you.':'Only the first eligible wallet top-up earns this reward.',
  'After the waiting period, both of you receive rewards':'Rewards are released {{hours}} hours after the top-up succeeds.',
  'Your reward becomes transferable; your friend receives usable Credits.':'After the safety period, your reward becomes transferable and your friend receives usable Credits.',
  'Only the first eligible credit across all three sources earns rewards.':'Only the first eligible wallet top-up earns this reward.',
  'Refunded credits cause the related rewards to be recovered.':'If the top-up is refunded, the related rewards are removed.',
  'Reward transfer failed. Retry safely.':'Failed to transfer rewards',
}
for(const key of ['Invite friends','Friend invitation campaign','Invite link','Copy link','Credits, not cash','Your friend gets','You get','Released after {{hours}} hours','Invite Rewards','Rewards in safety period','Rewards released','Rewards reversed','Reward balance','Lifetime rewards','How It Works','Get and share your personal invitation link','Program rules','Clear and fair rewards','Rewards added to credits']) aliases[key]=key
const mismatches=[]
for(const [language,title] of Object.entries(titles)){
  const dictionary=dictionaries.find(d=>d['Invite friends']===title)
  assert(dictionary,`Reference locale missing: ${language}`)
  for(const [key,referenceKey]of Object.entries(aliases)){
    assert.equal(typeof dictionary[referenceKey],'string',`Missing reference key: ${language} ${referenceKey}`)
    const expected=dictionary[referenceKey].replace('US$100','{{amount}}').replace('{{quota}}','{{amount}}')
    if(messages[language][key]!==expected)mismatches.push({language,key,expected})
  }
}
console.log(JSON.stringify({reference:url,sha256:createHash('sha256').update(source).digest('hex'),languages:Object.keys(titles),keysPerLanguage:Object.keys(aliases).length,mismatches},null,2))
if(mismatches.length)process.exitCode=1
