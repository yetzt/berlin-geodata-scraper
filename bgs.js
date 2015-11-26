#!/usr/bin/env node

// config
var BASE_URL = "http://fbinter.stadt-berlin.de/rbs/rbs-slct-str-liste.jsp";
var NUMBER_URL = "http://fbinter.stadt-berlin.de/rbs/rbs-slct-hnr-liste.jsp";
var DETAIL_URL = "http://fbinter.stadt-berlin.de/rbs/rbs-show-data-text.jsp";

// get node modules
var fs = require("fs");
var path = require("path");
var url = require("url");

// get npm modules
var scrapyard = require("scrapyard");
var debug = require("debug")("bgs");
var sv = require("sv");

var out = new sv.Stringifier({peek: 2, missing: null, delimiter: "\t", quotechar: true});
out.pipe(process.stdout);

// get local modules
var soldner = require(__dirname+"/lib/soldner.js");

// initialize scrapyard
var scraper = new scrapyard({
	retries: 3,
	connections: 3,
	cache: './cache', 
	bestbefore: "24h"
});

var fetch_streets = function(callback){
	var _fetched = 0;
	var _result = [];
	["01","02","03","04","05","06","07","08","09","10","11","12"].forEach(function(beznr){
		scraper.scrape({
			url: BASE_URL+"?beznr="+beznr+"&go=go&stop=window",
			type: "html",
			encoding: "utf8"
		}, function(err, $){
			_fetched++;
			if (err) return callback(err);
			debug("fetched streets for bezirk %d", beznr);
			$('form.query tr').each(function(){
				// filter additional rows for streets in two districts
				if ($('td', this).length === 1) return;
				_result.push({
					number: $("td input[name=strnr]", this).attr('value'),
					name: $("td font", this).eq(0).text().replace(/^\s+|\s+$/g,'').replace(/\s+/g,' ')
				});
			});
			if (_fetched === 12) callback(null, _result);
		});
	});

};

var fetch_numbers = function(street, callback){
	// debug("fetching numbers for %s", street.name);
	scraper.scrape({
		url: NUMBER_URL+"?strnr="+street.number+"&strname="+street.name+"&go=go&stop=window",
		type: "html",
		encoding: "utf8"
	}, function(err, $){
		if (err) return callback(err);
		var result = [];
		$('form tr td input[name=hausnr]').each(function(idx, $r){
			result.push({
				strnr: street.number,
				hausnr: $(this).attr('value'),
				name: street.name,
				nummer: $(this).parent().parent().find("td").eq(1).text()
			});
		});
		callback(null, result);
	});
};

