// ==UserScript==
// @name         D's Torn Stock Predictor - Beta
// @namespace    https://github.com/djoiner89/torn-stock-tools
// @version      0.3
// @description  API-only Torn stock predictor with rankings, history, and backtesting
// @match        https://www.torn.com/page.php?sid=stocks*
// @updateURL    https://raw.githubusercontent.com/djoiner89/torn-stock-tools/main/ds-torn-stock-predictor.user.js
// @downloadURL  https://raw.githubusercontent.com/djoiner89/torn-stock-tools/main/ds-torn-stock-predictor.user.js
// @grant        none
// ==/UserScript==

(() => {
'use strict';

/*
 D'S TORN STOCK PREDICTOR v0.3 — API-ONLY REBUILD

 Compliance design:
 - Torn stock data comes only from https://api.torn.com/v2
 - No page.php getChartData requests.
 - No scraping of hidden/unfocused Torn pages.
 - No automated gameplay actions.
 - No non-API retries because this build makes no non-API data requests.

 API privacy / use:
 - Requires only a PUBLIC-access Torn API key.
 - Key is stored locally in this browser.
 - Key is sent only to Torn's official API.
 - Key/data are not sent to the developer or third parties.
 - Stock snapshots, predictions and settings are stored locally for analysis/backtesting.
*/

const VERSION = '0.3';
const API = 'https://api.torn.com/v2';
const KEY_KEY = 'dstp_v03_api_key';
const SNAP_KEY = 'dstp_v03_daily_snapshots';
const PRED_KEY = 'dstp_v03_predictions';
const PANEL_KEY = 'dstp_v03_panel';
const CACHE_KEY = 'dstp_v03_last_results';
const MAX_DAILY = 180;
const MAX_PRED = 90;
const DELAY = 180;

let results = [];
let busy = false;
let sortMode = 'opportunity';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function load(k,f=null){try{const x=JSON.parse(localStorage.getItem(k));return x??f}catch{return f}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function money(v){return num(v)==null?'—':'$'+Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function pct(v){return num(v)==null?'—':`${v>=0?'+':''}${Number(v).toFixed(2)}%`}
function dayKey(ts=Date.now()){return new Date(ts).toISOString().slice(0,10)}

async function api(path,key){
    const r=await fetch(API+path,{headers:{Accept:'application/json',Authorization:`ApiKey ${key}`}});
    let d;
    try{d=await r.json()}catch{throw new Error(`Torn API HTTP ${r.status}`)}
    if(!r.ok||d?.error){
        const e=d?.error?.error||d?.error?.message||d?.error||`HTTP ${r.status}`;
        throw new Error(String(e));
    }
    return d;
}

function getKey(){
    let k=localStorage.getItem(KEY_KEY)||'';
    if(!k){
        k=(prompt(
`D's Torn Stock Predictor v${VERSION}

Enter a PUBLIC-access Torn API key.

• Stored only in this browser
• Sent only to Torn's official API
• Never sent to the developer or a third party
• Used only for stock analysis`
        )||'').trim();
        if(k)localStorage.setItem(KEY_KEY,k);
    }
    return k;
}

function perf(stock,key){
    return num(stock?.chart?.performance?.[key]?.change_percentage);
}

function volatility(history){
    if(!Array.isArray(history)||history.length<3)return 0;
    const rs=[];
    for(let i=1;i<history.length;i++){
        const a=num(history[i-1]?.price),b=num(history[i]?.price);
        if(a&&b!=null)rs.push(((b-a)/a)*100);
    }
    if(!rs.length)return 0;
    const m=rs.reduce((a,b)=>a+b,0)/rs.length;
    return Math.sqrt(rs.reduce((a,b)=>a+(b-m)**2,0)/rs.length);
}

function analyze(stock){
    const price=num(stock?.market?.price);
    const hour=perf(stock,'last_hour');
    const day=perf(stock,'last_day');
    const week=perf(stock,'last_week');
    const month=perf(stock,'last_month');
    const year=perf(stock,'last_year');
    const all=perf(stock,'all_time');
    const hist=Array.isArray(stock?.chart?.history)?stock.chart.history:[];
    const vol=volatility(hist.slice(-120));

    const parts=[
        [hour,.32],[day,.28],[week,.23],[month,.17]
    ].filter(([v])=>v!=null);
    const momentum=parts.reduce((s,[v,w])=>s+v*w,0);
    const dir=[hour,day,week].filter(v=>v!=null).reduce((s,v)=>s+(v>0?1:v<0?-1:0),0);

    const trend=clamp(50+momentum*3.5+dir*6-Math.min(vol*1.2,10),0,100);
    const pullback=(hour!=null&&hour<0&&week!=null&&week>0)?Math.min(Math.abs(hour)*2,8):0;
    const opportunity=clamp(trend*.78+(week==null?10:clamp(10+week,0,20))+pullback,0,100);

    let signal='WATCH';
    if(opportunity>=75&&trend>=62)signal='STRONG';
    else if(opportunity>=62&&trend>=55)signal='POSITIVE';
    else if(trend<=38)signal='WEAK';

    return {stock,price,hour,day,week,month,year,all,vol,trend,opportunity,signal};
}

function safeResult(r){
    return {
        stock:{
            id:r.stock.id,name:r.stock.name,acronym:r.stock.acronym,
            market:r.stock.market,bonus:r.stock.bonus
        },
        price:r.price,hour:r.hour,day:r.day,week:r.week,month:r.month,
        year:r.year,all:r.all,vol:r.vol,trend:r.trend,
        opportunity:r.opportunity,signal:r.signal
    };
}

function storeScan(rs){
    save(CACHE_KEY,{time:Date.now(),results:rs.map(safeResult)});

    const snaps=load(SNAP_KEY,[]);
    const snap={
        time:Date.now(),
        prices:Object.fromEntries(rs.map(r=>[r.stock.id,r.price]))
    };
    const dk=dayKey();
    const ix=snaps.findIndex(s=>dayKey(s.time)===dk);
    if(ix>=0)snaps[ix]=snap;else snaps.push(snap);
    snaps.sort((a,b)=>a.time-b.time);
    while(snaps.length>MAX_DAILY)snaps.shift();
    save(SNAP_KEY,snaps);

    const preds=load(PRED_KEY,[]);
    const pix=preds.findIndex(p=>dayKey(p.time)===dk);
    const pred={
        time:Date.now(),
        items:rs.map(r=>({
            id:r.stock.id,acronym:r.stock.acronym,price:r.price,
            trend:r.trend,opportunity:r.opportunity,signal:r.signal
        }))
    };
    if(pix>=0)preds[pix]=pred;else preds.push(pred);
    preds.sort((a,b)=>a.time-b.time);
    while(preds.length>MAX_PRED)preds.shift();
    save(PRED_KEY,preds);
}

function nearestPrediction(target,maxDiff){
    let best=null,diff=Infinity;
    for(const p of load(PRED_KEY,[])){
        const d=Math.abs(p.time-target);
        if(d<diff){best=p;diff=d}
    }
    return best&&diff<=maxDiff?best:null;
}

function backtest(){
    if(!results.length)return [];
    const now=Date.now();
    return [
        ['24h',86400000,12*3600000],
        ['7d',604800000,36*3600000],
        ['30d',2592000000,72*3600000]
    ].map(([label,ms,tolerance])=>{
        const old=nearestPrediction(now-ms,tolerance);
        if(!old)return {label,count:0,avg:null,hit:null};
        const vals=[];
        for(const p of old.items){
            if(p.opportunity<62)continue;
            const cur=results.find(r=>Number(r.stock.id)===Number(p.id));
            if(cur&&p.price&&cur.price!=null)vals.push(((cur.price-p.price)/p.price)*100);
        }
        return {
            label,count:vals.length,
            avg:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,
            hit:vals.length?vals.filter(v=>v>0).length/vals.length*100:null
        };
    });
}

async function scanAll(){
    if(busy)return;
    const key=getKey(); if(!key)return;
    busy=true;
    try{
        status('Loading stock list from official Torn API…');
        const base=await api('/torn/stocks',key);
        const stocks=Array.isArray(base?.stocks)?base.stocks:[];
        if(!stocks.length)throw new Error('No stocks returned by Torn API.');

        const out=[];
        const failures=[];
        for(let i=0;i<stocks.length;i++){
            const s=stocks[i];
            status(`API scan ${i+1}/${stocks.length}: ${s.acronym||s.name||'#'+s.id}`);
            try{
                const d=await api(`/torn/${encodeURIComponent(s.id)}/stocks`,key);
                if(d?.stocks)out.push(analyze(d.stocks));
            }catch(e){
                failures.push(`${s.acronym||s.id}: ${e.message}`);
                console.warn('Stock API request failed:',s,e);
            }
            if(i<stocks.length-1)await sleep(DELAY);
        }

        if(!out.length)throw new Error('No stock analyses completed.');
        results=out;
        storeScan(out);
        render();
        status(`${out.length}/${stocks.length} stocks analyzed • API-only${failures.length?` • ${failures.length} failed`:''}`);
    }catch(e){status(`Error: ${e.message}`,true)}
    finally{busy=false}
}

async function current(){
    if(busy)return;
    const id=Number(new URLSearchParams(location.search).get('stockID'));
    if(!id){status('Open a specific stock first, or use Scan All Stocks.',true);return}
    const key=getKey();if(!key)return;
    busy=true;
    try{
        status(`Loading stock #${id} from official Torn API…`);
        const d=await api(`/torn/${id}/stocks`,key);
        if(!d?.stocks)throw new Error('No stock returned.');
        results=[analyze(d.stocks)];
        render();
        status(`${d.stocks.acronym} analyzed • API-only`);
    }catch(e){status(`Error: ${e.message}`,true)}
    finally{busy=false}
}

function sorted(){
    const a=[...results];
    if(sortMode==='trend')a.sort((x,y)=>y.trend-x.trend);
    else a.sort((x,y)=>y.opportunity-x.opportunity);
    return a;
}

function render(){
    const o=document.getElementById('dstp-output');if(!o)return;
    const a=sorted();
    o.innerHTML=`
      <div class="sum"><b>${a.length}</b> stock${a.length===1?'':'s'} analyzed • Official Torn API v2</div>
      <div class="sorts">
        <button id="dstp-sort-o">Sort Opportunity</button>
        <button id="dstp-sort-t">Sort Trend</button>
      </div>
      <div class="tablewrap"><table>
        <thead><tr><th>Stock</th><th>Price</th><th>1h</th><th>1d</th><th>7d</th><th>30d</th><th>1y</th><th>Trend</th><th>Opportunity</th><th>Signal</th></tr></thead>
        <tbody>${a.map(r=>`<tr>
          <td><b>${esc(r.stock.acronym)}</b><small>${esc(r.stock.name)}</small></td>
          <td>${money(r.price)}</td>
          <td class="${(r.hour??0)>=0?'pos':'neg'}">${pct(r.hour)}</td>
          <td class="${(r.day??0)>=0?'pos':'neg'}">${pct(r.day)}</td>
          <td class="${(r.week??0)>=0?'pos':'neg'}">${pct(r.week)}</td>
          <td class="${(r.month??0)>=0?'pos':'neg'}">${pct(r.month)}</td>
          <td class="${(r.year??0)>=0?'pos':'neg'}">${pct(r.year)}</td>
          <td>${r.trend.toFixed(1)}</td>
          <td><b>${r.opportunity.toFixed(1)}</b></td>
          <td><span class="sig ${r.signal.toLowerCase()}">${r.signal}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="note">Experimental estimate only. Scores are decision support, not a guarantee of future performance.</div>`;
    document.getElementById('dstp-sort-o').onclick=()=>{sortMode='opportunity';render()};
    document.getElementById('dstp-sort-t').onclick=()=>{sortMode='trend';render()};
}

function showBacktest(){
    const o=document.getElementById('dstp-output');
    if(!results.length){o.innerHTML='<div class="card">Run a scan first.</div>';return}
    const rows=backtest();
    o.innerHTML=`
      <div class="card"><b>Prediction Backtest</b><br><span class="muted">Uses daily predictions saved locally by this API-only version.</span></div>
      <div class="tablewrap"><table>
      <thead><tr><th>Window</th><th>Positive Signals Tested</th><th>Average Return</th><th>Positive Result</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.label}</td><td>${r.count}</td><td>${r.avg==null?'Pending':pct(r.avg)}</td><td>${r.hit==null?'Pending':r.hit.toFixed(1)+'%'}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="note">New installations need time to accumulate local prediction snapshots for 24h/7d/30d backtesting.</div>`;
}

function status(t,error=false){
    const e=document.getElementById('dstp-status');
    if(e){e.textContent=t;e.classList.toggle('err',error)}
}

function css(){
    const s=document.createElement('style');
    s.textContent=`
#dstp{position:fixed;z-index:999999;top:90px;right:18px;width:min(980px,calc(100vw - 28px));max-height:84vh;background:#181818;color:#ddd;border:1px solid #454545;border-radius:8px;box-shadow:0 8px 28px #000b;font:13px Arial,sans-serif;overflow:hidden}
#dstp-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(#383838,#252525);border-bottom:1px solid #444;cursor:move}
#dstp-head b{font-size:15px;color:#fff}#dstp-head span{font-size:11px;color:#999}
#dstp-head button,#dstp button{background:#333;color:#eee;border:1px solid #555;border-radius:5px;padding:6px 9px;cursor:pointer}
#dstp-head button:hover,#dstp button:hover{background:#444}
#dstp-body{padding:10px;max-height:calc(84vh - 43px);overflow:auto}
.compliance{padding:8px 9px;margin-bottom:8px;border:1px solid #3d6849;background:#1c3323;color:#a8eab5;border-radius:5px;font-weight:bold}
.actions,.sorts{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0}
#dstp-status,.card,.sum,.note{padding:8px 9px;margin:7px 0;background:#202020;border:1px solid #383838;border-radius:5px}
#dstp-status{background:#111;color:#bbb}.err{color:#ff9b9b!important;border-color:#733!important}
.tablewrap{overflow-x:auto;border:1px solid #383838;border-radius:5px}
#dstp table{border-collapse:collapse;width:100%;white-space:nowrap;background:#1d1d1d}
#dstp th{background:#292929;color:#bbb;text-align:left;padding:7px;border-bottom:1px solid #444}
#dstp td{padding:7px;border-bottom:1px solid #303030}
#dstp td small{display:block;color:#888;max-width:160px;overflow:hidden;text-overflow:ellipsis}
.pos{color:#91dda0}.neg{color:#ec9a9a}.muted,.note{color:#999}
.sig{padding:3px 6px;border-radius:4px;background:#333;font-size:11px;font-weight:bold}
.sig.strong{background:#24532f;color:#acf0b7}.sig.positive{background:#344a2e;color:#cae9ad}.sig.weak{background:#582d2d;color:#ffb3b3}
details{margin-top:9px;padding:8px;border-top:1px solid #333;color:#aaa}summary{cursor:pointer;color:#ccc}details div{padding-top:7px;line-height:1.45}
`;
    document.head.appendChild(s);
}

function drag(panel,head){
    let on=false,dx=0,dy=0;
    head.addEventListener('mousedown',e=>{
        if(e.target.tagName==='BUTTON')return;
        const r=panel.getBoundingClientRect();on=true;dx=e.clientX-r.left;dy=e.clientY-r.top;e.preventDefault();
    });
    addEventListener('mousemove',e=>{
        if(!on)return;
        const l=clamp(e.clientX-dx,0,Math.max(0,innerWidth-panel.offsetWidth));
        const t=clamp(e.clientY-dy,0,Math.max(0,innerHeight-45));
        panel.style.left=l+'px';panel.style.top=t+'px';panel.style.right='auto';
    });
    addEventListener('mouseup',()=>{
        if(!on)return;on=false;
        const r=panel.getBoundingClientRect();save(PANEL_KEY,{left:r.left,top:r.top});
    });
}

function init(){
    if(document.getElementById('dstp'))return;
    css();
    const p=document.createElement('div');p.id='dstp';
    p.innerHTML=`
      <div id="dstp-head"><div><b>D's Torn Stock Predictor</b> <span>v${VERSION}</span></div><button id="dstp-min">—</button></div>
      <div id="dstp-body">
        <div class="compliance">API-ONLY REBUILD • PUBLIC-ACCESS KEY • NO NON-API STOCK DATA REQUESTS</div>
        <div class="actions">
          <button id="dstp-current">Analyze Current Stock</button>
          <button id="dstp-all">Scan All Stocks</button>
          <button id="dstp-back">Backtest</button>
          <button id="dstp-key">Clear API Key</button>
        </div>
        <div id="dstp-status">Ready. This build uses Torn API v2 for stock data.</div>
        <div id="dstp-output"><div class="card">The old non-API <b>getChartData</b> system has been removed. Run a scan to begin.</div></div>
        <details><summary>API privacy / use disclosure</summary><div>
          This tool requires only a <b>Public</b> Torn API key. The key is stored locally in this browser and sent only to Torn's official API.
          It is not sent to the developer or third parties. Stock snapshots, predictions and settings may be stored locally for analysis and backtesting.
          The tool does not automatically buy or sell stocks or perform gameplay actions.
        </div></details>
      </div>`;
    document.body.appendChild(p);

    const pos=load(PANEL_KEY);
    if(pos&&num(pos.left)!=null&&num(pos.top)!=null){p.style.left=pos.left+'px';p.style.top=pos.top+'px';p.style.right='auto'}

    document.getElementById('dstp-current').onclick=current;
    document.getElementById('dstp-all').onclick=scanAll;
    document.getElementById('dstp-back').onclick=showBacktest;
    document.getElementById('dstp-key').onclick=()=>{localStorage.removeItem(KEY_KEY);status('API key cleared. You will be asked for a key on the next scan.')};
    document.getElementById('dstp-min').onclick=()=>{const b=document.getElementById('dstp-body');b.style.display=b.style.display==='none'?'':'none'};
    drag(p,document.getElementById('dstp-head'));

    const cached=load(CACHE_KEY);
    if(cached?.results?.length){
        results=cached.results;
        render();
        status(`Last API-only scan restored • ${new Date(cached.time).toLocaleString()}`);
    }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();

})();
