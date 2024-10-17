let map;                                                                    // Alustetaan muuttujat:    - Karttapohja
let currentRouteLayer = null;                                               //                          - Reittikerros
let startMarker, endMarker;                                                 //                          - Alku- ja loppumerkit
let currentMarkerType;                                                      //                          - Merkin tyyppi (myöhemmin start tai end)
let sceneryRouting = true;                                                  //                          - Perus- tai maisemanavigointi
let startAddress = document.getElementById('startPoint');                   //                          - Osoitekentät
let endAddress = document.getElementById('endPoint');
let startCoords = document.getElementById('startPointCoords');              //                          - Koordinaattikentät
let endCoords = document.getElementById('endPointCoords');
let searchBox = document.querySelector('.search');
let shortRoute = false;                                                     //                          - Muuttuja alle kymmenen koordinaattipisteen reitille

const defaultLat = 61.23345;                                                // Oletussijainti (ABC Heinola). Käytetään, mikäli selaimelle ei ole annettu lupaa sijainnin jakamiseen
const defaultLng = 26.04378;
const routeDistance = document.getElementById("routeDistance");             // Etäisyyskenttä
const defaultStart = defaultLat + ',' + defaultLng;                         // Asetetaan aluksi oletussijainnin koordinaatit
startCoords.value = defaultStart;

let [startLat, startLng] = startCoords.value.split(',').map(coord => parseFloat(coord.trim())); // Pituus- ja leveysasteet
let [endLat, endLng] = endCoords.value.split(',').map(coord => parseFloat(coord.trim()));

import { apiKey, apiKeyHERE } from './config.js';                           // Ladataan API-avaimet
import { getApprovedRoutes } from './routeFilter.js';                       // Reittien suodatus
import { findAlternativeRoute } from './routeFilter.js';
import { callForVerify } from './routeFilter.js';

export let geojsonData;                                                     // Reittidata
export let routeVerified = { validRoute: false };                           // True tai false tarkistettujen koordinaattien mukaisesti
export function setShortRoute(value) {                                      // Päivittää muuttujan arvoa routeFilter-tiedostosta
    shortRoute = value;
}
export function getShortRoute() {
    return shortRoute;
}



window.onload = function() {                                                // Tuodaan näkyviin lupakysely sijaintitiedon jakamiseen
    navigator.permissions.query({ name: 'geolocation' })
        .then(function(permissionStatus) {
            if (permissionStatus.state === 'granted') {                     // Tarkistetaan, onko lupa sijainnin käyttöön annettu aiemmalla sivustokäynnillä
                handlePermission(true);
                document.getElementById('locationQueryBox').style.display = 'none';
            } else if (permissionStatus.state === 'denied') {
                handlePermissionDenied(null);
            } else {
                document.getElementById('locationQueryBox').style.display = 'block';
            }
        });
}
    

document.addEventListener('DOMContentLoaded', async function() {            
    if (!localStorage.getItem('cookiesAccepted')) {                         // Tarkistetaan, onko HEREn evästekäytäntö hyväksytty aiemmin
        document.getElementById('cookie-banner').style.display = 'block';
    }

    document.getElementById('accept-cookies').addEventListener('click', function() {
        localStorage.setItem('cookiesAccepted', 'true');                    // Tieto hyväksytyistä evästeistä tallennetaan localstorageen
        document.getElementById('cookie-banner').style.display = 'none';
    });

    document.getElementById('decline-cookies').addEventListener('click', function() {
        window.location.href = "https://www.google.fi";                     // Ohjataan muualle, jos evästeitä ei hyväksytä
    });

    searchBox.addEventListener('mouseenter', () => {                        // Estetään kartan raahautuminen tekstiä valitessa syöttökentästä
        map.dragging.disable();
    })

    searchBox.addEventListener('mouseleave', () => {
        map.dragging.enable();
    })

    document.getElementById('startPoint').addEventListener('focus', () => {
        currentMarkerType = 'start';                                        // Asetetaan muuttujan arvo valitun osoitekentän mukaan
    });

    document.getElementById('endPoint').addEventListener('focus', () => {
        currentMarkerType = 'end';
    });

    document.getElementById('startPoint').addEventListener('blur', function() { // Tarkistetaan syöttökentän osoite
        checkAddress('start');                                              
    });

    document.getElementById('endPoint').addEventListener('blur', function() {       
        checkAddress('end');
    });

    document.getElementById('findRoute').addEventListener('click', function() { // Reittihakupainikkeen kuuntelu
        if (startLat && startLng && endLat && endLng) {
            getRoute(startLat, startLng, endLat, endLng);
        } else {
            alert("Aseta sekä lähtöpiste että määränpää.");
        }
    });

    document.getElementById("removeRoutes").addEventListener("click", function() {  // Reitin tyhjennyspainikkeen kuuntelu
        startAddress.value = "";
        endAddress.value = "";
        routeDistance.style.display = "none";
        removeRoute();
    });
});




