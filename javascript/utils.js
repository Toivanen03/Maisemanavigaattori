// Pyykkönen
// Osoitteiden autom.ehdotus
import {apiKeyHERE} from "./config.js";
import { checkAddress, setSceneryRouting } from "./main.js";
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



// Valikot piiloon
const infoBox = document.getElementById('info');
const maisemaSwitch = document.getElementById('maisema-switch');
const switchText = document.getElementById('switch-text');
const sideMenu = document.querySelector('.side-menu-left');


function closeAllSettings() {
    infoBox.classList.add('hide');
    maisemaSwitch.classList.add('hide');
    switchText.classList.add('hide');
  
}

window.addEventListener('click', function(event) {
    if (!sideMenu.contains(event.target)) {
        closeAllSettings();
    }

    
});

/*
Poissa käytöstä kunnes saan toimimaan
// Infoa
document.getElementById('toggle-info').addEventListener('click', function(event) {
    if (!infoBox.classList.contains('hide')) {
        closeAllSettings();
    } else {
        closeAllSettings();
        infoBox.classList.remove('hide');
    }
    event.stopPropagation();
});

*/


// Maisemareitti-kytkintä
document.getElementById('toggle-maisema').addEventListener('click', function(event) {
    if (!maisemaSwitch.classList.contains('hide')) {
        closeAllSettings();
    } else {
        closeAllSettings();
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


// Estetään mapin klikkaus sivuvalikossa
const searchDiv = document.querySelector('.search');

document.querySelector('.side-menu-left').addEventListener('click', function(event) {
    event.stopPropagation();

});

// Sama reitinhakuboxille
document.querySelector('.search').addEventListener('click', function(event) {
    event.stopPropagation();
    
});

// Reittihakua uusiksi
document.getElementById('search-route').addEventListener('click', function() {
   
    if (searchDiv.style.display === 'none' || searchDiv.style.display === '') {
        searchDiv.style.display = 'block';
    } else {
        searchDiv.style.display = 'none';
    }
});

// Suljetaan reittihaku kun osoitteet on syötetty
document.getElementById('findRoute').addEventListener('click', function() {
    const startPoint = document.getElementById('startPoint').value.trim();
    const endPoint = document.getElementById('endPoint').value.trim();

    if (startPoint !== '' && endPoint !== '') {
        searchDiv.style.display = 'none';
    }
});


// Tunnus ja salasana (prototyyppi)
const correctUsername = 'admin';
const correctPassword = 'pass';
const loginForm = document.getElementById('login-form');
const loginFormElement = document.getElementById('login-form-element');
const usernameDisplay = document.getElementById('username-display');
const loginDiv = document.getElementById('login');
const loginImage = loginDiv.querySelector('img');
const loginButton = document.getElementById('login');

loginButton.addEventListener('click', function() {
    document.getElementById('login-form').classList.toggle('hide');
});


// Kirjautuminen
loginFormElement.addEventListener('submit', function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    console.log(`Username: ${username}, Password: ${password}`);

    if (username === correctUsername && password === correctPassword) {
        loginForm.classList.add('hide');
        usernameDisplay.textContent = `Kirjautuneena: ${username}`;
        usernameDisplay.classList.remove('hide');
        loginImage.src = 'images/logout.png';
        loginImage.alt = 'logout';
        loginButton.classList.add('hide');
        loginFormElement.reset();
    } else {
        alert('Virheellinen tunnus tai salasana!');
    }
});

// Kirjaudu ulos
loginImage.addEventListener('click', function() {
    if (loginImage.alt === 'logout') {
        usernameDisplay.classList.add('hide');
        loginImage.src = 'images/login.png';
        loginImage.alt = 'login';
        loginForm.classList.remove('hide');
        console.log('Logout klikattu');
    }
});




