var nextbus = require('.');
var ru = nextbus.client();
console.log("Going to request agency");
ru.cacheAgency("rutgers", 40.4, 40.6, function(err) {
  console.log("Got agency");
  var routeStops = [
    {routeTag: "b", stop: "Hill Center"},
  ];
  ru.customPredict(routeStops, function(err, data) {
    console.log("got custom predict");
    console.log(err);
    console.log(data);
  });
});