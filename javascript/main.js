let map;                                                                    // Alustetaan muuttujat:    - Karttapohja
let currentRouteLayer = null;                                               //                          - Reittikerros
let startMarker, endMarker;                                                 //                          - Alku- ja loppumerkit
let currentMarkerType;                                                      //                          - Merkin tyyppi (myöhemmin start tai end)
let sceneryRouting = true;                                                  //                          - Perus- tai maisemanavigointi
let startAddress = document.getElementById('startPoint');                   //                          - Osoitekentät
let endAddress = document.getElementById('endPoint');
let startCoords = document.getElementById('startPointCoords');              //                          - Koordinaattikentät
let endCoords = document.getElementById('endPointCoords');
let verifiedByShortRoute = false;                                           //                          - Alle kymmenen koordinaattipisteen reitti
let verifiedByCoordinates = false;                                          //                          - Kaikki koordinaatit kelpoja jo ensimmäisellä haulla
let verifiedByScenery = false;                                              //                          - Suodatetun ja korjatun reitin muuttuja
let polygon;                                                                //                          - Vältettävä alue reittihaussa
let distance;                                                               //                          - Reitin pituus
let duration;                                                               //                          - Matkan kesto (sekunteina)
let timeEstimate                                                            //                          - Muotoiltu matkan kesto
let directions;                                                             //                          - Reittiopastuksen vaiheet (rakenteilla)

let defaultLat = 61.23345;                                                  // Oletussijainti
let defaultLng = 26.04378;
let [startLat, startLng] = startCoords.value.split(',').map(coord => parseFloat(coord.trim())); // Pituus- ja leveysasteet
let [endLat, endLng] = endCoords.value.split(',').map(coord => parseFloat(coord.trim()));

const defaultStart = defaultLat + ',' + defaultLng;                         // Asetetaan aluksi oletussijainnin koordinaatit
startCoords.value = defaultStart;

const routeDistance = document.getElementById("routeDistance");             // Etäisyyskenttä

import { apiKey, apiKeyHERE } from './config.js';                           // Ladataan API-avaimet
import { callForVerify } from './routeFilter.js';                           // Reittisuodatuskutsu
import { setFilterMethod } from './routeFilter.js'                          // Asettaa suodatusehdot (rakenteilla)


