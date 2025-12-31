export class Carousel {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.slides = this.container.querySelectorAll('.carousel-slide');
        this.indicatorsContainer = this.container.querySelector('.carousel-indicators');
        this.prevBtn = this.container.querySelector('.carousel-prev');
        this.nextBtn = this.container.querySelector('.carousel-next');

        this.currentIndex = 0;
        this.totalSlides = this.slides.length;
        this.interval = null;
        this.intervalTime = options.interval || 5000;

        if (this.totalSlides > 0) {
            this.init();
        }
    }

    init() {
        // Create indicators
        if (this.indicatorsContainer) {
            this.indicatorsContainer.innerHTML = '';
            this.slides.forEach((_, index) => {
                const dot = document.createElement('span');
                dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
                dot.onclick = () => this.goToSlide(index);
                this.indicatorsContainer.appendChild(dot);
            });
        }

        // Event listeners
        if (this.prevBtn) this.prevBtn.onclick = () => this.prev();
        if (this.nextBtn) this.nextBtn.onclick = () => this.next();

        // Hover pause
        this.container.onmouseenter = () => this.pause();
        this.container.onmouseleave = () => this.play();

        // Initial setup
        this.updateClasses();
        this.play();
    }

    updateClasses() {
        this.slides.forEach((slide, index) => {
            slide.classList.remove('active');
            if (index === this.currentIndex) {
                slide.classList.add('active');
            }
        });

        if (this.indicatorsContainer) {
            const dots = this.indicatorsContainer.querySelectorAll('.carousel-dot');
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === this.currentIndex);
            });
        }
    }

    goToSlide(index) {
        this.currentIndex = index;
        if (this.currentIndex >= this.totalSlides) this.currentIndex = 0;
        if (this.currentIndex < 0) this.currentIndex = this.totalSlides - 1;
        this.updateClasses();
    }

    next() {
        this.goToSlide(this.currentIndex + 1);
    }

    prev() {
        this.goToSlide(this.currentIndex - 1);
    }

    play() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.next(), this.intervalTime);
    }

    pause() {
        if (this.interval) clearInterval(this.interval);
    }
}

export function initHomeCarousel() {
    new Carousel('home-features-carousel', { interval: 6000 });
}
