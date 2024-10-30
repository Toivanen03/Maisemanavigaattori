import { getVerifiedByScenery, setVerifiedByScenery } from './main.js';     // Getter-setter -funktiot, jotka palauttavat tai joilla asetetaan
import { setVerifiedByShortRoute } from './main.js';                        // arvo reitin vahvistamisesta
import { setVerifiedByCoordinates } from './main.js';
import { getSceneryRouting } from './main.js';                              // True tai false sen mukaan, onko maisemahaku valittuna
import { updatePolygon } from './main.js';                                  // Funktio asettaa haetun polygonin muuttujaan
import { calculateDistance } from './main.js';                              // Funktio, joka laskee koordinaattipisteiden etäisyyksiä
import { devMode } from './main.js';                                        // True tai false sen mukaan, onko DevMode valittuna
import { datafile } from './main.js';                                       // Reittidatatiedostot, joita käytetään DevModessa
export let defaultLat, defaultLng;                                          // DevModen oletuskoordinaatit lasketaan getArea-funktiossa

let filteredWays;                                                           // Sallitut reitit
let filteredWaysCoords = [];                                                // Sallitut reittikoordinaatit
let originalRoute;                                                          // URL-haun reittidata
let firstCoords;                                                            // Ensimmäisen reittihaun koordinaatit
let routeArea;                                                              // Hakualueen äärikoordinaatit
let inArea = false;                                                         // True tai false, käytetään vähentämään Overpass-hakuja
let routeFilter;                                                            // Overpass-parametrit
let testmapWindow;                                                          // Käytetään testausvaiheessa
let testCount = 0;                                                          // Tieto hakujen määrästä. Käytetään hakujen rajaamiseksi ja apuna reittitarkistuksissa

let north;                                                                  // Muuttujat sallittujen reittien hakualueen määrittelyyn
let east;
let south;
let west;
let radius;
let centerLat, centerLon;
export let bounds;


export function getTestCount() {                                            // Hakulaskurin getter ja setter
    return testCount;
}

export function setTestCount() {
    testCount += 1;
}




export async function setFilterMethod(method) {                             // Asettaa reittisuodatuksen ehdot, tiukka ja väljempi, asetetaan kartan sivupalkista
    if (method === 'strict') {
        routeFilter = "secondary|residential|tertiary|unclassified|service|industrial";
        radius = radius * 4;                                                // Suurempi säde hakee sallittuja reittejä laajemmalta alueelta
    } else if (method === 'less_strict') {
        routeFilter = "primary|secondary|residential|tertiary|unclassified|service|industrial";
        radius = radius * 3;
    }
}




export async function getApprovedRoutes() { // Haetaan Overpass Turbolla luotu JSON-data sallituista teistä, eli pienet tiet ja kadut valitun tiedoston alueella.
    try {                                   // Käytössä DevModessa.
        const response = await fetch(`./mapdata/${datafile}`);
        const data = await response.json();
        filteredWays = data.elements;
        } 
    catch (err) {
        console.error('Virhe ladattaessa JSON-tiedostoa:', err);
    }
    await handleFilteredWays(filteredWays);
}




async function fetchOverpassData() {    // Hakee sallitut reitit Overpass-APIsta normaalitilassa dynaamisesti. Hakualueen koko määräytyy getRoute-funktiossa
    const overpassQuery =               // tehdyn reittihaun alueen mukaisesti.
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
        await handleFilteredWays(filteredWays);             // Asettaa vastaanotetun datan koordinaatit listaan
    } catch (error) {
        console.error('Virhe:', error);
    }
}




async function handleFilteredWays(filteredWays) {     
    filteredWays.forEach((way) => {
        way.geometry.forEach((coordinate) => {              // Sallitut reitit puretaan koordinaateiksi ja asetetaan listaan koordinaattipareina...
            filteredWaysCoords.push([coordinate.lat, coordinate.lon]);              
        });
    });
    if (getTestCount() !== 0) {
        routeArea = await getArea('filteredWays', filteredWaysCoords);  // ...minkä jälkeen koordinaateista etsitään ääripisteet.
    }
    return filteredWaysCoords;
}




