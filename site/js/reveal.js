/* ─────────────────────────────────────────────────────────────
   הופעה עדינה בגלילה.
   קובץ עצמאי בלי תלויות — כדי שתקלה בטעינת Firebase
   לא תשאיר תוכן מוסתר על המסך.
   ───────────────────────────────────────────────────────────── */
(function(){
  var supported = 'IntersectionObserver' in window
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!supported){
    window.revealNow = function(){};
    return;
  }

  // רק מכאן ואילך ה-CSS מסתיר את האלמנטים — בלי JS הכל נשאר גלוי
  document.documentElement.classList.add('reveal-on');

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -60px 0px' });

  // רשת ביטחון: אם משהו נתקע, הכל נחשף אחרי 4 שניות
  var net = setTimeout(function(){
    document.documentElement.classList.remove('reveal-on');
  }, 4000);

  window.revealNow = function(){
    clearTimeout(net);
    document.querySelectorAll('.reveal:not(.in)').forEach(function(el){ io.observe(el); });
  };

  document.addEventListener('DOMContentLoaded', window.revealNow);
})();
