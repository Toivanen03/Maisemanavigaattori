// Pyykkönen
// Osoitteiden autom.ehdotus
import {apiKeyHERE} from "./config.js";

const startPointInput = document.getElementById('startPoint');
const endPointInput = document.getElementById('endPoint');
const startSuggestionsList = document.getElementById('startSuggestionsList');
const endSuggestionsList = document.getElementById('endSuggestionsList');

// Haetaan herestä osoitteet
function fetchSuggestions(query, suggestionsList) {
    const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(query)}&in=countryCode:FIN&apiKey=${apiKeyHERE}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            displaySuggestions(data.items, suggestionsList);
        })
        .catch(error => {
            console.error('Virhe osoitteiden hakemisessa:', error);
            suggestionsList.innerHTML = '';
        });
}


// Ehdotukset tulee näkyviin mikäli syötetään enemmän kuin 2 kirjainta
// Lähtöpiste
startPointInput.addEventListener('input', function() {
    const query = startPointInput.value;
    if (query.length > 2) {
        fetchSuggestions(query, startSuggestionsList);
    } else {
        startSuggestionsList.innerHTML = '';
    }
});
// Määränpää
endPointInput.addEventListener('input', function() {
    const query = endPointInput.value;
    if (query.length > 2) {
        fetchSuggestions(query, endSuggestionsList);
    } else {
           endSuggestionsList.innerHTML = '';
    }
});



// Näytetään osoitteet listana allekkain, tässä myös valitaan klikattu osoite
function displaySuggestions(suggestions, suggestionsList) {
    suggestionsList.innerHTML = '';

    if (suggestions.length === 0) {
        return;
    }

    suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = suggestion.address.label;

        li.addEventListener('click', function() {
            suggestionsList.innerHTML = '';
            if (suggestionsList === startSuggestionsList) {
                startPointInput.value = suggestion.address.label;
            } else {
                endPointInput.value = suggestion.address.label;
            }
        });

        suggestionsList.appendChild(li);
    });
}

// Klikkaamalla muualle osoite-ehdotus poistuu
document.addEventListener('click', function(event) {
    if (!startPointInput.contains(event.target) && !startSuggestionsList.contains(event.target)) {
        startSuggestionsList.innerHTML = '';
    }
    if (!endPointInput.contains(event.target) && !endSuggestionsList.contains(event.target)) {
        endSuggestionsList.innerHTML = '';
    }
});




// Valikko mahdollisille asetuksille?
document.getElementById('settings-icon').addEventListener('click', function(event) {
    event.stopPropagation();
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('show');
});

document.addEventListener('click', function(event) {
    const panel = document.getElementById('settings-panel');
    const icon = document.getElementById('settings-icon');

    if (!panel.contains(event.target) && !icon.contains(event.target)) {
        panel.classList.remove('show');
    }
});


// Piilotetaan hakukentät kun aloitetaan navigointi 

const startPointDiv = document.getElementById('startPoint').parentElement;
const endPointDiv = document.getElementById('endPoint').parentElement;
const findRouteButton = document.getElementById('findRoute');

document.getElementById('navigateRoute').addEventListener('click', function() {
    if (startPointDiv.style.display === 'none') {
        startPointDiv.style.display = 'block';
        endPointDiv.style.display = 'block';
        findRouteButton.style.display = 'block';
    } else {
        startPointDiv.style.display = 'none';
        endPointDiv.style.display = 'none';
        findRouteButton.style.display = 'none';
    }
    
});



// Fullscreen tila 
document.getElementById('fullscreen-toggle').addEventListener('click', function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});




