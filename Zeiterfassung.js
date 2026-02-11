// ==UserScript==
// @name         Zeiterfassung Extra Buttons
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds 4 additional buttons below the "Erfassen" button
// @author       You
// @match        https://psteam.summit-services.de/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Wait for the page to load
    function addExtraButtons() {
        // Find the submit button box that contains the "Erfassen" button
        const submitButtonBox = document.querySelector('[data-testid="clockingWidgetSubmitButtonBox"]');
        
        if (!submitButtonBox) {
            console.log('Submit button box not found, retrying...');
            return false;
        }

        // Check if buttons already added
        if (submitButtonBox.querySelector('.extra-buttons-container')) {
            return true;
        }

        // Create container for the new buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'extra-buttons-container';
        buttonContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 12px;';

        // Button configurations
        const buttons = [
            { text: 'Button 1', color: '#1976d2', icon: '📋' },
            { text: 'Button 2', color: '#2e7d32', icon: '⏰' },
            { text: 'Button 3', color: '#ed6c02', icon: '📊' },
            { text: 'Button 4', color: '#9c27b0', icon: '✓' }
        ];

        // Create each button
        buttons.forEach((btnConfig, index) => {
            const button = document.createElement('button');
            button.className = 'MuiButtonBase-root MuiButton-root MuiButton-contained MuiButton-sizeMedium MuiButton-fullWidth';
            button.type = 'button';
            button.style.cssText = `
                background-color: ${btnConfig.color};
                color: white;
                padding: 10px 16px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                text-transform: uppercase;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: background-color 0.3s;
            `;

            button.innerHTML = `
                <span style="font-size: 18px;">${btnConfig.icon}</span>
                <span>${btnConfig.text}</span>
            `;

            // Add hover effect
            button.addEventListener('mouseenter', function() {
                this.style.filter = 'brightness(1.1)';
            });
            button.addEventListener('mouseleave', function() {
                this.style.filter = 'brightness(1)';
            });

            // Add click handler
            button.addEventListener('click', function() {
                console.log(`${btnConfig.text} clicked`);
                alert(`${btnConfig.text} was clicked!`);
                // Add your custom logic here for each button
            });

            buttonContainer.appendChild(button);
        });

        // Insert the button container after the submit button box
        submitButtonBox.parentNode.insertBefore(buttonContainer, submitButtonBox.nextSibling);
        console.log('Extra buttons added successfully!');
        return true;
    }

    // Try to add buttons immediately
    if (!addExtraButtons()) {
        // If not found, wait for DOM changes
        const observer = new MutationObserver(function(mutations) {
            if (addExtraButtons()) {
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also try after a short delay
        setTimeout(addExtraButtons, 1000);
        setTimeout(addExtraButtons, 2000);
        setTimeout(addExtraButtons, 3000);
    }
})();
