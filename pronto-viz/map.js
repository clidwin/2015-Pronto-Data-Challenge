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

var COLUMN_ID = 0;
var COLUMN_NAME = 1;
var COLUMN_TERMINAL = 2;
var COLUMN_LAT = 3;
var COLUMN_LNG = 4;
var COLUMN_DOCK_COUNT=5;
var COLUMN_ONLINE=6;

var openedInfoWindow = null;
var selectedMarker = null;

google.setOnLoadCallback(initMap);
google.load('visualization', '1', { 'packages':['corechart', 'table', 'geomap'] });

// From https://stackoverflow.com/questions/1643320/
var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

var DAY_OF_WEEK_NAMES = ['Sun.', 'Mon.', 'Tues.', 'Wed.', 'Thur.', 'Fri.', 'Sat.'];

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
 * Generates an info window (and associated card) based on the database information associated
 * with the coordinates of the point on the map clicked.
 *
 * @param marker The clicked marker object
 * @param event The click event
 */
function createInfoWindow(marker, event) {
  // Construct Query
  var query = 'SELECT * FROM ' + stationDataKey + ' where lat LIKE \'' + event.latLng.lat() + '\'';;
  query = encodeURIComponent(query);

  // Execute Query
  var gvizQuery = new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq=' + query);
  gvizQuery.send(function(response) {
    // Log errors if they occur
    if (response.isError()) {
        logQueryError(response);
        return;
    }
      
    // Close the opened info window if another one is already opened.
    if (openedInfoWindow != null) {
        openedInfoWindow.close();
    }
      
    // Create the content to display in the info window
    var infoWindowContent = '<p id="marker-title">' 
        + response.getDataTable().getValue(0, COLUMN_NAME) + '</p>';
    infoWindowContent += '<div class="marker-content-datum">';
    infoWindowContent += '<p class="marker-label">GPS: </p>' + '<p class="marker-content">';
    infoWindowContent += '(' + event.latLng.lat() + ', ' + event.latLng.lng() + ')' + "</p>";
    infoWindowContent += '</div>';
    infoWindowContent += '<div class="marker-content-datum">';
    infoWindowContent += '<p class="marker-label">Bike Docks: </p>';
    infoWindowContent += '<p class="marker-content">' 
        + response.getDataTable().getValue(0, COLUMN_DOCK_COUNT) + "</p>";
    infoWindowContent += '</div>'
    infoWindowContent += '<div class="horizontal-rule"></div>';
    //TODO(clidwin): Set an onClick listener for this link.
    infoWindowContent += '<a class="marker-link" onclick="getDirectionsClicked(' 
        + event.latLng.lat() + ', ' + event.latLng.lng() + ')">Pick Destination</a>';
      
    // Construct the info window object
    var infoWindow = new google.maps.InfoWindow();
    infoWindow.setPosition(event.latLng);
    infoWindow.setContent(infoWindowContent);
    google.maps.event.addListener(infoWindow, 'closeclick', function() {
        //TODO(clidwin): Clear the info-card data
        openedInfoWindow = null;
    });
      
    infoWindow.open(map);
    openedInfoWindow = infoWindow;
      
    updateStationInfoCard(response.getDataTable(), event);
  });
}

/**
 * Queries the database for the different Pronto bike stations and
 * generates the content to be displayed when each station is clicked.
 */
function initializeStations() {
  var query = 'SELECT * FROM ' + stationDataKey;
  query = encodeURIComponent(query);

  var gvizQuery = new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq=' + query);
  gvizQuery.send(function(response) {
      
  var numRows = response.getDataTable().getNumberOfRows();
    // For each row in the table, create a marker
    for (var i = 0; i < numRows; i++) {
      // Get the location from the row
      var lat = parseFloat(response.getDataTable().getValue(i, COLUMN_LAT));
      var lng = parseFloat(response.getDataTable().getValue(i, COLUMN_LNG));
      var markerLatLong = new google.maps.LatLng(
          parseFloat(response.getDataTable().getValue(i, COLUMN_LAT)),
          parseFloat(response.getDataTable().getValue(i, COLUMN_LNG))
      );
        
      // Create (and show) the associated marker object
      var marker = new google.maps.Marker({
        map: map,
        position: markerLatLong,
        //TODO(clidwin): custom markers for availability (green (available to come/go), 
        //blue (available to depart from), yellow (available to arrive at), black/grey (full/offline))
        icon: 'https://maps.gstatic.com/intl/en_us/mapfiles/markers2/measle_blue.png'
      });
      
      // Create attached infoWindow
      google.maps.event.addListener(marker, 'click', function(event) {
            createInfoWindow(marker, event);
        });
    }
  });
}

