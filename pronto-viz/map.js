var customMapTypeId = 'pronto_style';

var allowedBounds;
var lastValidCenter;
var map;
var stationData;

var originLatLng;

var destInfoWindow;

var elevator;

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
var selectedOriginMarker = null;
//TODO(clidwin): Create a different-colored marker indicating the destination
var selectedDestMarker = null;

var directionsDisplay;

google.setOnLoadCallback(initMap);
google.load('visualization', '1', { 
    'packages':['corechart', 'table', 'geomap', 'columnchart'] 
});

// From https://stackoverflow.com/questions/1643320/
var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

var DAY_OF_WEEK_NAMES = ['Sun.', 'Mon.', 'Tues.', 'Wed.', 'Thur.', 'Fri.', 'Sat.'];

/**
 * Sets up the map interface and related details
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
    
  setStyling();
  setBoundaries();
    
  initializeStations();
    
  //TODO(clidwin): Listen to onWindowSizeChange and 
  //adjust map so the footer is still in the view
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
  var query = 'SELECT * FROM ' + stationDataKey;
  query = encodeURIComponent(query);

  var gvizQuery = new google.visualization.Query(
      'http://www.google.com/fusiontables/gvizdata?tq=' + query);
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
        //TODO(clidwin): custom markers for availability 
        //(green (available to come/go), 
        //blue (available to depart from), 
        //yellow (available to arrive at), 
        //black/grey (full/offline))
        icon: 'assets/measle_brown.png'
      });
      
      // Create marker click listener
      google.maps.event.addListener(marker, 'click', function(event) {
            if (selectedOriginMarker != null) {
                showRoute(event.latLng);
                updateTripCard(event.latLng);
                
                // Set the trip-instructions element to be a link
                document.getElementById('trip-instructions').textContent = '';
                document.getElementById('trip-instructions').innerHTML = 
                    '<a onclick="showStationInsteadOfDirections()" ' 
                    + 'class="marker-link">' 
                    + 'Return to Station View' + '</a>';

            } else {
                // Set the trip-instructions element to be text
                document.getElementById('trip-instructions').innerHTML = '';
                document.getElementById('trip-instructions').textContent = 
                    'Click a Pronto Station Destination';
                
                // Create an info window and populate the station info card
                createInfoWindow(event, false);
            }
      });
    }
  });
}

/**
 * Generates an info window (and associated card)
 * based on the database information associated with the coordinates 
 * of the point on the map clicked.
 *
 * @param event The click event
 * @param forDirections 
 *      True if the info window is showing the destination for directions,
 *      else false
 */
function createInfoWindow(event, forDirections) {
  // Construct Query
  var query = 'SELECT * FROM ' + stationDataKey 
        + ' where lat LIKE \'' + event.latLng.lat() + '\'';;
  query = encodeURIComponent(query);

  // Execute Query
  var gvizQuery = new google.visualization.Query(
      'http://www.google.com/fusiontables/gvizdata?tq=' + query);
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
    infoWindowContent += '<p class="marker-label">GPS: </p>' 
        + '<p class="marker-content">';
    infoWindowContent += '(' + event.latLng.lat() + ', ' 
        + event.latLng.lng() + ')' + "</p>";
    infoWindowContent += '</div>';
    infoWindowContent += '<div class="marker-content-datum">';
    infoWindowContent += '<p class="marker-label">Bike Docks: </p>';
    infoWindowContent += '<p class="marker-content">' 
        + response.getDataTable().getValue(0, COLUMN_DOCK_COUNT) + "</p>";
    infoWindowContent += '</div>'
    infoWindowContent += '<div class="horizontal-rule"></div>';

    if (forDirections) {
        //TODO(clidwin): Set link to show information for this station 
        //(no more directions)
        infoWindowContent += 
            '<a class="marker-link" onclick="showStationInsteadOfDirections(' 
            + event.latLng.lat() + ', ' + event.latLng.lng() 
            + ')">Show Station Details</a>';
    } else {
        infoWindowContent += 
            '<a class="marker-link" onclick="initializeDirections(' 
            + event.latLng.lat() + ', ' + event.latLng.lng() 
            + ')">Pick Destination</a>';
        updateStationInfoCard(response.getDataTable(), event);
    }
      
    // Construct the info window object
    var infoWindow = new google.maps.InfoWindow();
    infoWindow.setPosition(event.latLng);
    infoWindow.setContent(infoWindowContent);
    google.maps.event.addListener(infoWindow, 'closeclick', function() {
        openedInfoWindow = null;
        resetStationCard();
    });

    infoWindow.open(map);
    openedInfoWindow = infoWindow;
    
    if (selectedOriginMarker != null) {
        destInfoWindow = infoWindow;
    }
  });
}

