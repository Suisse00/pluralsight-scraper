# Introduction
Here are some trap/information new constributors could end up with when using our dependencies.

## Display the browser
You can set the environment variable `SHOW_BROWSER=true` to display the browser so you can watch what happens.

I can be useful detect service disturbance or if the captcha has been triggered. (We don't work around the captcha).

## Non-friendly promise error
The nightmare library is likely to return a promise error (like `Cannot read property 'focus' of null`) when our script call a nightmare's action (eg. insert()/click()) that couldn't find his html target.

So when getting such error it may be because the Pluralsight has been updated and our script needs to be updated as well.

One way to help figuring what nightmare call fails is to set the environment variable `DEBUG=nightmare:actions`.

**WARNING:** Using a debugger may not display anything. Read the _stdout/stderr with debugger chapter_. 

## stdout/stderr with debugger
**Note:** The author of this chapter is a new user of nightmare/electron without knowledge. So here a summary of what he knows and what he does.

If you start this script with the VSCode debugger the `process.stdout`/`process.stderr` variables (which the `debug` package use by the way) aren't attached to the `DEBUG CONSOLE` windows anymore. 

This mean, if you are using the `debug` package and set the `DEBUG` environment variable it may seems to not work.

Running the script straight from a terminal does work.