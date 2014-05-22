/**
 * @fileoverview Contains TestReciever Class and initialisation code
 * for TestReciever and TogglePlugin. Requires previous inclusion of
 * <i>plugins.js</i>
 */

/**
 * Class responsible for running all automated tests. Once created it will
 * attach listeners to the start button. When the start button is clicked
 * it will scan the tests table for tests that should be run in the current mode
 * (auth or no-auth). It will the continue to execute all tests in a serial
 * fashion adding .success or .danger depending on whether the test passed or
 * failed.
 */



/**
 * TestReciever constructor. Attaches all DOM click observers
 * @constructor
 */
mpctests.TestReciever = function() {
  // Test fields
  this.tests_ = [];
  this.testsStarted_ = false;
  this.mode_ = null;

  // Chromecast fields
  this.session_ = null;

  // Attach click observers
  this.attachObservers_();
};


/**************************/
/* Initialisation section */
/**************************/


/**
 * Attach click observers to submit buttons in auth and no-auth sections
 * @private
 */
mpctests.TestReciever.prototype.attachObservers_ = function() {
  // Create closure reference to original "this" object for code readability
  // and ease of parent object access
  $('.auth .form-inline').submit(function(e) {
    this.startAuthTests_.call(this, $(e.target).find('.app-id').val());
    return false;
  }.bind(this));
  $('.no-auth .form-inline').submit(function(e) {
    this.startNoAuthTests_.call(this,
        $(e.target).find('.app-id').val(),
        $(e.target).find('.media-url').val(),
        $(e.target).find('.media-type').val());
    return false;
  }.bind(this));
};


/**
 * Generic form validation performed in both auth and no-auth modes
 * @private
 * @param {string} appID The appid entered by the user when starting tests
 * @return {boolean} true if form is valid, otherwise false
 */
mpctests.TestReciever.prototype.genericFormValidation_ = function(appID) {
  if (appID.length !== 8) {
    alert('Please enter a valid application id');
    return false;
  } else if (this.testsStarted_ === true) {
    alert('Tests have already run or are in progress. Please refresh the ' +
        'page to restart');
    return false;
  }
  return true;
};


/**
 * Starts auth mode tests. From here castAPI is initialised, session is
 * joined, existance of media is confirmed and if successful tests are
 * launched.
 * @private
 * @param {string} appID The appid entered by the user when starting tests
 */
mpctests.TestReciever.prototype.startAuthTests_ = function(appID) {
  if (this.genericFormValidation_(appID)) {
    this.mode_ = 'auth';
    this.initializeCastApi_(appID);
  }
};


/**
 * Starts no-auth mode tests. From here castAPI is initialised, session is
 * joined, after which point the media that the user has specified is loaded
 * and if successful, tests are launched.
 * @private
 * @param {string} appID The appid entered by the user when starting tests
 * @param {string} mediaURL The URL of the media to be used in this test
 * @param {string} mediaType The meta type of the media at the mediaURL
 */
mpctests.TestReciever.prototype.startNoAuthTests_ =
    function(appID, mediaURL, mediaType) {
  if (this.genericFormValidation_(appID)) {
    if (mediaURL.length === 0) {
      alert('Please enter a valid media URL');
    } else {
      this.mode_ = 'no-auth';
      this.initializeCastApi_(appID);

      // Start loading media once session has been established
      $(document).on('requestSessionSuccess', function() {
        // Play media when session has been started
        var mediaInfo = new chrome.cast.media.MediaInfo(mediaURL);
        mediaInfo.contentType = mediaType;
        var request = new chrome.cast.media.LoadRequest(mediaInfo);
        request.autoplay = true;
        request.currentTime = 0;
        this.session_.loadMedia(request,
            this.onMediaDiscovered_.bind(this, 'loadMedia'),
            this.onMediaError_);
      }.bind(this));
    }
  }
};


/*******************************/
/* Cast init & session section */
/*******************************/


/**
 * Initialises the castAPI, which if successful goes on to launch the App
 * @private
 * @param {string} appID The appid entered by the user when starting tests
 */
