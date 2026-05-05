const header = document.querySelector('[data-header]');
const revealItems = document.querySelectorAll('.reveal');
const heroMedia = document.querySelector('.hero-media');
const showcase = document.querySelector('[data-scroll-showcase]');
const showcaseCopies = showcase ? Array.from(showcase.querySelectorAll('[data-step-copy]')) : [];
const showcaseLayers = showcase ? Array.from(showcase.querySelectorAll('[data-step-layer]')) : [];
const showcaseMeter = showcase ? showcase.querySelector('[data-showcase-meter]') : null;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function setActive(items, activeIndex) {
  items.forEach((item, index) => {
    item.classList.toggle('active', index === activeIndex);
  });
}

function updateShowcase() {
  if (!showcase || showcaseCopies.length === 0) return;
  const rect = showcase.getBoundingClientRect();
  const travel = Math.max(showcase.offsetHeight - window.innerHeight, 1);
  const progress = clamp(-rect.top / travel);
  const stepCount = showcaseCopies.length;
  const activeIndex = Math.min(stepCount - 1, Math.floor(progress * stepCount));
  const local = clamp((progress * stepCount) - activeIndex);

  showcase.style.setProperty('--scene-progress', progress.toFixed(4));
  showcase.style.setProperty('--scene-local', local.toFixed(4));
  setActive(showcaseCopies, activeIndex);
  setActive(showcaseLayers, activeIndex);
  if (showcaseMeter) showcaseMeter.style.width = `${progress * 100}%`;
}

const revealObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.06, rootMargin: '0px 0px 10% 0px' }
);

revealItems.forEach(item => revealObserver.observe(item));

window.addEventListener(
  'scroll',
  () => {
    if (!header) return;
    header.style.boxShadow = window.scrollY > 16
      ? '0 12px 34px rgba(16, 24, 47, 0.18)'
      : '0 10px 30px rgba(16, 24, 47, 0.13)';
    if (heroMedia && !reduceMotion) {
      heroMedia.style.transform = `scale(1) translateY(${window.scrollY * 0.04}px)`;
    }
    if (!reduceMotion) updateShowcase();
  },
  { passive: true }
);

window.addEventListener('resize', updateShowcase);
updateShowcase();


function buildMobileShowcase() {
  if (!showcase || document.querySelector('.mobile-showcase-snap')) return;
  const layers = Array.from(showcase.querySelectorAll('[data-step-layer]'));
  const copies = Array.from(showcase.querySelectorAll('[data-step-copy]'));
  if (!layers.length || !copies.length) return;

  const mobileSection = document.createElement('section');
  mobileSection.className = 'mobile-showcase-snap';
  mobileSection.setAttribute('aria-label', 'ClassMate mobile product preview');

  copies.forEach((copy, index) => {
    const panel = document.createElement('article');
    panel.className = 'mobile-snap-panel reveal';

    const copyWrap = document.createElement('div');
    copyWrap.className = 'mobile-snap-copy';
    const copyClone = copy.cloneNode(true);
    copyClone.classList.add('active');
    copyWrap.appendChild(copyClone);

    const phoneWrap = document.createElement('div');
    phoneWrap.className = 'mobile-snap-phone-wrap';
    const phone = document.createElement('div');
    phone.className = 'motion-phone';
    phone.innerHTML = '<div class="phone-sensor"></div><div class="motion-screen"></div>';
    const screen = phone.querySelector('.motion-screen');
    const layerClone = layers[index].cloneNode(true);
    layerClone.classList.add('active');
    screen.appendChild(layerClone);
    phoneWrap.appendChild(phone);

    const dots = document.createElement('div');
    dots.className = 'mobile-snap-dots';
    dots.setAttribute('aria-hidden', 'true');
    copies.forEach((_, dotIndex) => {
      const dot = document.createElement('span');
      dot.classList.toggle('active', dotIndex === index);
      dots.appendChild(dot);
    });

    panel.append(copyWrap, phoneWrap, dots);
    mobileSection.appendChild(panel);
  });

  showcase.insertAdjacentElement('afterend', mobileSection);

  if (typeof revealObserver !== 'undefined') {
    mobileSection.querySelectorAll('.reveal').forEach(item => revealObserver.observe(item));
  }
}

buildMobileShowcase();
