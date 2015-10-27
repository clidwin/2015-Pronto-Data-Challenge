// Copyright (C) Christina Lidwin 2015.

// Data Tables
var stationTable, tripDataTable;

// Coordinates for the largest latitude and smallest longitude.
var topLeft;

// Coordinates for the smallest latitude and largest longitude.
var bottomRight;

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
  
  // Initial Canvas Settings
  createCanvas(printWidth, printHeight);
  background(50, 0, 85, 100);
  
  // Set Bounding Variables
  calculateBoundaries();
}

/**
 * Content to be executed multiple times/drawn on the screen.
 * This function executes continuously after setup has completed.
 * TODO(clidwin): Reduce the amount of calls made in draw.
 */
function draw() {
  var xDivisor = calcScaleFactor(bottomRight.x, topLeft.x, printWidth);
  var yDivisor = calcScaleFactor(bottomRight.y, topLeft.y, printHeight);
  
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
    if (toRow === null) {
      // The end terminal was "pronto shop", location unknown
      toRow = fromRow;
    } else if (fromRow === null) {
      // The start terminal was "pronto shop", location unknown
      fromRow = toRow;
    }
    
    // Get the latitudes from the trip stationIds
    var fromX = fromRow.get("lat");
    var toX = toRow.get("lat");
    
    // Get the longitudes from the trip stationIds
    var fromY = fromRow.get("long");
    var toY = toRow.get("long");
    
    // Calculate Canvas Coordinates
    var fromPoint = createVector(
      abs(fromX - topLeft.x)*xDivisor,
      abs(fromY - bottomRight.y)*yDivisor,
      0
    );
    var toPoint = createVector(
      abs(toX - topLeft.x)*xDivisor,
      abs(toY - bottomRight.y)*yDivisor,
      0
    );
    
    // Draw Points and Paths
    stroke(0);
    line(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y);
    point(printWidth - fromPoint.x, fromPoint.y);
    point(printWidth - toPoint.x, 600-toPoint.y);
  }
}

/**
 * Creates a multiplier to scale data points to the canvas size.
 * 
 * @param minDimension The minimum GPS representation to be used
 * @param maxDimension The maximum GPS representation to be used
 * @param pixelDimension The maximum number of pixels to be used
 * 
 * @returns a float representation of the relationship 
 *    between GPS and pixel coordinates
 */
function calcScaleFactor(minDimension, maxDimension, pixelDimension) {
  var scaleFactor = abs(maxDimension - minDimension);
  return pixelDimension/scaleFactor;
}

/**
 * Calculates the top left and bottom right coordinates
 * of the visible map area. 
 * 
 * This includes a border around the data.
 */
function calculateBoundaries() {
  // Set initial corners to the first data point in the table.
  bottomRight = new p5.Vector(
    stationTable.getNum(1, "lat"),
    stationTable.getNum(1, "long"), 
    0 /* z coordinate will not be used */
  );
  
  topLeft = new p5.Vector(
    stationTable.getNum(1, "lat"),
    stationTable.getNum(1, "long"), 
    0 /* z coordinate will not be used */
  );
  
  // Skip Row 0 because it contains the header text
  // and Row 1 because it was used above.
  for (var i=2; i < stationTable.getRowCount(); i++) {
    // Handle Latitude
    var latitude = stationTable.get(i, "lat");
    if (latitude < bottomRight.x) {
      bottomRight.set(latitude, bottomRight.y, 0);
    } else if (latitude > topLeft.x) {
      topLeft.set(latitude, topLeft.y, 0);
    }
    
    // Handle Longitude
    var longitude = stationTable.get(i, "long");
    if (longitude < bottomRight.y) {
      bottomRight.set(bottomRight.x, longitude, 0);
    } else if (longitude > topLeft.y) {
      topLeft.set(topLeft.x, longitude, 0);
    }
  }
  
  // Apply border to data points
  //TODO(clidwin): Add border so none of the data points are off the canvas.
  var border = 0.0001; // This puts a "border" of about 1 street around the data points
  //topLeft.add(0.0001, -0.0001, 0);
  //bottomRight.add(-0.0001, 0.0001, 0);
}