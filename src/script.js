// script.js

document.addEventListener("DOMContentLoaded", function() {
    // Select the main content area
    const mainContent = document.querySelector('.main-content');
    
    // Add the 'visible' class after a tiny delay to trigger the CSS transition
    setTimeout(() => {
        if(mainContent) {
            mainContent.classList.add('visible');
        }
    }, 100); // 100ms delay ensures the animation plays smoothly
});