var fetch_details = function(data, callback){
	// debug("fetching details for %s %s", data.name, data.hausnr);
	scraper.scrape({
		url: DETAIL_URL+"?strnr="+data.strnr+"&strname="+data.name+"&hausnr="+data.hausnr+"&go=go&stop=window", 
		type: "html",
		encoding: "utf8"
	}, function(err, $){
		if (err) {
			callback(err);
		} else {
			$('table.hnrresult > tbody > tr').each(function(idx,e){
				var k = $(this).find("td").eq(0).text().replace(/^\s+|\s+$/g,'');
				switch(k) {
					case "Adresse":
						data.addresse = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'');
					break;
					case "PLZ":
						data.plz = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'');
					break;
					case "Bezirk":
						var v = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'').split(/\s+\/\s+/g);
						data.berzirk_name = v[0];
						data.berzirk_nr = v[1];
					break;
					case "Ortsteil":
						var v = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'').split(/\s+\/\s+/g);
						data.ortsteil_name = v[0];
						data.ortsteil_nr = v[1];
					break;
					case "Straßen-Nr. / -abschnitt":
						var v = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'').split(/\s+\/\s+/g);
						data.strasse_nr = v[0];
						data.strasse_abschnitt_nr = v[1];
					break;
					case "Karten":
						var karten = [];
						$(this).find("td").eq(1).find("tr").each(function(idx,e){
							karten.push([
								$(this).find("td").eq(0).text().replace(/^\s+|\s+$/g,'').replace(/:$/,'').replace(/\./,''),
								$(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'')
							].join('='));
						});
						data.karten = karten.join(',');
					break;
					case "Soldner-Koordinaten":
						var v = [
							$(this).find("td").eq(1).find("tr").eq(0).find("td").eq(1).text(),
							$(this).find("td").eq(1).find("tr").eq(1).find("td").eq(1).text(),
						];
						data.soldner_x = parseInt(v[0],10);
						data.soldner_y = parseInt(v[1],10);
					break;
					case "ETRS89-Koordinaten":
					var v = [
						$(this).find("td").eq(1).find("tr").eq(0).find("td").eq(1).text(),
						$(this).find("td").eq(1).find("tr").eq(1).find("td").eq(1).text(),
					];
						data.etrs89_x = parseInt(v[0],10);
						data.etrs89_y = parseInt(v[1],10);
					break;
					case "stat.Geb./Block":
						var v = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'').split(/\s+\/\s+/g);
						data.stat_gebiet = v[0];
						data.stat_block = v[1];
					break;
					case "Einschulungsbezirk":
						data.einschulungsbezirk = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'');
					break;
					case "Verkehrsfläche / -teilfläche":
						var v = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'').split(/\s+\/\s+/g);
						data.verkehrsflaeche = v[0];
						data.verkehrsteilflaeche = v[1];
					break;
					case "Mittelbereich":
						data.mittelbereich = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'');
					break;
					case "Prognoseraum":
						var v = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'').split(/\s+\/\s+/g);
						data.prognoseraum_name = v[0];
						data.prognoseraum_nr = v[1];
					break;
					case "Bezirksregion":
						var v = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'').split(/\s+\/\s+/g);
						data.bezirksregion_name = v[0];
						data.bezirksregion_nr = v[1];
					break;
					case "Planungsraum":
						var v = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'').split(/\s+\/\s+/g);
						data.planungsraum_name = v[0];
						data.planungsraum_nr = v[1];
					break;
					case "Finanzamt":
						var v = $(this).find("td").eq(1).text().replace(/^\s+|\s+$/g,'').split(/\s+\/\s+/);
						if (typeof v[1] !== "undefined") v[1] = v[1].replace(/,  /g, ", ");
						data.finanzamt_nr = v[0];
						data.finanzamt_addr = v[1];
					break;
					default:
						debug("unknown key %s", k);
					break;
				}
			});
			
			if (("soldner_x" in data) && typeof data.soldner_x === "number" && !isNaN(data.soldner_x) && ("soldner_y" in data) && typeof data.soldner_y === "number" && !isNaN(data.soldner_y)) {
				var coord = soldner(data.soldner_x, data.soldner_y);
				data.lon = coord[0];
				data.lat = coord[1];
			} else {
				data.lon = null;
				data.lat = null;
			}

			callback(null,data);
		}
	});
};

(function() {
	
	// fetch counters
	var count_fetchable = 0;
	var count_fetched = 0;

	// monitor
	var monitor = setInterval(function(){
		if (count_fetchable === 0) return("nothing to fetch yet");
		debug("fetched %d/%d", count_fetched, count_fetchable);
	},10000);

	fetch_streets(function(err,streets){
		debug("loaded %d streets", streets.length);
		count_fetchable += streets.length;
		streets.forEach(function(street){
			fetch_numbers(street, function(err,numbers){
				count_fetchable += numbers.length;
				count_fetched++;
				numbers.forEach(function(number){
					fetch_details(number, function(err,data){
						count_fetched++;
						
						if (err) debug("error: %s", err);
						if (typeof data !== "object") debug("error: data is %s", (typeof data));
						
						if (!err && typeof data === "object") out.write(data);

						if (count_fetched === count_fetchable) {
							// done
							out.end();
							clearInterval(monitor);
							debug("done");
						}
					});
				})
			});
		});
	});
})();
