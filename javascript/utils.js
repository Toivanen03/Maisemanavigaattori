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
const findRouteButton = document.getElementById('findRoute');
const searchRoute = document.getElementById('search-route');
const searchDiv = document.querySelector('.search');
const loginForm = document.getElementById('login-form');
const toggleInfo = document.getElementById('toggle-info');
const infoDiv = document.getElementById('info');
const settingsMenu = document.getElementById('settings-menu');
const routingIcon = document.getElementById('routing-icon');
const modeBox = document.getElementById('mode-box');
const loginIconDiv = document.getElementById('login-icon');


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
    maisemaSwitch.classList.toggle('hide');
    switchText.classList.toggle('hide');
    event.stopPropagation();
});

// Maisemareitti-kytkintä
document.getElementById('maisema-checkbox').addEventListener('change', function() {
    if (this.checked) {
        switchText.textContent = 'Käytössä';
        setSceneryRouting(true);
    } else {
        switchText.textContent = 'Ei käytössä';
        setSceneryRouting(false);
    }
    setTimeout(() => {
        switchText.classList.toggle('hide');
        maisemaSwitch.classList.toggle('hide');
    }, 1500);
});


// Fullscreen tila 
document.getElementById('fullscreen-toggle').addEventListener('click', function() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});


// Funktio valikoiden näkyvyydelle
function toggleVisibility(targetDiv, ...divsToHide) {
    divsToHide.forEach(div => {
        if (!div.classList.contains('hide')) {
            div.classList.add('hide');
        }
    });
    targetDiv.classList.toggle('hide');
}

// Reitin haun jälkeen hakukenttä pois näkyvistä
findRouteButton.addEventListener('click', () => {
    const startPoint = startPointInput.value;
    const endPoint = endPointInput.value;
    if (startPoint && endPoint) {
        toggleVisibility(searchDiv);
    }
});

// Suljetaan muut, jos klikataan hakua
searchRoute.addEventListener('click', (event) => {
    toggleVisibility(searchDiv, loginForm, infoDiv,settingsMenu,modeBox);
});

// Infolle sama
toggleInfo.addEventListener('click', (event) => {
    toggleVisibility(infoDiv, loginForm, searchDiv, settingsMenu,modeBox);
});

// Reititystavan valintaboxille sama
routingIcon.addEventListener('click', () => {
    toggleVisibility(modeBox, infoDiv, loginForm, searchDiv, settingsMenu);
});

// Kirjautumiseen 
loginIconDiv.addEventListener('click', () => {
    if (!searchDiv.classList.contains('hide')) {
        searchDiv.classList.add('hide');
    }
    if (!infoDiv.classList.contains('hide')) {
        infoDiv.classList.add('hide');
    }
    toggleVisibility(loginForm);
});
