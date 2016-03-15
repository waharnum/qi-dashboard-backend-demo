"use strict";

var Hubkit = require("hubkit");
var moment = require("moment");

var gh = new Hubkit({
    token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN
});

function getEvents (commitsArray, contributorEvents) {
    var commitsData = {
        contributors: {}, // { "account1": commits, "account2": commits }
        events: [],
        totalCommits: commitsArray.length
    };

    var daysWithCommits = {};

    commitsArray.forEach(function (currentCommit) {
        // We need to identify the contributor using a variety of ways because if someone deletes
        // their GitHub account then the response won't include our required data. In that case
        // we can fall back to using their email address.
        var commitAuthorId = (currentCommit.author || currentCommit.committer || {login: currentCommit.commit.author.email}).login;

        var validAuthorCheck = commitsData.contributors[commitAuthorId];

        commitsData.contributors[commitAuthorId] = (validAuthorCheck || 0) + 1;

        var formattedDate = moment(currentCommit.commit.committer.date).format("YYYY-MM-DD");
        var validDateCheck = daysWithCommits[formattedDate];

        if (contributorEvents) {
            // daysWithCommits = {
            //   "YYYY-MM-DD": {
            //     account1: commits,
            //     account2: commits
            //   }
            // }
            var currentDate = daysWithCommits[formattedDate] = validDateCheck || {};
            var currentAuthorCount = currentDate[commitAuthorId];
            currentDate[commitAuthorId] = (currentAuthorCount || 0) + 1;
        } else {
            // daysWithCommits = {
            //   "YYYY-MM-DD": commits // total commits for that date
            // }
            daysWithCommits[formattedDate] = (validDateCheck  || 0) + 1;
        }
    });

    // Populate the events array with data converted from the daysWithCommits object
    commitsData.events = Object.keys(daysWithCommits).sort(function (a, b) {
        var firstDate = moment(a);
        var secondDate = moment(b);
        return firstDate.isBefore(secondDate) ? 1 : -1;
    }).map(function (currentDate, index) {
        var currentDaysData = daysWithCommits[currentDate];
        return {
            timestamp: currentDate,
            value: contributorEvents ? Object.keys(currentDaysData).length : currentDaysData
        };
    });

    return commitsData;
};

function getContributors (commitsArray) {
    var commitsData = getEvents(commitsArray, true);
    var output = {
        summary: {
            numberOfContributors: Object.keys(commitsData.contributors).length
        },
        events: commitsData.events
    };

    return output;
};

function getMostFrequentCommitter (commitsData) {
    var contributors = commitsData.contributors;
    var mostFrequentCommitter = null;
    var mostFrequentCommitterTotalCommits = 0;
    var mostFrequentCommitterData = {};

    Object.keys(contributors).forEach(function (currentAuthor) {
        var count = contributors[currentAuthor];

        if (count > mostFrequentCommitterTotalCommits) {
            mostFrequentCommitterTotalCommits = count;
            mostFrequentCommitter = currentAuthor;
        }
    });

    mostFrequentCommitterData.author = mostFrequentCommitter;
    mostFrequentCommitterData.commits = mostFrequentCommitterTotalCommits;
    
    return mostFrequentCommitterData;
};

function getCommits (commitsArray) {
    var commitsData = getEvents(commitsArray);
    var timeOfLastCommit = moment(commitsArray[0].commit.committer.date).format("YYYY-MM-DD");
    var mostFrequentCommitterData = getMostFrequentCommitter(commitsData);
    var output = {
        summary: {
            timeOfLastCommit: timeOfLastCommit,
            mostFrequentCommitter: mostFrequentCommitterData.author,
            mostFrequentCommitterTotalCommits: mostFrequentCommitterData.commits,
            totalCommits: commitsData.totalCommits
        },
        events: commitsData.events
    };

    return output;
};

function httpHandler (fn) {
    return function (req, res) {
        var owner = req.params.owner;
        var repo = req.params.repo;

        gh.request("GET /repos/:owner/:repo/commits", {
            owner: owner,
            repo: repo
        }).then(function (repoResult) {
            console.log(Hubkit.rateLimitRemaining + " GitHub API hourly requests remaining");
            if (req.query.callback) {
                return res.jsonp(fn(repoResult));
            } else {
                return res.json(fn(repoResult));
            }
        }).catch(function (err) {
            console.log(err);
            res.status(400).send("An error occurred: " + err.toString());
        });
    };
};

exports.getContributors = getContributors;
exports.getCommits = getCommits;
exports.httpHandler = httpHandler;
