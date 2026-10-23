(() => {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio || matchMedia('(prefers-reduced-motion: reduce)').matches || location.hash === '#join') return;
  let context, master, enabled = false;
  const started = performance.now();
  const played = new Set();
  const sources = new Set();
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = 'Enable sound';
  control.setAttribute('aria-pressed', 'false');
  control.style.cssText = 'position:fixed;left:max(24px,env(safe-area-inset-left));bottom:24px;z-index:6;min-height:48px;padding:12px 16px;border:1px solid #89919a;border-radius:2px;background:#f5f3ed;color:#192b42;font:inherit;font-size:13px;cursor:pointer';
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
    if (!enabled || context.state !== 'running' || played.has(cue) || document.hidden) return;
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
  control.addEventListener('click', async () => {
    try {
      if (!context) {
        context = new Audio();
        master = context.createGain();
        master.gain.value = .55;
        master.connect(context.destination);
      }
      await context.resume();
      enabled = !enabled;
      master.gain.setTargetAtTime(enabled ? .55 : 0, context.currentTime, .025);
      control.textContent = enabled ? 'Mute sound' : 'Enable sound';
      control.setAttribute('aria-pressed', String(enabled));
      if (performance.now() - started < 2300) play('welcome');
    } catch { control.textContent = 'Sound unavailable'; }
  });
  document.querySelector('.welcome-highlight').addEventListener('animationstart', () => play('draw'));
  window.welcomeAudio = {
    play,
    stop() {
      enabled = false;
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