/**
 * TODO(clidwin): Describe
 *
 * @param lat The latitude piece of the selected marker's coordinate
 * @param lng The longitude piece of the selected marker's coordinate
 */
function showStationInsteadOfDirections(lat, lng) {
    // Clear Trip Markers from the screen
    selectedOriginMarker.setVisible(false);
    selectedOriginMarker = null;
    selectedDestMarker.setVisible(false);
    selectedDestMarker = null;
    
    // Clear Route
    directionsDisplay.setMap(null);
    
    // Reset Cards
    resetStationCard();
    resetTripCard();
    
    // Show Station Card
    document.getElementById('info-card').style.display = 'block';
    document.getElementById('trip-card').style.display = 'none';
}

/**
 * TODO(clidwin): Implement a less-hacky solution for reseting the card content
 */
function resetStationCard() {
    var cardHtml = '<h1 id="info-title">Station Details</h1>';
    cardHtml += '<p id="station-card-name">Click a Pronto Station</p>';
    cardHtml += '<div id="station-card-streetview"></div>';
    cardHtml += '<h2 class="info-section-title">Basic Info</h2>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">First Online:</p>';
    cardHtml += '<p id="station-card-online" ';
    cardHtml += 'class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Terminal ID:</p>';
    cardHtml += '<p id="station-card-id" class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Total Bike Docks:</p>';
    cardHtml += '<p id="station-card-docks" ';
    cardHtml += 'class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="horizontal-rule"></div>';
    cardHtml += '<h2 class="info-section-title">Visit Details (2014)</h2>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Average Outgoing Visit:</p>';
    cardHtml += '<p id="station-card-visit-outgoing" ';
    cardHtml += 'class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Average Incoming Visit:</p>';
    cardHtml += '<p id="station-card-visit-incoming" ';
    cardHtml += 'class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Total Arrivals:</p>';
    cardHtml += '<p id="station-card-visit-arrivals" ';
    cardHtml += 'class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Total Departures:</p>';
    cardHtml += '<p id="station-card-visit-departures" ';
    cardHtml += 'class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="horizontal-rule"></div>';
    cardHtml += '<h2 class="info-section-title">Visits by Pass Type (2014)</h2>';
    cardHtml += '<div id="station-card-graph"></div>';
    
    document.getElementById('info-card').innerHTML = '';
    document.getElementById('info-card').innerHTML = cardHtml;
}

/**
 * TODO(clidwin): Implement a less-hacky solution for reseting the card content
 */
