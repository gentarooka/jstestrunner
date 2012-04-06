/**
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param testFx javascript condition that evaluates to a boolean,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param onReady what to do when testFx condition is fulfilled,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
 */
function waitFor(testFx, onReady, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3001, //< Default Max Timout is 3s
        start = new Date().getTime(),
        condition = false,
        interval = setInterval(function() {
            if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
                // If not time-out yet and condition not yet fulfilled
                condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
            } else {
                if(!condition) {
                    // If condition still not fulfilled (timeout but condition is 'false')
                    console.log("'waitFor()' timeout");
                    phantom.exit(1);
                } else {
                    // Condition fulfilled (timeout and/or condition is 'true')
                    console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                    typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                    clearInterval(interval); //< Stop this interval
                }
            }
        }, 100); //< repeat check every 250ms
};


if (phantom.args.length === 0 || phantom.args.length > 2) {
    console.log('Usage: run-qunit.js URL');
    phantom.exit();
}

openUrl(phantom.args[0].split(","));

function openUrl(testUrls) {
	var testUrl = testUrls.shift();
	
	var page = new WebPage();

	// Route "console.log()" calls from within the Page context to the main Phantom context (i.e. current "this")
	page.onConsoleMessage = function(msg) {
		console.log(msg);
	};
	
	page.open(testUrl, function(status) {
		if (status !== "success") {
			console.log("Unable to access network");
			phantom.exit();
		} else {
			bindQunit(page, testUrl);


			var v = testUrl.split("/");
			v.shift();
			v.shift();
			v.shift();
			var name = "./" + v.join("/").split(".")[0] + "Test.js";
			
			var isLoaded = page.injectJs(name);
			
			if(!isLoaded) {
				page.injectJs("./fail.js");
			}

			page.evaluate(function() {
				QUnit.load();
			});

			waitFor(function() {
				return page.evaluate(function() {
					if (typeof (runQunitFinished) == "undefined"
							|| !runQunitFinished) {
						return false;
					}
					;

					return true;
				});
			}, function() {
				if (testUrls.length === 0) {
					phantom.exit();
				}
				
				openUrl(testUrls);
			}, 10000);
		}
	});

}


function bindQunit(page, testUrl) {
	page.injectJs("./qunit.js");

	page.evaluate("function() {testUrl = \"" + testUrl + "\";}");

	page.evaluate(function() {
		runQunitFinished = false;

		var message = new Array();
		QUnit.testDone(function(data) {
			var m = data.module + "[" + data.name + "]  " + data.passed + "/"
					+ data.total;
			message.push(m);
		});

		QUnit.done(function(data) {
			var xhr = new XMLHttpRequest();
			xhr.open("POST", "/testResults", false);
			xhr.setRequestHeader("Content-Type", "application/json");
			try {
				xhr.send(JSON.stringify({
					testUrl : testUrl,
					passes : data.passed,
					failures : data.failed,
					message : message.join("\n")
				}));
			} catch (e) {
				// Just swallow exceptions as we can't do anything useful if
				// there are
				// comms errors.
			}
			
			runQunitFinished = true;
		});
	});

}

