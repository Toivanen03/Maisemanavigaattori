import { apiKey } from './config.js';
import { geojsonData } from './main.js';    // Haetut reittikoordinaatit
import { setRouteVerified, getRouteVerified } from './main.js';  // Olio sisältää tiedon, onko reitti hyväksytty

let filteredWays;                           // Sallitut reittikoordinaatit
let routeHandled;                           // Varalla, saatetaan tarvita jatkossa
let newRoute;                               // Uuden reitin muuttuja
let originalRoute;                          // Tallennetaan alkuperäinen reitti lyhyen haun palauttamiseksi

export function updateRouteVerified(value) {   // Päivittää routeVerified-muuttujaa main.js -tiedostossa
    setRouteVerified(value);
}

export async function getApprovedRoutes() { // Haetaan Overpass Turbolla luotu JSON-data sallituista teistä (pienet tiet ja kadut Heinolan keskustan alueella, suodatus ei vielä toiminnassa)
    try {
        const response = await fetch('mapdata/heinola.json');
        const data = await response.json();
        filteredWays = data.elements;
        } 
    catch (err) {
        console.error('Virhe ladattaessa JSON-tiedostoa:', err);
    }
}




export async function callForVerify() {
        return await verifyRoutes();
}




async function verifyRoutes() {                                     // Koordinaattien muunnos vertailukelpoiseen muotoon sekä keskinäinen vertailu
    originalRoute = geojsonData;
    let routeCoords = [];
    let filteredWaysCoords = [];

    if (geojsonData && geojsonData.coordinates) {                   // Alkuperäinen reitti puretaan koordinaateiksi
        geojsonData.coordinates.forEach((coordinate) => {
            routeCoords.push([coordinate[1], coordinate[0]]);
        });
    }

    if (routeCoords.length <= 10) {                                 // Jos haettava reitti on lyhyt, uutta hakua ei suoriteta, vaan palautetaan alkuperäinen
        setRouteVerified(true);
        console.log('Ei muutoksia, lyhyt reitti');
        return originalRoute;
    }
    
    if (filteredWays) {                                             // Sallitut reitit heinola.json -tiedostosta puretaan koordinaateiksi
        filteredWays.forEach((way) => {
            way.geometry.forEach((coordinate) => {
                filteredWaysCoords.push([coordinate.lat, coordinate.lon]);              
            });
        });
    }

        function compareCoords(coord1, coord2) {                        // Vertaillaan kolmea ensimmäistä desimaalia,
            let lon1 = coord1[0].toFixed(3);                            // mutta koordinaatit kuitenkin tallennetaan täydellä tarkkuudella
            let lat1 = coord1[1].toFixed(3);
            let lon2 = coord2[0].toFixed(3);
            let lat2 = coord2[1].toFixed(3);
            return lon1 === lon2 && lat1 === lat2;
        }

    let validCoords = routeCoords.filter(coord1 =>
        filteredWaysCoords.some(coord2 => compareCoords(coord1, coord2))                        // Muunnettujen koordinaattien vertailu
    );
    let coordsToAvoid = routeCoords.filter(coord1 =>
        !filteredWaysCoords.some(coord2 => compareCoords(coord1, coord2))                       // Epäkelpojen koordinaattien tallennus
    );
    if (coordsToAvoid.length >= 10) {
        coordsToAvoid = coordsToAvoid.slice(2, -2);                                             // Poistetaan alusta ja lopusta koordinaatteja (varmistaa liikkeellepääsyn esim. parkkipaikalta)
    };    
    if (validCoords.length > 0 && validCoords.length >= (routeCoords.length * 0.8 && !getRouteVerified())) {   // Jos haettuja koordinaatteja on tarpeeksi, kutsutaan funktiota arvolla true
        await updateRouteState(true, validCoords, routeCoords);
    } else {                                                                                                // Muutoin käsitellään falsena ja funktiokutsussa
        await updateRouteState(false, validCoords, coordsToAvoid);                                          // välitetään vältettävät koordinaatit
    };
}




export async function updateRouteState(value, validCoords, routeCoords) { // "Välifunktio", joka käsittelee toimet sen mukaan, onko reitti kriteerit täyttävä
    setRouteVerified(value);                              // Asetetaan vastaanotetun parametrin mukaisesti true tai false
    if (getRouteVerified()) {
        routeHandled = true;
        console.log('Reitti kelpaa, valideja ', validCoords.length, ' ja pisteitä ', routeCoords.length);
        return originalRoute;
    } else {
        if (!routeHandled) {
        console.log('Haetaan uutta reittiä, kelpoja koordinaatteja ', validCoords.length, ' ja pisteitä ', routeCoords.length);
        await handleNewRoute(routeCoords);      // Jos updateRouteState on kutsuttu falsella, routeCoords sisältää epäkelvot koordinaatit
        }
    }
}




async function handleNewRoute(routeCoords) {    // Käännetään koordinaattien järjestystä
    let coordsToAvoid = routeCoords.map(coord => {
        const [lat, lng] = coord;
        return [lng, lat];
    })
    await drawPolygon(coordsToAvoid);
}