function resetTripCard() {
    var cardHtml = '<h1 id="trip-heading">Ride Details</h1>';
    cardHtml += '<p id="trip-instructions">Click a Pronto Station Destination</p>';
    cardHtml += '<div id="trip-elevation-graph"></div>';
    cardHtml += '<h2 class="info-section-title">Basic Info</h2>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Origin:</p>';
    cardHtml += '<p id="trip-origin" class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Destination:</p>';
    cardHtml += '<p id="trip-destination" class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="horizontal-rule"></div>';
    cardHtml += '<h2 class="info-section-title">Trip Details (2014)</h2>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Route Travel Time:</p>';
    cardHtml += '<p id="travel-time-estimated" ';
    cardHtml += 'class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Average Trip Time:</p>';
    cardHtml += '<p id="travel-time-avg" class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Total Trips:</p>';
    cardHtml += '<p id="total-trips" class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">Trips by Annual Passes:</p>';
    cardHtml += '<p id="trips-annual" class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    cardHtml += '<div class="station-card-datum">';
    cardHtml += '<p class="station-card-datum-label">';
    cardHtml += 'Trips by Short-Term Passes:';
    cardHtml += '</p>';
    cardHtml += '<p id="trips-short-term" class="station-card-datum-content"></p>';
    cardHtml += '</div>';
    
    document.getElementById('trip-card').innerHTML = '';
    document.getElementById('trip-card').innerHTML = cardHtml;
}

/**
 * Sets variables and indicators noting an intention to find directions from
 * the marker selected at the provided latitude and longitude.
 *
 * @param lat The latitude piece of the selected marker's coordinate
 * @param lng The longitude piece of the selected marker's coordinate
 */
function initializeDirections(lat, lng) {    
    // Close the opened info window and highlight its associated marker
    openedInfoWindow.close();
    originLatLng = new google.maps.LatLng(parseFloat(lat),parseFloat(lng));
    selectedOriginMarker = new google.maps.Marker({
        map: map,
        position: originLatLng,
        icon: 'assets/measle_turquoise.png'
    });
    //TODO(clidwin): Figure out why resetting the visibility isn't working.
    selectedOriginMarker.setVisible(true);
    google.maps.event.addListener(selectedOriginMarker, 'click', function(event) {
        //TODO(clidwin): Have a toast pop up indicating origin != destination
        console.log('origin clicked');
    });
    
    // Switch which card is displayed
    document.getElementById('info-card').style.display = 'none';
    document.getElementById('trip-card').style.display = 'block';
    document.getElementById('trip-origin').textContent 
        = document.getElementById('station-card-name').textContent;
}

/**
 * TODO(clidwin): Describe Method
 *
 * @param destLatLng The position of the station destination (lat, long)
 */