mpctests.TestReciever.prototype.initializeCastApi_ = function(appID) {
  var sessionRequest = new chrome.cast.SessionRequest(appID);
  var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
      this.sessionListener_.bind(this),
      this.receiverListener_.bind(this));

  // Preserve current context on callback
  chrome.cast.initialize(apiConfig,
      function() {
        this.appendMessage_('Init success');
        this.launchApp_(); /* Immediately try and launch app */
      }.bind(this),
      function(e) {
        this.appendMessage_('Init failure');
        this.appendMessage_(e);
      }.bind(this)
  );
};


/**
 * Reciever listener function which appends messages to the debug area
 * @private
 * @param {string} e Message passed to callback function
 */
mpctests.TestReciever.prototype.receiverListener_ = function(e) {
  if (e === 'available') {
    this.appendMessage_('receiver found');
  }
  else {
    this.appendMessage_('receiver list empty');
  }
};


/**
 * Requests a new session and appends information to debug area
 * @private
 */
mpctests.TestReciever.prototype.launchApp_ = function() {
  this.appendMessage_('launching app...');
  chrome.cast.requestSession(this.onRequestSessionSuccess_.bind(this),
      function(e) {
        this.appendMessage_('launch error');
        this.appendMessage_(e);
      }.bind(this)
  );
};


/**
 * Session listener function used to attach further media listener functions
 * and to add output to the debug areas
 * @private
 * @param {chrome.cast.Session} e Chromecast session object
 */
mpctests.TestReciever.prototype.sessionListener_ = function(e) {
  this.session_ = e;
  this.appendMessage_('New session ID:' + e.sessionId);
  if (this.session_.media.length != 0) {
    this.appendMessage_(
        'Found ' + this.session_.media.length +
        ' existing media sessions.');
    this.onMediaDiscovered_('sessionListener', this.session_.media[0]);
  }
  this.session_.addMediaListener(this.onMediaDiscovered_.bind(this,
      'addMediaListener'));
  this.session_.addUpdateListener(this.sessionUpdateListener_.bind(this));
};


/**
 * Session update function which outputs messages to debug area
 * @private
 * @param {string} isAlive Whether function is still alive or has been
 * removed
 */
mpctests.TestReciever.prototype.sessionUpdateListener_ = function(isAlive) {
  var message = isAlive ? 'Session Updated' : 'Session Removed';
  message += ': ' + this.session_.sessionId;
  this.appendMessage_(message);
};


/**
 * Callback executed when session creation has been successful. If in auth
 * mode it will check for the presence of media and will alert if none is
 * found. It also triggers requestSessionSuccess event which is used in
 * no-auth mode to kick off tests
 * @private
 * @param {chrome.cast.Session} e Chromecast session object removed
 */
mpctests.TestReciever.prototype.onRequestSessionSuccess_ = function(e) {
  this.session_ = e;
  this.appendMessage_('session success: ' + e.sessionId);
  this.session_.addUpdateListener(this.sessionUpdateListener_.bind(this));

  // So that no-auth tests know that a session has been created
  $(document).trigger('requestSessionSuccess');

  // Check for existing media
  if (this.session_.media.length != 0) {
    this.onMediaDiscovered_('onRequestSession', this.session_.media[0]);
    this.session_.addMediaListener(this.onMediaDiscovered_.bind(this,
        'addMediaListener'));
    this.session_.addUpdateListener(this.sessionUpdateListener_.bind(this));
  } else if (this.mode_ === 'auth') {
    // If we're in auth mode and no media has
    // been found something's gone wrong...
    alert('Error - no existing media found. Please launch your sender' +
        'app, play your media, then run these tests again');
    this.session_.stop(function() {}, function() {});
  }
};


/*****************/
/* Media section */
/*****************/


/**
 * Callback for when media is discovered. It will start tests in both auth
 * and no-auth mode if they havn't already been started
 * @private
 * @param {String} how How the media was discovered
 * @param {chrome.cast.media.Media} media Chromecast media object
 */
