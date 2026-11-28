import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const production=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const preview=readFileSync(new URL('../public/preview.html',import.meta.url),'utf8');
const inlineScripts=html=>[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const game=inlineScripts(production).find(script=>script.includes('const VERSION ='));
function section(before,after){
  const a=game.indexOf(before),b=game.indexOf(after,a+before.length);
  assert.ok(a>=0&&b>a,`검사 대상 코드 누락: ${before} → ${after}`);
  return game.slice(a,b);
}
test('운영 버전과 업데이트 내역의 버전 형식',()=>{
  assert.match(game,/const VERSION = "v\.a\d+(?:\.\d+)+";/i);
  assert.match(game,/const CHANGELOG = \[\s*\["v\.a\d+(?:\.\d+)+"/i);
});
for(const [file,html] of [['index.html',production],['preview.html',preview]]){
  test(`${file} 인라인 자바스크립트 문법`,()=>{
    const scripts=inlineScripts(html);
    assert.ok(scripts.some(script=>script.includes('const VERSION =')));
    scripts.forEach((script,i)=>new vm.Script(script,{filename:`${file}:${i}`}));
  });
}
test('기존 저장 키와 저장 파일 호환',()=>{
  assert.match(game,/const SAVE_KEY = "problem-solver-office-save-v1"/);
  for(const word of ['problem-solver-backup','data-x="download"','data-x="file"','S.rentArrears','S.scarWeekDue'])assert.ok(game.includes(word),word);
});
test('사무소 이야기는 하루에 한 편만 열리고 참여 동료가 바뀐다',async()=>{
  const timers=[], scenes=[];
  const members=[
    {id:1,name:'대표',isLeader:true,hp:100},
    {id:2,name:'민준',personality:'신중함',hp:100},
    {id:3,name:'유나',personality:'다정함',hp:100},
    {id:4,name:'부상자',personality:'냉소',hp:0}
  ];
  let pickIndex=0;
  const cx={
    S:{day:60,fixers:members,requests:[],records:[],officeStory:{dialoguePending:['emptyRoster','tollReceipt']}},
    save(){}, render(){}, addLog(){}, changeFixerTrust(){}, signatureStudents:()=>[], modalStack:[],
    document:{querySelector:()=>null,body:{classList:{contains:()=>false}}},
    setTimeout(fn){ return timers.push(fn); },
    pick(list){ assert.deepEqual(Array.from(list),members.slice(1,3)); return list[pickIndex]; },
    async vnPlay(title,lines,ask,options){ scenes.push({title,lines}); return options[0]; }
  };
  vm.createContext(cx);
  const schedule=()=>vm.runInContext('officeStoryModule.schedule()',cx);
  vm.runInContext(section('const officeStoryModule =','/* ================= 의뢰 생성'),cx);
  schedule();
  schedule();
  assert.equal(timers.length,1);
  await timers.shift()();
  assert.equal(cx.S.officeStory.lastStoryDay,60);
  assert.equal(timers.length,0);
  assert.deepEqual(Array.from(cx.S.officeStory.dialoguePending),['tollReceipt']);
  assert.ok(scenes[0].lines.some(([name,line])=>name==='민준' && line.includes('길목에 표시')));

  cx.S=JSON.parse(JSON.stringify(cx.S));
  schedule();
  assert.equal(timers.length,0);
  cx.S.day++;
  pickIndex=1;
  schedule();
  await timers.shift()();
  assert.equal(scenes[1].title,'장 마감 전 한 시간');
  assert.ok(scenes[1].lines.some(([name,line])=>name==='유나' && line.includes('손수레 끌고')));
  assert.equal(timers.length,0);
  cx.S.day++;
  schedule();
  await timers.shift()();
  assert.equal(scenes[2].title,'가판대 밑 영수증');
  assert.equal(timers.length,0);
});
test('사무소 심사는 대표 해결사 급수보다 앞서갈 수 없다',()=>{
  const cx={Math,gName:n=>n+'급',OFFICE_DIRECT_NEED:5,OFFICE_ROSTER_NEED:2,OFFICE_FALLBACK_OK:2};
  vm.createContext(cx);vm.runInContext(section('function officeReviewStatus(','function reviewProgressHtml('),cx);
  const w={n:6,ok:6,hi:6,sc:6};
  assert.equal(cx.officeReviewStatus(w,8,[{isLeader:true,grade:8}]).ok,false);
  assert.equal(cx.officeReviewStatus(w,8,[{isLeader:true,grade:7}]).ok,true);
});
test('해결사 심사는 실제 성공 건수까지만 반영한다',()=>{
  const cx={Math,clamp:(n,min,max)=>Math.min(max,Math.max(min,n))};
  vm.createContext(cx);vm.runInContext(section('const REVIEW_NEED','// 사무소 심사:'),cx);
  assert.equal(cx.reviewOf({n:4,ok:5,hi:4,sc:3.6},9).ok,true);
  assert.equal(cx.reviewOf({n:5,ok:2,hi:4,sc:4},9).ok,false);
  assert.equal(cx.reviewOf({n:4,ok:4,sc:4},9).ok,false);
  assert.equal(cx.reviewOf({n:4,ok:4,hi:4},9).ok,false);
  assert.equal(cx.reviewOf({n:4,ok:5,hi:5,sc:4},9,5).ok,false);
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
  const f={isLeader:false,grade:8,mp:100,mpMax:100};
  const cx={Math,S:{money:1000,moved:false,fixers:[f]},accFx:()=>false,INJ_COST:500,
    won:n=>n,addLog:()=>{},ac:()=>{},changeFixerTrust:()=>{},RENT_DAYS:28,rentForecast:()=>({total:0,base:0}),RENT_SALES:0.1};
  vm.createContext(cx);vm.runInContext(section('const WAGE_BY_GRADE','const TECH_BASE_PLUS'),cx);
  vm.runInContext(section('function officeFees(','async function review('),cx);
  cx.officeFees(7);assert.equal(cx.S.money,0);assert.equal(f.wageDue,1500);
  cx.S.money=5000;cx.officeFees(14);assert.equal(cx.S.money,1000);assert.equal(f.wageDue,0);
});
test('미리보기 시험 업적과 실제 성과 분리',()=>{
  for(const expr of [/function ltSave\(\)\{ if\(FXTEST\) return;/,
    /function achSave\(d\)\{ if\(FXTEST\)/,
    /function codexSave\(d\)\{ if\(FXTEST\)/,
    /function citySave\(d\)\{ if\(FXTEST\)/])assert.match(game,expr);
});
test('5인 미니게임 시험 및 마탄 설명',()=>{
  assert.match(game,/for\(let n=S\.fixers\.length;n<5;n\+\+\)/);
  assert.ok(production.includes('마탄 2발(6·7번째 탄환)'));
});
test('세계관: 죄종과 환상체의 의뢰 표시 분리',()=>{
  assert.match(game,/const requestDisplayKind = q =>/);
  assert.match(game,/a\.risk==="죄종"\?"죄종 조우":"환상체 의뢰"/);
});
test('자동 출동과 의뢰 카드 성공률 동일',()=>{
  assert.match(game,/function autoRate\(team, q\)\{ return rate\(team,q\)/);
  assert.match(game,/const base = rate\(team,q\)/);
});
test('목표 달성 시 의뢰 확정 성공',()=>assert.match(game,/else if\(r\.decisive===true[^\n]*\{ mgScore = r\.score; decisive = true;/));
test('피해 예측과 실제 정산 공통 계산 함수 사용',()=>{
  assert.match(game,/(?:const|let) pct = damagePercent\(f,q,success,w,mental,march/);
  assert.match(game,/mx\*damagePercent\(f,q,success,w,mental,march\)/);
});


test('고용 해결사의 신뢰 기본값과 창립 동료',()=>{
  assert.match(game,/hp:100, hpMax:100, mp:100, mpMax:100, trust:50, personality:/);
  assert.match(game,/S\.fixers\.push\(L,P\)/);
  assert.match(game,/const P2 = newFixer\(randomName\(\), 9, genStats\(9\)\)/);
  assert.match(game,/S\.fixers\.push\(P2\)/);
  assert.match(game,/P\.trust = P2\.trust = 65;/);
  assert.match(game,/L\.founder = P\.founder = P2\.founder = true/);
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
  const cx={VERSION:'v.a3.1.5.3',fixGrade1Threat:()=>{},Math,EARLY_DL_DAYS:14,REQ_BASE:{8:[20000]},migrateEgoStory169:()=>{},stripInvalidPromoExams:()=>{}};vm.createContext(cx);
  vm.runInContext(section('function repairRequestDeadline(','const NOM_P ='),cx);
  const d={v:'1.2.5.7',fixPay127:true,requests:[{grade:8,reward:10000,accepted:false}]};
  cx.migrate1247(d);cx.migrate1247(d);
  assert.equal(d.requests[0].reward,10000);assert.equal(d.v,cx.VERSION);
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

test('개인 사연 조사: 이름의 받침과 개인 사연 유형별 확인',()=>{
  const cx={}; vm.createContext(cx);
  vm.runInContext(section('function jo(w, type){','/* 하루 마감'),cx);
  vm.runInContext(section('  function personalCase(f,which){','  function postRequest('),cx);
  for(const [name,p] of [['유나','가'],['민준','이'],['서아','가'],['민혁','이']]){
    for(const kind of ['사람','동료','물건']){
      const c=cx.personalCase({name,precious:{kind,text:'소중한 것'}},2);
      assert.ok(c.text.startsWith(name+p+' '),c.text);
      assert.equal(c.text.includes('이(가)'),false);
      assert.equal(c.scene[0].includes('이(가)'),false);
    }
  }
});
test('사무소 1~3차 확장: 대표 제외 2·5·7·10명 및 등급 조건',()=>{
  const cx={S:{officeExpansion:0,officeGrade:8,money:1200000,fixers:[{isLeader:true},{isLeader:false},{isLeader:false}]}};
  vm.createContext(cx);
  vm.runInContext(section('const OFFICE_EXTENSIONS = [','async function openRecruit(){'),cx);
  const cap=()=>vm.runInContext('officeCompanionMax()',cx);
  const can=()=>vm.runInContext('officeExpansionAllowed(officeExpansionNext())',cx);
  assert.equal(cap(),2); assert.equal(can(),true);
  cx.S.money=99999; assert.equal(can(),false);
  cx.S.money=1200000;
  cx.S.officeExpansion=1; assert.equal(cap(),5); assert.equal(can(),false);
  cx.S.officeGrade=5; assert.equal(can(),true);
  cx.S.officeExpansion=2; assert.equal(cap(),7); assert.equal(can(),false);
  cx.S.officeGrade=3; assert.equal(can(),true);
  cx.S.officeExpansion=3; assert.equal(cap(),10); assert.equal(can(),false);
});
test('출동 인원: 일반 3명, 도시 악몽과 도시의 별 4명',()=>{
  const cx={threatOf:q=>q.threat||({9:'뜬소문',8:'도시 괴담',7:'도시 전설',6:'도시 전설',5:'도시 질병',4:'도시 질병',3:'도시 악몽',2:'도시 악몽',1:'도시의 별'})[q.grade]};
  vm.createContext(cx);
  vm.runInContext(section('const PARTY = {','function gearList('),cx);
  for(const [grade,cap] of [[9,3],[8,3],[7,3],[6,3],[5,3],[4,3],[3,4],[2,4],[1,4]]){
    assert.equal(vm.runInContext('partyMax({grade:'+grade+'})',cx),cap);
  }
  assert.equal(vm.runInContext('partyMax({grade:9,threat:"도시의 별"})',cx),4);
  assert.equal(vm.runInContext('partyMax({grade:1,threat:"도시 질병"})',cx),3);
  assert.equal(vm.runInContext('partyMax({grade:1,kind:"특색 심사"})',cx),1);
  assert.match(game,/team.length>partyMax\(q\)/);
  assert.match(game,/else if\(sel.length < partyMax\(q\)\)/);
});

test('운영에 미리보기 전투 및 수색 규칙을 함께 배포한다',()=>{
  const previewGame=inlineScripts(preview).find(script=>script.includes('const VERSION ='));
  const removeEnvironmentKeys=source=>source.replaceAll(/(const (?:SAVE_KEY|FORMER_KEY|CITY_KEY|CODEX_KEY|ACH_LT_KEY|ACH_KEY) = "[^"]+)-preview";/g,'$1";')
    .replaceAll(/^\/\* 미리보기 사이트에서만 보이는.*\n|^const IS_PROD = .*\n/gm,'')
    .replace('if(IS_PROD || document.getElementById("pvbtn"))','if(document.getElementById("pvbtn"))');
  assert.equal(removeEnvironmentKeys(game),removeEnvironmentKeys(previewGame));
});

test('공격 손패와 고유 기술 고정 칸이 분리되고 기존 장착은 안전하게 이관된다',()=>{
  const cx=vm.createContext({TECHS:{brace:{def:true},old:{},allout:{}},Math,document:{addEventListener(){}}});
  vm.runInContext(section('const KEYWORD_NAMES=','function keywordCap('),cx);
  vm.runInContext(section('const SIGNATURE_TECHS =','function signatureLink('),cx);
  vm.runInContext(section('const MAX_BASIC_TECHS =','function syncAllStatVitals('),cx);
  const result=vm.runInContext(`(()=>{
    const keywordPlan={keys:["bleed","burn","tremor"],order:[0,1,2]};
    const leader={hp:100,grade:8,keywordPlan,tech:"allout",techs:["old","brace"],guardTech:"brace"};
    const partner={hp:100,grade:8,keywordPlan,tech:"old",techs:["old"]};
    const absent={hp:0};
    const office={fixers:[leader,partner,absent]};
    limitBasicTechs(leader);
    limitBasicTechs(partner);
    const initial=[leader.tech,leader.guardTech,partner.tech];
    const initialChoices=signatureCandidates(leader);
    const plan=signatureStudents(office).map(f=>[f,signatureCandidates(f)[0]]);
    if(office.fixers.some(f=>f.tech) || office.signatureTechs) throw new Error("장면 종료 전에 기술 지급");
    const taught=learnOfficeSignatures(office,plan);
    const earned=taught.map(([f])=>f.tech);
    const reloaded=JSON.parse(JSON.stringify(office));
    reloaded.fixers.forEach(limitBasicTechs);
    const stays=signatureStudents(reloaded).length;
    const before=reloaded.signatureTechs.slice();
    const veteran=limitBasicTechs({hp:100,grade:4,keywordPlan,tech:"sig_step"});
    const canRelearn=signatureCanRelearn(veteran);
    const veteranChoices=signatureCandidates(veteran);
    learnOfficeSignatures(reloaded,[[veteran,"sig_ember"]]);
    return {initial,earned,stays,before,after:reloaded.signatureTechs,initialChoices,canRelearn,veteranChoices,
      signatureCount:Object.keys(SIGNATURE_TECHS).length,deck:NORMAL_ATTACK_DECK};
  })()`,cx);
  const json=JSON.parse(JSON.stringify(result));
  assert.deepEqual(json.initial,[null,'brace',null]);
  assert.deepEqual(json.earned,['sig_seam','sig_seam']);
  assert.equal(json.stays,0);
  assert.deepEqual(json.initialChoices,['sig_seam','sig_stitch']);
  assert.ok(json.canRelearn);
  assert.ok(json.veteranChoices.includes('sig_ember'));
  assert.ok(!json.veteranChoices.includes('sig_echo'));
  assert.deepEqual(json.after.slice(0,json.before.length),json.before);
  assert.equal(json.signatureCount,15);
  assert.equal(json.deck.length,10);
  assert.ok(json.deck.every(card=>[0,6,7].includes(card)));
  assert.match(game,/data-combat-defense[\s\S]{0,450}data-signature-slot/);
});

test('화상은 턴 종료에 한 번 피해를 주고 진동은 부여한 턴에 유지된다',()=>{
  const cx=vm.createContext({esc:x=>x,document:{addEventListener(){}}});
  vm.runInContext(section('const KEYWORD_NAMES=','// 네 능력치의'),cx);
  const result=vm.runInContext(`(()=>{
    const enemy={hp:50,shield:2,name:"적"}, notes=[];
    keywordAdd(enemy,"burn",30);
    keywordAdd(enemy,"tremor",3);
    const immediate=keywordImpact(enemy,keywordSnapshot(enemy),1,notes);
    keywordBurn(enemy,notes);
    keywordDecay(enemy);
    const first=[enemy.hp,enemy.shield,enemy.burn,enemy.tremor];
    keywordDecay(enemy);
    return {immediate,first,later:enemy.tremor};
  })()`,cx);
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{immediate:0,first:[40,0,9,3],later:1});
});

test('침잠은 일반 대상에 추가 피해를 주고 보호막 대상에 더 강하다',()=>{
  const cx=vm.createContext({esc:x=>x,document:{addEventListener(){}}});
  vm.runInContext(section('const KEYWORD_NAMES=','// 네 능력치의'),cx);
  const result=vm.runInContext(`(()=>{
    const bare={hp:50,sink:8,shield:0}, shielded={hp:50,sink:8,shield:10};
    const first=keywordImpact(bare,keywordSnapshot(bare),1,[]);
    const second=keywordImpact(shielded,keywordSnapshot(shielded),1,[]);
    const intact=shielded.shield;
    const hpDamage=keywordShield(shielded,second,[]);
    return [first,second,intact,hpDamage,shielded.shield];
  })()`,cx);
  assert.deepEqual(Array.from(result),[8,12,10,2,0]);
});

test('고유 특수 키워드 12종의 발동·소멸·상한',()=>{
  const cx=vm.createContext({
    TECHS:{}, esc:String, document:{addEventListener(){}},
    foeDefenseDamage:(foe,dmg)=>Math.max(0,dmg-(foe.defense||0))
  });
  vm.runInContext(section('const KEYWORD_NAMES=','// 네 능력치의'),cx);
  vm.runInContext(section('const SIGNATURE_MARKS=','function knownSignature('),cx);
  const results=vm.runInContext(`(()=>{
    const notes=[], actor=()=>({name:"대상",hp:100});
    const T=id=>SIGNATURE_TECHS[id];
    const me=actor();
    const scar={...actor(),bleed:5};
    prepareSignatureMark(T("sig_seam"),scar,notes);
    signatureMarkTurnEnd(scar,notes);
    const scarFirst=scar.hp;
    signatureMarkTurnEnd(scar,notes);
    const blood={...actor(),bleed:7};
    prepareSignatureMark(T("sig_stitch"),blood,notes);
    keywordDecay(blood,signatureMarkTurnEnd(blood,notes));
    const flames=[["sig_ember",22,0],["sig_spark",17,3]].map(([id,cap,defense])=>{
      const foe={...actor(),defense};
      prepareSignatureMark(T(id),foe,notes);
      const raised=keywordCap("burn",foe);
      keywordAdd(foe,"burn",99);
      const hit=finishSignatureMark(T(id),me,foe,1,notes);
      return [raised,hit,foe.burn,keywordCap("burn",foe)];
    });
    const sink={...actor(),sink:8};
    const triple=id=>[1,2,3].map(()=>{
      prepareSignatureMark(T(id),sink,notes);
      return finishSignatureMark(T(id),me,sink,1,notes);
    });
    const panic=triple("sig_lamp"), shield=me.shield;
    me.shield=0;
    const submerge=triple("sig_rope"), self=me.hp;
    const echo={...actor(),tremor:9};
    prepareSignatureMark(T("sig_echo"),echo,notes);
    signatureMarkTurnEnd(echo,notes);
    const echoFirst=echo.hp;
    signatureMarkClashStart(echo,notes);
    keywordDecay(echo,signatureMarkTurnEnd(echo,notes));
    const axis={...actor(),tremor:9};
    prepareSignatureMark(T("sig_latch"),axis,notes);
    const axisFirst=finishSignatureMark(T("sig_latch"),me,axis,1,notes);
    prepareSignatureMark(T("sig_latch"),axis,notes);
    const axisSecond=finishSignatureMark(T("sig_latch"),me,axis,1,notes);
    const explosive={...actor(),charge:8};
    const primer=beginSignatureMark(T("sig_step"),explosive,actor(),false,notes);
    const primerCap=keywordCap("charge",explosive);
    const discharge=actor(), victim=actor();
    for(let i=0;i<3;i++){discharge.charge=10;beginSignatureMark(T("sig_handoff"),discharge,victim,false,notes);}
    const spirit=actor();
    beginSignatureMark(T("sig_palm"),spirit,victim,false,notes);
    for(let i=0;i<3;i++)beginSignatureMark(T("sig_turn"),spirit,victim,false,notes);
    return {effects:[...new Set(Object.values(SIGNATURE_TECHS).map(t=>t.mark))].length,scar:[scarFirst,scar.hp],blood:[blood.hp,blood.bleed],flames,
      panic:[...panic,shield],submerge:[...submerge,self],echo:[echoFirst,echo.hp,echo.tremor],axis:[axisFirst,axisSecond,axis.tremor,axis.coinDown],
      primer:[primer,primerCap,explosive.charge],discharge:[victim.hp,keywordCap("charge",discharge),discharge.charge],
      spirit:[spirit.signatureMarks.clear,spirit.signatureMarks.flash]};
  })()`,cx);
  assert.deepEqual(JSON.parse(JSON.stringify(results)),{
    effects:12,scar:[92,88],blood:[93,7],flames:[[22,33,12,12],[17,31,12,12]],panic:[0,0,8,8],submerge:[0,0,16,96],
    echo:[92,88,9],axis:[0,18,4,2],primer:[10,30,3],discharge:[85,15,0],spirit:[1,3]
  });
});

test('고유 기술이 없는 인원이 있을 때만 첫 만남과 재등장 확률을 적용한다',()=>{
  const cx=vm.createContext({save(){},Math,NAMELESS_P:.035});
  vm.runInContext(section('function rescueDue(','const rescueVoices'),cx);
  assert.equal(vm.runInContext('rescueDue({},1,1,()=>0)',cx),false);
  assert.equal(vm.runInContext('rescueDue({},5,1,()=>.0874)',cx),true);
  assert.equal(vm.runInContext('rescueDue({},5,1,()=>.0876)',cx),false);
  assert.equal(vm.runInContext('rescueDue({},7,1,()=>1)',cx),true);
  assert.equal(vm.runInContext('rescueDue({},7,0,()=>0)',cx),false);
  assert.equal(vm.runInContext('rescueDue({namelessSeen:true},7,1,()=>1)',cx),false);
  assert.equal(vm.runInContext('rescueDue({namelessPending:true},7,1,()=>1)',cx),true);
  assert.equal(vm.runInContext(`(()=>{
    const d={};
    rescueDue(d,5,1,()=>1);
    return rescueDue(d,5,1,()=>0);
  })()`,cx),false);
});

test('미리보기는 위험한 수만 예고하며 인간형 적의 강공 뒤에는 일반 행동이 이어진다',()=>{
  const start=preview.indexOf('function nextHumanIntent('), end=preview.indexOf('function mgCombat(',start);
  assert.ok(start>=0&&end>start);
  const cx=vm.createContext({});
  vm.runInContext(preview.slice(start,end),cx);
  const intent=cx.nextHumanIntent;
  assert.equal(intent('probe',.1),'heavy');
  assert.equal(intent('probe',.7),'feint');
  assert.equal(intent('probe',.9),'probe');
  assert.equal(intent('feint',.9),'heavy');
  assert.equal(intent('heavy',.1),'guard');
  assert.equal(intent('heavy',.9),'probe');
  assert.equal(intent('guard',.1),'probe');
  assert.equal(cx.dangerousFoeSkill({heavy:true}),true);
  assert.equal(cx.dangerousFoeSkill({bossSig:'bark'}),true);
  assert.equal(cx.dangerousFoeSkill({danger:true}),true);
  assert.equal(cx.dangerousFoeSkill({}),false);
  assert.equal(cx.dangerousFoeSkill({def:true,danger:true}),false);
});

test('미리보기 문답 수색은 16개 장소를 제한 안에 구분한다',()=>{
  const start=preview.indexOf('const SEARCH_LOCATIONS ='), end=preview.indexOf('function mgSearch(',start);
  assert.ok(start>=0&&end>start);
  const cx=vm.createContext({});
  vm.runInContext(preview.slice(start,end),cx);
  vm.runInContext(`(()=>{
    if(SEARCH_LOCATIONS.length!==16 || Object.keys(SEARCH_QUESTIONS).length!==23) throw Error('수색 데이터 수');
    if(new Set(SEARCH_LOCATIONS.map(x=>x.tags.slice().sort().join())).size!==16) throw Error('구별되지 않는 후보');
    for(const location of SEARCH_LOCATIONS){
      for(const tag of location.tags) if(!Object.hasOwn(SEARCH_QUESTIONS,tag)) throw Error('질문이 없는 태그');
    }
    for(let seed=1;seed<=12;seed++) for(const goal of SEARCH_LOCATIONS){
      let state=seed, possible=SEARCH_LOCATIONS;
      const rng=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
      const asked=new Set();
      for(let left=7;possible.length>1 && left>0;left--){
        const options=searchQuestionOptions(possible,asked,left,rng);
        if(!options.length) throw Error('다음 질문 없음');
        const {id}=options[Math.floor(rng()*options.length)];
        const yes=goal.tags.includes(id);
        if(asked.has(id)) throw Error('중복 질문');
        asked.add(id);
        const remaining=possible.filter(place=>place.tags.includes(id)===yes);
        if(!remaining.includes(goal) || remaining.length>=possible.length) throw Error('잘못된 답변');
        possible=remaining;
      }
      if(possible.length!==1 || possible[0]!==goal) throw Error('질문 한도 내 미해결');
    }
  })()`,cx);
});

test('미리보기의 인간형 키워드, 환상체 압박, 죄종 및 뒤틀림 규칙이 분리된다',()=>{
  const cx=vm.createContext({
    clamp:(n,min,max)=>Math.min(max,Math.max(min,n)),
    isDistContract:q=>q.kind==='뒤틀림 토벌',
    threatOf:q=>q.threat
  });
  const sectionOf=(a,b)=>preview.slice(preview.indexOf(a),preview.indexOf(b,preview.indexOf(a)));
  vm.runInContext(sectionOf('const DIST_TIER =','const DIST_PLACES')+sectionOf('function combatDistortion(','function distAfter('),cx);
  vm.runInContext(sectionOf('function foeBalanceGrade(','function foeDefenseDamage('),cx);
  assert.equal(cx.foeBalance({},null,null,7).kw,0);
  assert.equal(cx.foeBalance({},null,null,6).kw,2);
  assert.equal(cx.foeBalance({},{risk:'ALEPH'},null,1).kw,0);
  assert.equal(cx.foeBalance({},{kill:true},null,9).hp,0);
  assert.ok(vm.runInContext('!AB_COMBAT_PRESSURE.ZAYIN && AB_COMBAT_PRESSURE.TETH.sp>0',cx));
  for(const [th,coins,fixedHit] of [['도시 질병',4,3],['도시 악몽',5,4],['도시의 별',6,5]]){
    const old={distFoe:{th,mp:25,cards:[{n:'찌르기',a:4,b:8},{n:'방패',a:4,b:7,def:true}]}};
    const foe=cx.combatDistortion(old);
    assert.equal(foe.fixedHit,fixedHit);
    assert.equal(foe.cards.length,1);
    assert.equal(foe.cards[0].normalCoins,coins);
    assert.equal(cx.foeBalance({},null,foe,1).kw,0);
    assert.equal(cx.foeBalance({},null,foe,1).def,0);
    assert.ok(cx.combatDistortion({kind:'뒤틀림 토벌',threat:th}).cards.every(card=>card.normalCoins===coins));
  }
});
