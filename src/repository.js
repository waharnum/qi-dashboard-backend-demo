"use strict";

var request = require("request");
var moment = require("moment");

var token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
var GITHUB_API_HOST = "https://api.github.com";

function makeGithubRequest (url, query, callback) {
    if (typeof query === "function") {
        callback = query;
        query = undefined;
    }

    query = query || {};
    query.access_token = token;

    var requestAttempts = query.__requestAttempts || 5;
    delete query.__requestAttempts;

    request({
        url: GITHUB_API_HOST + url,
        qs: query,
        json: true,
        headers: {
            "User-agent": "Node.js"
        }
    }, function (err, res, data) {
        if (err) return callback(err);
         // The GitHub Statistics API documentation states that if the required data hasn't been 
         // been computed and cached then a 202 reponse is returned. Additional requests need to be
         // made once their background jobs have completed, yielding a successful 200 response.         
        if (res.statusCode === 202) {
            query.__requestAttempts = requestAttempts - 1;
            if (query.__requestAttempts === 0) {
                return callback(new Error("Unable to retrieve result from " + GITHUB_API_HOST));
            }
            console.log("Received a 202 response, retrying request...");
            return setTimeout(function () {
                makeGithubRequest(url, query, callback);
            }, 3000);
        }
        
        console.log(res.headers["x-ratelimit-remaining"] + " GitHub API hourly requests remaining");
        callback(null, data);
    });
}

function verifyGithubProjectOwner (owner, callback) {
    var isAllowed = owner === "gpii" || owner === "fluid-project";
    
    if (!isAllowed) {
        return callback(new Error("Unauthorized GitHub project owner provided."));
    }
}

function processEvents (activity) {
    return Object.keys(activity).sort(function(firstDate, secondDate) {
        return firstDate < secondDate ? 1 : -1;
    }).map(function(weekTimestamp) {
        return {
            timestamp: moment(weekTimestamp * 1000).format("YYYY-MM-DD"),
            value: activity[weekTimestamp]
        };
    }).filter(function (weeklyActivity) {
        // GitHub returns 0 values for weeks that don't have any commits, removing those from our
        // results here.
        return weeklyActivity.value;
    });
}

function getRepoContributors (owner, repo, callback) {
    makeGithubRequest("/repos/" + owner + "/" + repo + "/stats/contributors", callback);
}

function getContributors (owner, repo, callback) {
    if (verifyGithubProjectOwner(owner, callback)) return;
    
    getRepoContributors(owner, repo, function (err, contributors) {
        if (err) return callback(err);
        
        var contributorsPerWeek = {};
        
        contributors.forEach(function (currentContributor) {
            currentContributor.weeks.forEach(function (currentWeek) {
                contributorsPerWeek[currentWeek.w] = contributorsPerWeek[currentWeek.w] || 0;
                if (currentWeek.c) {
                    ++contributorsPerWeek[currentWeek.w];
                }
            });
        });

        var output = {
            summary: {
                numberOfContributors: contributors.length
            },
            events: processEvents(contributorsPerWeek)
        };

        callback(null, output);
    });
}

function getCommits (owner, repo, callback) {
    if (verifyGithubProjectOwner(owner, callback)) return;

    var numOfInvocations = 0;
    var contributors = null;
    var lastCommit = null;
    var err = null;

    function processResult () {
        if (++numOfInvocations !== 2) return;
        if (err) return callback(err);
        if (!contributors.length) return callback(new Error("No contributors found."));
        if (!lastCommit) return callback(new Error("Could not get the last commit."));

        // The Statistics endpoint returns the most active contributor object last.
        var mostFrequentCommitterData = contributors[contributors.length - 1];
        var totalCommits = 0;
        var commitsPerWeek = {};

        contributors.forEach(function (currentContributor) {
            totalCommits += currentContributor.total;
            currentContributor.weeks.forEach(function (currentWeek) {
                commitsPerWeek[currentWeek.w] = commitsPerWeek[currentWeek.w] || 0;
                commitsPerWeek[currentWeek.w] += currentWeek.c;
            });
        });

        var dateOfLastCommit = moment(lastCommit.commit.committer.date).format("YYYY-MM-DD");

        var output = {
            summary: {
                timeOfLastCommit: dateOfLastCommit,
                mostFrequentCommitter: mostFrequentCommitterData.author.login,
                mostFrequentCommitterTotalCommits: mostFrequentCommitterData.total,
                totalCommits: totalCommits
            },
            events: processEvents(commitsPerWeek)
        };

        callback(null, output);
    }

    getRepoContributors(owner, repo, function (_err, _contributors) {
        err = _err;
        contributors = _contributors;
        processResult();
    });
    
    // This second endpoint and extra request is required so that the timeOfLastCommit value can
    // be determined. Only one page is required since the first object in the result represents
    // the first commit. 
    makeGithubRequest("/repos/" + owner + "/" + repo + "/commits", {
        per_page: 1
    }, function (_err, _commits) {
        err = _err;
        lastCommit = _commits[0];
        processResult();
    });    
};

function httpHandler (fn) {
   return function (req, res) {
       var owner = req.params.owner;
       var repo = req.params.repo;

       fn(owner, repo, function (err, data) {
           if (err) {
               console.log(err);
               return res.status(400).send(err.toString());
           } else if (req.query.callback) {
               return res.jsonp(data);
           } else {
               return res.json(data); 
           }                      
       });
   };
};

exports.getContributors = getContributors;
exports.getCommits = getCommits;
exports.httpHandler = httpHandler;
