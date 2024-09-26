let map;                                                                    // Alustetaan muuttujat:    - Karttapohja
let currentRouteLayer = null;                                               //                          - Reittikerros
let startMarker, endMarker;                                                 //                          - Alku- ja loppumerkit
let currentMarkerType = null;                                               //                          - Merkin tyyppi (myöhemmin start tai end)

const apiKey = '5b3ce3597851110001cf6248854948ff45974bdbb781eef5997e8ba0';  // OpenRouteService API-key
const apiKeyHERE = 'S4YRzUa8LKgr_UV7BTPJE-uhCdcUTtOWCyjvByH_Izc';           // HERE-palvelun API-key, käytetään geokoodauksessa
const platform = new H.service.Platform({                                   // Geokoodauksen sisältävä luokka. HERE maps-kirjaston objekti H sisältyy HTML-koodissa ladattavaan scriptiin
    apikey: apiKey
});

const defaultLat = 61.23345;                                                // Oletussijainti (ABC Heinola). Käytetään, mikäli selaimelle ei ole annettu lupaa sijainnin jakamiseen
const defaultLng = 26.04378;
let geocodedStartAddress, geocodedDestinationAddress;


document.addEventListener('DOMContentLoaded', function() {                  // Haetaan Overpass Turbolla luotu JSON-data sallituista teistä (pienet tiet ja kadut Heinolan keskustan alueella)
    fetch('mapdata/heinola.json')
        .then(response => response.json())
        .then(data => {
            filteredWays = processMapData(data);
        })
        .catch(err => console.error('Virhe ladattaessa JSON-tiedostoa:', err));

    navigator.geolocation.getCurrentPosition(                               // Pyydetään selaimelta sijaintitieto, edellyttää käyttäjän myöntämää lupaa
        function(position) {
            let userLat = position.coords.latitude;
            let userLng = position.coords.longitude;
            drawMap(userLat, userLng, 20);
            const latLngString = `${userLat.toFixed(5)}, ${userLng.toFixed(5)}`;
            document.getElementById('startPointCoords').value = latLngString;
            reverseGeocode(userLat, userLng, function(address) {            // Saatu sijainti geokoodataan käänteisesti ja asetetaan osoite tekstinsyöttökenttään ja markeriin
                document.getElementById('startPoint').value = address;
                startMarker = L.marker([userLat, userLng]).addTo(map).bindPopup(address).openPopup();
            });
        },
        function(error) {                                                   // Jos sijaintia ei saada, siitä kerrotaan käyttäjälle ja asetetaan ylempänä määritetty oletussijainti
            drawMap(defaultLat, defaultLng, 15);
            document.getElementById('startPointCoords').value = `${defaultLat}, ${defaultLng}`;
            reverseGeocode(defaultLat, defaultLng, function(address) {
                document.getElementById('startPoint').value = "Oletussijainti";
                startMarker = L.marker([defaultLat, defaultLng]).addTo(map).bindPopup(`${address}<br><div style="text-align: center;"><i>(Sijaintia ei saatu)</i></div>`).openPopup();
            });
        }
    );

    document.getElementById('startPoint').addEventListener('blur', function() {     // Tapahtumakuuntelija tarkistaa lähtöpaikan syöttökentästä poistumisen
        const startAddress = document.getElementById('startPoint').value;
        geocodeAddress(startAddress, function(startLat, startLng) {
            if (startLat && startLng) {
                document.getElementById('startPointCoords').value = startLat + ', ' + startLng;
                reverseGeocode(startLat, startLng, function(formattedAddress) {
                    geocodedStartAddress = formattedAddress;
                });
            }
        });
    });
    document.getElementById('endPoint').addEventListener('blur', function() {       // Tapahtumakuuntelija tarkistaa määränpään syöttökentästä poistumisen
        const endAddress = document.getElementById('endPoint').value;
        geocodeAddress(endAddress, function(endLat, endLng) {
            if (endLat && endLng) {
                document.getElementById('endPointCoords').value = endLat + ', ' + endLng;
                reverseGeocode(endLat, endLng, function(formattedAddress) {
                    geocodedDestinationAddress = formattedAddress;
                });
            }
        });
    });

    document.getElementById('findRoute').addEventListener('click', function() {     // Tapahtumakuuntelija käsittelee reittihakupainikkeen
        let start = document.getElementById('startPoint').value;
        let endAddress = document.getElementById('endPoint').value; 
        if (start && endAddress) {                                                  // Kun osoitteet on saatu, geokoodataan osoite koordinaateiksi
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
});




function drawMap(lat, lng, zoomLevel) {
    if (map) {                                                              // Jos sivulla on jo kartta, estetään päällekkäisyys poistamalla vanha kartta ennen uuden piirtoa
        map.remove();
    }

    map = L.map('map').setView([lat, lng], zoomLevel);                      // Luodaan karttapohja

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {     // Asetetaan karttakuvat karttapohjalle
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    document.getElementById('startPoint').addEventListener('focus', () => { // Tapahtumakuuntelut, joilla kursori muutetaan ristiksi ja määritetään syöttökentän perusteella, kumpaa pistettä ollaan asettamassa
        currentMarkerType = 'start';
        document.getElementById('map').style.cursor = 'crosshair';
    });

    document.getElementById('endPoint').addEventListener('focus', () => {
        currentMarkerType = 'end';
        document.getElementById('map').style.cursor = 'crosshair';
    });

    map.on('click', function(e) {                           // Tarkistetaan klikkaustapahtumat kartan päällä
        if (currentMarkerType) {                            // Mikäli syöttökenttää on klikattu ensin, currentMarkerType on arvoltaan joko "start" tai "end"
            const latLngString = e.latlng.lat.toFixed(5) + ', ' + e.latlng.lng.toFixed(5);      // Tallennetaan muuttujaan kartalta koordinaatit ja pyöristetään
            reverseGeocode(e.latlng.lat, e.latlng.lng, function(address) {      // Muunnetaan koordinaatit osoitteeksi
                let addressParts = address.split(", ");                         // Pilkotaan osoite paloiksi. Tämä helpottaa osoitteen muotoilua eri tarkoituksiin
                let streetAndNumber = addressParts[0].split(" ");               // Katu ja numero. Numero saattaa puuttua eli olla undefined
                let displayAddress = isNaN(streetAndNumber[1]) ?                // Mikäli numeroa ei ole,
                    streetAndNumber[0] + ", " + addressParts[1] :               // displayAddress-muuttujaan tallennetaan kadunnimi ja kaupunki.
                    streetAndNumber[0] + " " + streetAndNumber[1] + ", " + addressParts[1]; // Jos numero löytyy, displayAddress saa arvon "kadunnimi numero, kaupunki"

                if (currentMarkerType === 'start') {        // Lohkossa luodaan valitun tekstikentän perusteella merkki, asetetaan se kartalle ja näytetään osoite popup-ikkunassa
                    if (startMarker) {
                        startMarker.setLatLng(e.latlng).update();
                    } else {
                        startMarker = L.marker(e.latlng).addTo(map).bindPopup(displayAddress).openPopup();
                    }
                    document.getElementById('startPointCoords').value = latLngString;       // Asetetaan merkin koordinaatit piilotettuun syöttökenttään
                    document.getElementById('startPoint').value = address || latLngString;

                } else if (currentMarkerType === 'end') {
                    if (endMarker) {
                        endMarker.setLatLng(e.latlng).update();
                    } else {
                        endMarker = L.marker(e.latlng).addTo(map).bindPopup(displayAddress).openPopup();
                    }
                    document.getElementById('endPointCoords').value = latLngString;
                    document.getElementById('endPoint').value = address || latLngString;
                }
                document.getElementById('map').style.cursor = 'default';                    // Lopuksi palautetaan kursori normaaliksi
            });
        }
    });
}




function processMapData(data) {                         // Rakenteilla, käytetään reittien suodatukseen 
    return data.elements.filter(element => {
        return element.type === 'way' &&
            element.tags.highway &&
            !['motorway', 'motorway_link', 'trunk', 'trunk_link'].includes(element.tags.highway);
    });
}




function getRoute(startLat, startLng, endLat, endLng) {     // Reitinhakufunktio lähettää hakupyynnön ORS-palvelimelle. Osoitteen muuttujissa on haettavat koordinaatit sekä APIkey. Lisäparametrilla määritetään haettavaksi kolme reittivaihtoehtoa.
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${startLng},${startLat}&end=${endLng},${endLat}&api_key=${apiKey}`;    
    fetch(url)                                              // Haetaan pyydetty data
        .then(response => response.json())
        .then(data => {
            
            if (data.features && data.features.length > 0) {
                let route = data.features[0];
                let geojsonData = route.geometry;           // Muuttuja sisältää reitin geometrian, eli koordinaattitiedot

                if (currentRouteLayer) {                    // Olemassaoleva karttakerros poistetaan, jos reittiä on jo haettu aiemmin
                    map.removeLayer(currentRouteLayer);
                }

                currentRouteLayer = L.geoJSON(geojsonData).addTo(map);      // Asetetaan reittikerros kartalle

                // tähän reitin pituus?
                const distance = route.properties.segments[0].distance;
                const routeDistanceDiv = document.getElementById('routeDistance');
                routeDistanceDiv.textContent = `Matka: ${(distance / 1000).toFixed(2)} km`; // Muokattu näyttämään oikein -ST
                routeDistanceDiv.style.display = 'block';
                routeDistanceDiv.style.textAlign = 'center';


                if (geojsonData.coordinates.length > 0) {
                    map.fitBounds(currentRouteLayer.getBounds());
                }                
            }
        })
        .catch(err => console.error('Virhe:', err));        // Tulostetaan virhe konsoliin, mikäli reittiä ei löydy   
}




function geocodeAddress(address, callback) {
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
                    callback(null, null);
                }
            })
            .catch(() => {                                          // Virheenkäsittely
                console.error("Osoitetta ei löytynyt.");
                callback(null, null);
            });
    }
}




function reverseGeocode(lat, lng, callback) {
    const url = `https://revgeocode.search.hereapi.com/v1/revgeocode?at=${lat},${lng}&apiKey=${apiKeyHERE}`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.items && data.items.length > 0) {
                const location = data.items[0];                     // Osoite pilkotaan ja muotoillaan
                const street = location.address.street;
                const number = location.address.houseNumber;
                const city = location.address.city;
                let displayAddress;
                if (isNaN(number)) {                                // Tarkistetaan mahdollinen undefined tilanteessa, jossa talonnumeroa ei saada
                    displayAddress = street + ", " + city;          // ja yhdistetään osoite sen mukaisesti
                } else {
                    displayAddress = street + " " + number + ", " + city;
                }
                callback(displayAddress);
            } else {
                callback('Osoitetta ei löytynyt.');
            }
        })
        .catch(() => {
            callback(null);                                         // Haku epäonnistui
        });
}
