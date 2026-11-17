/* 해결사 사무소 — 정적 파일(public/)을 내보내고, /api/ego 만 직접 처리한다.
   /api/ego: 개화하는 해결사의 기록을 받아 Anthropic API로 개화 E.G.O 이름·모습을 짓는다.
   Cloudflare 대시보드 → Workers → problem-solver-city → 설정 → 변수 및 비밀에 ANTHROPIC_API_KEY(비밀)를 넣어야 동작한다.
   키가 없으면 503을 돌려주고, 게임은 손으로 지은 목록에서 고른다. */
import { egoPrompt } from "./ego-prompt.js";
const MODEL = "claude-sonnet-5-5";
const clip = (v, n) => String(v ?? "").slice(0, n);
function clean(d){
  const L = {}; for(const k of ["kill","spare","escort","chase","search","abno","hunt","fail","heavy","solo","crew","grief"]) if(+d?.life?.[k]) L[k] = Math.min(999, +d.life[k]|0);
  const st = d?.stats || {};
  return { name: clip(d?.name, 20), grade: clip(d?.grade, 8), personality: clip(d?.personality, 8), leader: !!d?.leader,
    stats: { str: +st.str|0, agi: +st.agi|0, tec: +st.tec|0, wil: +st.wil|0 },
    precious: { kind: clip(d?.precious?.kind, 8), text: clip(d?.precious?.text, 30), lost: !!d?.precious?.lost, why: clip(d?.precious?.why, 80) },
    days: +d?.days|0, done: +d?.done|0, life: L, weapon: d?.weapon ? clip(d.weapon, 30) : null,
    diary: (Array.isArray(d?.diary) ? d.diary : []).slice(-12).map(x=>clip(x, 90)),
    records: (Array.isArray(d?.records) ? d.records : []).slice(-5).map(x=>clip(x, 90)),
    taken: (Array.isArray(d?.taken) ? d.taken : []).slice(0, 12).map(x=>clip(x, 14)) };
}
export default {
  async fetch(req, env){
    const url = new URL(req.url);
    if(url.pathname !== "/api/ego") return env.ASSETS.fetch(req);
    if(req.method !== "POST") return new Response("POST only", {status:405});
    if(!env.ANTHROPIC_API_KEY) return new Response("no key", {status:503});
    let d; try{ const t = await req.text(); if(t.length > 8000) throw 0; d = clean(JSON.parse(t)); }catch(e){ return new Response("bad request", {status:400}); }
    const r = await fetch("https://api.anthropic.com/v1/messages", { method:"POST",
      headers:{ "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01", "content-type":"application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages:[{ role:"user", content: egoPrompt(d) }] }) });
    if(!r.ok) return new Response("upstream " + r.status, {status:502});
    const j = await r.json(); const text = (j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("");
    return new Response(text, {headers:{"content-type":"text/plain; charset=utf-8", "cache-control":"no-store"}});
  }
};
