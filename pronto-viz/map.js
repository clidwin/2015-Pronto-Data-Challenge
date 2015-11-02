function initMap() {
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
        stylers: [{color: '#003B49'}]
      },
    ], {
      name: 'Pronto Style'
  });
  var customMapTypeId = 'pronto_style';

  var map = new google.maps.Map(document.getElementById('map-underlay'), {
    zoom: 14,
    center: {lat: 47.6097, lng: -122.3331},  // Seattle.
    mapTypeControlOptions: {
      mapTypeIds: [google.maps.MapTypeId.ROADMAP, customMapTypeId]
    }
  });
  
  var layer = new google.maps.FusionTablesLayer({
    query: {
      select: 'lat',
      from: '12mjOjVktZlJ6dTsFEC3_OVJYWCizYdE4o5XGQpPo'
    },
    styles: [{
      markerOptions: {
        iconName: "measle_turquoise" //cycling option for animations
      }
    }]
  });

  //TODO(clidwin): Animate trip data using the cycle marker
  //TODO(clidwin): Format station information
  map.mapTypes.set(customMapTypeId, customMapType);
  map.setMapTypeId(customMapTypeId);
  layer.setMap(map);
}