// Copyright (C) Christina Lidwin 2015.

// Data Tables
var stationTable, tripDataTable;

// Coordinates for the largest latitude and longitude.
var topRight;

// Coordinates for the smallest latitude and longitude.
var bottomLeft;

//TODO(clidwin): Make dimensions full-screen
var printWidth = 600;
var printHeight = 600;

/**
 * Content to be located asynchronously prior to main/continuous functions.
 * This function only executes once and before setup().
 */
function preload() {
  stationTable = loadTable("csv_src/2015_station_data.csv", "csv", "header");
  tripDataTable = loadTable("csv_src/2015_trip_data.csv", "csv", "header");
}

/**
 * Initializations for the drawing environment. 
 * This function only executes once and before draw().
 */
function setup() {
  // Environment Settings
  colorMode(HSB, 360, 100, 100, 100);
  angleMode(DEGREES);
  
  // Initial Canvas Settings
  createCanvas(printWidth, printHeight);
  //background(50, 0, 85, 100);
  
  // Set Bounding Variables
  calculateBoundaries();
}

/**
 * Content to be executed multiple times/drawn on the screen.
 * This function executes continuously after setup has completed.
 */
function draw() {
  // Rotates the canvas drawing area to match the orientation of a map.
  translate(printWidth, printHeight);
  rotate(180);
  
  // Draw the static.
  //drawAllTrips();
  //drawStations();
  
  // Do not iterate.
  noLoop();
}

function drawStations() {
  // Skip Row 0 because it contains the header text
  for (var i=1; i < stationTable.getRowCount(); i++) {
    var x = mapLongValue(stationTable.getNum(i, "long"));
    var y = mapLatValue(stationTable.getNum(i, "lat"));
    
    strokeWeight(6);
    stroke(0);
    point(x, y);
  }
}

function drawAllTrips() {
  // Skip Row 0 because it contains the header text
  for (var i=1; i < tripDataTable.getRowCount(); i++) {
    // Get the trip stationIds
    var fromId = tripDataTable.get(i, "from_station_id");
    var toId = tripDataTable.get(i, "to_station_id");
    if (fromId === null || toId === null) {
      continue;
    }
    
    var fromRow = stationTable.matchRow(fromId, "terminal");
    var toRow = stationTable.matchRow(toId, "terminal");
    if (toRow === null || fromRow === null) {
      // The terminal was "pronto shop", location unknown, so we won't map it
      continue;
    }
    
    // Get the latitudes from the trip stationIds
    var fromLat = mapLatValue(fromRow.get("lat"));
    var toLat = mapLatValue(toRow.get("lat"));
    
    // Get the longitudes from the trip stationIds
    var fromLong = mapLongValue(fromRow.get("long"));
    var toLong = mapLongValue(toRow.get("long"));
    
    // Draw Points and Paths
    stroke(100, 54, 87, 25); // Pronto green
    strokeWeight(2);
    line(fromLong, fromLat, toLong, toLat);
    strokeWeight(4);
    point(fromLong, fromLat);
    point(toLong, toLat);
  }
}

/**
 * Converts a GPS latitude number into a canvas x-dimension.
 * 
 * @param value The GPS coordinate to be converted.
 */
function mapLatValue(value) {
  return map(value, bottomLeft.y, topRight.y, 0, printHeight);
}

/**
 * Converts a GPS longitude number into a canvas y-dimension.
 * 
 * @param value The GPS coordinate to be converted.
 */
function mapLongValue(value) {
  return map(value, bottomLeft.x, topRight.x, 0, printWidth);
}

/**
 * Calculates the top left and bottom right coordinates
 * of the visible map area. 
 * 
 * This includes a border around the data.
 */
function calculateBoundaries() {
  // Set initial corners to the first data point in the table.
  bottomLeft = new p5.Vector(
    stationTable.getNum(1, "long"), 
    stationTable.getNum(1, "lat"),
    0 /* z coordinate will not be used */
  );
  topRight = bottomLeft.copy();
  
  // Skip Row 0 because it contains the header text
  // and Row 1 because it was used above.
  for (var i=2; i < stationTable.getRowCount(); i++) {
    // Handle Longitude (x piece of coordinate)
    var longitude = stationTable.get(i, "long");
    if (longitude < bottomLeft.x) {
      bottomLeft.set(longitude, bottomLeft.y, 0);
    } else if (longitude > topRight.x) {
      topRight.set(longitude, topRight.y, 0);
    }
    
    // Handle Latitude (y piece of coordinate)
    var latitude = stationTable.get(i, "lat");
    if (latitude < bottomLeft.y) {
      bottomLeft.set(bottomLeft.x, latitude, 0);
    } else if (latitude > topRight.y) {
      topRight.set(topRight.x, latitude, 0);
    }
  }
  
  // Apply border to data points
  //TODO(clidwin): Add border so none of the data points are off the canvas.
  var border = 0.0001; // This puts a "border" of about 1 street around the data points
  //topRight.add(0.0001, -0.0001, 0);
  //bottomLeft.add(-0.0001, 0.0001, 0);
  //print(bottomLeft);
  //print(topRight);
}