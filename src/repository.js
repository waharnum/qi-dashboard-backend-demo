"use strict";

var Hubkit = require("hubkit");
var moment = require("moment");

var gh = new Hubkit({
    token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN
});

var getEvents = function (commitsArray) {
    var commitsData = {
        contributors: {}, // { "account1": commits, "account2": commits }
        events: [],
        totalCommits: commitsArray.length
    };

    var daysWithCommits = {
        // "YYYY-MM-DD": commitCount
    };

    // Append contributors to the contributors object and count commits
    commitsArray.forEach(function (currentCommit) {
        // We need to identify the contributor using a variety of ways because if someone deletes
        // their GitHub account then the response won't include our required data. In that case
        // we can fall back to using their email address.
        var commitAuthorId = (currentCommit.committer || currentCommit.author || {login: currentCommit.commit.author.email}).login;
        var validAuthorCheck = commitsData.contributors[commitAuthorId];

        commitsData.contributors[commitAuthorId] = validAuthorCheck !== undefined ? commitsData.contributors[commitAuthorId] + 1 : 1;

        var formattedDate = moment(currentCommit.commit.committer.date).format("YYYY-MM-DD");
        var validDateCheck = daysWithCommits[formattedDate];

        daysWithCommits[formattedDate] = validDateCheck !== undefined ? daysWithCommits[formattedDate] + 1 : 1;
    });

    // Populate the events array with data converted from the daysWithCommits object
    commitsData.events = Object.keys(daysWithCommits).sort(function (a, b) {
        var firstDate = moment(a);
        var secondDate = moment(b);
        return firstDate.isBefore(secondDate) ? 1 : -1;
    }).map(function (currentDate, index) {
        return {
            timestamp: currentDate,
            value: daysWithCommits[currentDate]
        };
    });

    return commitsData;
};

var getContributors = function (commitsArray) {
    var commitsData = getEvents(commitsArray);
    var output = {
        summary: {
            numberOfContributors: Object.keys(commitsData.contributors).length
        },
        events: commitsData.events
    };

    return output;
};

var getMostFrequentCommitter = function (commitsData) {
    var contributors = commitsData.contributors;
    var mostFrequentCommitter = null;
    var maxCommitsPerAuthor = 0;

    Object.keys(contributors).forEach(function (currentAuthor) {
        var count = contributors[currentAuthor];

        if (count > maxCommitsPerAuthor) {
            maxCommitsPerAuthor = count;
            mostFrequentCommitter = currentAuthor;
        }
    });

    return mostFrequentCommitter;
};

var getCommits = function (commitsArray) {
    var commitsData = getEvents(commitsArray);
    var timeOfLastCommit = moment(commitsArray[0].commit.committer.date).format("YYYY-MM-DD");
    var mostFrequentCommitter = getMostFrequentCommitter(commitsData);
    var output = {
        summary: {
            timeOfLastCommit: timeOfLastCommit,
            mostFrequentCommitter: mostFrequentCommitter,
            totalCommits: commitsData.totalCommits
        },
        events: commitsData.events
    };

    return output;
};

var httpHandler = function (fn) {
    return function (req, res) {
        var owner = req.params.owner;
        var repo = req.params.repo;

        gh.request("GET /repos/:owner/:repo/commits", {
            owner: owner,
            repo: repo
        }).then(function (repoResult) {
            console.log(Hubkit.rateLimitRemaining);
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
