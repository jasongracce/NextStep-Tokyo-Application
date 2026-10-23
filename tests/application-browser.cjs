// No browser automation dependency required. Uses Edge/Chrome's DevTools protocol.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const executable=process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nextstep-form-'));
const browser=spawn(executable,['--headless','--disable-gpu','--no-first-run','--remote-debugging-port=9224',`--user-data-dir=${profile}`],{windowsHide:true,stdio:'ignore'});
(async()=>{
  let targets;
  for(let i=0;i<100;i++){try{targets=await(await fetch('http://127.0.0.1:9224/json')).json();if(targets.some(t=>t.type==='page'))break;}catch{}await sleep(100);}
  if(!targets)throw Error('Browser did not start');
  const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  let id=0;const pending=new Map();const runtimeErrors=[];
  ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.text);if(pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timeout=setTimeout(()=>{pending.delete(key);reject(Error(`Timed out: ${method}`));},15000);pending.set(key,message=>{clearTimeout(timeout);if(message.error)reject(Error(JSON.stringify(message.error)));else resolve(message.result);});ws.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  await send('Runtime.enable');await send('Page.enable');
  for(const width of [320,390,768,1440]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=900});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await send('Page.navigate',{url:'file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/')});await sleep(350);
    assert.equal(await evaluate("document.querySelector('.application')===null"),true);await evaluate('select(2)');await sleep(100);assert.equal(await evaluate("document.querySelector('.apply-link').textContent"),'Apply');await evaluate("document.querySelector('.apply-link').click()");await sleep(300);
    assert.equal(await evaluate("document.querySelector('.application-progress').textContent"),'Step 1 of 4');
    await evaluate("document.querySelector('.application').requestSubmit()");
    assert.equal(await evaluate('document.activeElement.name'),'full_name');
    await evaluate(`(()=>{const f=document.querySelector('.application');for(const [name,value] of Object.entries({full_name:'Jane Student',email:'jane@example.com',school:'Tokyo school',study_year:'Year 2'})){f.elements.namedItem(name).value=value;f.elements.namedItem(name).dispatchEvent(new Event('input',{bubbles:true}));}f.requestSubmit();})()`);
    assert.equal(await evaluate("document.querySelector('.application-progress').textContent"),'Step 2 of 4');
    await evaluate("document.querySelector('[name=preferred_role][value=graphics]').click();document.querySelector('.application').requestSubmit()");
    assert.equal(await evaluate("document.querySelector('.application-progress').textContent"),'Step 3 of 4');
    assert.equal(await evaluate("document.querySelector('.past-work').hidden"),false);
    await evaluate(`(()=>{const f=document.querySelector('.application');f.elements.work_description.value='My design work';f.elements.portfolio_url.value='https://example.com/portfolio';const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.7 sample'],'sample.pdf',{type:'application/pdf'}));f.elements.work_files.files=transfer.files;f.elements.work_files.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    assert.match(await evaluate("document.querySelector('.work-file-list').textContent"),/sample.pdf/);

    assert.equal(await evaluate("document.querySelector('.application [type=submit]').disabled"),false);
    assert.equal(await evaluate("document.querySelector('.application-review').closest('section').hidden"),true);
    await evaluate("document.querySelector('.application').requestSubmit()");
    assert.equal(await evaluate('document.activeElement.name'),'motivation');
    await evaluate("document.querySelector('[name=motivation]').value='I would like to help.';document.querySelector('.application').requestSubmit()");
    assert.equal(await evaluate("document.querySelector('.application-progress').textContent"),'Step 4 of 4');
    assert.match(await evaluate("document.querySelector('.application-review').textContent"),/sample.pdf/);
    assert.match(await evaluate("document.querySelector('.application-review').textContent"),/My design work/);
    await evaluate(`document.querySelector('[data-edit="1"]').click();document.querySelector('[name=preferred_role][value=events]').click();document.querySelector('.application').requestSubmit()`);
    assert.equal(await evaluate("document.querySelector('.past-work').hidden"),true);
    await evaluate(`document.querySelector('[data-back]').click();document.querySelector('[name=preferred_role][value=graphics]').click();document.querySelector('.application').requestSubmit()`);
    assert.equal(await evaluate("document.querySelector('[name=work_description]').value"),'My design work');
    assert.match(await evaluate("document.querySelector('.work-file-list').textContent"),/sample.pdf/);
    await evaluate("document.querySelector('.work-file-list button').click();const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.7 sample'],'sample.pdf',{type:'application/pdf'}));document.querySelector('[name=work_files]').files=transfer.files;document.querySelector('[name=work_files]').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.application').requestSubmit()");

    assert.equal(await evaluate("document.querySelector('.application-review').textContent.includes('I would like to help.')"),true);
    assert.equal(await evaluate("document.querySelector('[name=motivation]').closest('section').hidden"),true);
    assert.equal(await evaluate("document.querySelector('.application [type=submit]').disabled"),false);
    await evaluate("document.querySelector('[data-edit=\"0\"]').click();document.querySelector('.application').requestSubmit();document.querySelector('.application').requestSubmit()");
    assert.equal(await evaluate("document.querySelector('[name=full_name]').value"),'Jane Student');
    assert.equal(await evaluate("document.querySelector('[name=preferred_role]:checked').value"),'graphics');
    await evaluate("document.querySelector('.application').requestSubmit()");
    await evaluate("document.querySelector('[name=consent]').click();document.querySelector('.application').requestSubmit()");
    assert.match(await evaluate("document.querySelector('.application-status').textContent"),/has not been sent/);
    assert.equal(await evaluate("document.querySelector('.application-reference')"),null);
    await evaluate("document.querySelector('[name=consent]').click()");
    // Simulate configured verification and endpoint; no live service or applicant data.
    await evaluate(`(()=>{window.APPLICATION_CONFIG.endpoint='https://test.invalid';window.APPLICATION_CONFIG.turnstileSiteKey='test';window.turnstile={render:(element,options)=>{options.callback('verified');return 1;},remove:()=>{}};window.applicationTurnstileReady();document.querySelector('[name=motivation]').value='I would like to help.';document.querySelector('[name=consent]').click();document.querySelector('[data-edit="0"]').click();document.querySelector('[name=full_name]').focus();document.querySelector('[name=full_name]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));})()`);
    assert.equal(await evaluate("document.querySelector('.application-progress').textContent"),'Step 1 of 4');
    await evaluate("document.querySelector('.application').requestSubmit();document.querySelector('.application').requestSubmit()");
    await evaluate("document.querySelector('.application').requestSubmit()");
    assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"),`Overflow at ${width}`);
    const rects=await evaluate("[...document.querySelectorAll('.application-actions button')].filter(x=>!x.hidden).map(x=>x.getBoundingClientRect().height)");assert.ok(rects.every(height=>height>=48));
    if(width===390||width===1440){await evaluate('window.scrollTo(0,0)');const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(os.tmpdir(),`nextstep-form-${width}.png`),Buffer.from(shot.data,'base64'));}
    await evaluate(`window.sent=[];window.fetch=async(url,options)=>{window.sent.push(JSON.parse(options.body instanceof FormData?options.body.get('application'):options.body));window.uploaded=options.body instanceof FormData?options.body.getAll('files').map(file=>file.name):[];throw Error('offline');};document.querySelector('.application').requestSubmit()`);await sleep(100);
    assert.match(await evaluate("document.querySelector('.application-status').textContent"),/could not confirm/);
    await evaluate("window.applicationTurnstileReady();document.querySelector('.application').requestSubmit()");await sleep(100);
    assert.deepEqual(await evaluate('uploaded'),['sample.pdf']);
    assert.equal(await evaluate('sent.length'),2);assert.equal(await evaluate('sent[0].request_id===sent[1].request_id'),true);
    await evaluate("window.calls=0;window.fetch=()=>{calls++;return new Promise(resolve=>window.resolveSubmission=resolve)};window.applicationTurnstileReady();document.querySelector('.application').requestSubmit();document.querySelector('.application').requestSubmit()");
    assert.equal(await evaluate('calls'),1);
    await evaluate("resolveSubmission({ok:true,json:async()=>({reference:'test-reference'})})");await sleep(100);
    assert.equal(await evaluate("document.querySelector('.application-reference').textContent"),'test-reference');await evaluate("document.querySelector('.application-return').click()");await sleep(300);assert.equal(await evaluate('active'),2);assert.equal(await evaluate("getComputedStyle(document.querySelector('.intro')).display"),'none');
  }
  assert.deepEqual(runtimeErrors,[]);console.log('PASS: 320/390/768/1440px, validation, form navigation, preserved step answers, full-page entry/return, input arrow keys, verification configuration, error recovery, idempotent retries, and persistent confirmation.');
  ws.send(JSON.stringify({id:++id,method:'Browser.close'}));ws.close();browser.kill();
})().catch(error=>{console.error(error);browser.kill();process.exitCode=1;});
