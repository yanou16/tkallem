// Captures screens 03 to 06 of docs/pitch-assets from the LIVE app, as a guest, in Text mode (no stubbed API).
// Usage: CHROME_PATH=/path/to/chrome A1="your answer" node capture.mjs   (needs `npm i playwright-core`)
// 01 and 02 are plain viewport screenshots of /welcome and of the first coach question (see README.md).
import { chromium } from "playwright-core";
const EXE = process.env.CHROME_PATH; // a Chromium or Chrome binary
import { dirname } from "node:path"; import { fileURLToPath } from "node:url";
const BASE="https://tkallem.vercel.app", OUT=dirname(fileURLToPath(import.meta.url));
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const b = await chromium.launch({ executablePath: EXE, args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, colorScheme:"light", permissions:["microphone"] });
const p = await ctx.newPage();
const coachSel='[data-role]:not([data-role="user"])';
const input=p.locator('input[aria-label="Your answer"]');
const pick=(q)=>/pay|fund|sponsor|afford|cost/i.test(q)?"My father will pay for my studies, and I have some savings too."
  :/universit|school|where will you study|which/i.test(q)?"I will study at Boston University."
  :/return|after|plan|come back|future/i.test(q)?"After my master I plan to return to Algeria and work in a software company."
  :/family|ties|job|property|reason to return/i.test(q)?"My family is in Algeria and I have a job offer waiting for me."
  :/why/i.test(q)?"Because the universities there are very good and I want to learn new things."
  :"Yes, I have all my documents with me.";
async function typeAnswer(text){
  await input.click({force:true}); await input.pressSequentially(text,{delay:38}); await sleep(400);
  const n=await p.locator(coachSel).count();
  await p.locator('button[aria-label="Send"]').click();
  await p.waitForFunction(([s,n])=>document.querySelectorAll(s).length>n,[coachSel,n],{timeout:90000});
  await p.waitForFunction(()=>!document.querySelector('input[aria-label="Your answer"]')?.disabled,null,{timeout:90000}).catch(()=>{});
  await sleep(3500);
}
await p.goto(BASE+"/welcome",{waitUntil:"networkidle"}); await sleep(1500);
await p.getByRole("link",{name:"Try a visa interview now"}).first().click();
await p.waitForSelector(coachSel,{timeout:60000}); await sleep(2500);
await p.getByRole("radio",{name:/text/i}).click(); await sleep(600);
await p.getByRole("button",{name:"Skip"}).first().click().catch(()=>{}); await sleep(800);
// stop the coach voice so it does not talk over the capture
await p.getByRole("button",{name:/^Stop$/}).first().click({timeout:2000}).catch(()=>{});
const A1=process.env.A1||"I go to the United States for study my master in computer science.";
await typeAnswer(A1);
await p.evaluate(()=>{const u=[...document.querySelectorAll('[data-role="user"]')].at(-1); u?.scrollIntoView({block:"start"}); window.scrollTo(0,0)});
await sleep(900); await p.getByRole("button",{name:/^Stop$/}).first().click({timeout:1500}).catch(()=>{}); await sleep(500);
await p.screenshot({path:`${OUT}/03-correction.png`});
// Say it again: the real recording state (fake microphone), not sent
const again=p.getByRole("button",{name:/Say it again/}).first();
if(await again.count()){ await again.scrollIntoViewIfNeeded(); await again.click(); await sleep(2500); await p.screenshot({path:`${OUT}/04-say-it-again.png`}); console.log("say-it-again state captured"); }
else console.log("NO Say it again button");
await p.reload({waitUntil:"domcontentloaded"}); await sleep(5000);
await p.getByRole("button",{name:/^Stop$/}).first().click({timeout:1500}).catch(()=>{});
// two more answers so the report has substance
for (let i=0;i<2;i++){
  const q=(await p.locator(coachSel).last().innerText()).split("\n")[0]; console.log("Q",i+2,q);
  await typeAnswer(pick(q));
}
await p.getByRole("button",{name:/End session|See my report|^End$/}).first().click({timeout:15000});
await p.waitForFunction(()=>/Your answers|Practice again|Time before/.test(document.body.innerText),null,{timeout:90000});
await sleep(3500);
await p.evaluate(()=>window.scrollTo(0,0)); await sleep(600);
await p.screenshot({path:`${OUT}/06-report.png`});
const fz=p.getByText(/Time before you (write|speak|answer)/).first();
if(await fz.count()){ await fz.scrollIntoViewIfNeeded(); await p.evaluate(()=>{const e=[...document.querySelectorAll("*")].find(x=>x.children.length===0&&/Time before you/.test(x.textContent)); window.scrollBy(0,e.getBoundingClientRect().top-330)}); await sleep(700); await p.screenshot({path:`${OUT}/05-freeze-meter.png`}); console.log("freeze captured"); }
else console.log("NO freeze card");
await ctx.close(); await b.close();