function removeRoute() {                    // Poistaa reittikerroksen sekä asetetut merkit kartalta
    if (currentRouteLayer) {
        map.removeLayer(currentRouteLayer);
        currentRouteLayer = null;
    }
    if (startMarker) {
        map.removeLayer(startMarker);
        startMarker = null;
    }
    if (endMarker) {
        map.removeLayer(endMarker);
        endMarker = null;
    }
    currentMarkerType = 'start';
}




function handlePermission(reply) {                                              // Funktiota kutsutaan HTML-koodin sijaintilupakyselypainikkeilla
    document.getElementById('locationQueryBox').style.display = 'none';
    if (reply === true) {                                                       // Painikkeilta välittyy true tai false
        currentMarkerType = 'end';
        navigator.geolocation.getCurrentPosition(                               // Pyydetään selaimelta sijaintitieto, edellyttää käyttäjän myöntämää lupaa
            function(position) {
                startLat = position.coords.latitude;
                startLng = position.coords.longitude;
                drawMap(startLat, startLng, 20);
                const latLngString = `${startLat.toFixed(5)},${startLng.toFixed(5)}`;
                startCoords.value = latLngString;
                reverseGeocode(startLat, startLng, function(address) {            // Saatu sijainti geokoodataan käänteisesti ja asetetaan osoite tekstinsyöttökenttään ja markeriin
                    startAddress.value = address;
                    startMarker = L.marker([startLat, startLng]).addTo(map).bindPopup(`<div style="text-align: center;"><b>Sijaintisi:</b></div><br>${address}`).openPopup();
                });
            },
            function(error) {                       // Jos sijaintia ei saada, siitä kerrotaan käyttäjälle, asetetaan oletussijainti ja tulostetaan virhe
                locationError(error);
            });
        } else {                                    // Jos sijaintilupaa ei myönnetä, siitä kerrotaan käyttäjälle ja asetetaan oletussijainti
            handlePermissionDenied(null);
            locationError(null);
            }
}




function handlePermissionDenied(parameter) {        // Huolehtii viestilaatikon näytöstä tilanteessa, jossa käyttäjä on estänyt sijainnin
    document.getElementById('permissionDeniedBox').style.display = 'block';
    if (parameter === 'close') {
        document.getElementById('permissionDeniedBox').style.display = 'none';
    }
}




function locationError(error) {                 // Funktio määrittelee viestin saamansa parametrin perusteella. Jos todellinen virhe sijaintihaussa tapahtuu,
    let errorMessage;                           // näytetään eri viesti kuin tilanteessa, jossa käyttäjä on estänyt sijainnin jakamisen. Oletusosoitteen haku
    drawMap(defaultLat, defaultLng, 15);        // ja markerin asettaminen tapahtuvat tässä funktiossa.
    startCoords.value = `${defaultLat}, ${defaultLng}`;
    reverseGeocode(defaultLat, defaultLng, function(address) {
        startAddress.value = "Oletussijainti";
        if (error != null) {
            errorMessage = `${address}<br><div style="text-align: center;"><i>(Virhe sijainnin hakemisessa: ${error})</i></div>`;
        } else {
            errorMessage = `${address}<br><div style="text-align: center;"><i>(Sijaintilupaa ei myönnetty.)</i></div>`;
        }
        startMarker = L.marker([defaultLat, defaultLng]).addTo(map).bindPopup(errorMessage).openPopup();
    })
}




