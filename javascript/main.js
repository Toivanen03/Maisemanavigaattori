let map;
let currentRouteLayer = null;
let startMarker, endMarker;
let currentMarkerType = null;

const defaultLat = 61.23345;
const defaultLng = 26.04378;

const apiKey = 'S4YRzUa8LKgr_UV7BTPJE-uhCdcUTtOWCyjvByH_Izc';
const platform = new H.service.Platform({
    apikey: apiKey
});




document.addEventListener('DOMContentLoaded', function() {
    // Lataa ja prosessoi JSON-tiedosto
    fetch('mapdata/heinola.json')
        .then(response => response.json())
        .then(data => {
            filteredWays = processMapData(data);
        })
        .catch(err => console.error('Virhe ladattaessa JSON-tiedostoa:', err));

    navigator.geolocation.getCurrentPosition(
        function(position) {
            let userLat = position.coords.latitude;
            let userLng = position.coords.longitude;
            drawMap(userLat, userLng, 20);
            const latLngString = `${userLat.toFixed(5)}, ${userLng.toFixed(5)}`;
            document.getElementById('startPointCoords').value = latLngString;
            reverseGeocode(userLat, userLng, function(address) {
                document.getElementById('startPoint').value = address;
                startMarker = L.marker([userLat, userLng]).addTo(map).bindPopup(address).openPopup();
            });
        },
        function(error) {
            drawMap(defaultLat, defaultLng, 15);
            document.getElementById('startPointCoords').value = `${defaultLat}, ${defaultLng}`;
            document.getElementById('startPoint').value = 'Oletussijainti';
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

    map.on('click', function(e) {
        if (currentMarkerType) {
            const latLngString = e.latlng.lat.toFixed(5) + ', ' + e.latlng.lng.toFixed(5);
            reverseGeocode(e.latlng.lat, e.latlng.lng, function(address) {
                let addressParts = address.split(", ");
                let streetAndNumber = addressParts[0].split(" ");
                let displayAddress = isNaN(streetAndNumber[1]) ? 
                    streetAndNumber[0] + ", " + addressParts[1] : 
                    streetAndNumber[0] + " " + streetAndNumber[1] + ", " + addressParts[1];
                
                if (currentMarkerType === 'start') {
                    if (startMarker) {
                        startMarker.setLatLng(e.latlng).update();
                    } else {
                        startMarker = L.marker(e.latlng).addTo(map).bindPopup(displayAddress).openPopup();
                    }
                    document.getElementById('startPointCoords').value = latLngString;
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




function getRoute(startLat, startLng, endLat, endLng) {
    let url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=3`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                let route = data.routes[0];
                let geojsonData = route.geometry;

                if (currentRouteLayer) {
                    map.removeLayer(currentRouteLayer);
                }

                currentRouteLayer = L.geoJSON(geojsonData).addTo(map);

                if (geojsonData.coordinates.length > 0) {
                    map.fitBounds(currentRouteLayer.getBounds());
                }
            }
        })
        .catch(err => console.error('Error fetching route:', err));
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
        .catch(() => {
            console.error("Osoitetta ei löytynyt.");
            callback(null, null);
        });
}




function reverseGeocode(lat, lng, callback) {
    const geocoder = platform.getSearchService();
    const reverseGeocodingParameters = { at: `${lat},${lng}` };

    geocoder.reverseGeocode(reverseGeocodingParameters,
        function(result) {
            const location = result.items[0];
            const street = location.address.street;
            const number = location.address.houseNumber;
            const city = location.address.city;
            const displayAddress = street + " " + number + ", " + city;
            callback(location ? displayAddress : 'Osoitetta ei löytynyt.');
        },
        function() {
            callback(null);
        }
    );
}