export function setVerifiedByShortRoute(value) {                            // Päivittävät muuttujien arvoa routeFilter-tiedostosta
    verifiedByShortRoute = value;
}
export function getVerifiedByShortRoute() {
    return verifiedByShortRoute;
}
export function setVerifiedByCoordinates(value) {
    verifiedByCoordinates = value;
}
export function getVerifiedByCoordinates() {
    return verifiedByCoordinates;
}
export function setVerifiedByScenery(value) {
    verifiedByScenery = value;
}
export function getVerifiedByScenery() {
    return verifiedByScenery;
}
export function setSceneryRouting(value) {                                  // Maisemareittihaku päälle/pois
    sceneryRouting = value;
}
export function getSceneryRouting() {
    return sceneryRouting;
}
export function updatePolygon(value) {                                      // Suodatusehdot sisältävä polygoni
    polygon = value;
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

    document.getElementById('startPoint').addEventListener('focus', () => { // Asetetaan muuttujan arvo valitun osoitekentän mukaan
        map.dragging.disable();
        currentMarkerType = 'start';
    });

    document.getElementById('endPoint').addEventListener('focus', () => {
        map.dragging.disable();
        currentMarkerType = 'end';        
    });

    document.getElementById('startPoint').addEventListener('blur', function() { // Tarkistetaan syöttökentän osoite
        map.dragging.enable();                                                  // Estetään kartan raahautuminen, kun ollaan osoitteen syöttökentässä
        if (startMarker.getLatLng().lat.toFixed(5) + ',' + startMarker.getLatLng().lng.toFixed(5) !== startCoords.value) {
            checkAddress('start');      // If-lauseen tarkistus estää markereiden hyppimisen. Tämä välttämätöntä, koska myös pistettä kartalta valitessa
        }                               // markerin tyyppi valitaan syöttökenttää klikkaamalla. Ilman tarkistusta lähtee tuplakutsu markereiden asettamiselle.
    });

    document.getElementById('endPoint').addEventListener('blur', function() {
        map.dragging.enable();
        checkAddress('end');
    });

    document.getElementById('findRoute').addEventListener('click', function() {         // Reittihakupainikkeen kuuntelu
        const coords = [startLat, startLng, endLat, endLng].map(coord => Number(coord));// Varmistetaan, että koordinaatit ovat numeerisessa muodossa
        if (startLat && startLng && endLat && endLng) {
            getRoute(coords[0], coords[1], coords[2], coords[3]);
        } else {
            alert("Aseta sekä lähtöpiste että määränpää.");
        }
    });

    document.getElementById("removeRoutes").addEventListener("click", function() {      // Reitin tyhjennyspainikkeen kuuntelu
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
                drawMap(startLat, startLng, 18);
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
    drawMap(defaultLat, defaultLng, 18);        // ja markerin asettaminen tapahtuvat tässä funktiossa.
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



/* TARPEETON FUNKTIO, MIKÄLI DYNAAMINEN SUODATUS JÄTETÄÄN KÄYTTÖÖN !!!!!!
function checkBounds(startLat, startLng, endLat, endLng) {      // Funktio tarkistaa, onko haettavan reitin jokin piste heinola.json-tiedoston
    document.getElementById('loading').style.display = 'block'; // koordinaattien ulkopuolella, mikäli maisemareittihaku on käytössä. Jos on, maisemahaku poistetaan
    if (sceneryRouting) {                                       // käytöstä ennen reittihakua ja näytetään viesti. Tällä estetään suodatustoimintojen aiheuttama kuormitus selaimelle
        let message;        
        let messageEnd = "Heinolan ulkopuolella. Maisemareittihaku on pois käytöstä";
        const bounds = {
            minLat: 61.1394963,     // Heinola.json -tiedoston uloimmat koordinaatit
            maxLat: 61.2798717,
            minLng: 25.9770522,
            maxLng: 26.1375315
        };

        const isStartOutside = isPointOutsideBounds(startLat, startLng, bounds);
        const isEndOutside = isPointOutsideBounds(endLat, endLng, bounds);

        if (isStartOutside || isEndOutside) {                       // Näytettävä viesti mukautetaan tilanteen mukaan
            if (isStartOutside && isEndOutside) {
                message = "Molemmat pisteet ovat " + messageEnd;
            } else if (isStartOutside) {
                message = "Lähtöpiste on " + messageEnd;
            } else if (isEndOutside) {
                message = "Määränpää on " + messageEnd;
            }
            document.getElementById('maisema-checkbox').checked = false;
            setSceneryRouting(false);
            document.getElementById('loading').style.display = 'none';
            alert(message);
        }
    }

    getRoute(startLat, startLng, endLat, endLng);

    function isPointOutsideBounds(lat, lng, bounds) {
        const { minLat, maxLat, minLng, maxLng } = bounds;
        return lat < minLat || lat > maxLat || lng < minLng || lng > maxLng;
    }
}
*/



async function getRoute(startLat, startLng, endLat, endLng) {       // Reitinhakufunktio lähettää hakupyynnön ORS-palvelimelle. Osoitteen muuttujissa on haettavat koordinaatit sekä APIkey. Lisäparametrilla määritetään haettavaksi kolme reittivaihtoehtoa.
    document.getElementById('loading').style.display = 'block';     // Tuodaan latausanimaatio näkyviin reittihaun alkaessa
    let originalRoute;

    if (currentRouteLayer) {                                        // Olemassaoleva karttakerros poistetaan, jos reittiä on jo haettu aiemmin
        map.removeLayer(currentRouteLayer);
    }

    const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${startLng},${startLat}&end=${endLng},${endLat}&api_key=${apiKey}`;    
    try {                                                           // Haetaan pyydetty data
        const response = await fetch(url);
        let data = await response.json();    
            if (data.features && data.features.length > 0) {        // Tarkistetaan, onko palvelimelta vastaanotettu mitään
                let routeData = data.features[0];
                let route = routeData.geometry;                     // Muuttuja sisältää reitin geometrian, eli koordinaattitiedot
                originalRoute = route;                              // Tallennetaan ensimmäinen haku
                let result;
                if (sceneryRouting) {
                    result = await callForVerify(route);            // Kutsutaan reitin tarkistusta. Ehtojen toteutuessa vastaus on alkuperäinen reitti, muutoin polygoni
                    if (result === originalRoute) {                 // Jos koordinaattipisteitä alle kymmenen tai tarkistuksen tulos validi,
                        drawRoute(routeData);                       // kutsutaan reittipiirtoa
                    } else if (polygon !== undefined) {             // Mikäli reitti kulki suodatuksen läpi, kutsutaan reittihakua
                        findAlternativeRoute(polygon);              // välittäen samalla vältettävä polygoni
                    }
                } else {
                    drawRoute(route, null);                         // Jos maisemareittihaku on pois päältä, kutsutaan suoraan reittipiirtoa
                }
            }
        } catch(err) {                              // Tulostetaan virhe konsoliin, mikäli ensimmäinen reittihaku epäonnistuu (palvelinvirhe)
            console.error('Virhe:', err);
        }
}




async function findAlternativeRoute(polygon) {
    let [startLng, startLat] = document.getElementById('startPointCoords').value.split(',').map(part => parseFloat(part.trim()));
    let [endLng, endLat] = document.getElementById('endPointCoords').value.split(',').map(part => parseFloat(part.trim()));
    let startPoint = [startLat, startLng];
    let endPoint = [endLat, endLng];            // Valmistellaan lähtö- ja loppupisteiden koordinaatit uutta reittihakua varten

    const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
    const request = {                           // Asetetaan hakuun alku- ja loppupisteet sekä vältettävä polygoni
        coordinates: [startPoint, endPoint],
        options: {
            "avoid_polygons": polygon           // Vältettävät koordinaatit ovat muuttujassa polygon
        }
    };
    try {                                       // Lähetetään reittihakupyyntö
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey
            },
            body: JSON.stringify(request)
        });   
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            const sceneryRoute = data.routes[0];
            setVerifiedByScenery(true);         // Merkitään reitti löydetyksi
            drawRoute(sceneryRoute);            // Kutsutaan reittipiirtoa
        } else {
            alert('Ei reittejä.');              
            document.getElementById('loading').style.display = 'none';
        }
    } catch (error) {
        console.error('Virhe: ', error);
        return null;
    }
}




function handleData(routeData) {                                    // Tähän funktioon tullaan vain, kun maisemareittihaku on päällä
    let hours;                                                      // Alustetaan muuttujat reitin lisädatan tallentamiseksi
    let minutes;
    let seconds;
    let currentHour;
    let currentMinute;
    let dataFields;
    let steps;

    if (routeData.properties) {                                     // Lyhyen tai validin reitin tietokentät
        dataFields = routeData.properties.summary;
        steps = routeData.properties.segments[0].steps;
        directions = routeData.properties.segments.flatMap(segment => segment.steps);
    } else {
        dataFields = routeData.segments[0];                         // Maisemareitin tietokentät
        directions = dataFields.steps;
    }

    duration = dataFields.duration;

    if (dataFields.distance >= 1000) {                              // Muotoilee etäisyyden
        distance = (dataFields.distance / 1000).toFixed(2) + " kilometriä";
    } else {
        distance = (dataFields.distance).toFixed(2) + " metriä";
    }

    hours = Math.floor(duration / 3600);                            // Muotoillaan arvio reittiin kuluvasta ajasta
    minutes = Math.floor((duration % 3600) / 60);
    seconds = Math.floor(duration % 60);
    timeEstimate = `${hours} tuntia, ${minutes} minuuttia, ${seconds} sekuntia.`

    calculateDistance('handleData', null, null)                     // Laskee reitin pituuden linnuntietä pitkin (tuskin käyttöä tällä)
    .then(directDistance => {
        console.log('Tietä pitkin', distance, ', linnuntietä', directDistance);
    })
    .catch(error => {
        console.error('Etäisyyttä ei saatu:', error);
    });

    const now = new Date();                                         // Muotoillaan aika-arvio
    currentHour = now.getHours();
    currentMinute = now.getMinutes();
    console.log('Matka kestää', timeEstimate, 'Jos lähdet nyt, olet perillä', (currentHour + hours) + ':' + (currentMinute + minutes) + '.');
    
    return routeData.geometry;
}




function drawRoute(routeData) {                                         // Reitin piirtofunktio, asettaa reittikerroksen kartalle
    let route;
    if (sceneryRouting) {                                               // Maisemahaun ollessa päällä haetaan reittidatasta muu data talteen,
        route = handleData(routeData);                                  // funktio handleData palauttaa reitin
    } else {
        route = routeData;
        let distance = calculateDistance('drawRoute', null, null);
        console.log('Etäisyys linnuntietä', distance);
    }
    
    if (typeof(route) === 'string') {                                   // Tarkistetaan onko reittidata tullut suodatuksen kautta
        const decodedCoordinates = polyline.decode(route);              // Puretaan koordinaatit polyline-datasta
        const coordinates = decodedCoordinates.map(coord => [coord[0], coord[1]]);
        currentRouteLayer = L.polyline(coordinates).addTo(map);         // Maisemasuodatus palauttaa polyline-reitin,
    } else {
        currentRouteLayer = L.geoJSON(route).addTo(map);                // url-haku geojson-muotoisen reitin.
    }
    document.getElementById('loading').style.display = 'none';
    map.fitBounds(currentRouteLayer.getBounds(), {padding: [180, 50]}); // Piirtää reitin marginaalin kanssa
    document.getElementById('loading').style.display = 'none';          // Piilotetaan latausanimaatio
}




export async function calculateDistance(caller, firstCoord, secondCoord) {  // Laskee reitin linnuntietä, mietitään onko käyttöä
    let distance;
    let coord1;
    let coord2;
    if (caller === 'drawRoute' || caller === 'handleData') {
        coord1 = startCoords.value.split(',').map(coord => parseFloat(coord.trim()))
        coord2 = endCoords.value.split(',').map(coord => parseFloat(coord.trim()))
        distance = distanceCalc(coord1, coord2);        // Jatkotoimet käsitellään paikallisesti, mikäli kutsu on tullut main.js-tiedoston funktioilta
    } else if (caller === 'getArea') {
        coord1 = firstCoord;
        coord2 = secondCoord;
        return distanceCalc(coord1, coord2).toFixed(0); // Palauttaa suodatustiedostoon suodatettavan alueen halkaisijan (tarkempi selostus, kts. routeFilter.js)
    }

        function distanceCalc(coord1, coord2) {         // Laskee Haversinen kaavalla kahden koordinaattipisteen maantieteellisen etäisyyden toisistaan
            const R = 6371000;
            const lat1 = coord1[1] * Math.PI / 180;
            const lat2 = coord2[1] * Math.PI / 180;
            const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
            const deltaLng = (coord2[0] - coord1[0]) * Math.PI / 180;
        
            const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                        Math.cos(lat1) * Math.cos(lat2) *
                        Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
            return R * c
        }

        if (distance) {                                 // Jääkö käyttöön?
            const routeDistanceDiv = document.getElementById('routeDistance');
            routeDistanceDiv.textContent = `Matka: ${(distance / 1000).toFixed(2)} km`;
            routeDistanceDiv.style.display = 'block';
            routeDistanceDiv.style.textAlign = 'center';

            if (distance >= 1000) {
                return `${(distance / 1000).toFixed(0)} kilometriä`;
            } else {
                return `${distance.toFixed(0)} metriä`;
            }
        }
}




function geocodeAddress(address, callback) {                        // Geokoodaus kääntää osoitteet koordinaateiksi, joiden avulla varsinainen reittihaku tapahtuu
    if (address !== "") {                                           // Varmistetaan, ettei osoite ole tyhjä ja haetaan koordinaatit HERE-palvelimelta. Hakupyynnössä on haettava osoite sekä palveluun rekisteröityessä saatu API-avain
        const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(address)}&apiKey=${apiKeyHERE}`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.items && data.items.length > 0) {          // Mikäli pyyntö onnistuu ja vastaus ei ole tyhjä, tallennetaan koordinaatit muuttujiin ja asetetaan arvot piilotettuihin syöttökenttiin HTML-tiedostossa
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
                    console.error("Osoitetta ei löytynyt");         // Tyhjä vastaus
                    callback(null, null);
                }
            })
            .catch((error) => {                                     // Virhe
                console.error("Palvelinvirhe: ", error);
                callback(null, null);
            });
    }
}




