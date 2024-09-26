// Pyykkönen
// osoitteiden autom.ehdotus


const startPointInput = document.getElementById('startPoint');
const endPointInput = document.getElementById('endPoint');
const suggestionsList = document.getElementById('suggestionsList');

startPointInput.addEventListener('input', () => handleInput(startPointInput));
endPointInput.addEventListener('input', () => handleInput(endPointInput));



// haetaan herestä osoitteet (tässä vielä hiomista jotta saadaan vain suomen osoitteet)
function fetchSuggestions(query) {
    const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(query)}&apiKey=${apiKey}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            displaySuggestions(data.items);
        })
        .catch(error => {
            console.error('Virhe osoitteiden hakemisessa:', error);
            suggestionsList.innerHTML = '';
        });
}

// ehdotukset tulee näkyviin mikäli syötetään enemmän kuin 2 kirjainta
const handleInput = (input) => {
    const query = input.value;
    if (query.length > 2) {
        fetchSuggestions(query);
    } else {
        suggestionsList.innerHTML = '';
    }
};


// näytetään osoitteet listana allekkain, tässä myös valitaan klikattu osoite
function displaySuggestions(suggestions) {
    suggestionsList.innerHTML = '';

    if (suggestions.length === 0) {
        return;
        }

    suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = suggestion.address.label;

        li.addEventListener('click', function() {
            if (document.activeElement === startPointInput) {
                startPointInput.value = suggestion.address.label;
            } else if (document.activeElement === endPointInput) {
                endPointInput.value = suggestion.address.label;
            }
            suggestionsList.innerHTML = '';
        });

        suggestionsList.appendChild(li);
    });
}

// klikkaamalla muualle osoite-ehdotus poistuu
document.addEventListener('click', function(event) {
    if (!startPointInput.contains(event.target) && !endPointInput.contains(event.target) && !suggestionsList.contains(event.target)) {
        suggestionsList.innerHTML = '';
    }
});




// valikko mahdollisille asetuksille?
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
