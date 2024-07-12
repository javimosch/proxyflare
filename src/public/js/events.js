let autoUpdateInterval;

function fetchEvents() {
    fetch('/api/events')
        .then(response => response.json())
        .then(events => {
            const tableBody = document.querySelector('#eventsTable tbody');
            tableBody.innerHTML = '';
            events.forEach(event => {
                const row = `
                    <tr>
                        <td>${event.action}</td>
                        <td>${JSON.stringify(event.details)}</td>
                        <td>${new Date(event.timestamp).toLocaleString()}</td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
            window.updateProxiesTable&&window.updateProxiesTable()
        })
        .catch(error => console.error('Error fetching events:', error));
}

function startAutoUpdate() {
    autoUpdateInterval = setInterval(fetchEvents, 5000);
}

function stopAutoUpdate() {
    clearInterval(autoUpdateInterval);
}

document.getElementById('updateEvents').addEventListener('click', fetchEvents);

document.getElementById('autoUpdate').addEventListener('change', function() {
    if (this.checked) {
        startAutoUpdate();
    } else {
        stopAutoUpdate();
    }
});

// Initial fetch and start auto-update
fetchEvents();
document.getElementById('autoUpdate').checked = true;
startAutoUpdate();