export function checkAddress(addressType) {                         // Käsittelee kirjoittamalla syötetyn osoitteen
    if (addressType === 'start') {
        geocodeAddress(startAddress.value, function(lat, lng) {
            if (lat && lng) {
                startLat = lat;
                startLng = lng;
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
                endLat = lat;
                endLng = lng;
                reverseGeocode(lat, lng, function(address) {        // Saatu sijainti geokoodataan käänteisesti ja asetetaan osoite tekstinsyöttökenttään ja markeriin     
                    endAddress.value = address;
                    placeMarker(addressType, lat, lng);
                    placeAddressOnPopups(); 
                    });
            };
        });
    }
}




function checkCoords() {                                            // Hakee ja asettaa osoitteen karttaklikkausten perusteella
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
    




function reverseGeocode(lat, lng, callback) {                       // Käänteinen geokoodaus muuntaa koordinaatit osoitteeksi HEREn APIlla
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
    if (addressType === 'start') {
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
    if (startMarker && endMarker) {
        document.querySelector('.search').style.display = 'block';                          // Jätetään hakulaatikko näkyviin, kun molemmat markerit kartalla. Tällöin ei tarvitse
        const bounds = L.latLngBounds([startMarker.getLatLng(), endMarker.getLatLng()]);    // erikseen avata laatikkoa reittihakupainikkeen löytämiseksi.
        map.fitBounds(bounds, { padding: [150, 50] });
    }
}




function placeAddressOnPopups() {
    let bounds = [];

    if (startMarker) {
        startMarker.bindPopup(`<div style="text-align: center;"><b>Lähtöpaikka:</b><br>${startAddress.value}</div>`);
        startMarker.openPopup();
        bounds.push(startMarker.getLatLng());                   // Tallennetaan markereiden koordinaatit listaan
    }
    if (endMarker) {
        endMarker.bindPopup(`<div style="text-align: center;"><b>Määränpää:</b><br>${endAddress.value}</div>`);
        endMarker.openPopup();
        bounds.push(endMarker.getLatLng());
    }
    if (bounds.length === 2) {                                  // Tällä saadaan estettyä kartan "pomppiminen" silloin, kun jompaakumpaa
        const latLngBounds = L.latLngBounds(bounds);            // markeria ollaan asettamassa toisen markerin näkyvyyden ulkopuolelle.
        map.fitBounds(latLngBounds, { padding: [180, 50] });    // Kartta panoroituu aina siten, että molemmat markerit näkyvät.
    }
}




window.handlePermission = handlePermission;                         // Muunnetaan funktiot globaaleiksi. Koska scriptin type on module (tämä siksi, että import toimisi),
window.handlePermissionDenied = handlePermissionDenied;             // scriptin funktioita ei voida kutsua ilman muunnosta.