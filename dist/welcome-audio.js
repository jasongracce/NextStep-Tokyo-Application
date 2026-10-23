(() => {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio || matchMedia('(prefers-reduced-motion: reduce)').matches || location.hash === '#join') return;
  let context, master, enabled = true;
  const started=performance.now();
  const played = new Set();
  const sources = new Set();
  const control = document.createElement('button');
  control.type = 'button';
  function updateControl() {
    control.setAttribute('aria-label', enabled ? 'Mute sound' : 'Unmute sound');
    control.title = enabled ? 'Mute sound' : 'Unmute sound';
    control.setAttribute('aria-pressed', String(!enabled));
    control.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/>${enabled ? '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>' : '<path d="m16 9 5 6m0-6-5 6"/>'}</svg>`;
  }
  updateControl();
  control.className = 'sound-toggle';
  document.body.append(control);
  function track(source, duration) {
    sources.add(source);
    source.onended = () => { sources.delete(source); source.disconnect(); };
    source.start();
    source.stop(context.currentTime + duration);
  }
  function envelope(duration, level, attack = .04) {
    const gain = context.createGain(), now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + attack);
    gain.gain.setValueAtTime(level*.8, now + duration*.65);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    gain.connect(master);
    setTimeout(() => gain.disconnect(), duration * 1000 + 100);
    return gain;
  }
  function tone(from, to, duration, level) {
    const oscillator = context.createOscillator();
    oscillator.frequency.setValueAtTime(from, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(to, context.currentTime + duration);
    oscillator.connect(envelope(duration, level, .08));
    track(oscillator, duration);
  }
  function noise(duration, from, to, level, drawing = false) {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const t = i / context.sampleRate;
      samples[i] = (Math.random() * 2 - 1) * (drawing ? .55 + .25 * Math.sin(t * 93) + .2 * Math.sin(t * 217) : 1);
    }
    const source = context.createBufferSource(), filter = context.createBiquadFilter();
    source.buffer = buffer;
    filter.type = drawing ? 'bandpass' : 'lowpass';
    filter.Q.value = drawing ? .8 : .6;
    filter.frequency.setValueAtTime(from, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(to, context.currentTime + duration);
    source.connect(filter);
    filter.connect(envelope(duration, level, drawing ? .025 : duration * .35));
    source.onended = null;
    track(source, duration);
    setTimeout(() => filter.disconnect(), duration * 1000 + 100);
  }
  function softBrush() {
    const duration=.65,now=context.currentTime;
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);
    const samples=buffer.getChannelData(0);let smooth=0;
    for(let i=0;i<samples.length;i++){
      smooth=.7*smooth+.3*(Math.random()*2-1);
      samples[i]=smooth*Math.pow(Math.sin(Math.PI*i/samples.length),1.3);
    }
    const source=context.createBufferSource(),low=context.createBiquadFilter(),high=context.createBiquadFilter(),gain=context.createGain(),pan=context.createStereoPanner();
    source.buffer=buffer;high.type='highpass';high.frequency.value=300;
    low.type='lowpass';low.frequency.setValueAtTime(2000,now);
    low.frequency.exponentialRampToValueAtTime(1000,now+duration);low.Q.value=.4;
    gain.gain.value=.65;pan.pan.setValueAtTime(-.2,now);pan.pan.linearRampToValueAtTime(.2,now+duration);
    source.connect(high);high.connect(low);low.connect(gain);gain.connect(pan);pan.connect(master);track(source,duration);
    setTimeout(()=>{high.disconnect();low.disconnect();gain.disconnect();pan.disconnect();},duration*1000+100);
  }
  function cinematicZoom() {
    const now=context.currentTime,duration=2.6;
    const bus=context.createBiquadFilter();
    bus.type='lowpass';bus.frequency.setValueAtTime(1400,now);
    bus.frequency.linearRampToValueAtTime(3200,now+1.3);bus.Q.value=.35;
    bus.connect(master);
    // A short, dark room tail gives the chord depth without a sharp pitch sweep.
    const reverb=context.createConvolver(),wet=context.createGain();
    const impulse=context.createBuffer(2,Math.ceil(context.sampleRate*.85),context.sampleRate);
    for(let channel=0;channel<2;channel++){
      const samples=impulse.getChannelData(channel);
      for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.pow(1-i/samples.length,3);
    }
    reverb.buffer=impulse;wet.gain.value=.2;
    bus.connect(reverb);reverb.connect(wet);wet.connect(master);
    const wave=context.createPeriodicWave(new Float32Array(5),new Float32Array([0,1,.18,.06,.02]));
    [146.83,185,220].forEach((frequency,index)=>{
      const voice=context.createOscillator(),gain=context.createGain(),pan=context.createStereoPanner();
      voice.setPeriodicWave(wave);voice.frequency.value=frequency;
      voice.detune.value=(index-1)*3;pan.pan.value=(index-1)*.32;
      gain.gain.setValueAtTime(0,now);
      gain.gain.linearRampToValueAtTime(.08,now+.45);
      gain.gain.linearRampToValueAtTime(.22,now+1.2);
      gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      voice.connect(gain);gain.connect(pan);pan.connect(bus);track(voice,duration);
      setTimeout(()=>{gain.disconnect();pan.disconnect();},duration*1000+100);
    });
    noise(1.8,320,1600,.13);
    setTimeout(()=>{bus.disconnect();reverb.disconnect();wet.disconnect();},(duration+.9)*1000);
  }
  function play(cue) {
    if (!enabled || !context || context.state !== 'running' || played.has(cue) || document.hidden) return;
    played.add(cue);
    if (cue === 'welcome') {
      tone(110, 55, 2.2, .38);
      tone(220, 165, 1.8, .19);
      tone(440, 330, 1.4, .09);
      noise(1.7, 700, 2400, .18);
    } else if (cue === 'draw') {
      softBrush();
    } else if (cue === 'zoom') {
      cinematicZoom();
    }
  }
  let stopped = false;
  async function unlock() {
    if (stopped || !enabled) return;
    try {
      if (!context) {
        context = new Audio();
        master = context.createGain();
        master.gain.value = .9;
        const compressor=context.createDynamicsCompressor();
        compressor.threshold.value=-10;compressor.knee.value=12;
        compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.18;
        master.connect(compressor);compressor.connect(context.destination);
      }
      if (context.state !== 'running') {
        await context.resume();
      }
      if (stopped || !enabled) return;
      if(performance.now()-started<2300)play('welcome');
    } catch { /* Keep the animation running; retry audio on a later interaction. */ }
  }
  control.addEventListener('click', () => {
    enabled = !enabled;
    if (master && context.state !== 'closed') master.gain.setTargetAtTime(enabled ? .9 : 0, context.currentTime, .025);
    updateControl();
    if (enabled) unlock();
  });
  function onInteraction(event) {
    if (!control.contains(event.target)&&!event.target.closest?.('.skip-welcome')) unlock();
  }
  document.addEventListener('pointerdown', onInteraction);
  document.addEventListener('keydown', onInteraction);
  document.querySelector('.welcome-highlight').addEventListener('animationstart', () => play('draw'));
  window.welcomeAudio = {
    play,
    stop() {
      stopped = true;
      enabled = false;
      document.removeEventListener('pointerdown', onInteraction);
      document.removeEventListener('keydown', onInteraction);
      for (const source of sources) { try { source.stop(); } catch {} }
      control.remove();
      if (context && context.state !== 'closed') context.close().catch(() => {});
    }
  };
  unlock();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && context?.state === 'running') context.suspend().catch(() => {});
    else if (!document.hidden && enabled && context?.state === 'suspended') context.resume().catch(() => {});
  });
})();
