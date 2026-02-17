// ============================================== 
// 📱 Mobile Navigation
// ============================================== 

const menuToggle = document.getElementById('menu-toggle');
const navMenu = document.getElementById('nav-menu');

menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('open');
});

navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('open');
    });
});

// ============================================== 
// 🎯 Smooth Scroll (offset for fixed header)
// ============================================== 

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const target = document.querySelector(targetId);
        if (target) {
            e.preventDefault();
            const headerHeight = document.querySelector('.site-header').offsetHeight;
            const y = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    });
});

// ============================================== 
// ✨ Random Scatter Dots (data-viz inspired decoration)
// ============================================== 

(function createScatterDots() {
    const container = document.querySelector('.scatter-dots');
    if (!container) return;

    const colors = [
        'rgba(255,107,53,0.25)',   // fire
        'rgba(0,212,170,0.25)',    // ocean
        'rgba(167,139,250,0.2)',   // geo
        'rgba(244,114,182,0.2)',   // ml
        'rgba(251,191,36,0.2)',    // yellow
    ];

    for (let i = 0; i < 40; i++) {
        const dot = document.createElement('div');
        const size = Math.random() * 6 + 2;
        dot.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            opacity: ${Math.random() * 0.6 + 0.2};
        `;
        container.appendChild(dot);
    }
})();

// ============================================== 
// 🎨 Random accent color on logo hover (just for fun)
// ============================================== 

const logo = document.querySelector('.logo');
const funColors = ['#ff6b35', '#00d4aa', '#a78bfa', '#f472b6', '#fbbf24', '#58a6ff'];

logo.addEventListener('mouseenter', () => {
    logo.style.color = funColors[Math.floor(Math.random() * funColors.length)];
});

logo.addEventListener('mouseleave', () => {
    logo.style.color = '';
});
