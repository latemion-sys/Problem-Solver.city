import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const file of ['index.html','preview.html']) {
  test(file+' 환상체 기프트 개인별 지급',()=>{
    const html=readFileSync(new URL('../public/'+file,import.meta.url),'utf8');
    const start=html.indexOf('const AB_GIFT_RATE'), end=html.indexOf('const overGift',start);
    assert.ok(start>=0&&end>start);
    const f1={id:1,name:'A',gear:{}}, f2={id:2,name:'B',gear:{acc:{name:'old'}}};
    const S={fixers:[f1,f2],inventory:[]};
    const cx={S,window:{},roll:0,Math:{random:()=>cx.roll},esc:x=>x,threatOf:()=>'',relicLocked:()=>false,ac:()=>{},codexNote:()=>{},addLog:()=>{},abRec:()=>({giftPick:{a:'a'}}),abRecSave:()=>{}};
    vm.createContext(cx); vm.runInContext(html.slice(start,end),cx);
    const a={id:'a',vid:'a',n:'시험',risk:'HE',gifts:{a:{n:'시험'}}}, q={grade:3};
    cx.roll=.02; assert.equal(cx.grantAbnoGift(a,'ctrl',q,f1,.02),false);
    cx.roll=.019; assert.equal(cx.grantAbnoGift(a,'ctrl',q,f1,.02),true); assert.equal(f1.gear.acc.gift.recipientId,1);
    cx.roll=.08; cx.awardAbnoCompletion(a,q,S.fixers,{win:true,how:'ctrl'}); assert.equal(S.inventory.length,0);
    cx.roll=.079; cx.awardAbnoCompletion(a,q,S.fixers,{win:true,how:'ctrl'}); assert.equal(S.inventory.length,2);
    cx.roll=.01; cx.awardAbnoCompletion(a,q,S.fixers,{win:true,how:'sup',rage:true,battle:[{f:f1,fought:true},{f:f2,fought:false}]}); assert.equal(S.inventory.length,5);
    cx.awardAbnoCompletion(a,q,S.fixers,{win:true,how:'sup',rage:false,battle:[{f:f1,fought:true}]}); assert.equal(S.inventory.length,7);
    cx.awardAbnoCompletion({...a,risk:'죄종'},q,S.fixers,{win:true,how:'sup',rage:true,battle:[{f:f1,fought:true}]}); assert.equal(S.inventory.length,7);
    cx.awardAbnoCompletion(a,q,S.fixers,{win:false,how:'ctrl'}); assert.equal(S.inventory.length,7);
    assert.equal(f2.gear.acc.name,'old');
    assert.match(html,/grantAbnoGift\(a,"ctrl",q,f,AB_GIFT_RATE\.action,say\)/);
    assert.match(html,/awardAbnoCompletion\(A,q,team,abnoR/);
    assert.doesNotMatch(html,/const GIFT_P =/);
  });
}
