/**
 * DOM-based fade-to-black transition layer (engine-independent). Sits above the
 * canvas + overlay; used by SceneManager for smooth, interrupt-safe scene swaps.
 */
export class FadeLayer {
  private readonly el: HTMLElement;

  constructor(parent: HTMLElement = document.body) {
    const existing = document.getElementById('fade');
    if (existing) {
      this.el = existing;
    } else {
      this.el = document.createElement('div');
      this.el.id = 'fade';
      parent.appendChild(this.el);
    }
    this.el.style.opacity = '0';
  }

  out(ms = 260): Promise<void> {
    return this.to(1, ms);
  }

  in(ms = 260): Promise<void> {
    return this.to(0, ms);
  }

  private to(opacity: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.el.style.transition = `opacity ${ms}ms ease`;
      requestAnimationFrame(() => {
        this.el.style.opacity = String(opacity);
      });
      setTimeout(resolve, ms);
    });
  }
}
