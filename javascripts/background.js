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
        	desktopNotify('FAILURE','Failed to access to Jenkins','Please check your URL:' + apiUrl, apiUrl);
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
		window.open(apiUrl);
    });
    
    function fetch(apiUrl, num, job) {
        if (num == null) {
            num = BUILD_NUMBER;
        }
        var jobUrl = apiUrl + JOB + job + "/" + num;
        var jsonUrl = jobUrl + API_SUB;
        console.info("get job info:" + jobUrl);
        
        $.getJSON(jsonUrl, function(json, result) {
            if (result != "success") {
                return;
            }
            chrome.browserAction.setBadgeText({text: String(json.number)});
            chrome.browserAction.setBadgeBackgroundColor({color: getColor(json.result)});
            chrome.browserAction.onClicked.addListener(function(tab) {
            		window.open(jobUrl);
            });
            if (prevBuild != json.number) {
                if (notifyOnlyFail == 'true' && isSuccess(json.result)) {
                    return;
                }
                var submitUser = "";
                var description = "";
                if (json.actions[0].causes){
                	description = json.actions[0].causes[0].shortDescription;
                	if (description == "Started by an SCM change"){
                		for(var index in json.culprits){
                    		submitUser += getSoeId(json.culprits[index].absoluteUrl);
                        }
                	// Started by upstream project
                	}else if (description.indexOf('Started by upstream project') > -1){
                		if (isSuccess(json.result)){
                    		console.info(job + " build success trigger by upstream project, skip");
                    		return;
                    	}else{
                    		description = json.actions[0].causes[0].shortDescription;
                    	}
                    }
                } else {
                	var cause = json.actions[1].causes[0];
                	submitUser = cause.userId;
                	description = cause.shortDescription;
                }
                console.info(job + " " + description + ",user:" + submitUser);
                prevBuild = json.number;
                if (submitUser == "" || submitUser.indexOf(soeid) > -1){
                	desktopNotify(json.result,
                			"[Jenkins] " + job + ": Build #" + json.number + " -" + json.result,
                			'Click here to see more details',
                			jobUrl);
                }
            }
        });
    }

    var retryTime = 2500;
    var retryCount = 0;
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
        	desktopNotify('FAILURE','Failed to access to Jenkins Websocket','Please check your websocket URL:' + wsUrl, 'http://www.baidu.com');
//            $.fn.desktopNotify(
//                {
//                    picture: getIcon("FAILURE"),
//                    title: "Failed to access to Jenkins Websocket Notifier. Please check your websocket URL",
//                    text : wsUrl
//                }
//            );
        });

        // auto reconnect
        ws.bind('websocket::close', function() {
            console.log('closed connection, retry count:' + retryCount++);
            if (retryCount <5){
            	retryTime = retryTime * 2;
                setTimeout(function() {
                    bind(websocketUrl, apiUrl);
                }, retryTime);
            }
        });

        ws.webSocket({
            entry : wsUrl
        });
    }
    
    function desktopNotify(iconType,title,message,url){
    	var notify = new Notification(title,{
    		icon: getIcon(iconType),
    		body: message
    	});
    	notify.onclick = function(){
    		window.open(url);
    	}
    }

    bind(websocketUrl, apiUrl);
});
