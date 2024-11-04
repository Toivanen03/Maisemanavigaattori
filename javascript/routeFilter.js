import { getVerifiedByScenery, setVerifiedByScenery } from './main.js';     // Getter-setter -funktiot, jotka palauttavat tai joilla asetetaan
import { setVerifiedByShortRoute } from './main.js';                        // arvo reitin vahvistamisesta
import { setVerifiedByCoordinates } from './main.js';
import { getSceneryRouting } from './main.js';                              // True tai false sen mukaan, onko maisemahaku valittuna
import { updatePolygon } from './main.js';                                  // Funktio asettaa haetun polygonin muuttujaan
import { findAlternativeRoute } from './main.js';                           // Tuodaan reitin varmistamiseksi
import { calculateDistance } from './main.js';                              // Funktio, joka laskee koordinaattipisteiden etäisyyksiä
import { devMode } from './main.js';                                        // True tai false sen mukaan, onko DevMode valittuna
import { datafile } from './main.js';                                       // Reittidatatiedostot, joita käytetään DevModessa
import { loading } from './main.js';                                        // Lataustekstin kenttä
import { routeConfirmed } from './main.js';                                 // Tieto reitin lopullisesta vahvistamisesta
export let defaultLat, defaultLng;                                          // DevModen oletuskoordinaatit lasketaan getArea-funktiossa

//  REITTI- JA ALUELASKENTAMUUTTUJAT
let filteredWays;                                                           // Sallitut reitit
let filteredWaysCoords = [];                                                // Sallitut reittikoordinaatit
let originalRoute;                                                          // URL-haun reittidata
let firstCoords;                                                            // Ensimmäisen reittihaun koordinaatit
let routeArea;                                                              // Hakualueen äärikoordinaatit
let inArea;                                                                 // True tai false, käytetään vähentämään Overpass-hakuja
let routeFilter;                                                            // Overpass-parametrit
let testmapWindow;      // ----- //                                         // Käytetään testausvaiheessa
let testCount = 0;                                                          // Tieto hakujen määrästä. Käytetään hakujen rajaamiseksi ja apuna reittitarkistuksissa
export let firstLoad = false;                                               // Käytetään apumuuttujana sivun latauksen yhteydessä aloituskoordinaattien kääntämiseksi
let centerLat, centerLon;                                                   // Overpass-suodattimen keskipiste
let radius;                                                                 // Overpass-suodattimen hakualueen säde
export let bounds;                                                          // Reittihakualueen rajat, lasketaan haettavan reitin äärikoordinaattien perusteella

//  "SÄÄTÖMUUTTUJAT"
const radiusMultiplier = 2.5;                                               // Kertoimella voidaan säätää Overpass-suodatuksen alueen kokoa
const margin = 0.00005;                                                     // Koordinaattien välistysmarginaali
const coordPercentToAccept = 90;                                            // Prosenttiluku määrittelee, kuinka suuri osa koordinaateista täytyy hyväksyä
const coordSpacingPercent = 2;                                              // Marginaaliarvo, jota käytetään leikkauspisteiden tarkistuksessa
let coordsToRemove;                                                         // Koordinaattilistan alusta ja lopusta leikattava koordinaattimäärä


export function getTestCount() {                                            // Hakulaskurin getter ja setter
    return testCount;
}

export function setTestCount() {
    testCount += 1;
}

export function resetTestCount() {
    testCount = 0;
}

export function clearFilteredWays() {
    filteredWaysCoords = [];
}

export function setInArea(value) {
    inArea = value;
}

export function setRouteArea(area) {
    routeArea = area;
}


export async function setFilterMethod(method) {                             // Asettaa reittisuodatuksen ehdot, tiukka ja väljempi, asetetaan kartan sivupalkista
    console.log('Suodatusehto asetettu:', method);
    if (method === 'strict') {
        routeFilter = "secondary|residential|tertiary|unclassified|service|industrial";
    } else if (method === 'less_strict') {
        routeFilter = "primary|secondary|residential|tertiary|unclassified|service|industrial";
    }
}




export async function getApprovedRoutes() {                                 // Haetaan Overpass Turbolla luotu JSON-data sallituista teistä, eli pienet
    loading.innerText = 'Haetaan sallittuja reittejä';                      // tiet ja kadut valitun tiedoston alueella. Käytössä DevModessa.
    console.log('Haetaan sallittuja reittejä');
    try {
        const response = await fetch(`./mapdata/${datafile}`);
        const data = await response.json();
        filteredWays = data.elements;
        } 
    catch (err) {
        console.error('Virhe ladattaessa JSON-tiedostoa:', err);
    }
    await handleFilteredWays(filteredWays);
}




