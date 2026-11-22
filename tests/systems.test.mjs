import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// 미리보기 V.a1.2.6.3 독립 회귀 검사: node --test tests/systems.test.mjs
// 운영 파일은 검사하거나 수정하지 않는다.
const preview=readFileSync(new URL('../public/preview.html',import.meta.url),'utf8');
const scripts=[...preview.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const game=scripts.at(-1);
function section(before,after){
  const a=game.indexOf(before),b=game.indexOf(after,a+before.length);
  assert.ok(a>=0&&b>a,`검사 대상 코드 누락: ${before} → ${after}`);
  return game.slice(a,b);
}
test('미리보기 버전 V.a1.2.6.3',()=>assert.match(game,/const VERSION = "V\.a1\.2\.6\.3"/));
test('미리보기 인라인 자바스크립트 문법',()=>scripts.forEach((s,i)=>assert.doesNotThrow(()=>new vm.Script(s,{filename:`preview-${i}.js` }))));
test('기존 저장 키와 저장 파일 호환',()=>{
  assert.match(game,/const SAVE_KEY = "problem-solver-office-save-v1"/);
  for(const word of ['problem-solver-backup','data-x="download"','data-x="file"','S.rentArrears','S.scarWeekDue'])assert.ok(game.includes(word),word);
});
test('사무소 심사는 대표 해결사 급수보다 앞서갈 수 없다',()=>{
  const cx={Math,gName:n=>n+'급',OFFICE_DIRECT_NEED:5,OFFICE_ROSTER_NEED:2,OFFICE_FALLBACK_OK:2};
  vm.createContext(cx);vm.runInContext(section('function officeReviewStatus(','function reviewProgressHtml('),cx);
  const w={n:6,ok:6,hi:6,sc:6};
  assert.equal(cx.officeReviewStatus(w,8,[{isLeader:true,grade:8}]).ok,false);
  assert.equal(cx.officeReviewStatus(w,8,[{isLeader:true,grade:7}]).ok,true);
});
test('해결사 심사는 실제 성공 건수까지만 반영한다',()=>{
  const cx={Math,REVIEW_NEED:g=>3+Math.floor((9-g)/2)};
  vm.createContext(cx);vm.runInContext(section('function reviewOf(','// 사무소 심사:'),cx);
  assert.equal(cx.reviewOf({n:4,ok:5,hi:4,sc:3.6},9).ok,true);
  assert.equal(cx.reviewOf({n:5,ok:2,hi:4,sc:4},9).ok,false);
});
test('지명 및 고난도 조건 중복 충족 시 고난도 실적은 1건',()=>{
  const code=section('const sc = mode==="play"','S.wk = S.wk ||');
  const m=code.match(/add\s*=\s*\(w,\s*hard\)\s*=>\s*\{([\s\S]*?)\}\s*;/);
  assert.ok(m,'집계 함수');
  const cx={w:{n:0,ok:0,hi:0,sc:0}};
  vm.createContext(cx);
  vm.runInContext(`const success=true, q={nom:true}, sc=0.9;const add=(w,hard)=>{${m[1]}}; add(w,true)`,cx);
  assert.equal(cx.w.n,1);assert.equal(cx.w.ok,1);assert.equal(cx.w.hi,1);
});
test('의체 정비비를 못 내면 자금은 음수가 되지 않고 출동 차단',()=>{
  const f={name:'시험',hp:100,lastDispatch:0,unavailUntil:0,body:{full:{upkeep:8000}}};
  const cx={Math,S:{money:1000,day:8,fixers:[f]},FULL_BODY:{upkeep:8000},won:n=>n,addLog:()=>{},toast:()=>{}};
  vm.createContext(cx);vm.runInContext(section('function bodyServiceCost(','/* ---- 고유 무기:'),cx);
  vm.runInContext(section('function canGo(','/* 강행군:'),cx);
  vm.runInContext(section('function canMarch(','const canSend ='),cx);
  cx.bodyUpkeep();
  assert.equal(cx.S.money,1000);assert.equal(f.body.upkeepDue,8000);
  assert.equal(cx.canGo(f),false);assert.equal(cx.canMarch({...f,lastDispatch:8}),false);
  cx.S.money=8000;assert.equal(cx.payBodyService(f),true);
  assert.equal(cx.S.money,0);assert.equal(cx.canGo(f),true);
});
test('주급 미납액 이월 및 잔액 음수 방지',()=>{
  const f={isLeader:false,wage:2000,mp:100,mpMax:100};
  const cx={Math,S:{money:1000,moved:false,fixers:[f]},accFx:()=>false,INJ_COST:500,
    won:n=>n,addLog:()=>{},ac:()=>{},changeFixerTrust:()=>{},RENT_DAYS:28,rentForecast:()=>({total:0,base:0}),RENT_SALES:0.1};
  vm.createContext(cx);vm.runInContext(section('function officeFees(','async function review('),cx);
  cx.officeFees(7);assert.equal(cx.S.money,0);assert.equal(f.wageDue,1000);
  cx.S.money=5000;cx.officeFees(14);assert.equal(cx.S.money,2000);assert.equal(f.wageDue,0);
});
test('미리보기 시험 업적과 실제 성과 분리',()=>{
  for(const expr of [/function ltSave\(\)\{ if\(FXTEST\) return;/,
    /function achSave\(d\)\{ if\(FXTEST\)/,
    /function codexSave\(d\)\{ if\(FXTEST\)/,
    /function citySave\(d\)\{ if\(FXTEST\)/])assert.match(game,expr);
});
test('5인 미니게임 시험 및 마탄 설명',()=>{
  assert.match(game,/for\(let n=S\.fixers\.length;n<5;n\+\+\)/);
  assert.ok(preview.includes('마탄 2발(6·7번째 탄환)'));
});
test('세계관: 죄종과 환상체의 의뢰 표시 분리',()=>{
  assert.match(game,/const requestDisplayKind = q =>/);
  assert.match(game,/a\.risk==="죄종"\?"죄종 조우":"환상체 의뢰"/);
});
test('자동 출동과 의뢰 카드 성공률 동일',()=>{
  assert.match(game,/function autoRate\(team, q\)\{ return rate\(team,q\)/);
  assert.match(game,/const base = rate\(team,q\)/);
});
test('목표 달성 시 의뢰 확정 성공',()=>assert.match(game,/else if\(r\.decisive===true\)\{ mgScore = r\.score; decisive = true;/));
test('피해 예측과 실제 정산 공통 계산 함수 사용',()=>{
  assert.match(game,/const pct = damagePercent\(f,q,success,w,mental,march/);
  assert.match(game,/mx\*damagePercent\(f,q,success,w,mental,march\)/);
});


test('고용 해결사의 신뢰 기본값과 창립 동료',()=>{
  assert.match(game,/hp:100, hpMax:100, mp:100, mpMax:100, trust:50, personality:/);
  assert.match(game,/S\.fixers\.push\(L,P\); P\.trust=65;/);
  assert.match(game,/if\(!f\.isLeader && !Number\.isFinite\(f\.trust\)\) f\.trust=f\.founder\?65:50/);
});
test('개인 신뢰는 0~100 범위, 대표는 제외',()=>{
  const cx={Math,S:{log:[]},addLog:()=>{},ac:()=>{}};vm.createContext(cx);
  vm.runInContext(section('function fixerTrust(','function initSurroundings('),cx);
  const f={name:'직원',trust:50,isLeader:false};
  cx.changeFixerTrust(f,4,'성공');assert.equal(f.trust,54);
  cx.changeFixerTrust(f,-3,'미납');assert.equal(f.trust,51);
  cx.changeFixerTrust(f,200,'상승');assert.equal(f.trust,100);
  cx.changeFixerTrust(f,-200,'하락');assert.equal(f.trust,0);
  const lead={isLeader:true,trust:60};cx.changeFixerTrust(lead,-3,'미납');assert.equal(lead.trust,60);
});
test('버전 변경 후 의뢰 보수를 반복 삭감하지 않음',()=>{
  const cx={VERSION:'V.a1.2.6.3',fixGrade1Threat:()=>{},Math};vm.createContext(cx);
  vm.runInContext(section('function migrate1247(','const NOM_P ='),cx);
  const d={v:'1.2.5.7',requests:[{grade:8,reward:10000,accepted:false}]};
  cx.migrate1247(d);cx.migrate1247(d);
  assert.equal(d.requests[0].reward,10000);assert.equal(d.v,'V.a1.2.6.3');
});
test('주변 사무소 초기 급수와 주간 폐업 확률',()=>{
  const cx={S:{day:1,officeGrade:8,log:[]},Math,gName:n=>n+'급',ac:()=>{},FINGER_NEWS:['손가락'],CITY_NEWS:['도시']};
  vm.createContext(cx);vm.runInContext(section('function initSurroundings(','const FINGER_NEWS='),cx);
  const D=cx.initSurroundings();
  assert.deepEqual(Array.from(D.offices.map(o=>o.grade)),[8,8,6]);
  assert.deepEqual(Array.from(D.offices.map(o=>o.p)),[.04,.04,.005]);
  cx.surroundingsHandOff({id:1,grade:8,client:'주민',text:'수색'});
  assert.equal(D.jobs.length,1);
  cx.S.day=5;cx.surroundingsTick();assert.notEqual(D.jobs[0].status,'수행 중');
});
test('폐지부 0.1% 등장 및 지하 1~5층',()=>{
  const floors=JSON.parse(game.match(/const RUINS_FLOORS=({[^;\n]+});/)[1]);
  const areas=JSON.parse(game.match(/const RUINS_AREAS=({[^;\n]+});/)[1]);
  assert.deepEqual(Array.from(Object.values(floors)),[1,2,3,4,5]);
  const m=Object.create(Math);m.random=()=>.0009;
  const cx={S:{day:10},Math:m,RUINS_FLOORS:floors,RUINS_AREAS:areas,threatOf:q=>q.threat};
  vm.createContext(cx);vm.runInContext(section('function maybeRuinsRequest(','function ruinsPickNode('),cx);
  const q={kind:'일반',grade:8,threat:'도시 괴담',req:8};
  assert.equal(cx.maybeRuinsRequest({...q}).ruins.floor,1);
  m.random=()=>.001;assert.equal(cx.maybeRuinsRequest({...q}).ruins,undefined);
});
test('폐지부 5층에도 휴식과 정보 수집 경로 가능',()=>{
  const rooms=JSON.parse(game.match(/const RUINS_ROOMS=({[^;\n]+});/)[1]);
  const m=Object.create(Math);m.random=()=>.5;
  const cx={RUINS_ROOMS:rooms,Math:m};vm.createContext(cx);
  vm.runInContext(section('function ruinsPickNode(','function makeRuinsMap('),cx);
  m.random=()=>.88;assert.equal(cx.ruinsPickNode(5,2).kind,'rest');
  m.random=()=>.99;assert.equal(cx.ruinsPickNode(5,2).kind,'intel');
});
test('엔케팔린 통 보상 및 매각 가격',()=>{
  const m=Object.create(Math);m.random=()=>0;
  const cx={S:{day:9,inventory:[]},Math:m,ac:()=>{},acSet:()=>{},won:n=>n};vm.createContext(cx);
  vm.runInContext(section('function ruinsReward(','const RUINS_FLOORS='),cx);
  cx.ruinsReward({id:1,ruins:{floor:5},ruinsResult:{cans:9,intel:2,won:4}},[]);
  const enk=cx.S.inventory.filter(x=>x.name==='엔케팔린 통');
  assert.equal(enk.length,5);assert.ok(enk.every(x=>x.pawnFixed===50000));
  assert.equal(cx.S.inventory.filter(x=>x.ruinsRare).length,1);
});
test('미확정 메인 스토리 미반영, 기존 연속 사건 유지',()=>{
  for(const phrase of ['function mainlineState()','mainlineSpawn()','const MAINLINE=','검은 출근부'])
    assert.equal(game.includes(phrase),false,phrase);
  assert.ok(game.includes('const ARCS = ['));
});
