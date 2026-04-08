// ==UserScript==
// @name         Arbeitszeitstatus
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Zeigt die verbleibende Arbeitszeit sowie anfallende Überstunden unterhalb des "Erfassen"-Buttons an
// @author       You
// @match        https://psteam.summit-services.de/horizon/
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/jonas-halbeisen-psteam/Arbeitszeitstatus/refs/heads/main/Zeiterfassung.user.js
// ==/UserScript==

(function () {
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
            dayRecords: data.dayRecords || [],
            todayRecord: null
        };

        // Find today's record
        const today = new Date().toISOString().split('T')[0];
        parsed.todayRecord = data.dayRecords?.find(record => record.date === today);

        return parsed;
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
        let hasPause = false;

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

            // Check if it's a pause
            if (key === 'PA') {
                hasPause = true;
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
        if (!hasPause) {
            requiredMinutes += 30; // 8.5 hours
        }

        const remainingMinutes = Math.max(0, requiredMinutes - workedMinutes);
        const overtimeMinutes = Math.max(0, workedMinutes - requiredMinutes);

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
            overtimeMinutes,
            requiredMinutes,
            workedMinutes,
            hasPause,
            currentlyWorking,
            endTime,
            message: `Worked: ${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m / Required: ${Math.floor(requiredMinutes / 60)}h ${requiredMinutes % 60}m`
        };
    }

    // Add work time label below the Erfassen button
    function addWorkTimeLabel() {
        // Find the submit button box that contains the "Erfassen" button
        const submitButtonBox = document.querySelector('[data-testid="clockingWidgetSubmitButtonBox"]');

        if (!submitButtonBox) {
            return false;
        }

        // Check if already added
        if (document.querySelector('.work-time-container')) {
            return true;
        }

        // Create container
        const container = document.createElement('div');
        container.className = 'work-time-container';
        container.style.cssText = 'margin-top: 12px;';

        // Create work time info label
        const workTimeLabel = document.createElement('div');
        workTimeLabel.style.cssText = `
            background-color: #f5f5f5;
            border-left: 4px solid #1976d2;
            padding: 12px;
            border-radius: 4px;
            font-size: 14px;
            color: #2E3233;
        `;
        workTimeLabel.innerHTML = `
            <div style="font-weight: 500; margin-bottom: 4px;">⏱️ Arbeitszeitstatus</div>
            <div class="work-time-content" style="font-size: 13px; color: #555;">Lädt...</div>
        `;
        container.appendChild(workTimeLabel);

        // Cache for the last fetched data
        let cachedParsedData = null;

        // Function to update work time label (with optional fetch)
        async function updateWorkTimeLabel(forceFetch = false) {
            const contentDiv = workTimeLabel.querySelector('.work-time-content');

            // Fetch new data if forced or no cached data
            if (forceFetch || !cachedParsedData) {
                const rawData = await fetchClockingData();
                cachedParsedData = parseClockingData(rawData);
            }

            if (cachedParsedData && cachedParsedData.todayRecord) {
                const workTime = calculateRemainingWorkTime(cachedParsedData.todayRecord);

                const remainingHours = Math.floor(workTime.remainingMinutes / 60);
                const remainingMins = workTime.remainingMinutes % 60;

                let statusText = '';
                if (workTime.remainingMinutes === 0 && workTime.workedMinutes >= workTime.requiredMinutes) {
                    const overtimeMinutes = workTime.workedMinutes - workTime.requiredMinutes;
                    const overtimeHours = Math.floor(overtimeMinutes / 60);
                    const overtimeMins = overtimeMinutes % 60;
                    statusText = `<div style="color: #2e7d32; font-weight: 500;">Sollarbeitszeit erfüllt!</div>`;
                    statusText += `<div style="color: #2e7d32; margin-top: 4px;">Überstunden: +${overtimeHours}h ${overtimeMins}m</div>`;
                } else {
                    statusText = `<div>Verbleibend: ${remainingHours}h ${remainingMins}m</div>`;
                    if (workTime.endTime) {
                        statusText += `<div>Feierabend um: ${workTime.endTime}</div>`;
                    }
                }

                contentDiv.innerHTML = statusText;
            } else {
                contentDiv.innerHTML = `<div style="color: #666;">Keine Daten für heute verfügbar</div>`;
            }
        }

        // Initial fetch
        updateWorkTimeLabel(true);

        // Update display every minute (recalculate with cached data)
        setInterval(() => updateWorkTimeLabel(false), 60000);

        // Insert the container after the submit button box
        submitButtonBox.parentNode.insertBefore(container, submitButtonBox.nextSibling);
        return true;
    }

    // Try to add immediately
    if (!addWorkTimeLabel()) {
        // If not found, wait for DOM changes
        const observer = new MutationObserver(function (mutations) {
            if (addWorkTimeLabel()) {
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
})();