async function fetchOverpassData() {                        // Hakee sallitut reitit Overpass-APIsta normaalitilassa dynaamisesti. Hakualueen
    loading.innerText = 'Haetaan sallittuja reittejä';      // koko määräytyy getRoute-funktiossa tehdyn reittihaun alueen mukaisesti.
    console.log('Haetaan sallittuja reittejä');
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
        filteredWays = data.elements;                                   // Asetetaan palvelimelta saadut sallitut reitit muuttujaan
        filteredWaysCoords = await handleFilteredWays(filteredWays);    // Asettaa vastaanotetun datan koordinaatit listaan
    } catch (error) {
        console.error('Virhe:', error);
    }
}




async function handleFilteredWays(filteredWays) {
    console.log('Sallituja reittejä listataan'); 
    filteredWays.forEach((way) => {
        way.geometry.forEach((coordinate) => {              // Sallitut reitit puretaan koordinaateiksi ja asetetaan listaan koordinaattipareina...
            filteredWaysCoords.push([coordinate.lat, coordinate.lon]);              
        });
    });
    if (getTestCount() !== 0 || devMode) {
        routeArea = await getArea(filteredWaysCoords);      // ...minkä jälkeen koordinaateista etsitään ääripisteet.
    }
    return filteredWaysCoords;
}




export async function getArea(coords) {                 // Hakee koordinaattien ääripisteet. Funktiota käytetään sallittujen
    const latitudes = coords.map(coord => coord[0]);    // teiden listan muodostamiseksi dynaamisesti sekä tiedoston mukaisen
    const longitudes = coords.map(coord => coord[1]);   // alueen ääripisteiden laskemiseksi

    bounds = {
        maxLat: Math.max(...latitudes),                 // Alueen äärikoordinaatit
        minLat: Math.min(...latitudes),
        maxLng: Math.max(...longitudes),
        minLng: Math.min(...longitudes)
    };

    centerLat = (bounds.maxLat + bounds.minLat) / 2     // Overpass-suodatuksen keskipiste
    centerLon = (bounds.maxLng + bounds.minLng) / 2

    defaultLat = centerLat;                             // Main.js käyttää oletuskoordinaatteja virhetilanteissa sekä
    defaultLng = centerLon;                             // tiedostodataa käytettäessä DevModessa

    let verticalDiameter = await calculateDistance('getArea', [bounds.minLat, bounds.minLng], [bounds.maxLat, bounds.minLng]);
    let horizontalDiameter = await calculateDistance('getArea', [bounds.minLat, bounds.minLng], [bounds.minLat, bounds.maxLng]);

    let diameter = Math.max(verticalDiameter, horizontalDiameter);      // CalculateDistance laskee alueen halkaisijan, jonka
    radius = ((parseFloat((diameter / 2) * radiusMultiplier)) / 1000).toFixed(0);  // perusteella lasketaan suodatuksessa tarvittava sädeluku
    coordsToRemove = radius * 0.75;
    console.log(`Ääripisteet laskettu, alueen säde ${radius} kilometriä`);
    return bounds;
}




export async function callForVerify(geojsonData) {  // "Juurifunktio" reittihaulle, tässä myös ensimmäisen main.js -reittihaun tuloksen tallennus
    console.log('Reitin käsittely aloitettu'); 
    if (getTestCount() === 0) {                     // Arvo on 0, kun reittihaku käynnistetään klikkaamalla reittihakupainiketta.
        originalRoute = geojsonData;                // Uuden haun yhteydessä getRoute-funktion url-haun reitti tallennetaan.
        firstLoad = true;
    }
    
    if (!inArea) {
        firstCoords = [];
        centerLon = (geojsonData.coordinates[0][0] + geojsonData.coordinates[geojsonData.coordinates.length -1][0]) / 2;    // Lasketaan reittikoordinaateista alueen keskipiste.
        centerLat = (geojsonData.coordinates[0][1] + geojsonData.coordinates[geojsonData.coordinates.length -1][1]) / 2;    // Tarvitaan sallittujen reittien suodattamiseksi.

        geojsonData.coordinates.forEach((coordinate) => {           // Reittikoordinaatit tallennetaan listaan. Tarvitaan hakualueen ääripisteiden määrittelyyn.
            firstCoords.push([coordinate[1], coordinate[0]]);
        });

        routeArea = await getArea(firstCoords)                      // Laskee alkuperäisen reitin äärikoordinaatit.
        radius = await calculateDistance('getArea', [routeArea.minLat, routeArea.minLng], [routeArea.maxLat, routeArea.minLng]) * 2; // Laskee suodatusalueen säteen ja kertoo kahdella
    }
        if (filteredWaysCoords.length === 0) {
            await fetchOverpassData();                              // Noutaa sallitut reitit, eli Overpass Turbo API:n suodattaman datan
        }
    return filterCoordsToAvoid(geojsonData);
}




