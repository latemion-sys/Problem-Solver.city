import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// 실행: node --test tests/systems.test.mjs
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const preview=readFileSync(new URL('../public/preview.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const game=scripts.at(-1);
function section(before,after){
  const a=game.indexOf(before),b=game.indexOf(after,a+before.length);
  assert.ok(a>=0&&b>a,`코드 구간 누락: ${before}`);
  return game.slice(a,b);
}
test('본 사이트와 미리보기 파일 일치',()=>assert.equal(html,preview));
test('전체 인라인 스크립트 문법 검사',()=>scripts.forEach((s,i)=>assert.doesNotThrow(()=>new vm.Script(s,{filename:`script-${i}.js` }))));
test('심사에서 성공 건수와 실제 건수가 어긋나지 않는다',()=>{
 const cx={REVIEW_NEED:g=>3+Math.floor((9-g)/2),Math};
 vm.createContext(cx);vm.runInContext(section('function reviewOf(','/* 사무소가 5급'),cx);
 assert.equal(cx.reviewOf({n:4,ok:5,hi:4,sc:3.6},9).ok,true);
 assert.equal(cx.reviewOf({n:5,ok:2,hi:4,sc:4},9).ok,false);
});
test('위험 미리보기의 피해 공식과 실전 공식 일치',()=>{
 const cx={redHP:f=>f.redHP||0,redMP:f=>f.redMP||0,accFx:()=>false,
 LIGHT_THREATS:['뜬소문','도시 괴담'],threatOf:q=>q.threat,abnoOf:()=>null,
 MARCH_K:2.5,TIRED_DMG:1.2,Math};
 vm.createContext(cx);vm.runInContext(section('const LOSS_PCT =','function canGo('),cx);
 const f={hpMax:100,mpMax:90},q={kind:'일반',threat:'도시 괴담'};
 assert.equal(cx.damagePercent(f,q,true,0,false,false),5);
 assert.equal(cx.damagePercent(f,q,false,0,false,false),17);
 assert.equal(cx.damagePercent(f,q,false,3,false,false),30);
});
test('자동 수행은 의뢰 카드와 동일한 성공률 사용',()=>{
 assert.match(game,/function autoRate\(team, q\)\{ return rate\(team,q\)/);
 assert.match(game,/const base = rate\(team,q\)/);
});
test('직접 수행 목표 달성 시 의뢰 확정 성공',()=>{
 assert.match(game,/else if\(r\.decisive===true\)\{ mgScore = r\.score; decisive = true;/);
});
test('실제 정산과 미리보기가 공통 피해 계산 호출',()=>{
 assert.match(game,/const pct = damagePercent\(f,q,success,w,mental,march/);
 assert.match(game,/mx\*damagePercent\(f,q,success,w,mental,march\)/);
});
test('기존 저장 키 유지와 복구 기능 검사',()=>{
 assert.match(game,/const SAVE_KEY = "problem-solver-office-save-v1"/);
 for(const word of ['problem-solver-backup','data-x="download"','data-x="file"','S.rentArrears','S.scarWeekDue'])
   assert.ok(game.includes(word),word);
});