mpctests.TestReciever.prototype.onMediaDiscovered_ = function(how, media) {
  this.appendMessage_('new media session ID:' + media.mediaSessionId +
      ' (' + how + ')');
  if (this.testsStarted_ === false) {
    // Start tests as soon as media is discovered
    this.startTests_();
  }
};


/**
 * Callback when media fails to load. Triggers and alert to make it
 * obvious to the user what's happened.
 * @private
 * @param {chrome.cast.Error} e Chromecast error object
 */
mpctests.TestReciever.prototype.onMediaError_ = function(e) {
  this.appendMessage_('media error');
  this.appendMessage_(e);
  alert('Error loading media - ' + e.description +
      ' please check your media URL and meta content type');
  this.session_.stop();
};


/****************/
/* Test section */
/****************/


/**
 * Runs next test in queue. All tests are executed with at least a one
 * second delay to make it obvious to users what's happening
 * @private
 */
mpctests.TestReciever.prototype.runNextTest_ = function() {
  // Delay to make it more obvious what test is running
  setTimeout(function() {
    if (this.tests_.length !== 0) {
      var test = this.tests_.shift();
      this.appendMessage_('running test: ' + test.functionName);
      this[test.functionName + '_'](test.element);
    }
  }.bind(this), 1000);
};


/**
 * Enqueues all tests specified in the DOM. Specifically looks for all
 * table rows on page with a data-test attribute that are currently visible
 * @private
 */
mpctests.TestReciever.prototype.startTests_ = function() {
  this.testsStarted_ = true;
  this.appendMessage_('starting tests');
  $('table tr[data-test]:visible').each(function(i, element) {
    this.tests_.push({
      element: element,
      functionName: $(element).data('test')
    });
  }.bind(this));
  // Run first test
  this.runNextTest_();
};


/**
 * Processes the result of a test. Adds .pass class to element and sets its
 * content to 'pass' if test has passed otherwise adds a .danger class and
 * sets its content to 'fail'
 * @private
 * @param {DOMElement} element DOMElement that spawned test
 * @param {bool} result Whether the test has passed or failed
 * @param {String} error Error that was thrown by failed test
 */
mpctests.TestReciever.prototype.processTest_ =
    function(element, result, error) {

  if (result === true) {
    $(element).addClass('success');
    $(element).find('td.result').html('pass');
  } else {
    $(element).addClass('danger');
    $(element).find('td.result').html('fail');
    this.appendMessage_('Test failed with - ' + error);
  }
  // Run next test in queue
  this.runNextTest_();
};


/**
 * Test for whether the media namespace is supported. Checks to see if
 * urn:x-cast:com.google.cast.media is in current list of namespaces in
 * session
 * @private
 * @param {DOMElement} element DOMElement that spawned test
 */
mpctests.TestReciever.prototype.testMediaNameSpaceSupported_ =
    function(element) {

  var mediaNamespace = 'urn:x-cast:com.google.cast.media';
  for (var i = 0; i < this.session_.namespaces.length; i++) {
    if (this.session_.namespaces[i].name === mediaNamespace) {
      this.processTest_(element, true);
      return;
    }
  }
  this.processTest_(element, false);
};


/**
 * Tests what happens when sender prompts reciver to load an invalidURL.
 * Ensures that the expected error is thrown.
 * @private
 * @param {DOMElement} element DOMElement that spawned test
 */
