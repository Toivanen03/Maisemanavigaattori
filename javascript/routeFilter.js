let sceneryRouting;

export function updateSceneryRouting(value) {
    sceneryRouting = value;
}

if (sceneryRouting) {
    try { // Haetaan Overpass Turbolla luotu JSON-data sallituista teistä (pienet tiet ja kadut Heinolan keskustan alueella, suodatus ei vielä toiminnassa)
        const response = await fetch('mapdata/heinola.json');
        const data = await response.json();
        let filteredWays = processMapData(data);
        } 
        catch (err) {
            console.error('Virhe ladattaessa JSON-tiedostoa:', err);
        }

    function processMapData(data) {
        return data.elements.filter(element => {
            return element.type === 'way' &&
                element.tags.highway &&
                !['motorway', 'motorway_link', 'trunk', 'trunk_link'].includes(element.tags.highway);
        });
    }
}