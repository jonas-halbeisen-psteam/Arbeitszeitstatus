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
            const response = await fetch(window.location.origin + '/horizon/modules/pzw/widgets/clockings', {
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

    // Calculate remaining work time for today
    function calculateRemainingWorkTime(todayRecord) {
        if (!todayRecord || !todayRecord.timeBookings) {
            return { remainingMinutes: 480, requiredMinutes: 480, message: 'No bookings found for today' };
        }

        const bookings = todayRecord.timeBookings;
        let requiredMinutes = 480; // 8 hours = 480 minutes
        let workedMinutes = 0;
        let currentlyWorking = false;
        let pauseStartTime = null;
        let totalPauseMinutes = 0;
        let hasPauseAfter1300 = false;

        // Helper function to convert time string to minutes since midnight
        function timeToMinutes(timeStr) {
            if (!timeStr) return 0;
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        }

        // Sort bookings by time
        const sortedBookings = [...bookings].sort((a, b) => {
            const timeA = a.time || '00:00:00';
            const timeB = b.time || '00:00:00';
            return timeToMinutes(timeA) - timeToMinutes(timeB);
        });

        let workStartTime = null;

        // Process each booking
        for (const booking of sortedBookings) {
            const key = booking.bookingKey;
            const time = booking.time;

            if (!time) continue;

            const timeInMinutes = timeToMinutes(time);

            // Check if it's a pause after 13:00 (780 minutes)
            if (key === 'PA' && timeInMinutes >= 780) {
                hasPauseAfter1300 = true;
            }

            if (key === 'K' || key === 'MK') {
                // Kommen (arrival)
                workStartTime = timeInMinutes;
                currentlyWorking = true;
            } else if (key === 'G' || key === 'MG') {
                // Gehen (leaving)
                if (workStartTime !== null) {
                    workedMinutes += timeInMinutes - workStartTime;
                    workStartTime = null;
                }
                currentlyWorking = false;
            } else if (key === 'PA') {
                // Pause Beginn
                if (workStartTime !== null && currentlyWorking) {
                    workedMinutes += timeInMinutes - workStartTime;
                    pauseStartTime = timeInMinutes;
                    workStartTime = null;
                }
            } else if (key === 'PE') {
                // Pause Ende
                if (pauseStartTime !== null) {
                    totalPauseMinutes += timeInMinutes - pauseStartTime;
                    workStartTime = timeInMinutes;
                    pauseStartTime = null;
                }
            }
        }

        // If currently working, calculate time until now
        if (workStartTime !== null && currentlyWorking) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            workedMinutes += currentMinutes - workStartTime;
        }

        // Add 30 minutes to required time if no pause after 13:00
        if (!hasPauseAfter1300) {
            requiredMinutes += 30; // 8.5 hours
        }

        const remainingMinutes = Math.max(0, requiredMinutes - workedMinutes);

        // Calculate end time
        let endTime = '';
        if (currentlyWorking && workStartTime !== null) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const endMinutes = currentMinutes + remainingMinutes;
            const endHours = Math.floor(endMinutes / 60) % 24;
            const endMins = endMinutes % 60;
            endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
        }

        return {
            remainingMinutes,
            requiredMinutes,
            workedMinutes,
            hasPauseAfter1300,
            currentlyWorking,
            endTime,
            message: `Worked: ${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m / Required: ${Math.floor(requiredMinutes / 60)}h ${requiredMinutes % 60}m`
        };
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

        // Create work time info label
        const workTimeLabel = document.createElement('div');
        workTimeLabel.className = 'work-time-label';
        workTimeLabel.style.cssText = `
            background-color: #f5f5f5;
            border-left: 4px solid #1976d2;
            padding: 12px;
            border-radius: 4px;
            font-size: 14px;
            color: #2E3233;
            margin-bottom: 8px;
        `;
        workTimeLabel.innerHTML = `
            <div style="font-weight: 500; margin-bottom: 4px;">⏱️ Work Time Status</div>
            <div class="work-time-content" style="font-size: 13px; color: #555;">Loading...</div>
        `;
        buttonContainer.appendChild(workTimeLabel);

        // Function to update work time label
        async function updateWorkTimeLabel() {
            const rawData = await fetchClockingData();
            const parsedData = parseClockingData(rawData);
            
            const contentDiv = workTimeLabel.querySelector('.work-time-content');
            
            if (parsedData && parsedData.todayRecord) {
                const workTime = calculateRemainingWorkTime(parsedData.todayRecord);
                
                const remainingHours = Math.floor(workTime.remainingMinutes / 60);
                const remainingMins = workTime.remainingMinutes % 60;
                
                let statusText = '';
                if (workTime.remainingMinutes === 0) {
                    statusText = `<div style="color: #2e7d32; font-weight: 500;">Required time fulfilled!</div>`;
                } else {
                    statusText = `<div>Remaining: ${remainingHours}h ${remainingMins}m</div>`;
                    if (workTime.endTime) {
                        statusText += `<div>Finish at: ${workTime.endTime}</div>`;
                    }
                }
                
                contentDiv.innerHTML = statusText;
            } else {
                contentDiv.innerHTML = `<div style="color: #666;">No data available for today</div>`;
            }
        }

        // Initial update
        updateWorkTimeLabel();

        // Update every minute
        setInterval(updateWorkTimeLabel, 60000);

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
                    
                    // Calculate remaining work time
                    const workTime = calculateRemainingWorkTime(parsedData.todayRecord);
                    console.log('Work time calculation:', workTime);
                    
                    // Get the booking key ID for this button
                    const keyId = getBookingKeyId(rawData, btnConfig.text);
                    console.log(`Booking key ID for ${btnConfig.text}:`, keyId);
                    
                    // Update the work time label after button click
                    setTimeout(updateWorkTimeLabel, 1000);
                }
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
