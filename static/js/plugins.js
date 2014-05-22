/**
 * @fileoverview Contains TogglePlugin Class.
 */



/**
 * Class responsible for toggling hidden sections upon a user action. Enables
 * DOM visibility toggling to be defined within an HTML context in a simple
 * and easy to update manner.
 * @constructor
 */
mpctests.TogglePlugin = function() {
  this.attachObservers_();
};


/**
 * Attach click observers to all elements with a data attribute of toggle
 * @private
 */
mpctests.TogglePlugin.prototype.attachObservers_ = function() {
  // Create closure reference to original "this" object for code readability
  // and ease of parent object access
  (function(_this) {
    $("*[data-plugin='toggle']").click(function(e) {
      _this.doToggleOn_($(e.target).data('toggle-on'));
      _this.doToggleOff_($(e.target).data('toggle-off'));
    });
  })(this);
};


/**
 * Toggle list of elements on
 * @private
 * @param {Array} elements List of elements to operate on
 */
mpctests.TogglePlugin.prototype.doToggleOn_ = function(elements) {
  // Some nested elements need to use no-fade to prevent double fade in
  $(elements).removeClass('hidden').not('.no-fade').addClass('fade-in');
};


/**
 * Toggle list of elements off
 * @private
 * @param {Array} elements List of elements to operate on
 */
mpctests.TogglePlugin.prototype.doToggleOff_ = function(elements) {
  $(elements).addClass('hidden');
};