async function getArea(coordsToCheck, coords) {         // Hakee koordinaattien ääripisteet. Funktiota käytetään sallittujen
    const latitudes = coords.map(coord => coord[0]);    // teiden listan muodostamiseksi dynaamisesti sekä tiedoston mukaisen
    const longitudes = coords.map(coord => coord[1]);   // alueen ääripisteiden laskemiseksi

    if (coordsToCheck === 'geojsonData') {
        north = Math.max(...latitudes);
        south = Math.min(...latitudes);
        east = Math.max(...longitudes);
        west = Math.min(...longitudes);
    
        centerLat = (north + south) / 2;
        centerLon = (east + west) / 2;

        let verticalDiameter = await calculateDistance('getArea', [south, west], [north, west]);
        let horizontalDiameter = await calculateDistance('getArea', [south, west], [south, east]);
    
        let diameter = Math.max(verticalDiameter, horizontalDiameter);
        radius = parseFloat((diameter / 2).toFixed(1));
    } else if (coordsToCheck === 'filteredWays') {
        bounds = {
            minLat: Math.min(...latitudes),
            maxLat: Math.max(...latitudes),
            minLng: Math.min(...longitudes),
            maxLng: Math.max(...longitudes)
        };
        defaultLat = (bounds.minLat + bounds.maxLat) / 2;
        defaultLng = (bounds.minLng + bounds.maxLng) / 2;

        return bounds;
    }
}




export async function callForVerify(geojsonData) {  // "Juurifunktio" reittihaulle, tässä myös ensimmäisen main.js -reittihaun tuloksen tallennus
    if (getTestCount() === 0) { // Arvo on 0, kun reittihaku käynnistetään klikkaamalla reittihakupainiketta.
        originalRoute = geojsonData;                // Uuden haun yhteydessä getRoute-funktion url-haun reitti tallennetaan.
        firstCoords = [];
    }
        centerLon = (geojsonData.coordinates[0][0] + geojsonData.coordinates[geojsonData.coordinates.length -1][0]) / 2;    // Lasketaan reittikoordinaateista alueen keskipiste.
        centerLat = (geojsonData.coordinates[0][1] + geojsonData.coordinates[geojsonData.coordinates.length -1][1]) / 2;    // Tarvitaan sallittujen reittien suodattamiseksi.

        geojsonData.coordinates.forEach((coordinate) => {           // Reittikoordinaatit tallennetaan listaan. Tarvitaan hakualueen ääripisteiden määrittelyyn.
            firstCoords.push([coordinate[1], coordinate[0]]);
        });
        routeArea = await getArea('filteredWays', firstCoords)      // Laskee alkuperäisen reitin äärikoordinaatit.
        radius = await calculateDistance('getArea', [routeArea.minLat, routeArea.minLng], [routeArea.maxLat, routeArea.minLng]) * 2; // Laskee suodatusalueen säteen
        if (filteredWaysCoords.length === 0) {
            await fetchOverpassData();                              // Noutaa sallitut reitit, eli Overpass Turbo API:n suodattaman datan
        }
    if (geojsonData.coordinates || filteredWaysCoords.length !== 0) {   // Jos suodatetut reitit on jo haettu, tarkistetaan, onko seuraavan reittihaun koordinaatit
        const startCoord = geojsonData.coordinates[0];                  // samalla alueella kuin edellisen haun. Näin suodatettua reittidataa ei tarvitse hakea
        const endCoord = geojsonData.coordinates[geojsonData.coordinates.length - 1];   // jokaisella reittihaulla uudelleen, mikäli reittimuutos on pieni.
                                                                                        // Tämä vähentää palvelinkutsuja ja nopeuttaa ohjelman toimintaa
        inArea = 
            startCoord[1] <= routeArea.maxLat && startCoord[1] >= routeArea.minLat &&   // Verrataan alku- ja loppupisteiden koordinaatteja getArea-funktion
            startCoord[0] <= routeArea.maxLng && startCoord[0] >= routeArea.minLng &&   // hakemiin aluerajoihin
            endCoord[1] <= routeArea.maxLat && endCoord[1] >= routeArea.minLat &&
            endCoord[0] <= routeArea.maxLng && endCoord[0] >= routeArea.minLng;

        if (inArea) {
            console.log('Koordinaatit ovat alueen sisällä.');
        } else {
            filteredWaysCoords = [];                                    // Jos uuden reittihaun jokin piste on alueen ulkopuolella, sallittujen reittien lista
            console.log('Koordinaatit eivät ole alueen sisällä.');      // tyhjennetään. Tämä aiheuttaa uuden haun filterCoordsToAvoid-funktiossa.
        }
    }
    return filterCoordsToAvoid(geojsonData);
}


