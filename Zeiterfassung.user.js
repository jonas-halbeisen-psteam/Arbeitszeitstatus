// ==UserScript==
// @name         Arbeitszeitstatus
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Zeigt die verbleibende Arbeitszeit sowie anfallende Überstunden unterhalb des "Erfassen"-Buttons an
// @author       You
// @match        https://psteam.summit-services.de/horizon/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/jonas-halbeisen-psteam/Arbeitszeitstatus/refs/heads/main/Zeiterfassung.user.js
// ==/UserScript==

(function () {
    'use strict';

    function timeToMinutes(timeStr) {
        if (!timeStr) return null;
        const parts = timeStr.trim().split(':').map(Number);
        if (parts.length < 2 || parts.some(isNaN)) return null;
        return parts[0] * 60 + parts[1];
    }

    function parseTodayBookingsFromDOM() {
        const listItems = document.querySelectorAll('.MuiListItemButton-root');
        let todayItem = null;

        for (const item of listItems) {
            const label = item.querySelector('.css-1fo1l1c');
            if (label && label.textContent.trim() === 'Heute') {
                todayItem = item;
                break;
            }
        }

        if (!todayItem) return null;

        const rows = todayItem.querySelectorAll('.MuiCollapse-wrapperInner .css-1kdgy44');
        const bookings = [];

        for (const row of rows) {
            const ps = row.querySelectorAll('p');
            if (ps.length < 2) continue;
            const label = ps[0].textContent.trim();
            const time = ps[1].textContent.trim();

            let key = null;
            if (label === 'Kommen') key = 'K';
            else if (label === 'Gehen') key = 'G';
            else if (label === 'Pause Beginn' || label === 'PA') key = 'PA';
            else if (label === 'Pause Ende' || label === 'PE') key = 'PE';

            if (key) bookings.push({ key, time });
        }

        return bookings;
    }

    function calculateWorkTime(bookings) {
        const REQUIRED = 480;

        if (!bookings || bookings.length === 0) {
            return { workedMinutes: 0, requiredMinutes: REQUIRED + 30, remainingMinutes: REQUIRED + 30, overtimeMinutes: 0, currentlyWorking: false, endTime: '', hasPause: false };
        }

        const sorted = [...bookings].sort((a, b) => (timeToMinutes(a.time) ?? 0) - (timeToMinutes(b.time) ?? 0));

        let workedMinutes = 0;
        let workStart = null;
        let pauseStart = null;
        let hasPause = false;
        let currentlyWorking = false;

        for (const { key, time } of sorted) {
            const t = timeToMinutes(time);
            if (t === null) continue;

            if (key === 'K') {
                workStart = t;
                currentlyWorking = true;
            } else if (key === 'G') {
                if (workStart !== null) workedMinutes += t - workStart;
                workStart = null;
                currentlyWorking = false;
            } else if (key === 'PA') {
                hasPause = true;
                if (workStart !== null) {
                    workedMinutes += t - workStart;
                    workStart = null;
                }
                pauseStart = t;
            } else if (key === 'PE') {
                pauseStart = null;
                workStart = t;
            }
        }

        if (currentlyWorking && workStart !== null) {
            const now = new Date();
            workedMinutes += now.getHours() * 60 + now.getMinutes() - workStart;
        }

        const requiredMinutes = REQUIRED + (hasPause ? 0 : 30);
        const remainingMinutes = Math.max(0, requiredMinutes - workedMinutes);
        const overtimeMinutes = Math.max(0, workedMinutes - requiredMinutes);

        let endTime = '';
        if (currentlyWorking && remainingMinutes > 0) {
            const now = new Date();
            const end = now.getHours() * 60 + now.getMinutes() + remainingMinutes;
            endTime = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
        }

        return { workedMinutes, requiredMinutes, remainingMinutes, overtimeMinutes, currentlyWorking, endTime, hasPause };
    }

    function renderStatus(contentDiv) {
        const bookings = parseTodayBookingsFromDOM();
        const wt = calculateWorkTime(bookings);

        if (!bookings || bookings.length === 0) {
            contentDiv.innerHTML = `<div style="color:#666;">Keine Buchungen für heute gefunden</div>`;
            return;
        }

        if (wt.remainingMinutes === 0) {
            const oh = Math.floor(wt.overtimeMinutes / 60);
            const om = wt.overtimeMinutes % 60;
            contentDiv.innerHTML = `
                <div style="color:#2e7d32;font-weight:500;">Sollarbeitszeit erfüllt!</div>
                <div style="color:#2e7d32;margin-top:4px;">Überstunden: +${oh}h ${om}m</div>
            `;
        } else {
            const rh = Math.floor(wt.remainingMinutes / 60);
            const rm = wt.remainingMinutes % 60;
            contentDiv.innerHTML = `
                <div>Verbleibend: ${rh}h ${rm}m</div>
                ${wt.endTime ? `<div>Feierabend um: ${wt.endTime}</div>` : ''}
            `;
        }
    }

    function addWorkTimeLabel() {
        const submitButtonBox = document.querySelector('[data-testid="clockingWidgetSubmitButtonBox"]');
        if (!submitButtonBox) return false;
        if (document.querySelector('.work-time-container')) return true;

        const container = document.createElement('div');
        container.className = 'work-time-container';
        container.style.marginTop = '12px';

        const card = document.createElement('div');
        card.style.cssText = 'background:#f5f5f5;border-left:4px solid #1976d2;padding:12px;border-radius:4px;font-size:14px;color:#2E3233;';
        card.innerHTML = `<div style="font-weight:500;margin-bottom:4px;">⏱️ Arbeitszeitstatus</div><div class="work-time-content" style="font-size:13px;color:#555;">Lädt...</div>`;
        container.appendChild(card);

        submitButtonBox.parentNode.insertBefore(container, submitButtonBox.nextSibling);

        const contentDiv = card.querySelector('.work-time-content');
        renderStatus(contentDiv);
        setInterval(() => renderStatus(contentDiv), 60000);

        return true;
    }

    function tryInject() {
        const submitBox = document.querySelector('[data-testid="clockingWidgetSubmitButtonBox"]');
        const hasListItems = document.querySelectorAll('.MuiListItemButton-root').length > 0;
        if (!submitBox || !hasListItems) return false;
        return addWorkTimeLabel();
    }

    if (!tryInject()) {
        const initObserver = new MutationObserver(() => {
            if (tryInject()) initObserver.disconnect();
        });
        initObserver.observe(document.body, { childList: true, subtree: true });
    }

    new MutationObserver(() => {
        if (!document.querySelector('.work-time-container')) {
            addWorkTimeLabel();
        }
    }).observe(document.body, { childList: true, subtree: true });

})();