function updateTripCard(destLatLng) {    
  // Construct Destionation Query
  var destQuery = 'SELECT * FROM ' + stationDataKey 
        + ' where lat LIKE \'' + destLatLng.lat() + '\'';;
  destQuery = encodeURIComponent(destQuery);

  // Execute Query
  var destinationTerminal;
  var destGvizQuery = new google.visualization.Query(
      'http://www.google.com/fusiontables/gvizdata?tq=' + destQuery);
  destGvizQuery.send(function(response) {
    // Log errors if they occur
    if (response.isError()) {
        logQueryError(response);
        return;
    }
      
    document.getElementById('trip-destination').textContent = 
        response.getDataTable().getValue(0,COLUMN_NAME);

    var destinationTerminal = 
        response.getDataTable().getValue(0,COLUMN_TERMINAL);
    var originTerminal = document.getElementById('station-card-id').textContent;
    
    calculateTotalTrips(originTerminal, destinationTerminal);
    queryAndDisplayTripsByPass(originTerminal, destinationTerminal, true);
    queryAndDisplayTripsByPass(originTerminal, destinationTerminal, false);
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
      DAY_OF_WEEK_NAMES[onlineDate.getDay()] + ', ' 
      + MONTH_NAMES[onlineDate.getMonth()] + ' ' 
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
          // TODO(clidwin): Manually customize this for each station 
          // by adding details to the database
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
    query: 'SELECT usertype, COUNT(tripduration) ' + 'FROM  ' 
      + tripDataKey + ' WHERE ' + 'from_station_id' 
      + ' LIKE \'' + stationTable.getValue(0, COLUMN_TERMINAL) 
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
 * Retrieves from the database and calculates values relating to the total
 * trips taken along a specific route and the amount of time an average trip
 * takes on the route.
 *
 * @param originTerminal The id of the terminal where the trip begins
 * @param destinationTerminal The id of the terminal where the trip ends
 */
function calculateTotalTrips(originTerminal, destinationTerminal) {
  var avgQuery = 'SELECT COUNT(tripduration), SUM(tripduration) FROM ' 
      + tripDataKey 
      + ' WHERE from_station_id LIKE \'' + originTerminal + '\'';
      + ' AND to_station_id LIKE \'' + destinationTerminal + '\'';
  avgQuery = encodeURIComponent(avgQuery);
  var avgGvizQuery = new google.visualization.Query(
      'http://www.google.com/fusiontables/gvizdata?tq=' + avgQuery);
  avgGvizQuery.send(function(response) {
    // Log errors if they occur
    if (response.isError()) {
        logQueryError(response);
        return;
    }
    
    var totalTrips = response.getDataTable().getValue(0,0);
    var totalTripTime = response.getDataTable().getValue(0,1);
    var averageTripTime = Math.round((totalTripTime/totalTrips)/60);
      
    document.getElementById('total-trips').textContent = totalTrips;
    document.getElementById('travel-time-avg').textContent = 
        averageTripTime + ' mins';
  });
}

/**
 * Retrieves from the database and displays the number of trips for a specific
 * pass type.
 *
 * @param originTerminal The id of the terminal where the trip begins
 * @param destinationTerminal The id of the terminal where the trip ends
 * @param isAnnualPass True for annual passes, false for short term passes
 */
function queryAndDisplayTripsByPass(
    originTerminal, destinationTerminal, isAnnualPass) {
  var passQuery = 'SELECT COUNT(usertype) FROM ' 
      + tripDataKey 
      + ' WHERE from_station_id LIKE \'' + originTerminal + '\'';
      + ' AND to_station_id LIKE \'' + destinationTerminal + '\'';
       
  // Set method components dependent on the pass type
  var elementId;
  if (isAnnualPass) {
      passQuery += ' AND usertype LIKE \'Annual Member\'';
      elementId = 'trips-annual';
  } else {
      passQuery += ' AND usertype LIKE \'Short-Term Pass Holder\'';
      elementId = 'trips-short-term';
  }
  passQuery = encodeURIComponent(passQuery);
        
  var passGvizQuery = new google.visualization.Query(
      'http://www.google.com/fusiontables/gvizdata?tq=' + passQuery);
  passGvizQuery.send(function(response) {
    // Log errors if they occur
    if (response.isError()) {
        logQueryError(response);
        return;
    }
    
    document.getElementById(elementId).textContent =
        response.getDataTable().getValue(0,0);
  });
}

/**
 * Calculates and shows the average duration of a bike trip 
 * originating from this station.
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
        + tripDataKey + ' where ' + 'to_station_id' + ' LIKE \'' 
          + stationId + '\'';
  } else {
      queryText = 'SELECT SUM(tripduration), COUNT(tripduration) FROM ' 
        + tripDataKey + ' where ' + 'from_station_id' + ' LIKE \'' 
          + stationId + '\'';
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
    document.getElementById(domElementId).textContent = average + ' mins'; 
  });
}

/**
 * Outputs to the console the error received in attempting a database query.
 * 
 * @param response The error to display
 */
function logQueryError(response) {
    console.log('Error in query: ' + response.getMessage() + ' ' 
                + response.getDetailedMessage());
}

/**
 * Retrieves the number of entries in a column matching a particular string, 
 * and show the number of matching columns on the station card.
 *
 * @param columnName The name of the column to search for matches
 * @param likeValue The string each column entry is compared to for similarities
 * @param domElementId The element used to display the number of entries found
 */
function queryAndDisplayCount(columnName, likeValue, domElementId) {
  var queryText = 'SELECT COUNT(' + columnName + ') AS total FROM ' 
        + tripDataKey + ' where ' + columnName + ' LIKE \'' + likeValue + '\''; 
    
  var query = new google.visualization.Query(
      'http://www.google.com/fusiontables/gvizdata?tq=');
  query.setQuery(queryText);
  query.send(function(response) {
    // If the query does not execute, log the error;
    if (response.isError()) {
      console.log('Error in query: ' + response.getMessage() + ' ' 
                  + response.getDetailedMessage());
      document.getElementById(domElementId).textContent = 'Unknown'; 
      return;
    }
    // Successful queries should show the resulting count in the UI
    var numRows = response.getDataTable().getFormattedValue(0, 0);
    document.getElementById(domElementId).textContent = numRows; 
  });
}

/**
 * Displays a route between two two stations.
 * Inspiration in https://stackoverflow.com/questions/6040965/
 * 
 * @param destLatLng The arrival station's latitude and longitude
 */
function showRoute(destLatLng) {
  if (directionsDisplay != null) {
      directionsDisplay.setMap(null);
  }
    
  selectedDestMarker = new google.maps.Marker({
    map: map,
    position: destLatLng,
    icon: 'assets/measle_turquoise.png'
  });
  selectedDestMarker.setVisible(true);
    
  var directionsService = new google.maps.DirectionsService();
    
  var rendererOptions = {
    preserveViewport: true,         
    suppressMarkers:true,
    routeIndex:1
  };
    
  directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions); 
  directionsDisplay.setMap(map);
  directionsService.route({
    origin: originLatLng,
    destination: destLatLng,
    travelMode: google.maps.TravelMode.BICYCLING
  }, function(response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      directionsDisplay.setDirections(response);
    } else {
      window.alert('Directions request failed due to ' + status);
    }
    
    // Display the estimated route travel time
    var travelTime = directionsDisplay.directions
            .routes[0].legs[0].duration.text;
    document.getElementById('travel-time-estimated').textContent = travelTime;
      
    // Display elevation graph
    displayElevationGraph(directionsDisplay.directions.routes[0].legs[0].steps);
  });
}

/**
 * Calculate the path for elevation and draw a chart showing elevation
 * variations in the UI.
 *
 * @param route The trip to display
 */
function displayElevationGraph(route) {
  elevator = new google.maps.ElevationService;
    
  var path = [];
  for (var i=0; i < route.length; i++) {
      path.push.apply(path, route[i].path);
  }
    
  // Create a PathElevationRequest object using this array.
  // Ask for 256 samples along that path.
  // Initiate the path request.
  elevator.getElevationAlongPath({
    'path': path,
    'samples': 128
  }, plotElevation);
}

// Takes an array of ElevationResult objects, draws the path on the map
// and plots the elevation profile on a Visualization API ColumnChart.
// Source: https://developers.google.com/maps/documentation/
//          javascript/examples/elevation-paths
function plotElevation(elevations, status) {
  var chartDiv = document.getElementById('trip-elevation-graph');
  if (status !== google.maps.ElevationStatus.OK) {
    // Show the error code inside the chartDiv.
    chartDiv.innerHTML = 'Cannot show elevation: request failed because ' +
        status;
    return;
  }
  // Create the chart element in the pre-assigned div.
  var chart = new google.visualization.ColumnChart(chartDiv);

  // Convert the data into a chart-readable format.
  var data = new google.visualization.DataTable();
  data.addColumn('string', 'Sample');
  data.addColumn('number', 'Elevation');
  for (var i = 0; i < elevations.length; i++) {
    data.addRow(['', elevations[i].elevation]);
  }

  // Draw the chart in its pre-assigned DOM element.
  chart.draw(data, {
    colors: ['#8EDD65'],
    height: 250,
    legend: 'none',
    titleX: 'Position Along Route (%)',
    titleY: 'Elevation (m)'
  });
}