// TOIMII, MUTTA REITTIHAUSSA KESTÄÄ MELKO KAUAN, VAIKKA FILTEREDWAYSCOORDS EI TYHJENNETÄ. TARKISTA MITÄ FUNKTIOITA KUTSUTAAN UUSISSA HAUISSA.
// UUTTA POLYGONIA EI MUODOSTETA AINAKAAN PITEMMILLÄ REITEILLÄ. LISÄÄ MAINIIN LISÄKSI REITIN TARKISTUS, ELI KUTSU UUDEN POLYGONIN MUODOSTAMI-
// SEKSI!!!! TARKISTA INAREA TOIMINTA, KOSKA TULOSTAA AINA "KOORDINAATIT OVAT ALUEEN SISÄLLÄ", VAIKKA EIVÄT OLISIKAAN. LISÄKSI TARKISTUS TILAN-
// TEELLE, JOSSA AINOA REITTI POLYGONIN LÄPI, ESIMERKIKSI TÄHTIHOVILLE MENEE MOOTTORITIEN ALTA. TÄHÄN TILANTEESEEN VAIKKA POLYGONIN POISTO, 
// ETTÄ SAADAAN JOKIN REITTI. TOINEN MAHDOLLISUUS GETROUTE-KUTSU (TÄHÄN JOKIN EHTO JA VARMISTUS, ETTEI KUTSUTA UUTTA MAISEMAHAKUA, ESIMERKIKSI 
// MAISEMAHAUN POISTO. TÄLLÖIN VARMISTUTTAVA, ETTÄ MAISEMAHAKU MENEE TAKAISIN PÄÄLLE).

async function filterCoordsToAvoid(geojsonData) {               // Koordinaattien muunnos vertailukelpoiseen muotoon sekä keskinäinen vertailu
    let routeCoords = [];
    if (geojsonData && geojsonData.coordinates) {               // Alkuperäisen reittihaun koordinaatit puretaan listaan
        geojsonData.coordinates.forEach((coordinate) => {
            routeCoords.push([coordinate[1], coordinate[0]]);
        });
        if (!devMode) {
            if (getSceneryRouting()) {                          // Ohitetaan, mikäli maisemahaku ei ole valittuna. Nopeuttaa prosessointia.
                if (filteredWaysCoords.length === 0) {
                    await getArea('geojsonData', routeCoords);  // Laskee alkuperäisen reitin äärikoordinaatit, joista määritellään alueen keskipiste uutta hakua varten
                    await fetchOverpassData();                  // Kun alueen keskipiste ja koko on saatu, haetaan saaduilla arvoilla data hyväksytyistä teistä.
                }
            }
        }
    }
    if (routeCoords.length <= 10) {                     // Jos haettava reitti on lyhyt, uutta hakua ei suoriteta, vaan palautetaan alkuperäinen
        setVerifiedByShortRoute(true);                  // reitti ja kuitataan reitti käsitellyksi
        console.log('Ei muutoksia, lyhyt reitti');
        return geojsonData;
    }
    function compareCoords(coord1, coord2) {            // Vertaillaan kolmea ensimmäistä desimaalia,
        let lon1 = coord1[0].toFixed(3);                // mutta koordinaatit kuitenkin tallennetaan täydellä tarkkuudella
        let lat1 = coord1[1].toFixed(3);
        let lon2 = coord2[0].toFixed(3);
        let lat2 = coord2[1].toFixed(3);
        return lon1 === lon2 && lat1 === lat2;
    }
    let validCoords = routeCoords.filter(coord1 =>
        filteredWaysCoords.some(coord2 => compareCoords(coord1, coord2))                // Validien koordinaattien suodatus ja tallennus
    );
    let coordsToAvoid = routeCoords.filter(coord1 =>
        !filteredWaysCoords.some(coord2 => compareCoords(coord1, coord2))               // Epäkelpojen koordinaattien suodatus ja tallennus
    );
    console.log('filteredwayscoords', filteredWaysCoords);
    console.log('validit', validCoords);
    console.log('epäkelvot', coordsToAvoid);
    console.log('suhde', coordsToAvoid.length / validCoords.length);
    console.log('radius', radius);

    if (((validCoords.length / routeCoords.length) * 100).toFixed(0) > 80) {
        setVerifiedByCoordinates(true);
        setVerifiedByShortRoute(false);
        console.log(`Reitti kelpaa, valideja koordinaatteja ${((validCoords.length / routeCoords.length) * 100).toFixed(0)}%`);
        saveRoute(coordsToAvoid);
        return geojsonData;
    } else if (!getVerifiedByScenery()) {
        setVerifiedByShortRoute(false);
        setVerifiedByCoordinates(false);
        console.log(`Haetaan uutta reittiä, kelpoja koordinaatteja ${((validCoords.length / routeCoords.length) * 100).toFixed(0)}%`);
        await flipCoordinates(coordsToAvoid);
    }
}




async function flipCoordinates(routeCoords) {           // Käännetään koordinaattien järjestystä
    let coordsToAvoid = routeCoords.map(coord => {
        const [lat, lng] = coord;
        return [lng, lat];
    })
    await preparePolygon(coordsToAvoid);                   // Kutsutaan polygonin muodostamista nyt, kun kaikki tarvittava data on saatu
}




