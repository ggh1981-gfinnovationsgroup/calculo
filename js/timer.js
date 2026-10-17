// Reloj de tiempo ACTIVO. El tiempo se inyecta (ms) para poder probarlo sin esperar.
export class ActiveTimer {
  constructor({ activeMs = 900000, idleMs = 10000, maxTickMs = 2000, elapsedMs = 0 } = {}) {
    this.activeMs = activeMs;
    this.idleMs = idleMs;
    this.maxTickMs = maxTickMs;
    this.elapsedMs = elapsedMs;
    this.running = false;
    this.reason = 'paused';
    this.lastTick = 0;
    this.lastInteraction = 0;
  }

  start(now) {
    if (this.done) return;
    this.running = true;
    this.reason = null;
    this.lastTick = now;
    this.lastInteraction = now;
  }

  tick(now) {
    if (!this.running) return;
    const idleAt = this.lastInteraction + this.idleMs;
    const end = Math.min(now, idleAt);
    // Un salto grande (suspensión del equipo) no cuenta como tiempo activo.
    const add = Math.min(Math.max(0, end - this.lastTick), this.maxTickMs);
    this.elapsedMs += add;
    this.lastTick = now;
    if (now >= idleAt) {
      this.running = false;
      this.reason = 'idle';
    }
    if (this.elapsedMs >= this.activeMs) {
      this.elapsedMs = this.activeMs;
      this.running = false;
      this.reason = 'done';
    }
  }

  interact(now) {
    this.tick(now);
    if (this.done) return;
    if (!this.running) {
      this.running = true;
      this.reason = null;
      this.lastTick = now;
    }
    this.lastInteraction = now;
  }

  pause(reason, now) {
    this.tick(now);
    if (this.running) {
      this.running = false;
      this.reason = reason;
    }
  }

  get done() {
    return this.elapsedMs >= this.activeMs;
  }

  get fraction() {
    return Math.min(1, this.elapsedMs / this.activeMs);
  }

  get remainingMs() {
    return Math.max(0, this.activeMs - this.elapsedMs);
  }
}