async function filterCoordsToAvoid(geojsonData) {               // Koordinaattien muunnos vertailukelpoiseen muotoon sekä keskinäinen vertailu
    if (testCount === 0) {
        loading.innerText = 'Suodatetaan reittidataa';
    } else {
        loading.innerText = 'Vahvistetaan koordinaatteja';
    }
    console.log('Suodatetaan koordinaatteja'); 
    let routeCoords = [];
    if (geojsonData && geojsonData.coordinates) {               // Alkuperäisen reittihaun koordinaatit puretaan listaan
        geojsonData.coordinates.forEach((coordinate) => {
            routeCoords.push([coordinate[1], coordinate[0]]);
        });
        if (!devMode) {
            if (getSceneryRouting()) {                          // Ohitetaan, mikäli maisemahaku ei ole valittuna. Nopeuttaa prosessointia.
                if (filteredWaysCoords.length === 0) {
                    console.log('Sallittujen reittien lista tyhjä, kutsutaan alueen laskentaa ja Overpass -hakua');
                    await getArea(routeCoords);                 // Laskee alkuperäisen reitin äärikoordinaatit, joista määritellään alueen keskipiste uutta hakua varten
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

    function coordToString(coord) {                                 // Vertaillaan kolmea ensimmäistä desimaalia, mutta
        return `${coord[0].toFixed(3)},${coord[1].toFixed(3)}`;     // koordinaatit kuitenkin tallennetaan täydellä tarkkuudella
    }

    let validCoords = [];
    let coordsToAvoid = [];
    const filteredCoordsSet = new Set(filteredWaysCoords.map(coord => coordToString(coord)));

    routeCoords.forEach(coord => {                              // Reittihaun koordinaattien vertailu sallittujen reittien listaan...
        if (filteredCoordsSet.has(coordToString(coord))) {
            validCoords.push(coord);                            // ...luo kelvollisten...
        } else {
            coordsToAvoid.push(coord);                          // ...ja epäkelpojen koordinaattien listat
        }
    });

    if (((validCoords.length / routeCoords.length) * 100).toFixed(0) > coordPercentToAccept) {      // Lasketaan listojen pituuksien perusteella laskettu prosentti-
        setVerifiedByCoordinates(true);                                                             // toteutuma ja verrataan määriteltyyn prosenttilukuun  
        setVerifiedByShortRoute(false);
        loading.innerText = `Reitti kelpaa, valideja koordinaatteja ${((validCoords.length / routeCoords.length) * 100).toFixed(0)}%`;
        console.log(`Reitti kelpaa, valideja koordinaatteja ${((validCoords.length / routeCoords.length) * 100).toFixed(0)}%`);
        return geojsonData;
    } else if (!getVerifiedByScenery()) {       // Ohjelman suoritus jatkuu, mikäli aiempi koordinaattivertailu validien ja epäkelpojen koordinaattien
        setVerifiedByShortRoute(false);         // välillä ei täytä ehtoja.
        setVerifiedByCoordinates(false);
        if (testCount === 0) {
            loading.innerText = `Haetaan uutta reittiä, kelpoja koordinaatteja ${((validCoords.length / routeCoords.length) * 100).toFixed(0)}%`;
        } else {
            loading.innerText = 'Hetki vielä';
        }
        console.log(`Haetaan uutta reittiä, kelpoja koordinaatteja ${((validCoords.length / routeCoords.length) * 100).toFixed(0)}%`);
        await flipCoordinates(coordsToAvoid);
    }
}




async function flipCoordinates(routeCoords) {   // Käännetään koordinaattien järjestys ja pyöristetään arvot
    let coordsToAvoid = routeCoords.map(coord => {
        const [lat, lng] = coord;
        return [Math.round(lng * 10000) / 10000, Math.round(lat * 10000) / 10000];
    });
    await preparePolygon(coordsToAvoid);
}




async function preparePolygon(coordsToAvoid) {                              // MARGINAALIN LISÄYSTAPAA PARANNETTAVA SUUNNANMUUTOSTEN MUKAISEKSI !!!!!!!!!!
    console.log('Valmistellaan polygonia'); 
    for (let i = 0; i < coordsToAvoid.length; i++) {
        coordsToAvoid[i] = [
            parseFloat((coordsToAvoid[i][0] + margin).toFixed(5)),          // Arvoihin lisätään hieman marginaalia, näin saadaan väljempi polygoni,
            parseFloat((coordsToAvoid[i][1] + margin).toFixed(5))           // mikäli haettava reitti on kapea.
        ];
    }
    const reversedCoords = coordsToAvoid.slice().reverse();                 // Luodaan uusi lista, johon tallennetaan vältettävät koordinaatit takaperin
    for (let i = 0; i < reversedCoords.length; i++) {
        reversedCoords[i] = [
            parseFloat((reversedCoords[i][0] - (margin * 2)).toFixed(5)),   // Marginaalia myös takaperoiseen listaan
            parseFloat((reversedCoords[i][1] - (margin * 2)).toFixed(5))
        ];
    }
    coordsToAvoid.push(...reversedCoords);                                  // Lopuksi listat yhdistetään                                                              // esim. parkkipaikalta). Tätä säätämällä voidaan vaikka pienentää polygonia.
    await rawFilterRotation(coordsToAvoid);
}




async function rawFilterRotation(coordsToAvoid) {               // Tarkistaa koordinaattilistan kiertosuunnan ja kääntää tarvittaessa
    if (testCount !== 0) {
        loading.innerText = 'Varmistetaan dataa';
    }
    let area = 0;
    for (let i = 0; i < coordsToAvoid.length - 1; i++) {        // Lasketaan alue ns. shoelace -kaavalla (Gaussin aluekaava), eli yksinkertaisesti
        area += coordsToAvoid[i][0] * coordsToAvoid[i + 1][1];  // Area = (1/2) * | ∑(x_i * y_(i+1) - y_i * x_(i+1)) |
        area -= coordsToAvoid[i + 1][0] * coordsToAvoid[i][1];
    }
    area += coordsToAvoid[coordsToAvoid.length - 1][0] * coordsToAvoid[0][1];
    area -= coordsToAvoid[0][0] * coordsToAvoid[coordsToAvoid.length - 1][1];
    const isCounterClockwise = area > 0;
    if (!isCounterClockwise) {                                  // Jos kiertosuunta on myötäpäivään, käännetään koordinaatit
        coordsToAvoid.reverse();
        console.log('Polygonin kiertosuunta käännetty');
    } else {
        console.log('Polygonin kiertosuunta tarkistettu, vastapäivään.');
    }

    coordsToAvoid = coordsToAvoid.slice(coordsToRemove, -coordsToRemove);   // Poistetaan alusta ja lopusta koordinaatteja (varmistaa liikkeellepääsyn esimerkiksi parkkipaikalta

    if (coordsToAvoid[0][0] !== coordsToAvoid[coordsToAvoid.length - 1][0] || coordsToAvoid[0][1] !== coordsToAvoid[coordsToAvoid.length - 1][1]) {
        coordsToAvoid.push(coordsToAvoid[0]);   // Tarkistetaan ensimmäisen ja viimeisen koordinaatin eroavaisuus indeksin perusteella ja lisätään tarvittaessa
        console.log('Ensimmäinen koordinaatti lisätty viimeiseksi, polygoni suljettu.');    // ensimmäinen koordinaatti listan loppuun
    }
    await checkForLineCrossing(coordsToAvoid);
}




async function checkForLineCrossing(coordsToAvoid) {        // Funktio tarkistaa polygonin linjojen leikkaukset
    function doSegmentsIntersect(A, B, C, D) {              // Tarkistaa, leikkaavatko segmentit AB ja CD
        function orientation(p, q, r) {                     // Määrittää kolmion suunnan
            const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);  // 
            if (val === 0) return 0;                        // Jos arvo on nolla, pisteet p, q ja r ovat samalla suoralla
            return (val > 0) ? 1 : 2;                       // // Palauttaa 1, jos r on vasemmalla, 2 jos oikealla
        }
        function onSegment(p, q, r) {                       // Tarkistaa, onko piste q suoran p-r segmentissä
            return (q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) &&
                    q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]));
        }
        const o1 = orientation(A, B, C);                    // Haetaan neljälle muuttujalle kolmen koordinaatin kiertosuunta
        const o2 = orientation(A, B, D);
        const o3 = orientation(C, D, A);
        const o4 = orientation(C, D, B);
        if (o1 !== o2 && o3 !== o4) return true;            // Ehto on tosi, kun leikkaus havaitaan
        if (o1 === 0 && onSegment(A, C, B)) return true;
        if (o2 === 0 && onSegment(A, D, B)) return true;
        if (o3 === 0 && onSegment(C, A, D)) return true;
        if (o4 === 0 && onSegment(C, B, D)) return true;
        return false;
    }
    let hasCrossing;
    let iterationCount = 0;
    const maxIterations = 999;
    do {
        hasCrossing = false;
        for (let i = 0; i < coordsToAvoid.length - 1; i++) {                        // Tarkistaa leikkauspisteet
            const A = coordsToAvoid[i];
            const B = coordsToAvoid[i + 1];  
            for (let j = i + 2; j < coordsToAvoid.length - 1; j++) {
                const C = coordsToAvoid[j];
                const D = coordsToAvoid[j + 1];
                if (doSegmentsIntersect(A, B, C, D)) {
                    hasCrossing = true;                                             // Silmukka toistuu, kunnes hasCrossing on epätosi, tai maxIterations täyttyy
                    const midpointAB = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];      // Segmenttien väliset keskipisteet
                    const midpointCD = [(C[0] + D[0]) / 2, (C[1] + D[1]) / 2];

                    A[0] += (midpointAB[0] - A[0]) * (coordSpacingPercent / 100);   // Korjaustoimet
                    A[1] += (midpointAB[1] - A[1]) * (coordSpacingPercent / 100);
                    
                    B[0] += (midpointAB[0] - B[0]) * (coordSpacingPercent / 100);
                    B[1] += (midpointAB[1] - B[1]) * (coordSpacingPercent / 100);

                    C[0] += (midpointCD[0] - C[0]) * (coordSpacingPercent / 100);
                    C[1] += (midpointCD[1] - C[1]) * (coordSpacingPercent / 100);

                    D[0] += (midpointCD[0] - D[0]) * (coordSpacingPercent / 100);
                    D[1] += (midpointCD[1] - D[1]) * (coordSpacingPercent / 100);
                }
            }
        }
        iterationCount++;                                       // Lisätään suorituskertojen laskurin arvoa
        if (iterationCount >= maxIterations) {
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 0));   // 0 ms odotus asettaa tehtävän tapahtumajonoon ennen seuraavaa iteraatiota,
    } while (hasCrossing);                                      // varmistaa oikea-aikaisen suoritusjärjestyksen
    await createPolygon(coordsToAvoid);
}






