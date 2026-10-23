// No browser automation dependency required. Uses Edge/Chrome's DevTools protocol.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const executable=process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nextstep-audio-'));
const browser=spawn(executable,['--headless','--autoplay-policy=no-user-gesture-required','--disable-gpu','--no-first-run','--remote-debugging-port=9226',`--user-data-dir=${profile}`],{windowsHide:true,stdio:'ignore'});
(async()=>{
  let targets;
  for(let i=0;i<100;i++){try{targets=await(await fetch('http://127.0.0.1:9226/json')).json();if(targets.some(t=>t.type==='page'))break;}catch{}await sleep(100);}
  if(!targets)throw Error('Browser did not start');
  const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  let id=0;const pending=new Map();const runtimeErrors=[];
  ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.text);if(pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;const timeout=setTimeout(()=>{pending.delete(key);reject(Error(`Timed out: ${method}`));},15000);pending.set(key,message=>{clearTimeout(timeout);if(message.error)reject(Error(JSON.stringify(message.error)));else resolve(message.result);});ws.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  await send('Runtime.enable');await send('Page.enable');

  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.allowAudio=location.search.includes('audioAllowed');window.soundStarts=[];window.levels=[];
    const NativeAudio=window.AudioContext;
    window.AudioContext=class extends NativeAudio {
      constructor(){super();window.testAudio=this;if(!window.allowAudio)this.suspend();}
      resume(){return window.allowAudio?super.resume():new Promise(()=>{});}
    };
    const connect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(destination,...rest){
      if(destination instanceof AudioDestinationNode){
        const analyser=this.context.createAnalyser();analyser.fftSize=2048;
        connect.call(this,analyser);connect.call(analyser,destination);
        const data=new Float32Array(analyser.fftSize);
        setInterval(()=>{if(!window.welcomeAudio?.ready)return;analyser.getFloatTimeDomainData(data);let sum=0,peak=0;for(const n of data){sum+=n*n;peak=Math.max(peak,Math.abs(n));}window.levels.push({time:this.context.currentTime,rms:Math.sqrt(sum/data.length),peak});},20);
        return destination;
      }
      return connect.call(this,destination,...rest);
    };
    for(const type of [OscillatorNode,AudioBufferSourceNode]){
      const start=type.prototype.start;
      type.prototype.start=function(...args){soundStarts.push(this.context.currentTime);return start.apply(this,args);};
    }
  `});
  const url='file:///'+path.resolve(__dirname,'../dist/index.html').replaceAll('\\','/');
  await send('Page.navigate',{url});await sleep(500);
  assert.equal(await evaluate("document.body.classList.contains('welcome-awaiting-audio')"),true);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.welcome-highlight')).animationPlayState"),'paused');
  assert.equal(await evaluate('soundStarts.length'),0);
  assert.equal(await evaluate("document.querySelector('.start-welcome').hidden"),false);
  await evaluate("window.allowAudio=true;document.querySelector('.start-welcome').click()");
  for(let i=0;i<50;i++){if(await evaluate('welcomeAudio.ready'))break;await sleep(100);}
  assert.equal(await evaluate('welcomeAudio.ready'),true,JSON.stringify(await evaluate('({state:testAudio.state,errors:window.soundStarts})')));
  assert.equal(await evaluate("document.body.classList.contains('welcome-awaiting-audio')"),false);
  assert.equal(await evaluate('soundStarts.length'),4);
  await sleep(3700);
  assert.equal(await evaluate('soundStarts.length'),5,'Highlight must play its drawing sound');
  await sleep(3000);
  assert.equal(await evaluate('soundStarts.length'),9,'Zoom must play its chord and air layers');
  const measurements=await evaluate(`[
    [soundStarts[0]+.15,soundStarts[0]+1.1],[soundStarts[4]+.04,soundStarts[4]+.5],[soundStarts[5]+.5,soundStarts[5]+1.3]
  ].map(([from,to])=>{const samples=levels.filter(n=>n.time>=from&&n.time<=to);return {rms:Math.max(...samples.map(n=>n.rms)),peak:Math.max(...samples.map(n=>n.peak))};})`);
  measurements.forEach((level,index)=>{assert.ok(level.rms>.025,`Cue ${index} too quiet: ${JSON.stringify(level)}`);assert.ok(level.peak<1,`Cue ${index} clips`);});
  await evaluate("document.querySelector('.sound-toggle').click()");
  assert.equal(await evaluate("document.querySelector('.sound-toggle').getAttribute('aria-label')"),'Unmute sound');
  await evaluate("document.querySelector('.skip-welcome').click()");
  assert.equal(await evaluate('testAudio.state'),'closed');
  assert.equal(await evaluate("document.querySelector('.start-welcome')"),null);
  await send('Page.navigate',{url});await sleep(300);
  await evaluate("document.querySelector('.sound-toggle').click()");await sleep(100);
  assert.equal(await evaluate('welcomeAudio.ready'),true,'Muted welcome should continue without waiting for audio');
  assert.equal(await evaluate('soundStarts.length'),0);
  await evaluate("document.querySelector('.skip-welcome').click()");
  await send('Page.navigate',{url});await sleep(300);
  await evaluate("document.querySelector('.skip-welcome').click()");
  assert.equal(await evaluate("document.body.classList.contains('welcome-awaiting-audio')"),false);
  assert.equal(await evaluate('testAudio.state'),'closed');
  await send('Page.navigate',{url:url+'?audioAllowed'});
  for(let i=0;i<50;i++){if(await evaluate('window.welcomeAudio?.ready'))break;await sleep(100);}
  assert.equal(await evaluate('welcomeAudio.ready'),true,'Allowed autoplay should start immediately');
  assert.equal(await evaluate('soundStarts.length'),4);
  assert.equal(await evaluate("document.querySelector('.start-welcome')"),null);
  await evaluate("document.querySelector('.skip-welcome').click()");
  assert.deepEqual(runtimeErrors,[]);
  console.log('PASS: blocked autoplay waits; welcome, drawing and zoom emit audible unclipped audio; mute and skip work. Measured levels:',JSON.stringify(measurements));
  ws.send(JSON.stringify({id:++id,method:'Browser.close'}));ws.close();browser.kill();
})().catch(error=>{console.error(error);browser.kill();process.exitCode=1;});