mpctests.TestReciever.prototype.testInvalidURL_ = function(element) {
  // Play media when session has been started
  var currentMediaURL = this.session_.media[0].media.contentId;
  var currentMediaContentType = this.session_.media[0].media.contentType;

  // Callback function for reloading previous
  // media so tests can be continued
  var reloadPreviousMedia_ = function(callback) {
    var mediaInfo = new chrome.cast.media.MediaInfo(currentMediaURL);
    mediaInfo.contentType = currentMediaContentType;
    var request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = false;
    request.currentTime = 0;
    this.session_.loadMedia(request, callback, function(e) { callback(e) });
  }.bind(this);

  // Load broken media
  var mediaInfo = new chrome.cast.media.MediaInfo('http://xyz.zz/invalid.mp4');
  mediaInfo.contentType = 'video/mp4';
  var request = new chrome.cast.media.LoadRequest(mediaInfo);
  this.session_.loadMedia(request,
      function() {
        reloadPreviousMedia_(
            function(e) {
              this.processTest_(element, false,
                  'expected invalid media request to fail');
            }.bind(this)
        );
      }.bind(this),
      function(e) {
        if (e.description === 'LOAD_FAILED') {
          reloadPreviousMedia_(
              function(e) {
                this.processTest_(element, true);
              }.bind(this)
          );
        } else {
          reloadPreviousMedia_(
              function(e) {
                this.processTest_(element, false,
                    'expected invalid load media URL to return' +
                    'LOAD_MEDIA_FAILED error code');
              }.bind(this)
          );
        }
      }.bind(this)
  );
};


/**
 * Tests what happens when sender sends over a corrupt request to reciever.
 * Ensures that the expected error is thrown.
 * @private
 * @param {DOMElement} element DOMElement that spawned test
 */
mpctests.TestReciever.prototype.testInvalidRequest_ = function(element) {
  var mediaNamespace = 'urn:x-cast:com.google.cast.media';
  var request = new chrome.cast.media.SeekRequest();
  request.currentTime = 'INVALID_TIME';

  // Preserve current context in callback
  this.session_.sendMessage(mediaNamespace, JSON.stringify(request),
      function() {
        this.processTest_(element, false,
            'expected invalid media request to fail');
      }.bind(this),
      function(e) {
        if (e.code === chrome.cast.ErrorCode.INVALID_PARAMETER) {
          this.processTest_(element, true);
        } else {
          this.processTest_(element, false,
              'expected invalid media request to return INVALID_PARAMETER ' +
              'error code');
        }
      }.bind(this)
  );
};


/**
 * Tests what happens when play pause is invoked.
 * Ensures that the expected state is returned from the media after each
 * request.
 * @private
 * @param {DOMElement} element DOMElement that spawned test
 */
mpctests.TestReciever.prototype.testPlayPauseRequest_ = function(element) {
  var currentMedia = this.session_.media[0];
  var currentState = this.session_.media[0].playerState;

  // Callback function executed once we've established stream is paused
  var playPauseTest_ = function() {
    // Assert that current stream is paused
    currentState = currentMedia.playerState;
    if (currentState !== chrome.cast.media.PlayerState.PAUSED) {
      this.processTest_(element, false, 'expected current media state to ' +
          'be PAUSED after issuing pause() command');
    } else {
      this.session_.media[0].play(new chrome.cast.media.PlayRequest(),
          function() {
            // Assert that media is now playing
            currentState = currentMedia.playerState;
            if (currentState !== chrome.cast.media.PlayerState.PLAYING &&
                currentState !== chrome.cast.media.PlayerState.BUFFERING) {
              // Play command has not worked
              this.processTest_(element, false, 'expected current media state' +
                  ' to be PLAYING or BUFFERING after issuesing play() command');
            } else {
              // Finally, leave stream paused
              this.session_.media[0].pause(null,
                  function() {
                    this.processTest_(element, true);
                  }.bind(this),
                  function(e) {
                    this.processTest_(element, false,
                        'error during play/pause commands');
                  }.bind(this)
              );
            }
          }.bind(this),
          function(e) {
            this.processTest_(element, false,
                'error during play/pause commands');
          }.bind(this)
      );
    }
  }.bind(this);

  // Check to see if stream is already playing
  if (currentState === chrome.cast.media.PlayerState.PLAYING ||
      currentState === chrome.cast.media.PlayerState.BUFFERING) {
    // If it's playing, pause it
    this.session_.media[0].pause(null, playPauseTest_.bind(this),
        function(e) {
          this.processTest_(element, false, 'error during play/pause commands');
        }.bind(this)
    );
  } else {
    // If it's paused immediately run test
    playPauseTest_();
  }
};


