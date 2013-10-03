#!/usr/bin/env node

/* config */
var BASE_URL = "http://fbinter.stadt-berlin.de/rbs/rbs-slct-str-liste.jsp";
var DETAIL_URL = "http://fbinter.stadt-berlin.de/rbs/rbs-show-data-text.jsp";

/* get node modules */
var fs = require("fs");
var path = require("path");
var url = require("url");

/* get npm modules */
var scrapyard = require("scrapyard");
var colors = require("colors");

/* get command line options via optimist */
var argv = require("optimist")
	.boolean(["d","f","s"])
	.alias("d","debug")
	.alias("f","full")
	.alias("s","simple")
	.argv;

if (!argv.d && !argv.s) {
	console.error("specify either --full or --simple".red);
	process.exit();
}

/* data file */
if (argv._.length > 0) {
	var FILE_DATA = path.resolve(argv._[0]);
} else {
	var FILE_DATA = path.resolve(__dirname, "data.json.stream");
}

/* get local modules */
var soldner = require(__dirname+"/lib/soldner.js");

/* initialize scrapyard */
var scraper = new scrapyard({
	cache: './storage', 
	debug: argv.d,
	timeout: 986400000,
	retries: 5,
	connections: 5
});

var fetch_streets = function(callback){
	scraper.scrape(BASE_URL, "html", function(err, $){
		if (err) {
			callback(err);
		} else {
			var result = [];
			$('form.query tr td input[name=strnr]').each(function(idx, $r){
				result.push($(this).attr('value'));
			});
			callback(null, result);
		}
	});
};

var fetch_numbers = function(strnr, callback){
	scraper.scrape(BASE_URL+"?strnr="+strnr, "html", function(err, $){
		if (err) {
			callback(err);
		} else {
			var str_name = $("input[name=strname]").val();
			var result = [];
			$('form tr td input[name=hausnr]').each(function(idx, $r){
				result.push({
					strnr: strnr,
					hausnr: $(this).attr('value'),
					name: str_name,
					nummer: $(this).parent().parent().find("td").eq(1).text()
				});
			});
			callback(null, result);
		}
	});
};

var fetch_details = function(data, callback){
	scraper.scrape(DETAIL_URL+"?strnr="+data.strnr+"&hausnr="+data.hausnr, "html", function(err, $){
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
						v[1] = v[1].split(/,  /g);
						data.finanzamt_nr = v[0];
						data.finanzamt_addr = v[1].join(", ");
					break;
					default:
						console.error("[ ! ]".yellow.inverse.bold, "unknown key".yellow, k.cyan);
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

var main = function() {
	
	/* fetch counters */
	var count_fetchable = 0;
	var count_fetched = 0;

	/* write streams */
	var out_full = fs.createWriteStream(FILE_DATA, {'flags': 'w'});
	var out_simple = fs.createWriteStream(FILE_DATA, {'flags': 'w'});

	/* monitor */
	var monitor = setInterval(function(){
		process.stderr.write([
			"[status]".inverse.bold.green,
			(count_fetched+"/"+count_fetchable).magenta,
			"\r"
		].join(" "));
	},5000);

	fetch_streets(function(err,streets){
		console.error("[info]".inverse.bold.green, "loaded streets".green);
		count_fetchable += streets.length;
		streets.forEach(function(street){
			fetch_numbers(street, function(err,numbers){
				count_fetchable += numbers.length;
				count_fetched++;
				numbers.forEach(function(number){
					fetch_details(numbers[0], function(err,data){
						count_fetched++;

						/* write to file */
						out.write(JSON.stringify(data)+"\n");
						out_simple.write(JSON.stringify(data)+"\n");

						if (count_fetched === count_fetchable) {
							/* done */
							out.end();
							out_simple.end();
							clearInterval(monitor);
							console.error("[<3]".inverse.bold.magenta, "done".magenta);
						}
					});
				})
			});
		});
	});
}

main();