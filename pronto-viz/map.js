var customMapTypeId = 'pronto_style';

var allowedBounds;
var lastValidCenter;
var map;
var stationData;

var apiKey = 'AIzaSyC3cxT2wWKyrWIzITqYwR7PyfhO7UD9yBI';
var tripDataKey = '14RtXJ3vHUKxGiAom_mz8W4MpzJu1p5ga0_H_a82G';
var stationDataKey = '12mjOjVktZlJ6dTsFEC3_OVJYWCizYdE4o5XGQpPo';

// Coordinate components for directions between two stations
var originLat, originLong, destLat, destLong;

google.setOnLoadCallback(initMap);
google.load('visualization', '1', {
    'packages':['corechart', 'table', 'geomap']
});

/**
 *
 */
function initMap() {
  //google.load("visualization", "1");
    
  var rendererOptions = {
      map: map,
      preserveViewport: true,
      suppressMarkers : true
  };
    
  map = new google.maps.Map(document.getElementById('map-underlay'), {
    zoom: 13,
    minZoom: 13,
    center: {lat: 47.634831, lng: -122.326634},  // Seattle station EL-03
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
    
  setStyling();
  setBoundaries();
    
  initializeStations();
    
  directionsDisplay.setMap(map);
  //calculateAndDisplayRoute(directionsService, directionsDisplay);
    
  //TODO(clidwin): Listen to onWindowSizeChange and adjust map so the footer is still in the view
}

/**
 * Applies visual derivations to the map (color, visibility, etc).
 */
function setStyling() {
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
  map.mapTypes.set(customMapTypeId, customMapType);
  map.setMapTypeId(customMapTypeId);
}

/**
 * Creates limits for how far away from the center of the station data
 * a user can pan.
 */
function setBoundaries() {
  allowedBounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(47.598488, -122.35523), // Southwest boundary
    new google.maps.LatLng(47.666145, -122.284119)  // Northeast boundary
  );

  lastValidCenter = map.getCenter();
    
  // Method adapted from https://stackoverflow.com/questions/3125065/
  google.maps.event.addListener(map, 'center_changed', function() {
    if (allowedBounds.contains(map.getCenter())) {
        // Update the new center value to the current position
        lastValidCenter = map.getCenter();
        return; 
    }

    // Reset the center to be within the panning boundaries
    map.panTo(lastValidCenter);
      
    // TODO(clidwin): Show panning restriction message to users
   });
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
      from: stationDataKey // TODO(clidwin): Scrub this information before launch
    },
    styles: [{
      markerOptions: {
        iconName: 'measle_brown' //'cycling' option for animations
      }
    }]
  });
  console.log('Stations: ' + stationData.rows);

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
      
    //TODO(clidwin): Clear content when the "X" is clicked ('closeclick' event)
    //updateDirections(e);
  });
    
  /*google.maps.event.addListener(e.infoWindow, 'closeclick', function() {  
    alert("I'm Closed");  
  }); */
    
  stationData.setMap(map);
}

/**
 * Retrieves and applies content to display in the station info card.
 * 
 * @param stationTableCell A pointer a table row with
 *      the basic station information to be shown.
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
    
  // Show trip data affiliated with the station
  queryAndDisplayCount(
      'from_station_id', 
      stationTableCell.row['terminal'].value, 
      'station-card-visit-departures'
  );
  queryAndDisplayCount(
      'to_station_id', 
      stationTableCell.row['terminal'].value, 
      'station-card-visit-arrivals'
  );
}

/**
 * Retrieves the number of entries in a column matching a particular string, and show the number
 * of matching columns on the station card.
 *
 * @param columnName The name of the column to search for matches
 * @param likeValue The string each column entry is compared to for similarities
 * @param domElementId The element used to display the number of entries found
 */
function queryAndDisplayCount(columnName, likeValue, domElementId) {
  var queryText = 'SELECT COUNT(' + columnName + ') AS total FROM ' + tripDataKey + ' where ' 
        + columnName + ' LIKE \'' + likeValue + '\''; 
    
  var query = new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq=');
  query.setQuery(queryText);
  query.send(function(response) {
    // If the query does not execute, log the error;
    if (response.isError()) {
      console.log('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
      document.getElementById(domElementId).textContent = 'Unknown'; 
      return;
    }
    // Successful queries should show the resulting count in the UI
    var numRows = response.getDataTable().getFormattedValue(0, 0);
    document.getElementById(domElementId).textContent = numRows; 
  });
}

/**
 *
 */
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
