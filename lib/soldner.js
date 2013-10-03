#!/usr/bin/env node

/* require proj4js */
var proj = require("proj4");

/* define soldner projection */
proj.defs("EPSG:3068", "+proj=cass +lat_0=52.41864827777778 +lon_0=13.62720366666667 +x_0=40000 +y_0=10000 +ellps=bessel +datum=potsdam +units=m +no_defs");

module.exports = function(x, y) {
	return proj("EPSG:3068", "WGS84", [x,y]);
}