/**
 * Tests timepoint control. This includes loading at a time offset
 * (no-auth only) and seeking to different time points.
 * Ensures that the expected time is returned from the media after each
 * request.
 * @private
 * @param {DOMElement} element DOMElement that spawned test
 */
mpctests.TestReciever.prototype.testTimepointControl_ = function(element) {
  var testSeek = function() {
    var request = new chrome.cast.media.SeekRequest();
    request.currentTime = Math.floor((Math.random() * 100) *
        this.session_.media[0].media.duration / 100);

    this.session_.media[0].seek(request,
        function() {
          var currentTime = this.session_.media[0].currentTime;
          if (currentTime !== request.currentTime) {
            this.processTest_(element, false, 'expected current media time ' +
                'to match time that was seeked to');
          } else {
            this.processTest_(element, true);
          }
        }.bind(this),
        function(e) {
          this.processTest_(element, false, 'error during seek command');
        }.bind(this)
    );
  }.bind(this);

  // If we are in no-auth mode try and reload media at a time offset
  if (this.mode === 'no-auth') {
    var currentMediaURL = this.session_.media[0].media.contentId;
    var currentMediaContentType = this.session_.media[0].media.contentType;

    var playOffset = Math.floor((Math.random() * 100) *
        this.session_.media[0].media.duration / 100);
    var mediaInfo = new chrome.cast.media.MediaInfo(currentMediaURL);
    mediaInfo.contentType = currentMediaContentType;

    var request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;
    request.currentTime = playOffset;
    this.session_.loadMedia(request,
        function() {
          var currentTime = this.session_.media[0].currentTime;
          if (currentTime === playOffset) {
            // Run remaining seek part of test
            testSeek();
          } else {
            this.processTest_(element, false,
                'expected currentTime to be advanced to playOffset');
          }
        }.bind(this),
        function(e) {
          this.processTest_(element, false, 'error during seek command');
        }.bind(this)
    );
  } else {
    // If we are in auth mode don't try and reload media,
    // instead start seek tests immediately
    testSeek();
  }
};


/**
 * Tests stop request.
 * Ensures that the session has no current media after stop request is
 * issued.
 * @private
 * @param {DOMElement} element DOMElement that spawned test
 */
mpctests.TestReciever.prototype.testStopRequest_ = function(element) {
  this.session_.media[0].stop(null,
      function() {
        if (this.session_.media[0] == null) {
          this.processTest_(element, true);
        } else {
          this.processTest_(element, false,
              'expected current media to be null after issuing stop() command');
        }
      }.bind(this),
      function(e) {
        this.processTest_(element, false, 'error while stopping media');
      }.bind(this)
  );
};


/**
 * Tests stop session request.
 * Enables reciever to be torn down and tests to be rerun.
 * @private
 * @param {DOMElement} element DOMElement that spawned test
 */
mpctests.TestReciever.prototype.testStopSessionRequest_ = function(element) {
  this.session_.stop(this.processTest_.bind(this, element, true),
      function() {
        this.processTest_(element, false, 'error while stopping session');
      }.bind(this));
};


/****************/
/* Util section */
/****************/


/**
 * Appends message to debug section on page
 * Enables reciever to be torn down and tests to be rerun.
 * @private
 * @param {DOMElement} message Debug message to be appended
 */
mpctests.TestReciever.prototype.appendMessage_ = function(message) {
  var dw = $('#debugmessage')[0];
  dw.innerHTML += JSON.stringify(message) + '\n';
  dw.scrollTop = dw.scrollHeight;
};
/******************************/
/****** End TestReciever ******/
/******************************/

window.onload = function() {
  // Wait for Chromecast API to load before creating testObject
  if (!chrome.cast || !chrome.cast.isAvailable) {
    setTimeout(function() {
      window.togglePlugin = new mpctests.TogglePlugin();
      window.testReciever = new mpctests.TestReciever();
    }, 200);
  }
};
