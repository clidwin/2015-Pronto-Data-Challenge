var map;
var stationData;

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
  calculateAndDisplayRoute(directionsService, directionsDisplay);
}

/**
 * Queries the database for the different Pronto bike stations and
 * generates the content to be displayed when each station is clicked.
 */
function initializeStations() {
  // Gather and draw all stations.
  stationData = new google.maps.FusionTablesLayer({
    query: {
      select: 'lat',
      from: '12mjOjVktZlJ6dTsFEC3_OVJYWCizYdE4o5XGQpPo' // TODO(clidwin): Scrub this information before launch
    },
    styles: [{
      markerOptions: {
        iconName: 'measle_brown' //'cycling' option for animations
      }
    }]
  });

  // Define the click action for each station
  google.maps.event.addListener(stationData, 'click', function(e) {
    // Set the content of the info window
    // TODO(clidwin): Style this to match the color and typography in the rest of the map
    e.infoWindowHtml = '<b>' + e.row['name'].value + '</b>' + '<br>';
    e.infoWindowHtml += '<b>Terminal Id: </b>' + e.row['terminal'].value + '<br>';
    e.infoWindowHtml += '<b>Online Date: </b>' + e.row['online'].value + '<br>';
    e.infoWindowHtml += '<b>Dock Count: </b>' + e.row['dockcount'].value + '<br>';
  });
    
  stationData.setMap(map);
}

/**
 *
 */
function calculateAndDisplayRoute(directionsService, directionsDisplay) {
    //TODO(clidwin): Add all routes and use cycle marker to animate
    //https://stackoverflow.com/questions/6040965/drawing-multiple-route-google-map
  directionsService.route({
    origin: {lat: 47.618418, lng: -122.350964},
    destination: {lat: 47.615829, lng: -122.348564},
    travelMode: google.maps.TravelMode.BICYCLING
  }, function(response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      directionsDisplay.setDirections(response);
    } else {
      window.alert('Directions request failed due to ' + status);
    }
  });
}