let map;                                                                    // Alustetaan muuttujat:    - Karttapohja
let currentRouteLayer = null;                                               //                          - Reittikerros
let startMarker, endMarker;                                                 //                          - Alku- ja loppumerkit
let currentMarkerType = 'end';                                              //                          - Merkin tyyppi (myöhemmin start tai end)
let sceneryRouting;                                                         //                          - Perus- tai maisemanavigointi
let displayAddress;                                                         //                          - Osoitteen esittämisen muuttujat
let geocodedStartAddress;
let geocodedDestinationAddress;

import { apiKey, apiKeyHERE } from './config.js';                           // Ladataan API-avaimet
import { getApprovedRoutes } from './routeFilter.js';                       // Reittien suodatus

export let geojsonData;                                                     // Reittikoordinaatit
export let routeVerified = { validRoute: false };                           // True tai false tarkistettujen koordinaattien mukaisesti
export function updateSceneryRouting(value) {                               // Päivittää tiedon maisemanavigoinnista tiedostojen välillä
    sceneryRouting = value;  
}

const defaultLat = 61.23345;                                                // Oletussijainti (ABC Heinola). Käytetään, mikäli selaimelle ei ole annettu lupaa sijainnin jakamiseen
const defaultLng = 26.04378;
const routeDistance = document.getElementById("routeDistance");

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

    document.getElementById('startPoint').addEventListener('blur', function() {     // Tapahtumakuuntelija tarkistaa lähtöpaikan syöttökentästä poistumisen
        const startAddress = document.getElementById('startPoint').value;           // Syötetyn osoitteen arvo luetaan kentästä
        callForGeocoding('start', startAddress);                                    // Kutsutaan osoitekäsittelyä
    });
    document.getElementById('endPoint').addEventListener('blur', function() {       // Loppumerkillä täysin vastaava käsittely kuin alkumerkillä
        const endAddress = document.getElementById('endPoint').value;
        callForGeocoding('end', endAddress);
    });

    document.getElementById('findRoute').addEventListener('click', function() {     // Tapahtumakuuntelija käsittelee reittihakupainikkeen
        let start = document.getElementById('startPoint').value;
        let endAddress = document.getElementById('endPoint').value;
        if (start && endAddress) {                                                  // Kun osoitteet on saatu, geokoodataan osoitteet koordinaateiksi
            if (start === 'Oletussijainti') {                                       // Varmistetaan, että sijaintitiedon puuttuessa saadaan lähtöpaikalle koordinaatit sivun auetessa
                start = geocodedStartAddress;
            }
            geocodeAddress(start, function(startLat, startLng) {
                if (startLat && startLng) {
                    geocodeAddress(endAddress, function(endLat, endLng) {
                        if (endLat && endLng) {                                     // Kun geokoodaus on suoritettu, kutsutaan reittihakua
                            getRoute(startLat, startLng, endLat, endLng);
                        } else {
                            alert("Määränpään koordinaatteja ei löytynyt.");        // Virheenkäsittely
                        }
                    });
                } else {
                    alert("Lähtöpaikan koordinaatteja ei löytynyt.");
                }
            });
        } else {
            alert("Aseta sekä lähtöpiste että määränpää.");
        }
    });

    document.getElementById("removeRoutes").addEventListener("click", function() {
        document.getElementById("startPoint").value = "";
        document.getElementById("endPoint").value = "";
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
        navigator.geolocation.getCurrentPosition(                               // Pyydetään selaimelta sijaintitieto, edellyttää käyttäjän myöntämää lupaa
            function(position) {
                let userLat = position.coords.latitude;
                let userLng = position.coords.longitude;
                drawMap(userLat, userLng, 20);
                const latLngString = `${userLat.toFixed(5)}, ${userLng.toFixed(5)}`;
                document.getElementById('startPointCoords').value = latLngString;
                reverseGeocode(userLat, userLng, function(address) {            // Saatu sijainti geokoodataan käänteisesti ja asetetaan osoite tekstinsyöttökenttään ja markeriin
                    document.getElementById('startPoint').value = address;
                    startMarker = L.marker([userLat, userLng]).addTo(map).bindPopup(`<div style="text-align: center;"><b>Sijaintisi:</b></div><br>${address}`).openPopup();
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
    document.getElementById('startPointCoords').value = `${defaultLat}, ${defaultLng}`;
    reverseGeocode(defaultLat, defaultLng, function(address) {
        document.getElementById('startPoint').value = "Oletussijainti";
        if (error != null) {
            errorMessage = `${address}<br><div style="text-align: center;"><i>(Virhe sijainnin hakemisessa: ${error})</i></div>`;
        } else {
            errorMessage = `${address}<br><div style="text-align: center;"><i>(Sijaintilupaa ei myönnetty.)</i></div>`;
        }
        geocodedStartAddress = address;         // Tallennetaan osoite globaaliin muuttujaan
        startMarker = L.marker([defaultLat, defaultLng]).addTo(map).bindPopup(errorMessage).openPopup();
    })
}




async function getRoute(startLat, startLng, endLat, endLng) {   // Reitinhakufunktio lähettää hakupyynnön ORS-palvelimelle. Osoitteen muuttujissa on haettavat koordinaatit sekä APIkey. Lisäparametrilla määritetään haettavaksi kolme reittivaihtoehtoa.
    currentMarkerType = 'end';
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${startLng},${startLat}&end=${endLng},${endLat}&api_key=${apiKey}`;    
    try {                                                       // Haetaan pyydetty data
        const response = await fetch(url);
        const data = await response.json();    
            if (data.features && data.features.length > 0) {    // Tarkistetaan, onko palvelimelta vastaanotettu mitään
                let route = data.features[0];
                geojsonData = route.geometry;                   // Muuttuja sisältää reitin geometrian, eli koordinaattitiedot
                if (sceneryRouting && startMarker && endMarker) {
                    await getApprovedRoutes();
                }            
                if (routeVerified.validRoute || !sceneryRouting) {
                    if (currentRouteLayer) {                    // Olemassaoleva karttakerros poistetaan, jos reittiä on jo haettu aiemmin
                        map.removeLayer(currentRouteLayer);
                    }

                    currentRouteLayer = L.geoJSON(geojsonData).addTo(map);                      // Asetetaan reittikerros kartalle

                    // tähän reitin pituus?
                    const distance = route.properties.segments[0].distance;
                    const routeDistanceDiv = document.getElementById('routeDistance');
                    routeDistanceDiv.textContent = `Matka: ${(distance / 1000).toFixed(2)} km`; // Muokattu näyttämään oikein -ST
                    routeDistanceDiv.style.display = 'block';
                    routeDistanceDiv.style.textAlign = 'center';

                    if (geojsonData.coordinates.length > 0) {
                        map.fitBounds(currentRouteLayer.getBounds(), {padding: [100, 100]});    // Piirtää reitin marginaalin kanssa
                    }
                }
            }
        } catch(err) {                                                                          // Tulostetaan virhe konsoliin, mikäli reittiä ei löydy
            console.error('Virhe:', err);
        }
    placeAddressOnPopups();
}




function callForGeocoding(place, address) {
    geocodeAddress(address, function(lat, lng) {
        if (lat && lng) {
            if (place === 'start') {                                    // Vastaanotetut koordinaatit välitetään ensin koordinaattikenttiin...
                document.getElementById('startPointCoords').value = lat + ', ' + lng;
            } else {
                document.getElementById('endPointCoords').value = lat + ', ' + lng;
            }
            reverseGeocode(lat, lng, function(formattedAddress) {       // ...ja välitetään käänteisen geokoodauksen funktiokutsuun.
                let coordinates = {
                    lat: lat,
                    lng: lng
                };
                placeMarker(currentMarkerType, coordinates, formattedAddress)       // Asetetaan merkit kartalle
                if (place === 'start') {
                    document.getElementById('startPoint').value = formattedAddress; // Käänteisesti geokoodattu ja muotoiltu osoite asetetaan syöttökenttään.
                } else {                                                            // Näin esimerkiksi kaupan tai kaupungin nimellä tehty haku tulostuu
                    document.getElementById('endPoint').value = formattedAddress;   // varsinaisena osoitteena käyttäjän luettavaksi. 
                }
            });                                                                 
        }                                                                       
    });
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
                        document.getElementById('startPointCoords').value = lat + ', ' + lng;
                    } else if (currentMarkerType === 'end') {
                        document.getElementById('endPointCoords').value = lat + ', ' + lng;
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
                    displayAddress = street + ", " + city;          // ja yhdistetään osoite sen mukaisesti
                } else {
                    displayAddress = street + " " + number + ", " + city;
                }
                callback(displayAddress);
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




function drawMap(lat, lng, zoomLevel) {                                     // Kartan piirtofunktio
    document.getElementById('map').style.cursor = 'crosshair';
    if (map) {                                                              // Jos sivulla on jo kartta, estetään päällekkäisyys poistamalla vanha kartta ennen uuden piirtoa
        map.remove();
    }

    map = L.map('map').setView([lat, lng], zoomLevel);                      // Luodaan karttapohja

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {     // Asetetaan karttakuvat karttapohjalle
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    document.getElementById('startPoint').addEventListener('focus', () => { // Tapahtumakuuntelut, joilla määritetään syöttökentän perusteella, kumpaa pistettä ollaan asettamassa
        currentMarkerType = 'start';
    });

    document.getElementById('endPoint').addEventListener('focus', () => {
        currentMarkerType = 'end';
    });

    map.on('click', function(e) {                                                   // Tarkistetaan klikkaustapahtumat kartan päällä
        if (currentMarkerType) {                                                    // currentMarkerType on arvoltaan joko "start" tai "end" klikatun osoitekentän mukaisesti
            reverseGeocode(e.latlng.lat, e.latlng.lng, function(address) {          // Muunnetaan koordinaatit osoitteeksi
                if (address) {
                    let addressParts = address.split(", ");                         // Pilkotaan osoite paloiksi. Tämä helpottaa osoitteen muotoilua eri tarkoituksiin
                    let streetAndNumber = addressParts[0].split(" ");               // Katu ja numero. Numero saattaa puuttua eli olla undefined
                    displayAddress = isNaN(streetAndNumber[1]) ?                    // Mikäli numeroa ei ole,
                        streetAndNumber[0] + ", " + addressParts[1] :               // displayAddress-muuttujaan tallennetaan kadunnimi ja kaupunki.
                        streetAndNumber[0] + " " + streetAndNumber[1] + ", " + addressParts[1]; // Jos numero löytyy, displayAddress saa arvon "kadunnimi numero, kaupunki"
                    }
                if (currentMarkerType === 'start') {                                // Päivitetään merkkien sijainti.
                    placeMarker(currentMarkerType, e.latlng, address);
                } else if (currentMarkerType === 'end') {
                    placeMarker(currentMarkerType, e.latlng, address);
                }
                placeAddressOnPopups();                                             // Päivitetään osoite kuplassa
            });
        }
    });
}




function placeMarker(markerType, coordinates, address) {                                    // Asettaa markerit kartalle
    const latLngString = coordinates.lat.toFixed(5) + ', ' + coordinates.lng.toFixed(5);    // Tallennetaan muuttujaan kartalta koordinaatit ja pyöristetään
    if (markerType === 'start'){                                                            // Asetetaan alku- ja loppumerkit
        if (startMarker) {
            startMarker.setLatLng(coordinates).update();
        } else {
            startMarker = L.marker(coordinates).addTo(map);
        }
        document.getElementById('startPointCoords').value = latLngString;                   // Asetetaan merkin koordinaatit piilotettuun syöttökenttään
        document.getElementById('startPoint').value = address || latLngString;
        geocodedStartAddress = address;                                                     // Päivitetään osoitemuuttuja
    }
    if (markerType === 'end') {                                                             // Loppumerkki käsitellään samoin kuin alkumerkki
        if (endMarker) {    
            endMarker.setLatLng(coordinates).update();
        } else {
            endMarker = L.marker(coordinates).addTo(map);
        }
        document.getElementById('endPointCoords').value = latLngString;
        document.getElementById('endPoint').value = address || latLngString;
        geocodedDestinationAddress = address
    }
    placeAddressOnPopups();                                                                 // Päivitetään osoite kuplassa
}
   



function placeAddressOnPopups() {                                           // Funktio avaa osoitteen markerin popup-ikkunaan
    if (currentMarkerType === 'start') {
        startMarker.bindPopup(geocodedStartAddress).openPopup();
    }
    if (currentMarkerType === 'end') {
        endMarker.bindPopup(geocodedDestinationAddress).openPopup();
    }
}




window.handlePermission = handlePermission;                         // Muunnetaan funktiot globaaleiksi. Koska scriptin type on module (tämä siksi, että import toimisi),
window.handlePermissionDenied = handlePermissionDenied;             // scriptin funktioita ei voida kutsua ilman muunnosta.