async function preparePolygon(coordsToAvoid) {
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
    if (coordsToAvoid.length >= 20) {
        coordsToAvoid = coordsToAvoid.slice(2, -5);                         // Poistetaan alusta ja lopusta koordinaatteja (varmistaa liikkeellepääsyn
    };                                                                      // esim. parkkipaikalta). Tätä säätämällä voidaan vaikka pienentää polygonia.
    await rawFilterRotation(coordsToAvoid);
}




async function rawFilterRotation(coords) {                      // Tarkistaa koko koordinaattilistan kiertosuunnan ja kääntää tarvittaessa
    let area = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        area += coords[i][0] * coords[i + 1][1];
        area -= coords[i + 1][0] * coords[i][1];
    }
    area += coords[coords.length - 1][0] * coords[0][1];
    area -= coords[0][0] * coords[coords.length - 1][1];
    const isCounterClockwise = area > 0;
    if (!isCounterClockwise) {                                  // Jos kiertosuunta on myötäpäivään, käännetään koordinaatit
        coords.reverse();
    }
    await checkRotation(coords);
}




async function checkRotation(coordsToAvoid) {   // Funktion algoritmi tarkistaa koordinaattien kiertosuunnan tarkemmin vertailemalla
    function getTurnDirection(A, B, C) {        // kolmen pisteen koordinaatteja toisiinsa. Polygonin koordinaattien on kierrettävä vastapäivään
        const crossProduct = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); // silloin, kun halutaan välttää tiettyjä alueita.
        return crossProduct > 0;
    }
    let isCounterClockwise = true;              // Jos kaikki koordinaatit ovat valmiiksi oikein päin, muutoksia ei tehdä.
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

        if (getTurnDirection(A, B, C)) {        // Muutoin listasta poistetaan väärään suuntaan kiertävät koordinaatit.
            coordsToAvoid.splice(i + 1, 1);
        } else {
            i++;
        }
    }
    await checkForLineCrossing(coordsToAvoid);
}




async function checkForLineCrossing(coordsToAvoid) {
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

    let hasCrossing;
    let attempts = 0;
    const minCoords = 4;  // Vähintään 4 pistettä polygonille

    do {
        hasCrossing = false;
        let toRemove = new Set();

        for (let i = 0; i < coordsToAvoid.length - 1; i++) {
            const A = coordsToAvoid[i];
            const B = coordsToAvoid[i + 1];
            for (let j = i + 2; j < coordsToAvoid.length - 1; j++) {
                const C = coordsToAvoid[j];
                const D = coordsToAvoid[j + 1];
                if (doSegmentsIntersect(A, B, C, D)) {
                    // Lisää vain segmentin keskimmäiset pisteet karsittavaksi
                    toRemove.add(i + 1);
                    toRemove.add(j);
                    hasCrossing = true;
                }
            }
        }

        // Karsi pisteitä vain, jos koordinaatteja jää tarpeeksi
        if (coordsToAvoid.length - toRemove.size >= minCoords) {
            coordsToAvoid = coordsToAvoid.filter((_, index) => !toRemove.has(index));
        } else {
            break;  // Lopeta karsiminen, jos koordinaatteja jää liian vähän
        }

        attempts++;
        if (attempts > 10) break; // Turvatoimi, jos jäädään silmukkaan

    } while (hasCrossing);

    // Sulje polygoni lopuksi
    if (coordsToAvoid[0][0] !== coordsToAvoid[coordsToAvoid.length -1][0] || coordsToAvoid[0][1] !== coordsToAvoid[coordsToAvoid.length -1][1]) {
        coordsToAvoid.push(coordsToAvoid[0]);
    }

    await createPolygon(coordsToAvoid);
}





async function createPolygon(coordsToAvoid) {           // Muotoilee ja palauttaa lopullisen polygonin
    setTestCount();                                     // Kasvatetaan testCount-arvoa jokaisella polygonin luontikerralla
    function formatPolygon(coords) {
        return {
            type: "Polygon",
            coordinates: [coords]
        };
    }

    const polygon = formatPolygon(coordsToAvoid);
    setVerifiedByShortRoute(false);                     // Asetetaan oikea reittityyppi löydetyksi
    setVerifiedByCoordinates(false);
    setVerifiedByScenery(true);
    updatePolygon(polygon);                             // Tallettaa polygonin muuttujaan, joka on main.js- funktion findAlternativeRoute löydettävissä
    saveRoute(polygon.coordinates)                      // Testausta varten
}




function saveRoute(coords) {                                        // Testausvaiheen funktio. Tallentaa polygonin koordinaatit localstorageen ja avaa testikartan,
    localStorage.setItem("Polygon", JSON.stringify(coords));        // jossa polygonin koordinaatit asetetaan kartalle.

    if (testmapWindow && !testmapWindow.closed) {
        testmapWindow.location.reload();
    } else {
        testmapWindow = window.open("testmapCoord.html", "_blank");
    }
}
