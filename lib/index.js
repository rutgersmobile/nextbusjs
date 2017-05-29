const xmldom = require('xmldom');
const axios = require('axios');
const geohash = require('./geohash'); // geohashing lib
const DOMParser = require('xmldom').DOMParser;

const xmlparse = function(data, callback) {
  try {
    const doc = new DOMParser().parseFromString(data);
    callback(null, { document: doc });
  } catch (e) {
    callback(e, null);
  }
};

const request = (url, cb) => {
  axios.get(url)
    .then((response) => {
      cb(null, response, response.data);
    })
    .catch((err) => {
      cb(err, null, null);
    });
};

/*
   Class: nextbus
   Allows easy querying of the Nextbus public xml feed for predictions.  The
   <cacheAgency> function grabs the route and stop configuration from nextbus
   and caches it.  This is a very large file, and as such, the process takes a
   few seconds.  Every time a query is run, the query string is cached
   internally.  

   The agency cache can be retrieved with the <getAgencyCache> function; it can
   then be stored or sent to a client.  It can be reloaded with the
   <setAgencyCache> function.

   This is a commonjs module which exports a single function, 'client'.  This
   function constructs a nextbus client for your use.

   Example:
      (start code)
      var nextbus = require('nextbusjs').client;
          rutgers = nextbus();

      rutgers.cacheAgency('rutgers', function (err) {
         if (err) {
            throw err;
         } else {
            rutgers.routePredict('a', null, function (err, data) {
               // data will contain:
               [ { title: 'Scott Hall',
                   predictions: [ '8', '19', '31', '43', '54' ] },
                 { title: 'Student Activities Center',
                   predictions: [ '12', '23', '35', '47', '58' ] },
                 { title: 'Visitor Center',
                   predictions: [ '3', '16', '27', '39', '51' ] },
                 { title: 'Stadium',
                   predictions: [ '4', '17', '28', '40', '52' ] },
                 { title: 'Werblin Back Entrance',
                   predictions: [ '6', '19', '30', '42', '54' ] },
                 { title: 'Hill Center',
                   predictions: [ '7', '20', '31', '43', '55' ] },
                 { title: 'Science Building',
                   predictions: [ '8', '22', '33', '45', '57' ] },
                 { title: 'Library of Science',
                   predictions: [ '10', '23', '34', '46', '58' ] },
                 { title: 'Busch Suites',
                   predictions: [ '1', '12', '25', '36', '48' ] },
                 { title: 'Busch Campus Center',
                   predictions: [ '2', '13', '27', '38', '50' ] },
                 { title: 'Buell Apartments',
                   predictions: [ '4', '15', '28', '39', '51' ] },
                 { title: 'Werblin Main Entrance',
                   predictions: [ '5', '16', '29', '40', '52' ] },
                 { title: 'Rutgers Student Center',
                   predictions: [ '10', '21', '34', '45', '57' ] } ]
            }, 'minutes');

            rutgers.stopPredict('Hill Center', null, function (err, data) {
               // data will contain: 
               [ { direction: 'To Busch Student Center',
                   title: 'A',
                   predictions: [ '7', '20', '31', '43', '55' ] },
                 { direction: 'To Busch Student Center',
                   title: 'B',
                   predictions: [ '8', '16', '22', '30', '38' ] },
                 { direction: 'To Allison Road Classrooms',
                   title: 'C',
                   predictions: null },
                 { direction: 'To Allison Road Classrooms',
                   title: 'REX B',
                   predictions: [ '6', '20', '23', '35', '47' ] },
                 { direction: 'To Livingston Student Center',
                   title: 'All Campuses',
                   predictions: null },
                 { direction: 'To Livingston Student Center',
                   title: 'Weekend 1',
                   predictions: null },
                 { direction: 'To Stadium West Lot',
                   title: 'C',
                   predictions: null },
                 { direction: 'To Rutgers Student Center',
                   title: 'H',
                   predictions: [ '1', '13', '24', '36', '48' ] },
                 { direction: 'To College Hall',
                   title: 'REX B',
                   predictions: [ '0', '12', '24', '35', '47' ] },
                 { direction: 'To Rutgers Student Center',
                   title: 'Weekend 2',
                   predictions: null } ]
            }, 'minutes');

            var nearest = rutgers.closestStops(40.40264, -74.3840120);
            //{ 'Rutgers Student Center': 7,
            //  'Student Activities Center': 6,
            //  'Scott Hall': 5 }
         }
      });
      (end)
*/

