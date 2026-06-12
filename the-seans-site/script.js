// JS가 살아있음을 표시 — .reveal 숨김은 .js가 있을 때만 적용되므로
// 스크립트가 실패해도 콘텐츠는 항상 보인다 (graceful degradation).
document.documentElement.classList.add('js');

const header = document.querySelector('[data-header]');
const hero = document.querySelector('.hero');
const revealItems = Array.from(document.querySelectorAll('.reveal'));

/* ── Header state: 스크롤 그림자 + 다크 히어로 위에서 색 반전 ── */
function updateHeader() {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 8);
  if (hero) {
    const overDark = window.scrollY < hero.offsetHeight - 60;
    header.classList.toggle('on-dark', overDark);
  }
}
window.addEventListener('scroll', updateHeader, { passive: true });
window.addEventListener('resize', updateHeader);
updateHeader();

/* ── Scroll reveal (IntersectionObserver + 폴백) ── */
function showAll() {
  revealItems.forEach(el => el.classList.add('visible'));
}

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px 8% 0px' }
  );
  revealItems.forEach(el => observer.observe(el));
} else {
  showAll();
}

// 안전장치: 어떤 이유로든 안 보이면 1.2초 뒤 강제 표시
setTimeout(showAll, 1200);
