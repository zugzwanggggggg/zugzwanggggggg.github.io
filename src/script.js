document.addEventListener("DOMContentLoaded", function() {
    // 1. Page Load Animation
    const mainContent = document.querySelector('.main-content');
    setTimeout(() => {
        if(mainContent) {
            mainContent.classList.add('visible');
        }
    }, 100);

    // 2. Theme Logic (Default is DARK)
    const toggleBtn = document.getElementById('theme-toggle');
    const body = document.body;

    // Check if user previously selected LIGHT mode
    if (localStorage.getItem('theme') === 'light') {
        body.classList.add('light-mode');
        if(toggleBtn) toggleBtn.textContent = "🌙 Dark Mode";
    }

    // Toggle on click
    if(toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            
            if (body.classList.contains('light-mode')) {
                localStorage.setItem('theme', 'light');
                toggleBtn.textContent = "🌙 Dark Mode";
            } else {
                localStorage.setItem('theme', 'dark'); // Actually removes class, reverting to default
                toggleBtn.textContent = "☀️ Light Mode";
            }
        });
    }
});