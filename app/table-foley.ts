// Original, quiet procedural effects: no downloaded audio or external player.
export function playFoley(ctx: AudioContext, kind: string): boolean {
  const now = ctx.currentTime;
  function noise(
    at: number,
    duration: number,
    frequency: number,
    volume: number,
  ) {
    const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * duration),
        ctx.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(at);
    source.stop(at + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  function tone(
    at: number,
    duration: number,
    frequency: number,
    volume: number,
    type: OscillatorType = 'sine',
  ) {
    const source = ctx.createOscillator(),
      gain = ctx.createGain();
    source.type = type;
    source.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(at);
    source.stop(at + duration);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
  }
  if (['hover', 'pick', 'drop', 'draw'].includes(kind)) {
    noise(
      now,
      kind === 'hover' ? 0.065 : 0.15,
      kind === 'drop' ? 900 : 2300,
      kind === 'hover' ? 0.035 : 0.075,
    );
    return true;
  }
  if (kind === 'shuffle') {
    for (let i = 0; i < 10; i++)
      noise(now + i * 0.065, 0.1, i % 2 ? 1900 : 2900, 0.07);
    noise(now + 0.68, 0.1, 650, 0.09);
    return true;
  }
  if (kind === 'coins') {
    noise(now, 0.12, 850, 0.05);
    for (let i = 0; i < 5; i++) {
      tone(now + i * 0.045, 0.3, 1800 + i * 437, 0.025);
      tone(now + i * 0.045, 0.18, 2910 + i * 231, 0.012);
    }
    return true;
  }
  if (kind === 'attack') {
    noise(now, 0.22, 1100, 0.09);
    noise(now + 0.13, 0.15, 4200, 0.13);
    for (const f of [730, 1370, 2280, 3510])
      tone(now + 0.14, 0.48, f, 0.024, 'triangle');
    return true;
  }
  if (kind === 'low') {
    for (let i = 0; i < 3; i++) {
      tone(now + i * 0.48, 0.2, 68, 0.1);
      tone(now + i * 0.48 + 0.18, 0.14, 54, 0.075);
    }
    return true;
  }
  return false;
}
