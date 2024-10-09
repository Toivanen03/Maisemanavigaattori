let filteredWays;

import { geojsonData } from './main.js'
import { routeVerified } from './main.js';

export async function getApprovedRoutes() {
    try {   // Haetaan Overpass Turbolla luotu JSON-data sallituista teistä (pienet tiet ja kadut Heinolan keskustan alueella, suodatus ei vielä toiminnassa)
        const response = await fetch('mapdata/heinola.json');
        const data = await response.json();
        filteredWays = processMapData(data);
        } 
        catch (err) {
            console.error('Virhe ladattaessa JSON-tiedostoa:', err);
        }
        verifyRoutes();
}


function processMapData(data) {
    return data.elements;
}


function updateRouteState(value, validCoords, routeCoords) {
    routeVerified.validRoute = value;
    if (routeVerified.validRoute) {                                                             // Testivaiheessa vain koordinaattien vertailu ja tulostus.
        console.log('Reitti kelpaa, valideja ', validCoords.length, ' ja pisteitä ', routeCoords.length)
    } else {                                                                                    // Reitin uudelleenhaku vielä rakennettava.
        console.log('Reitti ei kelpaa, valideja ', validCoords.length, ' ja pisteitä ', routeCoords.length);
        findNewRoute();
    }
}


function verifyRoutes() {
    let routeCoords = [];
    let filteredWaysCoords = [];

    if (geojsonData && geojsonData.coordinates) {                   // Reittikoordinaatit main.js -tiedoston findRoute -funktiosta
        geojsonData.coordinates.forEach((coordinate) => {
            let coordStr = coordinate[1].toFixed(4) + ', ' + coordinate[0].toFixed(4);
            routeCoords.push(coordStr);
        });
    }
    if (filteredWays) {                                             // Sallitut reitit heinola.json -tiedostosta
        filteredWays.forEach((way) => {
            way.geometry.forEach((coordinate) => {
                let coordStr = coordinate.lat.toFixed(4) + ', ' + coordinate.lon.toFixed(4);
                filteredWaysCoords.push(coordStr)
            });
        });
    }

    const validCoords = routeCoords.filter(coord => filteredWaysCoords.includes(coord));        // Tähän varsinainen reittisuodatus. Vertailu tiedostojen välillä ok.

    if (validCoords.length > 0 && validCoords.length >= (routeCoords.length * 0.8)) {           // Testivaiheessa vain koordinaattien vertailu ja tulostus.
        updateRouteState(true, validCoords, routeCoords);
    } else {                                                                                    // Reitin uudelleenhaku vielä rakennettava.
        updateRouteState(false, validCoords, routeCoords);
    }
}


function findNewRoute() {
    console.log('Uutta hakua pyydetty');
}