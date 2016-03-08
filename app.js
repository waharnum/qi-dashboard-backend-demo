"use strict";

var express = require("express");
var bodyParser = require("body-parser");

var repo = require("./src/repository.js");

var port = process.env.QI_DASHBOARD_BACKEND_TCP_PORT || 3000;
var app = express();

app.use(bodyParser.json());

app.get("/a/:owner/:repo/contributors", repo.httpHandler(repo.getContributors));

app.get("/a/:owner/:repo/commits", repo.httpHandler(repo.getCommits));

app.listen(port, function () {
    console.log("Listening on port " + port);
});