async function getRoute(startLat, startLng, endLat, endLng) {   // Reitinhakufunktio lähettää hakupyynnön ORS-palvelimelle. Osoitteen muuttujissa on haettavat koordinaatit sekä APIkey. Lisäparametrilla määritetään haettavaksi kolme reittivaihtoehtoa.
    let routeCheck;
    if (sceneryRouting) {
        getApprovedRoutes();                // Puretaan heinola.json-tiedoston sallitut reitit tiedostossa routeFilter
    }

    if (currentRouteLayer) {                // Olemassaoleva karttakerros poistetaan, jos reittiä on jo haettu aiemmin
        map.removeLayer(currentRouteLayer);
    }

    const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${startLng},${startLat}&end=${endLng},${endLat}&api_key=${apiKey}`;    
    try {                                                                       // Haetaan pyydetty data
        const response = await fetch(url);
        const data = await response.json();    
            if (data.features && data.features.length > 0) {                    // Tarkistetaan, onko palvelimelta vastaanotettu mitään
                let route = data.features[0];
                geojsonData = route.geometry;                                   // Muuttuja sisältää reitin geometrian, eli koordinaattitiedot
                if (sceneryRouting) {
                    routeCheck = await callForVerify(); // Korkeintaan kymmenen koordinaattipisteen reittihaku palauttaa alkuperäisen reitin takaisin
                    if (!shortRoute) {                  // Jos alkuperäinen reittihaku on vähintään 11 koordinaattipisteen pituinen,
                        let alternativeRoute = await findAlternativeRoute();    // suoritetaan uusi reittihaku routeFilter-tiedostossa
                        if (geojsonData !== alternativeRoute) {     // Jos vastaanotettu reitti on eri kuin alkuperäisen haun tulos,
                            geojsonData = alternativeRoute;         // uusi reitti asetetaan geojsonData-muuttujaan.
                        }
                    }
                }
                
                if (routeVerified.validRoute || !sceneryRouting || shortRoute) {    // Suoritetaan, mikäli: a) ensimmäinen reittihaku täyttää suodatusehdot, b) maisemaraittihaku on pois päältä, tai c) haettu reitti on lyhyt
                    currentRouteLayer = L.geoJSON(geojsonData).addTo(map);          // Asetetaan reittikerros kartalle
                    //calculateDistance();                                          // Laskee reitin pituuden linnuntietä
                    if (geojsonData.coordinates.length > 0) {
                        map.fitBounds(currentRouteLayer.getBounds(), {padding: [100, 100]});    // Piirtää reitin marginaalin kanssa
                    }
                }
            }
        } catch(err) {                              // Tulostetaan virhe konsoliin, mikäli ensimmäinen reittihaku epäonnistuu (palvelinvirhe)
            console.error('Virhe:', err);
        }
    placeAddressOnPopups();
}




function calculateDistance() {  // Laskee reitin linnuntietä, mietitään onko käyttöä
        let coord1 = startCoords.value.split(',').map(coord => parseFloat(coord.trim()))
        let coord2 = endCoords.value.split(',').map(coord => parseFloat(coord.trim()))
        let distance = distanceCalc(coord1, coord2);

        function distanceCalc(coord1, coord2) {
            const R = 6371000;
            const lat1 = coord1[1] * Math.PI / 180;
            const lat2 = coord2[1] * Math.PI / 180;
            const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
            const deltaLng = (coord2[0] - coord1[0]) * Math.PI / 180;
        
            const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                        Math.cos(lat1) * Math.cos(lat2) *
                        Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
            return R * c;
        }

        const routeDistanceDiv = document.getElementById('routeDistance');
        routeDistanceDiv.textContent = `Matka: ${(distance / 1000).toFixed(2)} km`;
        routeDistanceDiv.style.display = 'block';
        routeDistanceDiv.style.textAlign = 'center';
}




function geocodeAddress(address, callback) {                        // Geokoodaus kääntää osoitteet koordinaateiksi, joiden avulla varsinainen reittihaku tapahtuu
    if (address !== "") {                                           // Varmistetaan, ettei osoite ole tyhjä ja haetaan koordinaatit HERE-palvelimelta. Hakupyynnössä on haettava osoite sekä palveluun rekisteröityessä saatu API-avain
        const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(address)}&apiKey=${apiKeyHERE}`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.items && data.items.length > 0) {          // Mikäli pyyntö onnistuu ja vastaus ei ole tyhjä, tallennetaan koordinaatit muuttujiin ja asetetaan arvot piilotettuihin syöttökenttiin
                    const location = data.items[0];
                    const lat = location.position.lat;
                    const lng = location.position.lng;
                    if (currentMarkerType === 'start') {
                        startCoords.value = lat + ',' + lng;
                    } else if (currentMarkerType === 'end') {
                        endCoords.value = lat + ',' + lng;
                    }
                    callback(lat, lng);                             // Palautetaan koordinaatit
                } else {
                    console.error("Sijaintia ei löytynyt");         // Tyhjä vastaus
                    callback(null, null);
                }
            })
            .catch((error) => {                                     // Virhe
                console.error("Palvelinvirhe: ", error);
                callback(null, null);
            });
    }
}




