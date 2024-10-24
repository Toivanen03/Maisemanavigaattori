import { getVerifiedByScenery, setVerifiedByScenery } from './main.js';
import { setVerifiedByShortRoute } from './main.js';
import { setVerifiedByCoordinates } from './main.js';
import { getSceneryRouting } from './main.js';
import { updatePolygon } from './main.js';
import { calculateDistance } from './main.js';
import { devMode } from './main.js';
import { datafile } from './main.js';

let filteredWays;                           // Sallitut reittikoordinaatit
let originalRoute;                          // Tallennetaan alkuperäinen reitti lyhyen haun palauttamiseksi
let routeFilter;

let north;                                  // Muuttujat sallittujen reittien dynaamiseen hakuun
let east;
let south;
let west;
let radius;
let centerLat, centerLon;
export let bounds;
export let defaultLat, defaultLng;


export async function setFilterMethod(method) {     // Asettaa reittisuodatuksen ehdot
    if (method === 'strict') {
        routeFilter = "secondary|residential|tertiary|unclassified|service|industrial";
        radius = radius * 5;
    } else if (method === 'less_strict') {
        routeFilter = "primary|secondary|residential|tertiary|unclassified|service|industrial";
        radius = radius * 2;
    }
}


export async function getApprovedRoutes() { // Haetaan Overpass Turbolla luotu JSON-data sallituista teistä (pienet tiet ja kadut Heinolan keskustan alueella, suodatus ei vielä toiminnassa)
let filteredWaysCoords = [];
    try {
        const response = await fetch(`./mapdata/${datafile}`);
        const data = await response.json();
        filteredWays = data.elements;
        } 
    catch (err) {
        console.error('Virhe ladattaessa JSON-tiedostoa:', err);
    }
    if (filteredWays) {                                 // Sallitut reitit puretaan koordinaateiksi ja asetetaan listaan koordinaattipareina,
        filteredWays.forEach((way) => {                 // minkä jälkeen koordinaateista etsitään ääripisteet.
            way.geometry.forEach((coordinate) => {
                filteredWaysCoords.push([coordinate.lat, coordinate.lon]);              
            });
        });
        await getArea('filteredWays', filteredWaysCoords);
    }
}




async function fetchOverpassData() {                        // Hakee sallitut reitit Overpass-APIsta normaalitilassa, eli ei devModessa
    const overpassQuery = 
        `[out:json];
        (
        way["highway"~"${routeFilter}"](around:${radius}, ${centerLat}, ${centerLon});
        );
        out geom;`
    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `data=${encodeURIComponent(overpassQuery)}`
        });
        if (!response.ok) {
            throw new Error(`Verkkovirhe: ${response.status}`);
        }
        const data = await response.json();
        filteredWays = data.elements;                       // Asetetaan palvelimelta saadut sallitut reitit muuttujaan
    } catch (error) {
        console.error('Virhe:', error);
    }
}




export async function callForVerify(geojsonData) {          // "Juurifunktio" reittihaulle, tässä myös ensimmäisen main.js -reittihaun tuloksen tallennus
    originalRoute = geojsonData;
    return verifyRoutes(geojsonData);
}




async function verifyRoutes(geojsonData) {                          // Koordinaattien muunnos vertailukelpoiseen muotoon sekä keskinäinen vertailu
    let routeCoords = [];
    let filteredWaysCoords = [];

    if (geojsonData && geojsonData.coordinates) {                   // Alkuperäinen reitti puretaan koordinaateiksi
        geojsonData.coordinates.forEach((coordinate) => {
            routeCoords.push([coordinate[1], coordinate[0]]);
        });
        if (!devMode) {
            if (getSceneryRouting()) {                      // Ohitetaan, mikäli maisemahaku ei ole valittuna. Nopeuttaa prosessointia.
                await getArea('geojsonData', routeCoords);  // Laskee alkuperäisen reitin äärikoordinaatit, joista määritellään alueen keskipiste uutta hakua varten
                await fetchOverpassData();                  // Kun alueen keskipiste ja koko on saatu, haetaan saaduilla arvoilla data hyväksytyistä teistä.
            }
        }
    }

    if (routeCoords.length <= 10) {                     // Jos haettava reitti on lyhyt, uutta hakua ei suoriteta, vaan palautetaan alkuperäinen
        setVerifiedByShortRoute(true);                  // reitti ja kuitataan reitti käsitellyksi
        console.log('Ei muutoksia, lyhyt reitti');
        return geojsonData;
    }
    
    if (filteredWays) {                                 // Dynaamisesti haetut sallitut reitit puretaan koordinaateiksi
        filteredWays.forEach((way) => {                 // ja asetetaan listaan koordinaattipareina
            way.geometry.forEach((coordinate) => {
                filteredWaysCoords.push([coordinate.lat, coordinate.lon]);              
            });
        });
        await getArea('filteredWays', routeCoords);
    }

    function compareCoords(coord1, coord2) {            // Vertaillaan kolmea ensimmäistä desimaalia,
        let lon1 = coord1[0].toFixed(3);                // mutta koordinaatit kuitenkin tallennetaan täydellä tarkkuudella
        let lat1 = coord1[1].toFixed(3);
        let lon2 = coord2[0].toFixed(3);
        let lat2 = coord2[1].toFixed(3);
        return lon1 === lon2 && lat1 === lat2;
    }

    let validCoords = routeCoords.filter(coord1 =>
        filteredWaysCoords.some(coord2 => compareCoords(coord1, coord2))                // Validien koordinaattien tallennus
    );
    let coordsToAvoid = routeCoords.filter(coord1 =>
        !filteredWaysCoords.some(coord2 => compareCoords(coord1, coord2))               // Epäkelpojen koordinaattien tallennus
    );
    if (coordsToAvoid.length >= 10) {
        coordsToAvoid = coordsToAvoid.slice(2, -2);                                     // Poistetaan alusta ja lopusta koordinaatteja (varmistaa liikkeellepääsyn esim. parkkipaikalta). Tätä säätämällä voidaan vaikka pienentää polygonia.
    };
    
    if (validCoords.length > 0 && validCoords.length >= (routeCoords.length * 0.8)) {   // Jos valideja koordinaatteja on tarpeeksi, kutsutaan funktiota arvolla true
        setVerifiedByCoordinates(true);
        setVerifiedByShortRoute(false);
        console.log('Reitti kelpaa, valideja ', validCoords.length, ' ja pisteitä ', routeCoords.length);
        return geojsonData;
    } else if (!getVerifiedByScenery()) {
        setVerifiedByShortRoute(false);
        setVerifiedByCoordinates(false);
        console.log('Haetaan uutta reittiä, kelpoja koordinaatteja ', validCoords.length, ' ja pisteitä ', routeCoords.length);
        return await handleNewRoute(routeCoords);                                       // RouteCoords sisältää epäkelvot koordinaatit
    };
}




