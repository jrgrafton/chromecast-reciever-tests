/********************************/
/****** Start testReciever ******/
/********************************/
var testReciever = (function() {
  var _this;

  function TestReciever(){
    // Store static object reference
    _this = this;
    _this.attachObservers();
  };

  TestReciever.prototype = {
    constructor : TestReciever,

    /* Initialization functions */
    attachObservers : function() {
      var _this = this;
      $(".form-inline").submit(function(e) {
          _this.initializeCastApi($('#app-id').val());
          e.preventDefault();
      });
    },
    initializeCastApi : function(appID) {
      var applicationID = appID;//"5E448CA4";
      var sessionRequest = new chrome.cast.SessionRequest(applicationID);
      var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
        _this.sessionListener,
        _this.receiverListener);

      chrome.cast.initialize(apiConfig, function() {
        _this.appendMessage('Init success');
        _this.launchApp(); /* Immediately try and launch app */
      }, function(e) {
        _this.appendMessage('Init failure');
        _this.appendMessage(e);
      });
    },
    receiverListener : function(e) {
      if( e === 'available' ) {
        _this.appendMessage("receiver found");
      }
      else {
        _this.appendMessage("receiver list empty");
      }
    },
    launchApp : function() {
      _this.appendMessage("launching app...");
      chrome.cast.requestSession(_this.onRequestSessionSuccess, function(e){
        _this.appendMessage("launch error");
        _this.appendMessage(e);
      });
    },
    /* Session functions */
    sessionListener : function(e) {
      _this.appendMessage('New session ID:' + e.sessionId);
      _this.session = e;
      if (_this.session.media.length != 0) {
        _this.appendMessage(
            'Found ' + _this.session.media.length + ' existing media sessions.');
        _this.onMediaDiscovered('sessionListener', _this.session.media[0]);
      }
      _this.session.addMediaListener(_this.onMediaDiscovered.bind(_this, 'addMediaListener'));
      _this.session.addUpdateListener(_this.sessionUpdateListener.bind(_this)); 
    },
    sessionUpdateListener : function(isAlive) {
      var message = isAlive ? 'Session Updated' : 'Session Removed';
      message += ': ' + _this.session.sessionId;
      _this.appendMessage(message);
    },
    onRequestSessionSuccess : function(e) {
      _this.appendMessage("session success: " + e.sessionId);
      _this.session = e;
      _this.session.addUpdateListener(_this.sessionUpdateListener.bind(_this));  
      if (_this.session.media.length != 0) {
        _this.onMediaDiscovered('onRequestSession', _this.session.media[0]);
      } else {
        alert("Error - no existing media found. Please launch your app and player media via another platform and rerun these tests");
      }
      _this.session.addMediaListener(
        _this.onMediaDiscovered.bind(_this, 'addMediaListener'));
      _this.session.addUpdateListener(_this.sessionUpdateListener.bind(_this));  
    },

    /* Media functions */
    onMediaDiscovered : function(how, media) {
      _this.appendMessage("new media session ID:" + media.mediaSessionId + ' (' + how + ')');
      _this.currentMedia = media;
      _this.currentMedia.addUpdateListener(_this.onMediaStatusUpdate);
      _this.startTests();
    },

    onMediaError : function(e) {
      _this.appendMessage("media error");
      _this.appendMessage(e);
    },

    onMediaStatusUpdate : function(isAlive) {
      _this.appendMessage("media status update isAlive " + isAlive);
    },

    /* tests */
    startTests : function() {
      _this.appendMessage("starting tests");
      $("table tr[data-test]").each(function(i, element) {
        (function(i, element) {
          var _element = element;
          setTimeout(function() {
            _this.appendMessage("Running test: " + $(element).data("test"));
            _this[$(element).data("test")](_element);
          }, i * 1000);
        })(i, element);
      });
    },
    processTest : function(element, result) {
      if(result === true) {
        $(element).addClass("success");
        $(element).find("td.result").html("pass");
      } else {
        $(element).addClass("danger");
        $(element).find("td.result").html("fail");
      }
    },
    testMediaNameSpaceSupported : function(element) {
      var mediaNamespace = "urn:x-cast:com.google.cast.media";
      for(var i = 0; i < _this.session.namespaces.length; i++) {
        if(_this.session.namespaces[i].name === mediaNamespace) {
          _this.processTest(element, true);
          return;
        }
      }
      _this.processTest(element, false);
    },
    testVolumeRequest : function(element) {
      var currentMedia = _this.session.media[0];
      var volume = new chrome.cast.Volume(Math.random(), false);
      var request = new chrome.cast.media.VolumeRequest(volume);
      currentMedia.setVolume(request, _this.processTest.bind(_this, element, true), _this.processTest.bind(_this, element, true));
    },
    testSeekRequest : function(element) {
      var currentMedia = _this.session.media[0];
      var request = new chrome.cast.media.SeekRequest();
      request.currentTime = (Math.random() * 100) * currentMedia.media.duration / 100;
      currentMedia.seek(request, _this.processTest.bind(_this, element, true), _this.processTest.bind(_this, element, true));
    },
    testPlayRequest : function(element) {
      var currentMedia = _this.session.media[0];
      currentMedia.play(null, _this.processTest.bind(_this, element, true), _this.processTest.bind(_this, element, true));
    },
    testPauseRequest : function(element) {
      var currentMedia = _this.session.media[0];
      currentMedia.play(null, _this.processTest.bind(_this, element, true), _this.processTest.bind(_this, element, true));
    },
    testStopRequest : function(element) {
      var currentMedia = _this.session.media[0];
      currentMedia.stop(null, _this.processTest.bind(_this, element, true), _this.processTest.bind(_this, element, true));
    },
    /* util functions */
    appendMessage : function(message) {
      var dw = document.getElementById("debugmessage");
      dw.innerHTML += JSON.stringify(message) + '\n';
      dw.scrollTop = dw.scrollHeight;
    }
  }

  return TestReciever;
})();
/******************************/
/****** End testReciever ******/
/******************************/

// On window load
window.onload = function() {
  if (!chrome.cast || !chrome.cast.isAvailable) {
    setTimeout(function(){
      window.testReciever = new testReciever();
    }, 1000);
  }
}
