$(function(){
    var apiUrl = localStorage["jenkins-url"];
    var soeid = localStorage["soeid"];
    var jobName = localStorage["job-name"];
    var websocketUrl   = localStorage["websocket-url"];
    var notifyOnlyFail = localStorage["notify-only-fail"];

    if (apiUrl == null || websocketUrl == null || soeid == null) {
        return;
    }

    apiUrl = appendLastSlash(apiUrl);
    var prevBuild = -1;
    var JOB = "job/"
    var BUILD_NUMBER = "lastBuild"
    var API_SUB  = "/api/json";
    var POLLING_TIME = 60 * 1000;

    $.ajaxSetup({
        "error": function() {
            $.fn.desktopNotify(
                {
                    picture: getIcon("FAILURE"),
                    title: "Failed to access to Jenkins",
                    text : apiUrl
                }
            );
        }
    });

    function appendLastSlash(url) {
        var lastChar = url.substring(url.length - 1);
        if (lastChar != "/") {
            return url + "/";
        }
        return url;
    }

    function isSuccess(result) {
        return (result == "SUCCESS");
    }
    
    function getSoeId(link){
    	return link.substring(link.lastIndexOf("/")+1);
    }

    function getIcon(result) {
        var url = "images/blue.png";
        if (result == "UNSTABLE") {
            url = "images/yellow.png";
        } else if (result == "FAILURE") {
            url = "images/red.png";
        } else if (result == "ABORTED") {
            url = "images/grey.png";
        }
        return url;
    }

    function getColor(result) {
        var color = [0, 0, 255, 200];
        if (result == "UNSTABLE") {
            color =  [255, 255, 0, 200];
        } else if (result == "FAILURE") {
            color = [255, 0, 0, 200];
        } else if (result == "ABORTED") {
            color = [200, 200, 200, 200];
        }
        return color;
    }

    // replace popup event
    chrome.browserAction.setPopup({popup : ""});
    chrome.browserAction.onClicked.addListener(function(tab) {
    	if (jobName && jobName != ""){
    		window.open(apiUrl + JOB + jobName);
    	}else{
    		window.open(apiUrl);
    	}
    });

    function fetch(apiUrl, num, job) {
        if (num == null) {
            num = BUILD_NUMBER;
        }
        var url = apiUrl + JOB + job + "/" + num + API_SUB;
        console.info("get job info:" + url);
        $.getJSON(url, function(json, result) {
            if (result != "success") {
                return;
            }
            if (prevBuild != json.number) {
                if (notifyOnlyFail == 'true' && isSuccess(json.result)) {
                    return;
                }
                var submitUser = "";
                var description = "";
                // Started by upstream project
                if (json.actions[0].causes){
                	if (isSuccess(json.result)){
                		console.info(job + " build success trigger by upstream project,skip");
                		return;
                	}else{
                		description = json.actions[0].causes[0].shortDescription;
                	}
                }else{
                	description = json.actions[1].causes[0].shortDescription;
                	if (description == "Started by an SCM change"){
                    	for(var culprit in json.culprits){
                    		submitUser += getSoeid(culprit.absoluteUrl);
                        }
                    }else{
                    	submitUser = json.actions[1].causes[0].userId;
                    }
                	console.info(job + " " + description + ",user:" + submitUser);
                }
                prevBuild = json.number;
                chrome.browserAction.setBadgeText({text: String(json.number)});
                chrome.browserAction.setBadgeBackgroundColor({color: getColor(json.result)});
                if (submitUser == "" || submitUser.indexOf(soeid) > -1){
                	$.fn.desktopNotify({
                        picture: getIcon(json.result),
                        title: "[Jenkins] " + job + ": Build #" + json.number + " -" + json.result,
                        text : description
                    });
                }
            }
        });
    }

    var retryTime = 2500;
    function bind(wsUrl, apiUrl) {
        var ws = $("<div />");

        ws.bind("websocket::connect", function() {
            console.log('opened connection');
            retryTime = 5000;
        });

        ws.bind("websocket::message", function(_, obj) {
        	console.log(obj);
        	if (jobName && jobName != ""){
        		if (jobName == obj.project){
        			fetch(apiUrl, obj.number , obj.project);
        		}
        	}else{
        		fetch(apiUrl, obj.number , obj.project);
        	}
        });

        ws.bind("websocket::error", function() {
            $.fn.desktopNotify(
                {
                    picture: getIcon("FAILURE"),
                    title: "Failed to access to Jenkins Websocket Notifier. Please check your websocket URL",
                    text : wsUrl
                }
            );
        });

        // auto reconnect
        ws.bind('websocket::close', function() {
            console.log('closed connection');
            retryTime *= 2;
            setTimeout(function() {
                bind(websocketUrl, apiUrl);
            }, retryTime);
        });

        ws.webSocket({
            entry : wsUrl
        });
    }

    bind(websocketUrl, apiUrl);
});