async function getArea(coordsToCheck, coords) {         // Hakee koordinaattien ääripisteet. Funktiota käytetään sallittujen
    const latitudes = coords.map(coord => coord[0]);    // teiden listan muodostamiseksi dynaamisesti sekä tiedoston mukaisen
    const longitudes = coords.map(coord => coord[1]);   // alueen ääripisteiden laskemiseksi

    if (coordsToCheck === 'geojsonData') {
        north = Math.max(...latitudes);
        south = Math.min(...latitudes);
        east = Math.max(...longitudes);
        west = Math.min(...longitudes);

        centerLat = (north + south) / 2;                    // Keskipisteen määritys
        centerLon = (east + west) / 2;

        let diameter = await calculateDistance('getArea', [south, west], [north, west]);
        radius = (diameter / 2).toFixed(1)                  // Asettaa reitin säteen laajuuden halkaisijasta
    } else if (coordsToCheck === 'filteredWays') {
        bounds = {
            minLat: Math.min(...latitudes),
            maxLat: Math.max(...latitudes),
            minLng: Math.min(...longitudes),
            maxLng: Math.max(...longitudes)
        };
        defaultLat = (bounds.minLat + bounds.maxLat) / 2;
        defaultLng = (bounds.minLng + bounds.maxLng) / 2;
    }
}




async function handleNewRoute(routeCoords) {            // Käännetään koordinaattien järjestystä
    let coordsToAvoid = routeCoords.map(coord => {
        const [lat, lng] = coord;
        return [lng, lat];
    })
    await drawPolygon(coordsToAvoid);                   // Kutsutaan polygonin muodostamista nyt, kun kaikki tarvittava data on saatu
}




async function drawPolygon(coordsToAvoid) {
    for (let i = 0; i < coordsToAvoid.length; i++) {
        coordsToAvoid[i] = [
            parseFloat((coordsToAvoid[i][0] + 0.0010).toFixed(5)),          // Arvoihin lisätään hieman marginaalia, näin saadaan myöhemmin polygoni viivan sijaan,
            parseFloat((coordsToAvoid[i][1] + 0.0010).toFixed(5))           // mikäli haettava reitti on kapea.
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
    return await checkRotation(coordsToAvoid);
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
    return await checkForLineCrossing(coordsToAvoid);
}




async function checkForLineCrossing(coordsToAvoid) {    // Tämä funktio sekä doSegmentsIntersect tarkistavat, leikkaavatko koordinaattien linjat.
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

    return await createPolygon(coordsToAvoid);          // Kutsutaan polygonin muotoilua
}




async function createPolygon(coordsToAvoid) {           // Muotoilee ja palauttaa lopullisen polygonin
    async function formatPolygon(coords) {
        return {
            type: "Polygon",
            coordinates: [coords]
        };
    }

    const polygon = await formatPolygon(coordsToAvoid); // Polygonin muotoilu
    setVerifiedByShortRoute(false);                     // Asetetaan oikea reittityyppi löydetyksi
    setVerifiedByCoordinates(false);
    setVerifiedByScenery(true);
    updatePolygon(polygon);                             // Tallettaa polygonin muuttujaan, joka on main.js- funktion findAlternativeRoute löydettävissä
}