require('dotenv').config()

// Link to the table of contents of the course you want
var target = process.env.TARGET;

// Your login details
var user = {
    email: process.env.EMAIL,
    password: process.env.PASSWORD
}

/*** DAH CODEZ ***/
var ProgressBar = require('progress');
var Nightmare = require('nightmare');
var nightmare = Nightmare({ show: process.env.SHOW_BROWSER === 'true' });

var https = require('https');
var fs = require("fs");

var useragent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'

console.log(`This program was written for EDUCATION and PERSONAL USE ONLY
Please be respectful of the original authors' intellectual property

This scraper is open source and licensed under GPLv2 on Github
https://github.com/knyzorg/pluralsight-scraper
`)

// Add a promise for indirect call to an goto (eg. from click()) so the remaining promise won't start before the DOM is ready
//  (We try to replicate the goto() promise)
Nightmare.prototype.willGenerateGoto = function(callback) {
    var self = this

    var executionContext = {}

    // Safety to avoid waiting for a dom-ready if the click() actually didn't trigger anything
    self.once('did-start-loading', function() {
        executionContext.rejectError = new Error("Unable to generate the webpage within the time frame (DOM ready wasn't triggered)")
    });

    self.once('dom-ready', function() {
        clearTimeout(executionContext.timer)
        executionContext.done()
    });

    callback.call(this);
    
    this.invoke(function(done) {
        executionContext.done = done
        executionContext.rejectError = new Error("Expected a page load to be triggered but nothing happened.")
        executionContext.timer = setTimeout(function() { done(executionContext.rejectError) }, self.options.gotoTimeout)
    });

    return this;
}

Nightmare.prototype.ensureValidHttpStatus = function(callback, args) {
    this.once('did-get-response-details', function(event, status, newURL, originalURL, httpResponseCode) {
        args = Object.assign({excludeHttpCodes: []}, args)

        var excludeHttpCodes = args.excludeHttpCodes || []
        if(httpResponseCode >= 400 && !excludeHttpCodes.includes(httpResponseCode)) {
            throw new Error(`Unable to get the webpage, server returnede HTTP Code ${httpResponseCode}`)
        }
    });

    callback.call(this);

    return this;
}

Nightmare.action('invoke', function(callback, done) {
    callback(done)
});

// Let's go 88mph Scott!
if(process.env.NODE_ENV === "development") {
    Nightmare.action('wait', function() {});
}

console.log("Logging in...")

var numberOfFiles, completed, saveTo, progress = 0;
nightmare
    .useragent(useragent)
    .ensureValidHttpStatus(function() { this.goto('https://app.pluralsight.com/id?') })
    .insert('#Username', user.email)
    .insert('#Password', user.password)
    // The captcha may trigger a 403 http code and it will mess up with the captcha detection below
    .willGenerateGoto(function() { this.ensureValidHttpStatus(function() { this.click('#login') }, { excludeHttpCodes: [ 403 ]})})
    .evaluate(function () {
        var errorMessage = document.getElementById('errorMessage');
        if(errorMessage) {
            throw new Error(`Unable to login: ${errorMessage.textContent}`)
        }

        var captch = document.getElementById('challenge-form');
        if(captch) {
            // We could avoid this error if process.env.SHOW_BROWSER is set but we would need to recheck if credentials are fine (executing this eveluate() again) before moving one.
            // Captch will repost credentials upon success the challenge.
            throw new Error(`Unable to login, you triggered a captch. Rerun this script with the environment variable SHOW_BROWSER=true`)
        }
    })
    .wait(1000)
    .ensureValidHttpStatus(function() { this.goto(target) })
    .wait(3000)
    .evaluate(function () {
        var courses = [];
        document.querySelectorAll('a[class^="clipListTitle"').forEach((course) => {
            courses.push({
                name: course.text,
                url: course.href
            })
        })
        return {
            courses: courses.filter((thing) => thing.url),
            title: document.title
        }
    })
    .then(function (module) {
        numberOfFiles = module.courses.length;
        if (!numberOfFiles){
            console.error("Unable to detect courses. It could be because the course URL is invalid, because of too many login attempt, because the site has been updated but not this script so it isn't able to detect failed sign-in.")
            process.exit(1)
            return;
        }
        console.log("Logged in!")
        saveTo = module.title.replace(" | Pluralsight", "");
        console.log(`Downloading "${saveTo}" from PluralSight, ${numberOfFiles} videos`)
        progress = new ProgressBar(':current/:total [:bar] :percent :etas', { total: numberOfFiles, callback: terminate })
        var tasks = module.courses.map((course, index) => (
            (callback) => {
                scrape(course, index, callback)
            }
        ))
        require("async.parallellimit")(tasks, 1, function () {
        });
    }).catch((e) => console.error(`Unhandled error: ${e}`))

function scrape(course, index, callback, delay=1500) {
    nightmare
        .useragent(useragent)
        .ensureValidHttpStatus(function() { this.goto(course.url) })
        .wait("video")
        .wait(1500)
        .evaluate(() => {
            var src = document.querySelector("video").src
            return src
        })
        .then((result) => {

            if (!result) {
                progress.interrupt("Something went wrong. Retrying...")
                scrape(course, index, callback, delay+500)
                return
            }

            course.src = result
            saveVideo(course, index + 1)
            callback()
        }).catch((e) => console.log(e))
}

function saveVideo(course, number) {
    //console.log(number, course.name);
    if (!fs.existsSync("videos/")) {
        fs.mkdirSync("videos/");
    }
    if (!fs.existsSync("videos/" + saveTo)) {
        fs.mkdirSync("videos/" + saveTo);
    }
    if (fs.existsSync("videos/" + saveTo + "/" + number + ". " + course.name.replace(/[^a-z]/ig, "") + ".webm")) {
        return;
    }
    var file = fs.createWriteStream("videos/" + saveTo + "/" + number + ". " + course.name.replace(/[^a-z]/ig, "") + ".webm");
    var request = https.get(course.src,(response) => {
        progress.tick()
        response.pipe(file);
        completed++;
        if (completed == numberOfFiles) {

        }
    });
}

function terminate() {
    console.log("Operation Completed!")
    process.exit(0)
}
