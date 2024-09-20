let map;
let currentRouteLayer = null;
let startMarker, endMarker;
let currentMarkerType = null;

const defaultLat = 61.19218145;
const defaultLng = 25.99925768;

const apiKey = 'S4YRzUa8LKgr_UV7BTPJE-uhCdcUTtOWCyjvByH_Izc';
const platform = new H.service.Platform({
    apikey: apiKey
});



document.addEventListener('DOMContentLoaded', function() {
    navigator.geolocation.getCurrentPosition(
        function(position) {
            let userLat = position.coords.latitude;
            let userLng = position.coords.longitude;
            drawMap(userLat, userLng, 20);
        },
        function(error) {
            drawMap(defaultLat, defaultLng, 15);
        }
    );

    document.getElementById('findRoute').addEventListener('click', function() {
        let start = document.getElementById('startPoint').value;
        let endAddress = document.getElementById('endPoint').value;
    
        if (start && endAddress) {
            geocodeAddress(endAddress, function(endLat, endLng) {
                let startCoords = document.getElementById('startPointCoords').value.split(',').map(coord => parseFloat(coord.trim()));
                let startLat = startCoords[0];
                let startLng = startCoords[1];
    
                getRoute(startLat, startLng, endLat, endLng);
            });
        } else {
            alert("Aseta sekä lähtöpiste että määränpää.");
        }
    });
});



function drawMap(lat, lng, zoomLevel) {
    if (map) {
        map.remove();
    }

    map = L.map('map').setView([lat, lng], zoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    document.getElementById('startPoint').addEventListener('focus', () => {
        currentMarkerType = 'start';
        document.getElementById('map').style.cursor = 'crosshair';
    });

    document.getElementById('endPoint').addEventListener('focus', () => {
        currentMarkerType = 'end';
        document.getElementById('map').style.cursor = 'crosshair';
    });

    document.getElementById('startPoint').addEventListener('blur', () => {
        document.getElementById('map').style.cursor = 'default';
    });

    document.getElementById('endPoint').addEventListener('blur', () => {
        document.getElementById('map').style.cursor = 'default';
    });

    map.on('click', function(e) {
        if (currentMarkerType) {
            const latLngString = e.latlng.lat.toFixed(5) + ', ' + e.latlng.lng.toFixed(5);
            reverseGeocode(e.latlng.lat, e.latlng.lng, function(address) {
                if (currentMarkerType === 'start') {
                    if (startMarker) {
                        startMarker.setLatLng(e.latlng).update();
                    } else {
                        startMarker = L.marker(e.latlng).addTo(map).bindPopup("Lähtöpiste").openPopup();
                    }
                    document.getElementById('startPointCoords').value = latLngString;
                    if (address) {
                        document.getElementById('startPoint').value = address;
                    } else {
                        document.getElementById('startPoint').value = latLngString;
                    }

                } else if (currentMarkerType === 'end') {
                    if (endMarker) {
                        endMarker.setLatLng(e.latlng).update();
                    } else {
                        endMarker = L.marker(e.latlng).addTo(map).bindPopup("Määränpää").openPopup();
                    }
                    document.getElementById('endPointCoords').value = latLngString;
                    if (address) {
                        document.getElementById('endPoint').value = address;
                    } else {
                        document.getElementById('endPoint').value = latLngString;
                    }
                }
                currentMarkerType = null;
                document.getElementById('map').style.cursor = 'default';
            });
        }
    });
}



function processMapData(data) {
    return data.elements.filter(element => {
        return element.type === 'way' &&
            element.tags.highway &&
            !['motorway', 'motorway_link', 'trunk', 'trunk_link'].includes(element.tags.highway);
    });
}



function visualizeFilteredWays() {
    if (!map) {
        return;
    }

    let filteredWays = window.filteredWays;
    if (!filteredWays || filteredWays.length === 0) {
        return;
    }

    filteredWays.forEach(way => {
        let latlngs = way.geometry.map(point => [point.lat, point.lon]);
        L.polyline(latlngs, { color: 'blue' }).addTo(map);
    });
}



function getRoute(startLat, startLng, endLat, endLng) {
    if (!startLat || !startLng || !endLat || !endLng) {
        return;
    }
    let url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                let route = data.routes[0];
                if (currentRouteLayer) {
                    map.removeLayer(currentRouteLayer);
                }

                currentRouteLayer = L.geoJSON(route.geometry).addTo(map);
                map.fitBounds(currentRouteLayer.getBounds());
                if (isRouteValid(route.geometry)) {
                    visualizeFilteredWays();
                }
            }
        })
        .catch(err => console.error('Reitin hakemisessa tapahtui virhe:', err));
}



function isRouteValid(routeGeometry) {
    if (!window.filteredWays || window.filteredWays.length === 0) {
        return false;
    }

    let routeLatLngs = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);
    let validWays = window.filteredWays.flatMap(way => 
        way.geometry.map(p => [p.lat, p.lon])
    );

    let isValid = routeLatLngs.every(point => {
        return validWays.some(p => Math.abs(p[0] - point[0]) < 0.0001 && Math.abs(p[1] - point[1]) < 0.0001);
    });
    return isValid;
}



function geocodeAddress(address, callback) {
    const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(address)}&apiKey=${apiKey}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.items && data.items.length > 0) {
                const location = data.items[0];
                const lat = location.position.lat;
                const lng = location.position.lng;

                if (currentMarkerType === 'start') {
                    document.getElementById('startPointCoords').value = lat + ', ' + lng;
                } else if (currentMarkerType === 'end') {
                    document.getElementById('endPointCoords').value = lat + ', ' + lng;
                }

                callback(lat, lng);
            } else {
                callback(null, null);
            }
        })
        .catch(error => {
            console.error("Osoitetta ei löytynyt.")
            callback(null, null);
        });
}



function reverseGeocode(lat, lng, callback) {
    const geocoder = platform.getSearchService();
    const reverseGeocodingParameters = {
        at: `${lat},${lng}`
    };

    geocoder.reverseGeocode(
        reverseGeocodingParameters,
        function(result) {
            const location = result.items[0];
            if (location) {
                callback(location.address.label);
            } else {
                callback('Osoitetta ei löytynyt.');
            }
        },
        function(error) {
            callback(null);
        }
    );
}