async function drawPolygon(coordsToAvoid) {
    for (let i = 0; i < coordsToAvoid.length; i++) {
        coordsToAvoid[i] = [
            parseFloat((coordsToAvoid[i][0] + 0.0010).toFixed(5)),          // Arvoihin lisätään hieman marginaalia, näin saadaan myöhemmin polygoni viivan sijaan
            parseFloat((coordsToAvoid[i][1] + 0.0010).toFixed(5))
        ];
    }

    const reversedCoords = coordsToAvoid.slice().reverse();                 // Luodaan uusi lista, johon tallennetaan vältettävät koordinaatit takaperin

    for (let i = 0; i < reversedCoords.length; i++) {
        reversedCoords[i] = [
            parseFloat((reversedCoords[i][0] - 0.0020).toFixed(5)),         // Marginaalia myös takaperoiseen listaan
            parseFloat((reversedCoords[i][1] - 0.0020).toFixed(5))
        ];
    }

    coordsToAvoid.push(...reversedCoords);                                  // Lopuksi listat yhdistetään
    await checkRotation(coordsToAvoid);
}




async function checkRotation(coordsToAvoid) {   // Funktion algoritmi tarkistaa koordinaattien kiertosuunnan. Polygonin koordinaattien on kierrettävä vastapäivään silloin, kun halutaan välttää tiettyjä alueita.
    function getTurnDirection(A, B, C) {        // Jos kaikki koordinaatit ovat valmiiksi oikein päin, muutoksia ei tehdä. Muutoin listasta poistetaan väärään suuntaan kiertävät koordinaatit.
        const crossProduct = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
        return crossProduct > 0;
    }

    let isCounterClockwise = true;

    for (let i = 0; i < coordsToAvoid.length - 2; i++) {
        const A = coordsToAvoid[i];
        const B = coordsToAvoid[i + 1];
        const C = coordsToAvoid[i + 2];

        if (!getTurnDirection(A, B, C)) {
            isCounterClockwise = false;
            break;
        }
    }

    if (!isCounterClockwise) {
        coordsToAvoid.reverse();
    }

    let i = 0;
    while (i < coordsToAvoid.length - 2) {
        const A = coordsToAvoid[i];
        const B = coordsToAvoid[i + 1];
        const C = coordsToAvoid[i + 2];

        if (getTurnDirection(A, B, C)) {
            coordsToAvoid.splice(i + 1, 1);
        } else {
            i++;
        }
    }
    await checkForLineCrossing(coordsToAvoid);
}




async function checkForLineCrossing(coordsToAvoid) {    // Tämä funktio sekä doSegmentsIntersect tarkistavat, leikkaavatko koordinaattien linjat.
    let toRemove = new Set();

    for (let i = 0; i < coordsToAvoid.length - 1; i++) {
        const A = coordsToAvoid[i];
        const B = coordsToAvoid[i + 1];

        for (let j = i + 2; j < coordsToAvoid.length - 1; j++) {
            const C = coordsToAvoid[j];
            const D = coordsToAvoid[j + 1];

            if (doSegmentsIntersect(A, B, C, D)) {      // Leikkauspisteiden tarkistusalgoritmi
                toRemove.add(i + 1);
                toRemove.add(j);
                toRemove.add(j + 1);
            }
        }
    }
    coordsToAvoid = coordsToAvoid.filter((_, index) => !toRemove.has(index));
    if (coordsToAvoid[0][0] !== coordsToAvoid[coordsToAvoid.length -1][0] || coordsToAvoid[0][1] !== coordsToAvoid[coordsToAvoid.length -1][1]) {
        coordsToAvoid.push(coordsToAvoid[0]);           // Lisätään ensimmäinen koordinaatti on myös viimeiseksi, jotta polygoni sulkeutuu
    }
    await createPolygon(coordsToAvoid);
}





function doSegmentsIntersect(A, B, C, D) {
    function orientation(p, q, r) {
        const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
        if (val === 0) return 0;
        return (val > 0) ? 1 : 2;
    }

    function onSegment(p, q, r) {
        return (q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) &&
                q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]));
    }

    const o1 = orientation(A, B, C);
    const o2 = orientation(A, B, D);
    const o3 = orientation(C, D, A);
    const o4 = orientation(C, D, B);

    if (o1 !== o2 && o3 !== o4) {
        return true;
    }

    if (o1 === 0 && onSegment(A, C, B)) return true;
    if (o2 === 0 && onSegment(A, D, B)) return true;
    if (o3 === 0 && onSegment(C, A, D)) return true;
    if (o4 === 0 && onSegment(C, B, D)) return true;

    return false;
}




async function createPolygon(coordsToAvoid) {       // Muotoilee ja palauttaa lopullisen polygonin
    function formatPolygon(coords) {
        return {
            type: "Polygon",
            coordinates: [coords]
        };
    }

    const polygon = formatPolygon(coordsToAvoid);
    findAlternativeRoute(polygon);
}





export async function findAlternativeRoute(polygon) {
    if (!routeHandled) {
        let [startLat, startLng] = document.getElementById('startPointCoords').value.split(',').map(part => parseFloat(part.trim()));
        let [endLat, endLng] = document.getElementById('endPointCoords').value.split(',').map(part => parseFloat(part.trim()));
        let startPoint = [startLng, startLat];      // Valmistellaan lähtö- ja loppupisteiden koordinaatit uutta reittihakua varten
        let endPoint = [endLng, endLat];

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

            const data = await response.json();     // Odotetaan vastausta

            if (data.routes && data.routes.length > 0) {
                let route = data.routes[0];
                newRoute = route.geometry;
                routeHandled = true;
                console.log('Uusi reitti palautettu');
                return newRoute;                    // Palautetaan uusi reitti
            } else {
                routeHandled = false;
                console.error('Ei reittejä.');
                return null;
            }
        } catch (error) {
            routeHandled = false;
            console.error('Virhe: ', error);
            return null;
        }
    }
}