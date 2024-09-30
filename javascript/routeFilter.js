export function processMapData(data) {
    return data.elements.filter(element => {
        return element.type === 'way' &&
            element.tags.highway &&
            !['motorway', 'motorway_link', 'trunk', 'trunk_link'].includes(element.tags.highway);
    });
}