/**
 * Retrieves and applies content to display in the station info card.
 * 
 * @param stationTable A pointer a table row with
 *      the basic station information to be shown.
 * @param event The click event (with location info) triggering a (re)population
 *      of the info card
 */
function updateStationInfoCard(stationTable, event) {
  var onlineDate = new Date(stationTable.getValue(0, COLUMN_ONLINE));
    
  // Set Text Elements
  document.getElementById('station-card-name').textContent = 
      stationTable.getValue(0, COLUMN_NAME);
  document.getElementById('station-card-online').textContent = 
      DAY_OF_WEEK_NAMES[onlineDate.getDay()] + ', ' + MONTH_NAMES[onlineDate.getMonth()] + ' ' 
      + onlineDate.getDate() + ', ' + onlineDate.getFullYear();
  document.getElementById('station-card-id').textContent = 
      stationTable.getValue(0, COLUMN_TERMINAL);
  document.getElementById('station-card-docks').textContent = 
      stationTable.getValue(0, COLUMN_DOCK_COUNT);
    
  // Create Street View Panorama
  var panorama = new google.maps.StreetViewPanorama(
      document.getElementById('station-card-streetview'), {
        addressControl: false,
        position: event.latLng,
        pov: {
          // TODO(clidwin): Manually customize this for each station by adding details to the database
          heading: 34,
          pitch: 10,
          zoom: 1
        }
  });
  map.setStreetView(panorama);
    
  // Show trip data affiliated with the station
  queryAndDisplayCount(
      'from_station_id', 
      stationTable.getValue(0, COLUMN_TERMINAL), 
      'station-card-visit-departures'
  );
  queryAndDisplayCount(
      'to_station_id', 
      stationTable.getValue(0, COLUMN_TERMINAL), 
      'station-card-visit-arrivals'
  );
  queryAndDisplayDuration(
      stationTable.getValue(0, COLUMN_TERMINAL), 
      'station-card-visit-outgoing',
      false
  );
  queryAndDisplayDuration(
      stationTable.getValue(0, COLUMN_TERMINAL), 
      'station-card-visit-incoming',
      true
  );
    
  // Generate and display showing groupings
  google.visualization.drawChart({
    containerId: 'station-card-graph',
    dataSourceUrl: 'http://www.google.com/fusiontables/gvizdata?tq=',
    query: 'SELECT usertype, COUNT(tripduration) ' + 'FROM  ' + tripDataKey + ' WHERE ' 
      + 'from_station_id' + ' LIKE \'' + stationTable.getValue(0, COLUMN_TERMINAL) 
      + '\'' + ' GROUP BY usertype',
    chartType: 'ColumnChart',
    options: {
      colors: ['#00708c'],
      hAxes: {
        0: {
          title:'Type of Pass'
        }
      },
      legend: { position: 'none' },
      tooltip: 'none', //TODO(clidwin): Customize tooltip
      vAxes: {
        0: {
          title:'Number of Rides'
        }
      },
      viewWindowMode: 'maximized',
      width: '100%'
    }
  });
}

/**
 * Calculates and shows the average duration of a bike trip originating from this station.
 *
 * @param stationId The destination location
 * @param domElementId The element used to average duration
 * @param isArrivalQuery Boolean determining which duration query is being requested
 */
function queryAndDisplayDuration(stationId, domElementId, isArrivalQuery) {
  // Establish query text
  var queryText;
  if (isArrivalQuery) {
      queryText = 'SELECT SUM(tripduration), COUNT(tripduration) FROM ' 
        + tripDataKey + ' where ' + 'to_station_id' + ' LIKE \'' + stationId + '\'';
  } else {
      queryText = 'SELECT SUM(tripduration), COUNT(tripduration) FROM ' 
        + tripDataKey + ' where ' + 'from_station_id' + ' LIKE \'' + stationId + '\'';
  }
  
    
  // Execute query for departure time duration totals
  var query = new google.visualization.Query('http://www.google.com/fusiontables/gvizdata?tq=');
  query.setQuery(queryText);
  query.send(function(response) {
    // If the query does not execute, log the error
    if (response.isError()) {
      logQueryError(response);
      return;
    }
    // Successful query; extract queried information
    var total = response.getDataTable().getValue(0, 0);
    var count = response.getDataTable().getValue(0, 1);
    var average = Math.round((total/count)/60);
    document.getElementById(domElementId).textContent = average + ' minutes'; 
  });
}

/**
 * Outputs to the console the error received in attempting a database query.
 * 
 * @param response The error to display
 */
function logQueryError(response) {
    console.log('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
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
