document.addEventListener("DOMContentLoaded", function() {
    const mainContent = document.querySelector('.main-content');
    setTimeout(() => {
        if(mainContent) {
            mainContent.classList.add('visible');
        }
    }, 100);

    const toggleBtn = document.getElementById('theme-toggle');
    const body = document.body;

    if (localStorage.getItem('theme') === 'light') {
        body.classList.add('light-mode');
        if(toggleBtn) toggleBtn.textContent = "🌙 Dark Mode";
    }

    if(toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            
            if (body.classList.contains('light-mode')) {
                localStorage.setItem('theme', 'light');
                toggleBtn.textContent = "🌙 Dark Mode";
            } else {
                localStorage.setItem('theme', 'dark');
                toggleBtn.textContent = "☀️ Light Mode";
            }
        });
    }
});