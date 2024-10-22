// Pyykkönen
// Osoitteiden autom.ehdotus
import {apiKeyHERE} from "./config.js";
import { checkAddress, setSceneryRouting } from "./main.js";
const startPointInput = document.getElementById('startPoint');
const endPointInput = document.getElementById('endPoint');
const startSuggestionsList = document.getElementById('startSuggestionsList');
const endSuggestionsList = document.getElementById('endSuggestionsList');
const maisemaSwitch = document.getElementById('maisema-switch');
const switchText = document.getElementById('switch-text');
const menu = document.querySelector('.menu');
const menuItems = menu.querySelectorAll('.menu-item');
const findRouteButton = document.getElementById('findRoute');
const startPoint = document.getElementById('startPoint').value;
const endPoint = document.getElementById('endPoint').value;

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

            const selectedAddress = suggestion.address.label;
            suggestionsList.innerHTML = '';
            if (suggestionsList === startSuggestionsList) {
                startPointInput.value = selectedAddress;
                checkAddress('start');
            } else {
                endPointInput.value = selectedAddress;
                checkAddress('end');
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



// Maisemareitti-kytkintä
document.getElementById('toggle-maisema').addEventListener('click', function(event) {
    if (!maisemaSwitch.classList.contains('hide')) {

    } else {
 
        maisemaSwitch.classList.remove('hide');
        switchText.classList.remove('hide');
    }
    event.stopPropagation();
});

// Maisemareitti-kytkintä
document.getElementById('maisema-checkbox').addEventListener('change', function() {
    if (this.checked) {
        switchText.textContent = "Käytössä";
      
        console.log('Maisemareitti käytössä');
        console.log('Maisemareitti?');
    } else {
        switchText.textContent = "Ei käytössä";
     
        console.log('Maisemareitti ei käytössä');
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


// Estetään mapin klikkaus sivuvalikossa

document.querySelector('.menu').addEventListener('click', function(event) {
    event.stopPropagation();

});

// Sama reitinhakuboxille
document.querySelector('.search').addEventListener('click', function(event) {
    event.stopPropagation();
    
});



///// Uutta

const searchRoute = document.getElementById('search-route');
const searchDiv = document.querySelector('.search');

searchRoute.addEventListener('click', (event) => {
    event.stopPropagation();
    searchDiv.style.display = searchDiv.style.display === 'block' ? 'none' : 'block';
});

findRouteButton.addEventListener('click', () => {
    const startPoint = startPointInput.value;
    const endPoint = endPointInput.value;
    if (startPoint && endPoint) {
        searchDiv.style.display = 'none';
    }
});


document.addEventListener('click', () => {
    searchDiv.style.display = 'none';
});