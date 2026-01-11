export class VanillaTilt {
    constructor(element, settings = {}) {
        this.element = element;
        this.settings = Object.assign({
            max: 15,
            perspective: 1000,
            scale: 1.05,
            speed: 400,
            glare: true,
            "max-glare": 0.3
        }, settings);

        this.init();
    }

    init() {
        this.element.addEventListener("mouseenter", this.onMouseEnter.bind(this));
        this.element.addEventListener("mousemove", this.onMouseMove.bind(this));
        this.element.addEventListener("mouseleave", this.onMouseLeave.bind(this));
    }

    onMouseEnter() {
        this.element.style.transition = `none`;
    }

    onMouseMove(event) {
        const rect = this.element.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const width = rect.width;
        const height = rect.height;

        const centerX = width / 2;
        const centerY = height / 2;

        const rotateX = ((y - centerY) / centerY) * -1 * this.settings.max;
        const rotateY = ((x - centerX) / centerX) * this.settings.max;

        this.element.style.transform = `perspective(${this.settings.perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${this.settings.scale}, ${this.settings.scale}, ${this.settings.scale})`;

        if (this.settings.glare) {
            // Simple glare effect if time permits, for now just tilt
        }
    }

    onMouseLeave() {
        this.element.style.transition = `transform ${this.settings.speed}ms ease`;
        this.element.style.transform = `perspective(${this.settings.perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    }
}

export function initTilt(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => new VanillaTilt(el));
}