function checkAddress(addressType) {                                // Käsittelee kirjoittamalla syötetyn osoitteen
    if (addressType === 'start') {
        geocodeAddress(startAddress.value, function(lat, lng) {
            if (lat && lng) {
                reverseGeocode(lat, lng, function(address) {        // Saatu sijainti geokoodataan käänteisesti ja asetetaan osoite tekstinsyöttökenttään ja markeriin
                    startAddress.value = address;
                    placeMarker(addressType, lat, lng);
                    placeAddressOnPopups(); 
                    });
            }
        });
    }
    if (addressType === 'end') {
        geocodeAddress(endAddress.value, function(lat, lng) {
            if (lat && lng) {
                reverseGeocode(lat, lng, function(address) {        // Saatu sijainti geokoodataan käänteisesti ja asetetaan osoite tekstinsyöttökenttään ja markeriin     
                    endAddress.value = address;
                    placeMarker(addressType, lat, lng);
                    placeAddressOnPopups(); 
                    });
            };
        });
    }
}




function checkCoords() {                                            // Hakee osoitteen karttaklikkausten perusteella
    if (currentMarkerType === 'start') {
        startCoords.value = `${startLat},${startLng}`;
        reverseGeocode(startLat, startLng, function(address) {
            startAddress.value = address;
            placeMarker('start', startLat, startLng);
            placeAddressOnPopups(); 
            });
    }
    if (currentMarkerType === 'end') {
        endCoords.value = `${endLat},${endLng}`;
        reverseGeocode(endLat, endLng, function(address) {
            endAddress.value = address;
            placeMarker('end', endLat, endLng);
            placeAddressOnPopups(); 
            });
    };
}
    




function reverseGeocode(lat, lng, callback) {                       // Käänteinen geokoodaus muuntaa koordinaatit osoitteeksi HEREn avulla
    const url = `https://revgeocode.search.hereapi.com/v1/revgeocode?at=${lat},${lng}&apiKey=${apiKeyHERE}`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.items && data.items.length > 0) {
                const location = data.items[0];                     // Osoite pilkotaan ja muotoillaan
                const street = location.address.street;
                const number = location.address.houseNumber;
                const city = location.address.city;                
                if (isNaN(number)) {                                // Tarkistetaan mahdollinen undefined tilanteessa, jossa talonnumeroa ei saada
                    callback(street + ", " + city);                 // ja yhdistetään osoite sen mukaisesti
                } else {
                    callback(street + " " + number + ", " + city);
                }
            } else {
                console.error("Osoitetta ei löytynyt");
                callback(null);
            }
        })
        .catch((error) => {
            console.error("Palvelinvirhe: ", error);
            callback(null);
        });
}




function drawMap(lat, lng, zoomLevel) {                                     // Karttapohjan piirtofunktio
    document.getElementById('map').style.cursor = 'crosshair';
    if (map) {                                                              // Jos sivulla on jo kartta, estetään päällekkäisyys poistamalla vanha kartta ennen uuden piirtoa
        map.remove();
    }
    map = L.map('map').setView([lat, lng], zoomLevel);                      // Luodaan karttapohja
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {     // Asetetaan karttakuvat karttapohjalle
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', function(e) {                                           // Tarkistetaan klikkaustapahtumat kartan päällä
        if (currentMarkerType === 'start') {                                // Asetetaan koordinaatit muuttujiin klikkausten perusteella
            startLat = e.latlng.lat.toFixed(5);
            startLng = e.latlng.lng.toFixed(5);
        } else if (currentMarkerType === 'end') {
            endLat = e.latlng.lat.toFixed(5);
            endLng = e.latlng.lng.toFixed(5);
        }
        checkCoords();                              // Kutsutaan funktiota, joka hakee osoitteen kenttiin ja markereihin
    });
}




function placeMarker(addressType, lat, lng) {       // Asettaa markerit kartalle kutsuttaessa, eli sekä osoite kirjoittamalla että kartalta klikkaamalla
    if (addressType === 'start'){
        if (startMarker) {
            startMarker.setLatLng([lat, lng]).update();
        } else {
            startMarker = L.marker([lat, lng]).addTo(map);
        }
    } else if (addressType === 'end') {
        if (endMarker) {    
            endMarker.setLatLng([lat, lng]).update();
        } else {
            endMarker = L.marker([lat, lng]).addTo(map);
        }
    }
}




function placeAddressOnPopups() {                               // Tuo kutsuttaessa osoitteen markerin popup-ikkunaan
    if (startMarker) {
        startMarker.bindPopup(startAddress.value).openPopup();
    }
    if (endMarker) {
        endMarker.bindPopup(endAddress.value).openPopup();
    }
}




window.handlePermission = handlePermission;                         // Muunnetaan funktiot globaaleiksi. Koska scriptin type on module (tämä siksi, että import toimisi),
window.handlePermissionDenied = handlePermissionDenied;             // scriptin funktioita ei voida kutsua ilman muunnosta.