function client() {
  "use strict";
  var exports = {},
    agencyData = {},
    agency = null,
    baseURL = "http://webservices.nextbus.com/service/publicXMLFeed?command=",
    isAgencyCached = false,
    vehicleLastTime = null,
    activeExpireTime;

  /*
      Group: Public Functions

      Function: routePredict
      Returns an array of predictions for a particular route in a particular
      direction.  Prediction objects contain a title and a predictions array.

      Parameters:
         route     - *string* route to return predictions for
         direction - *string* direction to return predictions for, can be null
         cb        - *function (err, data)* called with results
         units     - *string* 'minutes', 'seconds', or 'both'.  Defaults to
                     minutes.  If 'both', the return predictions will be an
                     object with 'minutes' and 'seconds' properties.

      Returns:
         Object mapping stop names to arrays of strings.

      Example:
         > nextbus.routePredict('a', null, callback);

         (start code)
         [ { title: 'Scott Hall',
             predictions: [ '8', '19', '31', '43', '54' ] },
           { title: 'Student Activities Center',
             predictions: [ '12', '23', '35', '47', '58' ] },
           { title: 'Visitor Center',
             predictions: [ '3', '16', '27', '39', '51' ] },
           { title: 'Stadium',
             predictions: [ '4', '17', '28', '40', '52' ] },
           { title: 'Werblin Back Entrance',
             predictions: [ '6', '19', '30', '42', '54' ] },
           { title: 'Hill Center',
             predictions: [ '7', '20', '31', '43', '55' ] },
           { title: 'Science Building',
             predictions: [ '8', '22', '33', '45', '57' ] },
           { title: 'Library of Science',
             predictions: [ '10', '23', '34', '46', '58' ] },
           { title: 'Busch Suites',
             predictions: [ '1', '12', '25', '36', '48' ] },
           { title: 'Busch Campus Center',
             predictions: [ '2', '13', '27', '38', '50' ] },
           { title: 'Buell Apartments',
             predictions: [ '4', '15', '28', '39', '51' ] },
           { title: 'Werblin Main Entrance',
             predictions: [ '5', '16', '29', '40', '52' ] },
           { title: 'Rutgers Student Center',
             predictions: [ '10', '21', '34', '45', '57' ] } ]
         (end)
   */

  function routePredict(route, direction, cb, units) {
    var routeData, str = "", stops;

    // default to minutes
    units = units || "minutes";

    if (direction === null) {
      // direction is the string 'null' because its whats actually passed to
      // nextbus when we do predictionsForMultiStops
      direction = "null";
    }

    if (!isAgencyCached) {
      cb({ name: "nocache", message: "no agency cache" }, null);
      return;
    }

    routeData = agencyData.routes[route];
    if (routeData === undefined) {
      cb({ name: "noroute", message: "route not found" }, null);
      return;
    }
    if (routeData.queries[direction] === undefined) {
      // There's no query string, we'll have to build one.
      stops = routeData.stops;
      stops.forEach(function(stop) {
        str += "&stops=" + route + "|" + direction + "|" + stop;
      });
      routeData.queries[direction] = str;
    }

    if (routeData.sorter === undefined) {
      // This is a reverse mapping of tags to numbers that can be used
      // to sort the data returned from nextbus, since this is now apparently
      // necessary.
      routeData.sorter = routeData.stops.reduce(function(memo, item, index) {
        memo[item] = index;
        return memo;
      }, {});
    }

    query("predictionsForMultiStops", routeData.queries[direction], function(
      err,
      response
    ) {
      var stop, ret = [], item, j, i, data, currIndex;

      try {
        if (err) {
          throw err;
        }

        data = response.document.getElementsByTagName("predictions");

        if (data.length === 0) {
          var e = new Error("response is invalid, data.length = 0");
          e.name = "ParseError";
          e.detail = "zero length data";
          e.data = response;
          throw e;
        }

        for (i = 0; i < data.length; i++) {
          stop = data.item(i).getAttribute("stopTitle");
          var stopTag = data.item(i).getAttribute("stopTag");
          // push a new object onto the return
          ret.push({
            title: stop,
            predictions: [],
            tag: stopTag
          });

          currIndex = ret.length - 1;
          item = data.item(i).getElementsByTagName("prediction");
          // in Titanium, getElementsByTagName returns undefined if there
          // are no tags by that name.  In node (with jsdom), it returns
          // an empty nodelist.
          if (item === null) {
            ret[currIndex].predictions = null;
            continue;
          }

          for (j = 0; j < item.length; j++) {
            if (direction !== "null") {
              // if we were given a direction as input, but the
              // prediction we're looking at isn't in that direction,
              // ignore it
              if (direction !== item.item(j).getAttribute("dirTag")) {
                continue;
              }
            }

            if (units !== "both") {
              ret[currIndex].predictions.push(item.item(j).getAttribute(units));
            } else {
              ret[currIndex].predictions.push({
                minutes: item.item(j).getAttribute("minutes"),
                seconds: item.item(j).getAttribute("seconds")
              });
            }
          }

          // if there are no predictions, map the route identifier to null
          // this is for jsdom.  in titanium
          // getElementsByTagName('prediction') will return undefined if
          // there are no prediction tags.
          if (ret[currIndex].predictions.length === 0) {
            ret[currIndex].predictions = null;
          }
        }
        ret = ret.sort(function(a, b) {
          return routeData.sorter[a.tag] - routeData.sorter[b.tag];
        });
        cb(null, ret);
      } catch (e) {
        cb(e, null);
        return;
      } finally {
        // if we're not in titanium, we're in node, and we just used
        // jsdom for parsing.  If we don't call window.close(), jsdom
        // will leak an enormous amount of memory.
        typeof response.close == "function" && response.close();
      }
    });
  }

  /*
      Function: stopPredict
      Calls a callback function with an object mapping input stops to
      arrays of predictions.  The predictions will be strings, not Numbers,
      as this data is usually intended for display as strings.  If a particular
      route isn't currently running, null will be returned.  If no agency data
      is cached, the callback function will be called with an error.

      Parameters:
         stop        - *string* route tag or route title
         direction   - *string* direction tag, can be null
         cb          - *function (err, data)* callback function
         units       - *string* 'minutes', 'seconds', or 'both'.  Defaults to
                       minutes.  If 'both', the return predictions will be an
                       object with 'minutes' and 'seconds' properties.

      Example:
         > nextbus.stopPredict('Hill Center', null, callback);

         Will provide callback with an object resembling
         (start code)
         [ { direction: 'To Busch Student Center',
             title: 'A',
             predictions: [ '7', '20', '31', '43', '55' ] },
           { direction: 'To Busch Student Center',
             title: 'B',
             predictions: [ '8', '16', '22', '30', '38' ] },
           { direction: 'To Allison Road Classrooms',
             title: 'C',
             predictions: null },
           { direction: 'To Allison Road Classrooms',
             title: 'REX B',
             predictions: [ '6', '20', '23', '35', '47' ] },
           { direction: 'To Livingston Student Center',
             title: 'All Campuses',
             predictions: null },
           { direction: 'To Livingston Student Center',
             title: 'Weekend 1',
             predictions: null },
           { direction: 'To Stadium West Lot',
             title: 'C',
             predictions: null },
           { direction: 'To Rutgers Student Center',
             title: 'H',
             predictions: [ '1', '13', '24', '36', '48' ] },
           { direction: 'To College Hall',
             title: 'REX B',
             predictions: [ '0', '12', '24', '35', '47' ] },
           { direction: 'To Rutgers Student Center',
             title: 'Weekend 2',
             predictions: null } ]
         (end)
   */

  function stopPredict(stop, direction, cb, units) {
    var tags = [], str = "", queryprops = {}, stopData, inputType = "";

    units = units || "minutes";

    if (direction === null) {
      direction = "null";
    }

    if (!isAgencyCached) {
      cb({ name: "nocache", message: "no agency cache" }, null);
      return;
    }

    if (agencyData.stops[stop] !== undefined) {
      stopData = agencyData.stops[stop];
      inputType = "tag";
      // We mark the input type so that we can return using the same
      // format.
    } else if (
      agencyData.stopsByTitle &&
      agencyData.stopsByTitle[stop] !== undefined
    ) {
      stopData = agencyData.stopsByTitle[stop];
      inputType = "title";
    } else {
      cb(new Error("stop not found"), null);
      return;
    }

    if (stopData.queries[direction] === undefined) {
      // Well, there's no query string, so we'll have to make one.
      if (inputType === "title") {
        tags = stopData.tags;
      } else {
        tags = [stop];
      }
      tags.forEach(function(tag) {
        var routes = agencyData.stops[tag].routes;
        routes.forEach(function(route) {
          // now tag contains a stoptag and route contains a routetag
          // combine them and add to query string
          str += "&stops=" + route + "|" + direction + "|" + tag;
        });
      });
      stopData.queries[direction] = str;
    }

    query("predictionsForMultiStops", stopData.queries[direction], function(
      err,
      response
    ) {
      var i,
        j,
        item,
        prediction,
        ret = [],
        route,
        data,
        currIndex,
        currDirection,
        currDirectionNodes;

      try {
        if (err) {
          throw err;
        }

        data = response.document.getElementsByTagName("predictions");

        if (data.length === 0) {
          var e = new Error("response is invalid");
          e.name = "ParseError";
          e.detail = "zero length data";
          throw e;
        }

        for (i = 0; i < data.length; i++) {
          // getAttribute input type may get the title, if the user gave
          // us a title to lookup
          route = data.item(i).getAttribute("routeTitle");
          currDirectionNodes = data.item(i).getElementsByTagName("direction");
          currDirection = null;
          // currDirectionNodes will be null in Titanium if there are no
          // direction nodes, in jsdom it will have length 0
          if (currDirectionNodes === null) {
            // correct titanium error in dom implementation
            currDirectionNodes = { length: 0 };
          }
          if (currDirectionNodes.length !== 0) {
            currDirection = currDirectionNodes.item(0).getAttribute("title");
          } else {
            currDirection = data
              .item(i)
              .getAttribute("dirTitleBecauseNoPrediction");
          }
          ret.push({
            direction: currDirection,
            title: route,
            predictions: []
          });
          currIndex = ret.length - 1;
          item = data.item(i).getElementsByTagName("prediction");
          // see the notes in routePredict about item === null
          if (item === null) {
            ret[currIndex].predictions = null;
            continue;
          }
          for (j = 0; j < item.length; j++) {
            /*
                  if (direction !== 'null') {
                     if (direction !== item.item(j).getAttribute('dirtag')) {
                        continue;
                     }
                  }*/

            if (units !== "both") {
              ret[currIndex].predictions.push(item.item(j).getAttribute(units));
            } else {
              ret[currIndex].predictions.push({
                minutes: item.item(j).getAttribute("minutes"),
                seconds: item.item(j).getAttribute("seconds")
              });
            }
          }
          // if there are no predictions, map the route identifier to null
          if (ret[currIndex].predictions.length === 0) {
            ret[currIndex].predictions = null;
          }
        }

        // we're done now, call the callback
        cb(null, ret);
      } catch (e) {
        cb(e, null);
      } finally {
        // if we're not in titanium, we're in node, and we just used
        // jsdom for parsing.  If we don't call window.close(), jsdom
        // will leak an enormous amount of memory.
        typeof response.close == "function" && response.close();
      }
    });
  }

  /**
   * A custom prediction query
   * @param {[{route: string, stop: string}]} routeStops
   * @param {function(err,data)} cb
   */
  function customPredict(routeStops, cb) {
    if (!isAgencyCached) {
      cb({ name: "nocache", message: "no agency cache" }, null);
      return;
    }

    var queryData = routeStops.map((item) => {
      const route = item.route;
      const stop = item.stop;
      let routeTag, stopTags;

      // check stop
      if (agencyData.stops[stop] !== undefined) {
        stopTags = [stop];
      } else if (agencyData.stopsByTitle[stop] !== undefined) {
        stopTags = agencyData.stopsByTitle[stop].tags;
      } else {
        console.log("stop '" + stop + "' not found");
        return null;
      }
      // check route
      if (agencyData.routes[route] !== undefined) {
        routeTag = route;
      } else if (agencyData.routesByTitle[route] !== undefined) {
        routeTag = agencyData.routesByTitle[route].tag;
      } else {
        console.log("route '" + route + "' not found");
        return null;
      }
      const routeStopTags = agencyData.routes[routeTag].stops;
      return stopTags
        .filter((tag) => routeStopTags.includes(tag))
        .map((tag) => {
          return {
            routeTag: routeTag,
            direction: null,
            stopTag: tag,
          };
        });
    });
    // clear empty items
    queryData = queryData.filter(item => item ? true : false);

    // flatten array
    const flatten = arr => arr.reduce(
      (acc, val) => acc.concat(
        Array.isArray(val) ? flatten(val) : val
      ),
      []
    );
    queryData = flatten(queryData);

    var str = queryData.reduce((acc, val) => {
      return acc + "&stops=" + val.routeTag + "|" + val.direction + "|" + val.stopTag;
    }, "");

    console.log("url params: " + str);

    if (queryData.length == 0) {
      cb({ name: "emptyquery", message: "No data to query for given routeStops"});
      return;
    }

    query("predictionsForMultiStops", str, (error, response) => {
      try {
        if (error) {
          throw error;
        }
        let predictionContainers = response.document.getElementsByTagName("predictions");

        if (predictionContainers.length === 0) {
          let e = new Error("response has no 'predictions' elements");
          e.name = "ParseError";
          e.detail = "zero length data";
          e.data = response;
          throw e;
        }

        const predictions = Array.from(predictionContainers)
          .map((predictionContainer) => {
            const routeTitle = predictionContainer.getAttribute("routeTitle");
            const stopTitle = predictionContainer.getAttribute("stopTitle");
            let predictionsByDirection = Array.from(predictionContainer.getElementsByTagName("direction"))
              .map((directionNode) => {
                const directionTitle = directionNode.getAttribute("title");
                const predictions = Array.from(directionNode.getElementsByTagName("prediction"))
                  .map((predictionNode) => {
                    const minutes = predictionNode.getAttribute("minutes");
                    const seconds = predictionNode.getAttribute("seconds");
                    return {
                      minutes: minutes,
                      seconds: seconds
                    };
                  });
                return {
                  direction: directionTitle,
                  predictions: predictions
                };
              });
            if (predictionContainer.getElementsByTagName('direction').length == 0) {
              predictionsByDirection = [{
                direction: predictionContainer.getAttribute('dirTitleBecauseNoPredictions'),
                predictions: []
              }]
            }
            return predictionsByDirection
              .map((predictionByDir) => {
                return {
                  routeTitle: routeTitle,
                  stopTitle: stopTitle,
                  direction: predictionByDir.direction,
                  predictions: predictionByDir.predictions
                }
              });
          });

        cb(null, flatten(predictions));
      } catch (e) {
        cb(e, null);
      } finally {
        // if we're not in titanium, we're in node, and we just used
        // jsdom for parsing.  If we don't call window.close(), jsdom
        // will leak an enormous amount of memory.
        typeof response.close == "function" && response.close();
      }
    });
  }

  /*
      Function: closestStops
      Finds closest stops to a particular lat and lon.  Will use only active
      stops if that information has been retrieved

      Parameters:
         lat      - *Number* latitude
         lon      - *Number* longitutde
         num      - *Number* number of stops to return
         accuracy - *Number* # of accuracy characters in the geohash, defaults to 8
   */
  function closestStops(lat, lon, num, accuracy) {
    num = num || 3; // default to 3
    var loc = geohash.encode(lat, lon), nearest, stops, oldData, d;

    if (isActiveDataFresh()) {
      stops = agencyData.active.stops;
    } else {
      stops = agencyData.sortedStops;
    }
    nearest = geohash.nearest(loc, stops, num, accuracy);
    return nearest;
  }

  /*
      Function: cacheAgency
      Load the agency data.  Somewhat slow as this is often a huge file.  
      Also geohashes each lat and lon for easy closest stop calculation.  
      Also builds an object indexed by stop titles so stops with identical
      titles but different tags can be treated as a single stop.

      Parameters:
         agency      - *string* name of the agency to cache]
         callback    - *function (err)* called when the process is complete
   */
  function cacheAgency(name, lower_bound, upper_bound, callback) {
    var out = {};
    if (typeof name !== "string") {
      callback({ name: "TypeError", message: "agency must be a string" }, null);
      return;
    }
    if (typeof callback !== "function") {
      return { name: "TypeError", message: "callback must be a function" };
    }
    out.routes = {};
    out.stops = {};
    agency = name;

    // actually run the query
    query("routeConfig", "&terse", function(err, data) {
      var i, j, route, routes, stop, stops, dirs;

      try {
        if (err) {
          throw err;
        }

        routes = data.document.getElementsByTagName("route");

        for (i = 0; i < routes.length; i++) {
          route = routes.item(i).getAttribute("tag");

          //setup the route object
          out.routes[route] = {
            queries: {},
            stops: [],
            directions: [],
            title: routes.item(i).getAttribute("title"),
            tag: route
          };
          stops = routes.item(i).getElementsByTagName("stop");

          for (j = 0; j < stops.length; j++) {
            // if the title is null, this is the stop as listed in the direction
            // section.  we need the title (and other stuff too) so this node is
            // useless
            if (stops.item(j).getAttribute("title") === "") {
              continue;
            }
            stop = stops.item(j).getAttribute("tag");

            // If we already saw this stop, continue
            if (out.routes[route].stops.indexOf(stop) !== -1) continue;

            // If the route has a stop that falls outside of the bounds, don't include the route
            if (
              stops.item(j).getAttribute("lat") < lower_bound ||
              stops.item(j).getAttribute("lat") > upper_bound
            ) {
              delete out.routes[route];
              break;
            }

            // initialize to defaults values.  if this stop in out.stops
            // is already set this does nothing, otherwise it sets intial values.
            out.stops[stop] = out.stops[stop] || {
              routes: [],
              queries: {},
              title: stops.item(j).getAttribute("title"),
              lat: stops.item(j).getAttribute("lat"),
              lon: stops.item(j).getAttribute("lon")
            };

            out.routes[route].stops.push(stop);
            out.stops[stop].routes.push(route);
            out.stops[stop].stopId =
              stops.item(j).getAttribute("stopId") || undefined;
          }
          if (out.routes[route]) {
            dirs = routes.item(i).getElementsByTagName("direction");
            for (j = 0; j < dirs.length; j++) {
              out.routes[route].directions.push({
                title: dirs.item(j).getAttribute("title"),
                tag: dirs.item(j).getAttribute("tag")
              });
            }
          }
        }

        agencyData = out;
        isAgencyCached = true;

        // combine like stop names
        combineStops();

        agencyData.routesByTitle = {};
        for (const key in agencyData.routes) {
          agencyData.routesByTitle[agencyData.routes[key].title] = agencyData.routes[key];
        }

        // created sorted lists of stops
        sort();
        callback(null, out);
      } catch (e) {
        callback(e, null);
      }
    });
  }

  /*
      Function: setAgencyCache
      Set the agency cache to a given object.  This is useful if you'd like to
      generate the agency cache only once or load the agency cache from another
      location.

      Parameters:
         data            - *object* agency cache object
         agencyname      - *string* name of the agency
   */
  function setAgencyCache(data, agencyname) {
    agencyData = data;
    agency = agencyname;
    isAgencyCached = true;
  }

  /*
      Function: getAgencyCache
      Get the cached agency data.  This is useful if you'd like to save this cache
      or send it to a client.

      Returns:
         *object* agency cache
   */
  function getAgencyCache() {
    return agencyData;
  }

  function rand(to) {
    return Math.floor(Math.random() * (to + 1));
  }

  /* Function: guessActive
    * Guesses which routes are currently active by running a vehicleLocations
    * query to discover which routes are active.  Then, assumes that
    * every stop on each active route is active, yielding a list of active
    * routes and active stops for this agency.
    *
    * Parameters:
    *    callback    - *function (err, data)* called with results; data.routes
    *                  and data.stops will have alphabetically sorted arrays of
    *                  active routes and stops respectively
    */

  function guessActive(lower_bound, upper_bound, callback) {
    if (!isAgencyCached) {
      callback({ name: "nocache", message: "no agency cache" }, null);
      return;
    }

    // we temporarily use hashes for activeRoutes/Stops, because then we
    // don't have to deal with duplicates.  Once we've gone through
    // everything one time and we have activeRoutes and activeStops
    // completed, we'll loop over these hashes to build the final output
    // hash.

    var activeRoutes = {},
      activeStops = {},
      active = {},
      route,
      i,
      stops,
      len,
      str = "";

    // first, we guess which routes are active.

    // we do this by simply running a vehiclelocations query.  we assume
    // any routes that have buses running are active
    vehicleLocations(lower_bound, upper_bound, null, function(err, response) {
      if (err) {
        callback(err, null);
        return;
      }
      var i, item, route, data, stop;
      // our response will be an object mapping routes to vehicles.  we dont
      // care about the values, but the keys tell us exactly which routes are
      // active.
      activeRoutes = response;
      // second, we use our route guesses to mark the stops as active
      active.time = new Date().getTime();
      active.routes = [];
      active.stops = [];
      if (!activeRoutes) {
        callback(null, active);
        return;
      }
      // loop over the active routes
      for (route in activeRoutes) {
        if (activeRoutes.hasOwnProperty(route)) {
          // add to the final output
          active.routes.push({
            tag: route,
            title: agencyData.routes[route].title
          });
          for (i = 0; i < agencyData.routes[route].stops.length; i++) {
            // add each stop of current route to active stops list
            stop = agencyData.routes[route].stops[i];
            activeStops[agencyData.stops[stop].title] = true;
          }
        }
      }

      // lastly, we build the final return data
      for (stop in activeStops) {
        if (activeStops.hasOwnProperty(stop)) {
          active.stops.push({
            title: stop,
            geoHash: agencyData.stopsByTitle[stop].geoHash
          });
        }
      }

      // sort the active routes & stops
      active.routes.sort(function(a, b) {
        return a.title.localeCompare(b.title);
      });
      active.stops.sort(function(a, b) {
        return a.title.localeCompare(b.title);
      });

      agencyData.active = active;

      callback(null, active);
    });
  }

  /* Function: setActive
    * Sets the active info, if retrieved from another nextbusjs client
    *
    * Parameters:
    *    active      - *object* active stops and routes
    */

  function setActive(active) {
    agencyData.active = active;
  }

  /* Function: vehicleLocations
    * Runs a vehicleLocations query against nextbus.  Can optionally filter to
    * a particular route.  By default, this command will return only the
    * vehicles which are in a different location since the last call to the
    * function (ie, lastTime is handled).  This can be overridden by passing
    * true as the final argument.
    *
    * Parameters:
    *    route       - *string* routeTag to use in the query.  Will only return
    *                  vehicles in this route.  If null is passed, will return
    *                  all vehicles.
    *    callback    - *function (err, data)* to be called with the return data
    *    resetTime   - *boolean* if truthy, will ignore lastTime and run the
    *                  query without the 't' parameter.  This will return buses
    *                  which have moved in the last 15 minutes.  If falsy, will
    *                  use the last time the function was called for lastTime.
    *
    * Callback return:
    *    err         - *error* object, if one occurred.
    *    data        - *object* mapping routes to arrays
    *    data[route] - *array* of vehicles for this route
    *    data[route][i][id] - *string* vehicle id number
    *    data[route][i][direction] - *string* direction tag
    *    data[route][i][lat] - *string* latitude, float as string
    *    data[route][i][lon] - *string* longitude, float as string
    *    data[route][i][since] - *string* seconds since the query was run
    *    data[route][i][predictable] - *boolean* whether the vehicle is
    *                                  predictable. not sure what this means,
    *                                  but it's returned by the api, so its
    *                                  here for consistency
    *    data[route][i][heading] - *string* heading
    *    data[route][i][speed]   - *string* speed in km/h
    */

  function vehicleLocations(
    lower_bound,
    upper_bound,
    route,
    callback,
    resetTime
  ) {
    var str = "";
    if (route) {
      str += "&r=" + route;
    }

    if (!resetTime && vehicleLastTime) {
      str += "&t=" + vehicleLastTime;
    }
    query("vehicleLocations", str, function(err, response) {
      var vehicles, vehicle, lastTime, i, result = {}, route, data, current_lat;
      try {
        if (err) {
          throw err;
        }

        vehicles = response.document.getElementsByTagName("vehicle");
        lastTime = response.document.getElementsByTagName("lastTime");

        vehicleLastTime = lastTime.item(0).getAttribute("time");

        for (i = 0; i < vehicles.length; i++) {
          vehicle = vehicles.item(i);
          route = vehicle.getAttribute("routeTag");
          result[route] = result[route] || [];
          current_lat = null;
          current_lat = vehicle.getAttribute("lat");
          if (current_lat >= lower_bound) {
            if (current_lat <= upper_bound) {
              result[route].push({
                id: vehicle.getAttribute("id"),
                dirtag: vehicle.getAttribute("dirtag"),
                lat: current_lat,
                lon: vehicle.getAttribute("lon"),
                predictable: vehicle.getAttribute("predictable") === "true",
                heading: vehicle.getAttribute("heading"),
                since: vehicle.getAttribute("secsSinceReport"),
                speed: vehicle.getAttribute("speedKmHr")
              });
            }
          }
        }
        for (route in result) {
          if (result.hasOwnProperty(route)) {
            if (Object.keys(result[route]).length === 0) {
              delete result[route];
            }
          }
        }

        callback(null, result);
      } catch (e) {
        callback(e, null);
      }
    });
  }

  /* Function: setActiveExpireTime
    * Sets the amount of time it takes for the active information to expire.
    * Default 10 minutes.
    *
    * Parameters:
    *    time     - *number* time in seconds
    */

  function setActiveExpireTime(time) {
    activeExpireTime = time * 1000;
  }

  setActiveExpireTime(600);

  /* Function: getRoutes
    * Gets a sorted list of routes.  If active routes are available, returns
    * those, unless the parameter is true, in which case the full sorted
    * route list is returned regardless of the state of the active data.
    *
    * Parameters:
    *    ignoreActive   - *boolean* whether or not to ignore the active data
    */

  function getRoutes(ignoreActive) {
    if (!ignoreActive && isActiveDataFresh()) {
      return agencyData.active.routes;
    } else {
      return agencyData.sortedRoutes;
    }
  }

  /* Function: getStops
    * Gets a sorted list of stops.  If active stops are available, returns
    * those, unless the parameter is true, in which case the full sorted
    * route list is returned regardless of the state of the active data.
    *
    * Parameters:
    *    ignoreActive   - *boolean* whether or not to ignore the active data
    */

  function getStops(ignoreActive) {
    if (!ignoreActive && isActiveDataFresh()) {
      return agencyData.active.stops;
    } else {
      return agencyData.sortedStops;
    }
  }

  /*
      Group: Private Functions

      Function: query
      Runs a query on the nextbus api.

      Parameters:
         command  - *string* name of the query type to run; can be predictions,
                    predictionsForMultiStops, or routeConfig
         str      - *string* query parameters
         cb       - *function (err, dom)* callback function, provided with xml
                    dom tree received
   */

  function query(command, str, cb) {
    var url = baseURL + command + "&a=" + "rutgers" + str;

    request(url, function(err, response, data) {
      if (err) {
        console.log("error in query request: " + err);
        cb(err, null);
      } else if (response.status != 200) {
        cb(new Error("Bad HTTP response " + response.statusCode), null);
      } else {
        xmlparse(data, function(err, dom) {
          if (err) {
            console.log("error in xmlparse callback: " + err);
            cb(err, null);
          } else {
            cb(null, dom);
          }
        });
      }
    });
  }

  /* Function: isActiveDataFresh
    * Calculates whether the active data is fresh enough for use or not
    *
    * Returns:
    *    *boolean* whether or not the data is fresh for use
    */

  function isActiveDataFresh() {
    if (agencyData.active) {
      var age = new Date().getTime() - Number(agencyData.active.time);
      if (age < activeExpireTime) {
        return true;
      }
    }

    return false;
  }

  /* Function: sort
    * Creates sorted arrays of the stop and route data and adds it to the
    * agency cache.  Run when the agency is cached.
    */

  function sort() {
    var stop, route, sortedStops = [], sortedRoutes = [];

    for (stop in agencyData.stopsByTitle) {
      if (agencyData.stopsByTitle.hasOwnProperty(stop)) {
        sortedStops.push({
          title: stop,
          geoHash: agencyData.stopsByTitle[stop].geoHash
        });
      }
    }

    for (route in agencyData.routes) {
      if (agencyData.routes.hasOwnProperty(route)) {
        sortedRoutes.push({
          tag: route,
          title: agencyData.routes[route].title
        });
      }
    }

    sortedRoutes.sort(function(a, b) {
      return a.title.localeCompare(b.title);
    });

    sortedStops.sort(function(a, b) {
      return a.title.localeCompare(b.title);
    });

    agencyData.sortedStops = sortedStops;
    agencyData.sortedRoutes = sortedRoutes;
  }

  /*
      Function: combineStops
      Combines stops into an object indexed by full titles.  This way, if there
      are multiple stop tags with the same title, they can be queried all at once.
      This function is run by default when the agency is cached.
   */

  function combineStops() {
    var titles = {}, item, stop;

    for (item in agencyData.stops) {
      if (agencyData.stops.hasOwnProperty(item)) {
        stop = agencyData.stops[item];

        if (titles[stop.title] === undefined) {
          titles[stop.title] = {
            tags: [],
            queries: {}
          };
        }

        titles[stop.title].tags.push(item);
        if (titles[stop.title].geoHash === undefined) {
          titles[stop.title].geoHash = geohash.encode(stop.lat, stop.lon);
        }
      }
    }

    agencyData.stopsByTitle = titles;
  }

  exports.setActive = setActive;
  exports.guessActive = guessActive;
  exports.getAgencyCache = getAgencyCache;
  exports.setAgencyCache = setAgencyCache;
  exports.cacheAgency = cacheAgency;
  exports.closestStops = closestStops;
  exports.routePredict = routePredict;
  exports.stopPredict = stopPredict;
  exports.vehicleLocations = vehicleLocations;
  exports.setActiveExpireTime = setActiveExpireTime;
  exports.getRoutes = getRoutes;
  exports.getStops = getStops;
  exports.customPredict = customPredict

  return exports;
}

exports.client = client;
