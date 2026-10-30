(function () {
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('sideNav');
    var overlay = document.getElementById('navOverlay');
    if (!toggle || !nav || !overlay) return;
    function closeNav() { nav.classList.remove('open'); overlay.classList.remove('show'); }
    toggle.addEventListener('click', function () {
        nav.classList.toggle('open');
        overlay.classList.toggle('show');
    });
    overlay.addEventListener('click', closeNav);
    // Close the menu automatically after tapping a nav link (mobile UX)
    nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeNav);
    });
})();
document.addEventListener('submit', function (event) {
    var form = event.target;
    if (form && form.dataset.confirm && !window.confirm(form.dataset.confirm)) {
        event.preventDefault();
    }
});
