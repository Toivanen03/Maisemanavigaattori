let filteredWays;                           // Sallitut reittikoordinaatit

import { apiKey } from './config.js';
import { geojsonData } from './main.js';    // Haetut reittikoordinaatit
import { routeVerified } from './main.js';  // Olio sisältää tiedon, onko reitti hyväksytty

export async function getApprovedRoutes() { // Haetaan Overpass Turbolla luotu JSON-data sallituista teistä (pienet tiet ja kadut Heinolan keskustan alueella, suodatus ei vielä toiminnassa)
    try {
        const response = await fetch('mapdata/heinola.json');
        const data = await response.json();
        filteredWays = data.elements;
        } 
    catch (err) {
        console.error('Virhe ladattaessa JSON-tiedostoa:', err);
    }
    verifyRoutes();                         // Reittitarkistusta kutsutaan, kun sallitut reitit on haettu
}

export async function updateRoute(route) {
    return route;
}




function verifyRoutes() {                                           // Koordinaattien muunnos vertailukelpoiseen muotoon sekä keskinäinen vertailu
    let routeCoords = [];
    let filteredWaysCoords = [];

    if (geojsonData && geojsonData.coordinates) {                   // Reittikoordinaatit main.js- tiedoston findRoute- funktiosta
        geojsonData.coordinates.forEach((coordinate) => {
            let coordStr = coordinate[0].toFixed(4) + ', ' + coordinate[1].toFixed(4);
            routeCoords.push(coordStr);
        });
    }
    if (filteredWays) {                                             // Sallitut reitit heinola.json -tiedostosta
        filteredWays.forEach((way) => {
            way.geometry.forEach((coordinate) => {
                let coordStr = coordinate.lon.toFixed(4) + ', ' + coordinate.lat.toFixed(4);
                filteredWaysCoords.push(coordStr)                
            });
        });
    }

    let validCoords = routeCoords.filter(coord => filteredWaysCoords.includes(coord));        // Muunnettujen koordinaattien vertailu
    let coordsToAvoid = routeCoords.filter(coord => !filteredWaysCoords.includes(coord));       // Epäkelpojen koordinaattien tallennus
    if (coordsToAvoid.length >= 10) {
        coordsToAvoid = coordsToAvoid.slice(2, -2);                                               // Poistetaan alusta ja lopusta koordinaatteja
    }
    if (validCoords.length > 0 && validCoords.length >= (routeCoords.length * 0.8)) {           // Jos haettuja koordinaatteja on tarpeeksi, kutsutaan funktiota arvolla true
        updateRouteState(true, validCoords, routeCoords);
    } else {                                                                                    // Muutoin käsitellään falsena ja funktiokutsussa
        updateRouteState(false, validCoords, coordsToAvoid);                                    // välitetään vältettävät koordinaatit
    }
}




function updateRouteState(value, validCoords, routeCoords) {                                    // "Välifunktio", joka käsittelee toimet sen mukaan, onko reitti kriteerit täyttävä
    routeVerified.validRoute = value;                                                           // Asetetaan vastaanotetun parametrin mukaisesti true tai false
    if (routeVerified.validRoute) {
        console.log('Reitti kelpaa, valideja ', validCoords.length, ' ja pisteitä ', routeCoords.length)
    } else {
        handleNewRoute(routeCoords);      // Jos updateRouteState on kutsuttu falsella, routeCoords sisältää epäkelvot koordinaatit
    }
}




function handleNewRoute(routeCoords) {    
    let coordsToAvoid = routeCoords.map(coordStr => {     // Koordinaatit muunnetaan numeerisiksi ja asetetaan oikein päin uuteen listaan
        const [lat, lng] = coordStr.split(',').map(Number);
        return [lng, lat];
    })
    drawPolygon(coordsToAvoid);
}




function drawPolygon(coordsToAvoid) {
    for (let i = 0; i < coordsToAvoid.length; i++) {
        coordsToAvoid[i] = [
            parseFloat((coordsToAvoid[i][0] + 0.0005).toFixed(5)),          // Arvoihin lisätään hieman marginaalia
            parseFloat((coordsToAvoid[i][1] + 0.0005).toFixed(5))
        ];
    }

    const reversedCoords = coordsToAvoid.slice().reverse();                 // Luodaan uusi lista, johon tallennetaan vältettävät koordinaatit takaperin

    for (let i = 0; i < reversedCoords.length; i++) {
        reversedCoords[i] = [
            parseFloat((reversedCoords[i][0] - 0.0010).toFixed(5)),         // Käännetyn listan arvoista vähennetään hieman
            parseFloat((reversedCoords[i][1] - 0.0010).toFixed(5))
        ];
    }

    coordsToAvoid.push(...reversedCoords);                                  // Lopuksi listat yhdistetään

    if (coordsToAvoid[0][0] !== coordsToAvoid[coordsToAvoid.length -1][0] || coordsToAvoid[0][1] !== coordsToAvoid[coordsToAvoid.length -1][1]) {
        coordsToAvoid.push(coordsToAvoid[0]);                               // Lisätään ensimmäinen koordinaatti on myös viimeiseksi
    }

    const polygon = createPolygon(coordsToAvoid);
    JSON.stringify(polygon, null, 2);
    findAlternativeRoute(polygon);
}




function createPolygon(coordsToAvoid) {
    return {
        type: "Polygon",
        coordinates: [coordsToAvoid]
    };
}



function findAlternativeRoute(polygon) {
    let [startLat, startLng] = document.getElementById('startPointCoords').value.split(',').map(part => parseFloat(part.trim()));
    let [endLat, endLng] = document.getElementById('endPointCoords').value.split(',').map(part => parseFloat(part.trim()));
    let startPoint = [startLng, startLat];
    let endPoint = [endLng, endLat];
    
  
    const url = 'https://api.openrouteservice.org/v2/directions/driving-car';
    const request = {
        coordinates: [startPoint, endPoint],
        options: {
            avoid_polygons: polygon
        }
    };
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': apiKey
        },
        body: JSON.stringify(request)
    })
    .then(response => response.json())
    .then(data => {
        if (data.routes && data.routes.length > 0) {
            let geojsonData = data.routes[0].geometry;
            console.log(data.routes);
            updateRoute(geojsonData);
        } else {
            console.error('Ei reittejä löytynyt.');
        }
        }
    )
    .catch(error => {
        console.error('Virhe: ', error);
    });
}