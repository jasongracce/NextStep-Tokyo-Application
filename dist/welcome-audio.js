(() => {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio || matchMedia('(prefers-reduced-motion: reduce)').matches || location.hash === '#join') return;
  let context, master, enabled = true;
  const started = performance.now();
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
  function play(cue) {
    if (!enabled || !context || context.state !== 'running' || played.has(cue) || document.hidden) return;
    played.add(cue);
    if (cue === 'welcome') {
      tone(98, 49, 2.2, .22);
      tone(196, 147, 1.8, .07);
      noise(1.7, 700, 1800, .065);
    } else if (cue === 'draw') {
      noise(.65, 2300, 1100, .18, true);
    } else if (cue === 'zoom') {
      noise(1.8, 240, 6500, .24);
      tone(65, 32, 2.1, .24);
      tone(180, 700, 1.65, .045);
    }
  }
  let stopped = false;
  async function unlock() {
    if (stopped || !enabled) return;
    try {
      if (!context) {
        context = new Audio();
        master = context.createGain();
        master.gain.value = .55;
        master.connect(context.destination);
      }
      if (context.state !== 'running') await context.resume();
      if (stopped || !enabled) return;
      if (performance.now() - started < 2300) play('welcome');
    } catch { /* Retry on the next interaction if autoplay is blocked. */ }
  }
  control.addEventListener('click', () => {
    enabled = !enabled;
    if (master && context.state !== 'closed') master.gain.setTargetAtTime(enabled ? .55 : 0, context.currentTime, .025);
    updateControl();
    if (enabled) unlock();
  });
  function onInteraction(event) {
    if (!control.contains(event.target)) unlock();
  }
  document.addEventListener('pointerdown', onInteraction);
  document.addEventListener('keydown', onInteraction);
  unlock();
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
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && context?.state === 'running') context.suspend().catch(() => {});
    else if (!document.hidden && enabled && context?.state === 'suspended') context.resume().catch(() => {});
  });
})();
