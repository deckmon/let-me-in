var status = false;
var countArr = {};
var debugger_tab_id = null;
var is_in = false;

window.onload = function() {
    // Remove interval for removed tabs
    chrome.tabs.onRemoved.addListener( function(tabId, removeInfo) {
        if(countArr.hasOwnProperty(String(tabId))) {
            window.clearInterval(countArr[String(tabId)].handle);
            delete countArr[String(tabId)];
        }
    });
    
    chrome.runtime.onMessage.addListener( function(msg, sender, sendResponse) {
        if(msg["type"] == "view") {
            sendResponse(countArr[msg["tabId"]]);
        } else if(msg["type"] == "begin") {
            addRefresher(countArr, msg["tabId"], msg["value"]);
        } else if(msg["type"] == "end") {
            removeRefresher(countArr, msg["tabId"]);
        }
    });
};

function addRefresher(countArr, tabId, interval) {
    var tabIdStr = String(tabId);
    if(countArr.hasOwnProperty(tabIdStr)) {
        window.clearInterval(countArr[tabIdStr].handle);
        delete countArr[tabIdStr];
    }
    var cur_url = null;
    is_in = false;
    chrome.tabs.get(tabId,function(tab) {
        var cur_url = tab.url;
        if(debugger_tab_id != tabId){
            if (debugger_tab_id != null){
                chrome.debugger.detach({tabId:tabId});
            }
            debugger_tab_id = tabId;
            chrome.debugger.attach({tabId:tabId}, "1.0",function() {
                chrome.debugger.sendCommand({tabId:tabId}, "Network.enable");
                chrome.debugger.onEvent.addListener(function(debuggeeId, message, params) {
                    if (debugger_tab_id != debuggeeId.tabId){
                        return;
                    };
                    if (message == "Network.responseReceived" && params.response.url == cur_url) {
                        if (Math.floor(params.response.status/100) == 2){
                            is_in = true;
                        }
                    };
                });
            });
        }
    });
    var handle = window.setInterval(function() {
        if (is_in){
            removeRefresher(countArr, tabId);
            chrome.browserAction.setBadgeText({text: 'in!', tabId: tabId});
            return;
        };
        chrome.tabs.get(tabId, function(tab) {
            if (countArr[tabIdStr].current > 0) {
                countArr[tabIdStr].current -= 10;
                var value = countArr[tabIdStr].current;
                chrome.browserAction.setBadgeText({text: String(Math.round(value / 100) / 10) + 's', tabId: tabId});
                chrome.runtime.sendMessage(null, {"type": "state", "tabId": tabId, "value": value});
            } else {
                if (tab.status != "complete" && countArr[tabIdStr].current > -3000){
                    countArr[tabIdStr].current -= 10;
                    chrome.browserAction.setBadgeText({text: String(Math.round(countArr[tabIdStr].current / 100) / 10) + 's', tabId: tabId});
                    return false;
                }
                countArr[tabIdStr].current = countArr[tabIdStr].interval;
                chrome.tabs.executeScript({
                    code: 'location.reload()'
                });
            }
        });
    }, 10);
    countArr[tabIdStr] = {
        "interval": interval,
        "current": interval,
        "handle": handle
    };
}

function removeRefresher(countArr, tabId) {
    var tabIdStr = String(tabId);
    if(countArr.hasOwnProperty(tabIdStr)) {
        chrome.browserAction.setBadgeText({text: "", tabId: tabId});
        window.clearInterval(countArr[tabIdStr].handle);
        countArr[tabIdStr].current = "";
        countArr[tabIdStr].handle = null;
    }
}