async function createPolygon(coordsToAvoid) {           // Muotoilee ja palauttaa lopullisen polygonin
    setTestCount();                                     // Kasvatetaan testCount-arvoa jokaisella polygonin luontikerralla
    console.log('Muodostetaan polygonia');
    function formatPolygon(coords) {
        return {
            type: "Polygon",
            coordinates: [coords]
        };
    }

    const polygon = formatPolygon(coordsToAvoid);
    setVerifiedByShortRoute(false);                     // Asetetaan oikea reittityyppi löydetyksi
    setVerifiedByCoordinates(false);
    if (routeConfirmed) {
        setVerifiedByScenery(true);
        saveRoute(polygon.coordinates);                 // Testausta varten
    }
    if (testCount === 1) {
        updatePolygon(polygon);                         // Tallettaa polygonin muuttujaan, joka on main.js- funktion findAlternativeRoute löydettävissä
    } else {
        await findAlternativeRoute(polygon, originalRoute);
    }
}




function saveRoute(coords) {                                        // Testausvaiheen funktio. Tallentaa polygonin koordinaatit localstorageen ja avaa testikartan,
    localStorage.setItem("Polygon", JSON.stringify(coords));        // jossa polygonin koordinaatit asetetaan kartalle.
    console.log('Tallennetaan tietoja testikarttaan');
    if (testmapWindow && !testmapWindow.closed) {
        testmapWindow.location.reload();
    } else {
        testmapWindow = window.open("testmapCoord.html", "_blank");
    }
}