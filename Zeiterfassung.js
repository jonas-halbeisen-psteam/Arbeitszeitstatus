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

    // Fetch clocking data from the API
    async function fetchClockingData() {
        try {
            const response = await fetch('/horizon/modules/pzw/widgets/clockings', {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Clocking data fetched:', data);
            return data;
        } catch (error) {
            console.error('Error fetching clocking data:', error);
            return null;
        }
    }

    // Parse the clocking data to get useful information
    function parseClockingData(data) {
        if (!data) return null;

        const parsed = {
            canClockTime: data.canClockTime,
            canManuallySpecifyDateAndTime: data.canManuallySpecifyDateAndTime,
            selectableKeys: data.selectableTimeBookingKeys || [],
            dayRecords: data.dayRecords || [],
            todayRecord: null,
            lastBooking: null
        };

        // Find today's record
        const today = new Date().toISOString().split('T')[0];
        parsed.todayRecord = data.dayRecords?.find(record => record.date === today);

        // Find the most recent booking
        if (data.dayRecords && data.dayRecords.length > 0) {
            const latestDay = data.dayRecords[0];
            if (latestDay.timeBookings && latestDay.timeBookings.length > 0) {
                parsed.lastBooking = latestDay.timeBookings[latestDay.timeBookings.length - 1];
            }
        }

        return parsed;
    }

    // Get booking key ID by display name
    function getBookingKeyId(data, displayName) {
        if (!data || !data.selectableTimeBookingKeys) return null;
        
        const key = data.selectableTimeBookingKeys.find(
            k => k.displayName === displayName
        );
        return key ? key.id : null;
    }

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
            { text: 'Kommen', color: '#1976d2', icon: '🏃‍♂️‍➡️' },
            { text: 'Gehen', color: '#2e7d32', icon: '🏃‍♂️' },
            { text: 'Pause Beginn', color: '#ed6c02', icon: '⏸️' },
            { text: 'Pause Ende', color: '#9c27b0', icon: '⏯️' }
        ];

        // Create each button
        buttons.forEach((btnConfig, index) => {
            const button = document.createElement('button');
            button.className = 'MuiButtonBase-root MuiButton-root MuiButton-contained MuiButton-sizeMedium MuiButton-fullWidth';
            button.type = 'button';
            button.style.cssText = `
                background-color: ${btnConfig.color};
                color: white;
                padding: 6px 16px;
                min-height: 36px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-size: 16px;
                font-weight: 500;
                text-transform: none;
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
            button.addEventListener('click', async function() {
                console.log(`${btnConfig.text} clicked`);
                
                // Fetch and parse clocking data
                const rawData = await fetchClockingData();
                const parsedData = parseClockingData(rawData);
                
                if (parsedData) {
                    console.log('Parsed data:', parsedData);
                    console.log('Can clock time:', parsedData.canClockTime);
                    console.log('Today record:', parsedData.todayRecord);
                    console.log('Last booking:', parsedData.lastBooking);
                    
                    // Get the booking key ID for this button
                    const keyId = getBookingKeyId(rawData, btnConfig.text);
                    console.log(`Booking key ID for ${btnConfig.text}:`, keyId);
                }
                
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
    }
})();
