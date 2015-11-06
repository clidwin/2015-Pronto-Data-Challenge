var map;
var stationData;

var originLat, originLong, destLat, destLong;

/**
 *
 */
function initMap() {
  var rendererOptions = {
      map: map,
      preserveViewport: true,
      suppressMarkers : true
  };
    
  map = new google.maps.Map(document.getElementById('map-underlay'), {
    zoom: 14,
    center: {lat: 47.6097, lng: -122.3331},  // Seattle.
    mapTypeControlOptions: {
      mapTypeIds: [google.maps.MapTypeId.ROADMAP, customMapTypeId]
    },
    disableDefaultUI: true,
    scaleControl: true,
    zoomControl: true,
    zoomControlOptions: {
        position: google.maps.ControlPosition.LEFT_BOTTOM
    }
  });
    
  var directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);
  var directionsService = new google.maps.DirectionsService;
    
  // TODO(clidwin): Apply these boundaries to the map
  var bounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(47.6095, -122.3330),
    new google.maps.LatLng(47.6097, -122.3332)
  );
  var customMapType = new google.maps.StyledMapType([
      {
        stylers: [
          {hue: '#8EDD65'},
          {visibility: 'simplified'},
          {gamma: 0.5},
          {weight: 0.5}
        ]
      },
      {
        elementType: 'labels',
        stylers: [{visibility: 'off'}]
      },
      {
        featureType: 'water',
        stylers: [{color: '#00708c'}]
      },
    ], {
      name: 'Pronto Style'
  });
  var customMapTypeId = 'pronto_style';
  map.mapTypes.set(customMapTypeId, customMapType);
  map.setMapTypeId(customMapTypeId);
    
  initializeStations();
    
  directionsDisplay.setMap(map);
  //calculateAndDisplayRoute(directionsService, directionsDisplay);
}

/**
 * Queries the database for the different Pronto bike stations and
 * generates the content to be displayed when each station is clicked.
 */
function initializeStations() {
  // Define the click action for each station
  google.maps.event.addListener(stationData, 'click', function(e) {
    // Set the content of the info window
    e.infoWindowHtml = '<p id="marker-title">' + e.row['name'].value + '</p>';
    e.infoWindowHtml += '<div class="marker-content-datum">';
    e.infoWindowHtml += '<p class="marker-label">GPS: </p>' + '<p class="marker-content">';
    e.infoWindowHtml += '(' + e.row['lat'].value + ', ' + e.row['long'].value + ')' + "</p>";
    e.infoWindowHtml += '</div>';
    e.infoWindowHtml += '<div class="marker-content-datum">';
    e.infoWindowHtml += '<p class="marker-label">Bike Docks: </p>';
    e.infoWindowHtml += '<p class="marker-content">' + e.row['dockcount'].value + "</p>";
    e.infoWindowHtml += '</div>'
    e.infoWindowHtml += '<div class="horizontal-rule"></div>';
    //TODO(clidwin): Set an onClick listener for this link.
    e.infoWindowHtml += '<a class="marker-link">Pick Destination</a>';

    updateStationInfoCard(e);
      
    //TODO(clidwin): Clear content when the "X" is clicked
    //updateDirections(e);
  });
    
  stationData.setMap(map);
}

/**
 *
 */
function updateStationInfoCard(stationTableCell) {
  // Set Text Elements
  document.getElementById('station-card-name').textContent = 
      stationTableCell.row['name'].value;
  document.getElementById('station-card-online').textContent = 
      stationTableCell.row['online'].value;
  document.getElementById('station-card-id').textContent = 
      stationTableCell.row['terminal'].value;
  document.getElementById('station-card-docks').textContent = 
      stationTableCell.row['dockcount'].value;
    
  // Create Street View Panorama
  var location = new google.maps.LatLng
      (parseFloat(stationTableCell.row['lat'].value), 
       parseFloat(stationTableCell.row['long'].value));
  var panorama = new google.maps.StreetViewPanorama(
      document.getElementById('station-card-streetview'), {
        addressControl: false,
        position: location,
        pov: {
          heading: 34,
          pitch: 10,
          zoom: 1
        }
  });
  map.setStreetView(panorama);
    
  //TODO(clidwin): Get information from the trip data
}

function updateDirections(row) {
  if (originLat === null) {
    originLat = row.row['lat'].value;
    originLong = row.row['long'].value;
    return;
  } else if (destLat === null) {
    destLat = row.row['lat'].value;
    destLong = row.row['long'].value;

    var directionsDisplay = new google.maps.DirectionsRenderer;
    var directionsService = new google.maps.DirectionsService;
    calculateAndDisplayRoute2(directionsService, directionsDisplay);
  } else {
    originLat = destLat;
    originLong = destLong;
    destLat = row.row['lat'].value;
    destLong = row.row['long'].value;

    var rendererOptions = {
    map: map,
    preserveViewport: true,
    suppressMarkers : true
  };
    var directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);
    var directionsService = new google.maps.DirectionsService;
    //calculateAndDisplayRoute2(directionsService, directionsDisplay);
  }
}

/**
 *
 */
function calculateAndDisplayRoute2(directionsService, directionsDisplay) {
    
    console.log('Origin: (' + originLat + ', ' + originLong + ')');
    console.log('Destination: (' + destLat + ', ' + destLong + ')');
    //TODO(clidwin): Add all routes and use cycle marker to animate
    //https://stackoverflow.com/questions/6040965/drawing-multiple-route-google-map
  directionsService.route({
    origin: new google.maps.LatLng(parseFloat(originLat), parseFloat(originLong)),
    destination: new google.maps.LatLng(parseFloat(destLat), parseFloat(destLong)),
    travelMode: google.maps.TravelMode.BICYCLING
  }, function(response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      directionsDisplay.setDirections(response);
    } else {
      window.alert('Directions request failed due to ' + status);
    }
  });
}
