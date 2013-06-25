/*
 * sparrow.js
 *
 * Sparrow - light weight JS library. Lower level and boarder then JQuery, but less DOM functions.
 */

// Simple check for browser features
if ( ! document.querySelectorAll || !window.Storage ) {
   alert('Please upgrade browser.');
}

/**
 * Select DOM Nodes by CSS selector.
 * 
 * @param {Node} subject Optional. Root node to select from. Default to document.
 * @param {String} selector CSS selector to run. Has shortcut for simple id/class/tag.
 * @returns {Array-like} Array or NodeList of DOM Node result.
 */
function _ ( root, selector ) {
   if ( selector === undefined ) {
      selector = root;
      root = document;
   }
   if ( ! selector ) return [ root ];
   // Test for simple id / class / tag, if fail then use querySelectorAll
   if ( selector.indexOf(' ') > 0 || ! /^[#.]?\w+$/.test( selector ) ) return root.querySelectorAll( selector );
   
   // Get Element series is many times faster then querySelectorAll
   if ( selector.charAt(0) === '#' ) {
      var result = root.getElementById( selector.substr(1) );
      return result ? [ result ] : [ ];
   }
   if ( selector.charAt(0) === '.' ) return root.getElementsByClassName( selector.substr(1) );
   return root.getElementsByTagName( selector );
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Array Helpers
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Convert an array-like object to be an array. Default to clone or slice.
 *
 * @param {Array-like} subject Subject to be converted.
 * @param {Integer} startpos If given, work like Array.slice( startpos ).
 * @param {Integer} length If this and startpos is given, work like Array.slice( startpos, length ).
 * @returns {Array} Clone or slice of subject.
 */
_.ary = function _ary ( subject, startpos, length ) {
   if ( subject.length <= 0 ) return [];
   var s = Array.prototype.slice;
   if ( startpos === undefined ) return subject instanceof Array ? subject : s.call( subject, 0 );
   return s.call( subject, startpos, length );
};

/**
 * Given an array-like object and one or more columns, extract and return those columns from subject.
 *
 * @param {Array-like} subject Array-like object to be extracted.
 * @param {String} column Columns (field) to extract.
 * @returns {Array} Array (if single column) or Array of Array (if multiple columns).
 */
_.col = function _col ( subject, column /* ... */) {
   if ( ! ( subject instanceof Array ) ) subject = _.ary( subject );
   if ( column === undefined ) return subject.map(function(e){ return e[0]; });
   if ( arguments.length === 2 ) return subject.map(function(e){ return e[column]; });
   return subject.map(function(e){
      var result = [];
      for ( var i = 1, l = arguments.length ; i < l ; i++ ) result.push( e[arguments[i]] );
      return result ;
   });
};

/**
 * Returns a sorter function that sort an array of items by given fields.
 *
 * @param {String} field Field name to compare
 * @param {boolean} des   true for a descending sorter. false for ascending sorter.
 * @returns {function} Sorter function
 */
_.sorter = function _sorter ( field, des ) {
   if ( ! des ) {
      return function _sorter_asc( a, b ) { return a[ field ] > b[ field ] ?  1 : ( a[ field ] < b[ field ] ? -1 : 0 ); };
   } else {
      return function _sorter_des( a, b ) { return a[ field ] > b[ field ] ? -1 : ( a[ field ] < b[ field ] ?  1 : 0 ); };
   }
};

/**
 * Returns a sorter function that sort an array of items by given fields.
 *
 * @param {Array} data Data to sort. Will be modified.
 * @param {String} field Field name to compare
 * @param {boolean} des   true for a descending sort. false for ascending sort.
 * @returns {Array} Sorted data.
 */
_.sort = function _sort ( data, field, des ) {
   return data.sort( _.sorter( field, des ) );
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Function Helpers
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Call a function - if it is not undefined - in a try block and return its return value.
 *
 * @param {Function} func   function to call. Must be function, null, or undefined.
 * @param {Object} thisObj  'this' to be passed to the function
 * @param {any} param       call parameters, can have multiple.
 * @returns {any}           Return value of called function, or undefined if function is not called or has error.
 */
_.call = function _call ( func, thisObj, param /*...*/ ) {
   if ( func === undefined || func === null ) return undefined;
   try {
      if ( arguments.length <= 1 ) return func();
      else if ( arguments.length <= 3 ) return func.call( thisObj, param );
      else return func.apply( thisObj, _.ary(arguments, 2) );
   } catch ( e ) { _.error( [ e, func, arguments ] ); }
};

/**
 * Given a function, return a function that when called multiple times, only the first call will be transferred.
 * Useful for concurrent error callback, so that the first error pass through and subsequence error doesn't.
 * Parameters passed to the returned function will be supplied to the callback as is.
 * This function will disregard any additional parameters.
 *
 * @param {type} func  Function to call.
 * @returns {function} Function that can be safely called multiple times without calling func more then once
 */
_.callonce = function _call ( func ) {
   if ( ! func ) return function () {};
   return function _callonce_call () {
      if ( ! func ) return; // func would be set to null after first call
      var f = func;
      func = null;
      return _.call.apply( this, [ f, this ].concat( _.ary( arguments ) ) );
   };
};

/**
 * Capture parameters in a closure and return a callback function
 * that can be called at a later time.
 */
_.callfunc = function _callfunc ( func, thisObj, param /*...*/ ) {
   if ( arguments.length <= 1 ) return func;
   if ( arguments.length <= 3 ) return function _callback1 () { func.call( thisObj, param ); };
   var arg = _.ary( arguments, 2 );
   return function _callback () { func.apply( thisObj, arg ); };
};

if ( window.setImmediate === undefined ) {
   if ( window.requestAnimationFrame ) {
      window.setImmediate = window.requestAnimationFrame;
      window.clearImmediate = window.cancelAnimationFrame;
   } else {
      window.setImmediate = function setImmediate ( func ){ return window.setTimeout(func, 0); };
      window.clearImmediate = window.clearTimeout;
   }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Ajax / js / Cross origin inclusion
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Ajax function.
 *
 * @param {String} url Url to send get request.
 * @param {function} onsuccess Callback (responseText, xhr) when the request succeed.
 * @param {function} onfail Callback (xhr, text statue) when the request failed.
 * @param {function} ondone Callback (xhr) after success or failure.
 * @param {Object} xhr XMLHttpRequest object to use. If none is provided the default will be used.
 * @returns {Object} xhr object
 */
_.ajax = function _ajax ( url, onsuccess, onfail, ondone, xhr ) {
   if ( xhr === undefined ) xhr = new XMLHttpRequest();
   _.info( "[AJAX] Ajax: "+url);
   xhr.open( 'GET', url );
   //xhr.mozBackgroundRequest = true;
   var finished = false;
   xhr.onreadystatechange = function _ajax_onreadystatechange () {
      if ( xhr.readyState === 4 ) {
         _.debug( 'Ajax ready 4, status ' + xhr.status + ', url ' + url );
         // 0 is a possible response code for local file access under IE 9 ActiveX
         if ( [0,200,302].indexOf( xhr.status ) >= 0 && xhr.responseText ) {
            setImmediate( function _ajax_err_status(){
               if ( finished ) return;
               finished = true;
               _.call( onsuccess, xhr, xhr.responseText, xhr );
               _.call( ondone, xhr, xhr );
            } );
         } else {
            setImmediate( function _ajax_err_status () {
               if ( finished ) return;
               finished = true;
               _.call( onfail, xhr, xhr, "HTTP Response Code " + xhr.status );
               _.call( ondone, xhr, xhr );
            } );
         }
         xhr.onreadystatechange = function(){}; // Avoid repeated call
      }
   };
   try {
      xhr.send();
   } catch (e) {
      _.error( 'Ajax exception on ' + url + ': ' + e );
      finished = true;
      _.call( onfail, xhr, xhr, e );
      _.call( ondone, xhr, xhr );
   }
   return xhr;
};

/**
 * Load a JavaScript from an url.
 *
 * @param {String} url  JS url.
 * @param {Object} option
 * @returns {undefined}
 */
_.js = function _js ( url, option ) {
   if ( option === undefined ) option = {};
   // Validate before doing anything, if pass then we are done
   if ( option.validate && option.validate.call( null, url, option ) ) return _js_done( 'onload' );

   var e = document.createElement( 'script' );
   e.src = url;
   if ( option.charset ) e.charset = option.charset;
   _.info( "[JS] Load script: " + url );

   var done = false;
   function _js_done ( call, log ) {
      if ( done ) return;
      done = true;
      if ( log ) _.log( log );
      _.call( option[call], e, url, option );
      if ( e && e.parentNode === document.body ) document.body.removeChild(e);
   }

   e.addEventListener( 'load', function _js_load (){
      // Delay execution to make sure validate/load is called _after_ script has been ran.
      setImmediate( function _js_load_delayed () {
         if ( option.validate && ! _.call( option.validate, e, url, option )  ) {
            return _js_done( 'onerror', "[JS] Script error: " + url );
         }
         _js_done( 'onload', "[JS] Script loaded: " + url );
      } );
   } );
   e.addEventListener( 'error', function _js_error (){
      _js_done( 'onerror', "[JS] Script not found: " + url );
   } );

   document.body.appendChild( e );
};

/**
 * Cross Origin Request function. Currently only works for IE.
 *
 * @param {String} url Url to send get cross-origin request.
 * @param {function} onsuccess Callback (responseText, xhr) when the request succeed.
 * @param {function} onfail Callback (xhr, text statue) when the request failed.
 * @param {function} ondone Callback (xhr) after auccess or failure.
 * @returns {Object} xhr object
 */
_.cor = function _cor ( url, onsuccess, onfail, ondone ) {
   if ( window.ActiveXObject !== undefined ) {
      // XMLHttp can cross origin.
      return _.ajax( url, onsuccess, onfail, ondone, new ActiveXObject("Microsoft.XMLHttp") );
   } else {
      _.info( "[COR] Cross orig req: "+url );
      alert('Please override Cross Origin Request control (TODO: Explain better)');
      // enablePrivilege is disabled since Firefox 15
      //try {
      //   netscape.security.PrivilegeManager.enablePrivilege('UniversalXPConnect');
      //} catch ( e ) {
      //   alert(e);
      //}
      //return _.ajax( url, onsuccess, onfail, ondone, new ActiveXObject("Microsoft.XMLHttp") );
   }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Document parsing
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Parse xml and return an xml document.
 * Will try DOMParser then MSXML 6.0.
 *
 * @param {String} txt XML text to parse.
 * @returns {Document} Parsed xml DOM Document.
 */
_.xml = function _xml ( txt ) {
   if ( window.DOMParser !== undefined ) {
      return new DOMParser().parseFromString( txt, 'text/xml' );

   } else if ( window.ActiveXObject !== undefined )  {
      var xml = new ActiveXObject('Msxml2.DOMDocument.6.0');
      xml.loadXML( txt );
      return xml;

   } else {
      _.error('XML Parser not supported');
   }
};

/**
 * parse xml and return an xml document.
 * Will try DOMParser then MSXML 6.0.
 *
 * @param {String} txt HTML text to parse.
 * @returns {Node} A node containing parsed html.
 */
_.html = function _html ( txt ) {
   var e = _.html.node;
   if ( !e ) {
      e = _.html.node = document.createElement('div');
      e.style.display = 'none';
      document.body.appendChild(e);
   }
   e.innerHTML = txt;
   return e;
};
_.html.node = null;


/**
 * Apply an xsl to xml and return the result of transform
 *
 * @param {type} xml XML String or document to be transformed.
 * @param {type} xsl XSL String or document to transform xml.
 * @returns {Document} Transformed fragment root or null if XSL is unsupported.
 */
_.xsl = function _xsl ( xml, xsl ) {
   var xmlDom = typeof( xml ) === 'string' ? _.xml( xml ) : xml;
   var xslDom = typeof( xsl ) === 'string' ? _.xml( xsl ) : xsl;
   if ( window.XSLTProcessor ) {
      var xsltProcessor = new XSLTProcessor();
      xsltProcessor.importStylesheet( xslDom );
      return xsltProcessor.transformToFragment( xmlDom, document );

   } else if ( xmlDom.transformNode ) {
      return xmlDom.transformNode( xslDom );

   } else if ( window.ActiveXObject )  {
         /* // This code has problem with special characters
         var xslt = new ActiveXObject("Msxml2.XSLTemplate");
         if ( typeof( xsl === 'string' ) ) { // Must use ActiveX free thread document as source.
            xslDom = new ActiveXObject('Msxml2.FreeThreadedDOMDocument.3.0');
            xslDom.loadXML( xsl );
         }
         xslt.stylesheet = xslDom;
         var proc = xslt.createProcessor();
         proc.input = xmlDom;
         proc.transform();
         return _.xml( proc.output );
      */
         xmlDom = new ActiveXObject('Msxml2.DOMDocument.6.0');
         xmlDom.loadXML( xml );
         xslDom = new ActiveXObject('Msxml2.DOMDocument.6.0');
         xslDom.loadXML( xsl );
         var result = new ActiveXObject('Msxml2.DOMDocument.6.0');
         result.async = false;
         result.validateOnParse = true;
         xmlDom.transformNodeToObject( xslDom, result );
         return result;

   } else {
      return null;
   }
};

/**
 * Run XPath on a DOM node.
 *
 * @param {Node} node   Node to run XPath on.
 * @param {String} path XPath to run.
 * @returns {NodeList} XPath result.
 */
_.xpath = function _xpath ( node, path ) {
   var doc = node.ownerDocument;
   if ( doc.evaluate ) {
      return doc.evaluate( path, node, null, XPathResult.ANY_TYPE, null );
   } else {
      return doc.selectNodes( path );
   }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Console logging & timing.
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Console log function.
 *
 * @param {String} type Optional. Type of console function to run, e.g. 'debug' or 'warn'. If not found then fallback to 'log'.
 * @param {mixed}  msg  Message objects to pass to console function.
 * @returns {undefined}
 */
_.log = function _info ( type, msg ) {
   if ( msg === undefined ) {
      msg = type;
      type = 'log';
   }
   if ( window.console ) {
      if ( console[type] === undefined ) type = 'log';
      var t = new Date();
      console[type]( "["+t.getHours()+":"+t.getMinutes()+":"+t.getSeconds()+"."+t.getMilliseconds()+"] ", msg );
   }
};

/**
 * Safe console.debug message.
 *
 * @param {type} msg Message objects to pass to console.
 * @returns {undefined}
 */
_.debug = function _info ( msg ) { _.log( 'debug', msg ); };

/**
 * Safe console.info message.
 *
 * @param {type} msg Message objects to pass to console.
 * @returns {undefined}
 */
_.info = function _info ( msg ) { _.log( 'info', msg ); };

/**
 * Safe console.warn message.
 *
 * @param {type} msg Message objects to pass to console.
 * @returns {undefined}
 */
_.warn = function _info ( msg ) { _.log( 'warn', msg ); };

/**
 * Safe console.error message.  It will stack up all errors in a 50ms window and shows them together.
 * Messages with same string representation as previous one will be ignored rather then stacked.
 *
 * @param {type} msg Message objects to pass to console.
 * @returns {undefined}
 */
_.error = function _info ( msg ) {
   if ( ! _.error.timeout ) {
      // Delay a small period so that errors popup together instead of one by one
      _.error.timeout = setTimeout( function _error_timeout(){
         _.error.timeout = 0;
         alert( _.error.log );
         _.error.log = [];
      }, 50 );
   }
   _.log( 'error', msg );
   if ( ( "" + msg ) !== _.error.lastmsg ) {
      _.error.lastmsg = "" + msg;
      _.error.log.push( msg );
   }
};
_.error.timeout = 0;
_.error.log = [];

/**
 * Coarse timing function. Will show time relative to previous call as well as last reset call.
 * Time is in unit of ms. This routine is not designed for fine-grain measurement that would justify using high performance timer.
 *
 * @param {String} msg Message to display.  If undefined then will reset accumulated time.
 * @returns {Array} Return [time from last call, accumulated time].
 */
_.time = function _time ( msg ) {
   var t = _.time;
   var now = new Date();
   if ( msg === undefined ) {
      t.base = now;
      t.last = null;
      return;
   }
   var fromBase = now - t.base;
   var fromLast = t.last ? ( 'ms,+' + (now - t.last) ) : '';
   _.debug( msg + ' (+' + fromBase + fromLast + 'ms)' );
   t.last = now;
   return [now - t.last,fromBase];
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// String helpers
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * HTML escape function.
 *
 * @param {String} txt  Text to do HTML escape.
 * @returns {String} Escaped text.
 */
_.escHtml = function _escHtml ( txt ) {
   if ( ! /[<&'"]/.test( txt ) ) return txt;
   //return t.replace( /&/g, '&amp;').replace( /</g, '&lt;').replace( /"/g, '&quot;' ).replace( /'/g, '&#39;' );
   return txt.replace( /[&<"']/g, function ( c ) { return { '&':'&amp;', '<':'&lt;', '"':"&quot;", "'":'&#39;' }[ c ]; });
};

/**
 * JavaScript escape function.
 *
 * @param {String} txt  Text to do JavaScript escape.
 * @returns {String} Escaped text.
 */
_.escJs = function _escJs ( txt ) {
   return txt.replace( /\r?\n/g, '\\n').replace( /'"/g, '\\$0');
};

/**
 * Regular expressoin escape function.
 *
 * @param {String} txt  Text to do regx escape.
 * @returns {String} Escaped text.
 */
_.escRegx = function _escRegx ( txt ) {
   return txt.replace( /[()?*+.\\{}[\]]/g, '\\$0' );
};

/**
 * Round function with decimal control.
 *
 * @param {number} val Number to round.
 * @param {integer} decimal Optional. Decimal point to round to. Negative will round before decimal point. Default to 0.
 * @returns {number} Rounded number.
 */
_.round = function _round ( val, decimal ) {
   var e = Math.pow( 10, ~~decimal );
   //if ( e === 1 ) return Math.round( val );
   return Math.round( val *= e ) / e;
};

/**
 * Convert big number to si unit or vice versa. Case insensitive.
 * Support k (kilo, 1e3), M, G, T, P (peta, 1e15)
 *
 * @param {mixed} val  Number to convert to unit (e.g. 2.3e10) or united text to convert to number (e.g."23k").
 * @param {integer} decimal Optional. Decimal point of converted unit (if number to text). See _.round.
 * @returns {mixed} Converted text or number
 */
_.si = function _si ( val, decimal ) {
   if ( typeof( val ) === 'string' ) {
      if ( ! /^-?\d+(\.\d+)?[kmgtp]$/i.test( val ) ) return +val;
      var l = val.length-1, c = val.charAt( l ).toLowerCase();
      return val.substr( 0, l )*{'k':1e3,'m':1e6,'g':1e9,'t':1e12,'p':1e15}[c];
   } else {
      var count = 0;
      while ( val > 1000 || val < -1000 ) { val /= 1000; ++count; }
      return _.round( val, decimal ) + ['','k','M','G','T','P'][count];
   }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Object freezing
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

_.freeze = function _freeze ( o ) { return Object.freeze ? Object.freeze(o) : o; };
_.seal = function _seal ( o ) { return Object.seal ? Object.seal(o) : o; };
_.noExt = function _noExt ( o ) { return Object.preventExtensions ? Object.preventExtensions(o) : o; };
_.noDef = function _noDef ( e ) { if ( e && e.preventDefault ) e.preventDefault(); return false; };

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// DOM manipulation
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Create a DOM element and set its attributes / contents.
 *
 * @param {String} tag Tag name of element to create.
 * @param {mixed} attr Text content String, or object with properties to set. e.g. text, html, class, onclick, disabled, style.
 * @returns {Element} Created DOM element.
 */
_.create = function _create ( tag, attr ) {
   /* Disabled Id/class parsing because just the check would slow down _.create by 6% to 12%, and does not do anything new. *
   if ( typeof( attr ) !== 'object' ) attr = { 'text' : attr }; // Convert text / numeric attribute to proper attribute object
   if ( tag.indexOf( '#' ) > 0  || tag.indexOf( '.' ) > 0 ) { // Parse 'table.noprint.fullwidth#nav' into tag, class, id
      if ( ! attr ) attr = {}; // Create attribute object if not given
      tag.split( /(?=[#.])/ ).forEach( function( e, i ) {
         if ( i === 0 ) return tag = e; // Set first token as tag name
         if ( e.charAt(0) === '#') return attr.id = e.substr(1); // Set id
         if ( ! attr.className ) return attr.className = e.substr(1); // Set className
         attr.className += ' ' + e.substr(1); // Append className
      } );
   }
   */
   var result = document.createElement( tag );
   if ( attr ) {
      if ( typeof( attr ) !== 'object' ) {
         result.textContent = attr; 
      } else {
         for ( var name in attr ) {
            if ( name === 'text' ) {
               result.textContent = attr.text;
               
            } else if ( name === 'html' ) {
               result.innerHTML = attr.html;
               
            } else if ( name === 'class' || name === 'className' ) {
               result.className = attr[ name ];
               
            } else if ( name.indexOf('on') === 0 ) {
               result.addEventListener( name.substr( 2 ), attr[ name ] );
               
            } else {
               result.setAttribute( name, attr[ name ] );
            }
         }
      }
   }
   return result;
};

/**
 * Convert selector / DOM element / NodeList / array of Node to array-like node list.
 *
 * @param {mixed} e Selector or element(s).
 * @returns {Array-like} Array-like list of e.
 */
_.domlist = function _domlist ( e ) {
   if ( typeof( e ) === 'string' ) return _( e );
   else if ( e.length === undefined ) return [ e ];
   return e;
};

/**
 * Show DOM elements by setting display to ''.
 *
 * @param {mixed} e Selector or element(s).
 * @returns {Array-like} Array-like e
 */
_.show = function _show ( e ) {
   e = _.domlist( e );
   for ( var i = 0, l = e.length ; i < l ; i++ ) {
      e[ i ].style.display = '';
      delete e[ i ].style.display;
   }
   return e;
};

/**
 * Hide DOM elements by setting display to 'none'.
 *
 * @param {mixed} e Selector or element(s).
 * @returns {Array-like} Array-like e
 */
_.hide = function _show ( e ) {
   e = _.domlist( e );
   for ( var i = 0, l = e.length ; i < l ; i++ ) e[ i ].style.display = 'none';
   return e;
};

/**
 * Set DOM elements visibility by setting display to '' or 'none.
 *
 * @param {mixed} e Selector or element(s).
 * @param {boolean} visible If true then visible, otherwise hide.
 * @returns {Array-like} Array-like e
 */
_.visible = function _visible ( e, visible ) {
   return visible ? _.show( e ) : _.hide( e );
};

/**
 * Check whether given DOM element(s) contain a class.
 *
 * @param {mixed} e Selector or element(s).
 * @param {String} className  Class to check.
 * @returns {boolean} True if any elements belongs to given class.
 */
_.hasClass = function _hasClass ( e, className ) {
   return _.domlist( e ).some( function(c){ return c.className.split( /\s+/ ).indexOf( className ) >= 0; } );
};

/**
 * Adds class(es) to DOM element(s).
 *
 * @param {mixed} e Selector or element(s).
 * @param {mixed} className  Class(es) to add.  Can be String or Array of String.
 * @returns {Array-like} Array-like e
 */
_.addClass = function _addClass ( e, className ) {
   return _.toggleClass( e, className, true );
};

/**
 * Removes class(es) from DOM element(s).
 *
 * @param {mixed} e Selector or element(s).
 * @param {mixed} className  Class(es) to remove.  Can be String or Array of String.
 * @returns {Array-like} Array-like e
 */
_.removeClass = function _removeClass ( e, className ) {
   if ( className === undefined ) className = e.substr( 1 );
   return _.toggleClass( e, className, false );
};

/**
 * Adds or removes class(es) from DOM element(s).
 *
 * @param {mixed} e Selector or element(s).
 * @param {mixed} className  Class(es) to toggle.  Can be String or Array of String.
 * @param {boolean} toggle   True for add, false for remove, undefined for toggle.
 * @returns {Array-like} Array-like e
 */
_.toggleClass = function _toggleClass ( e, className, toggle ) {
   e = _.domlist( e );
   var c = typeof( className ) === 'string' ? [ className ] : className;
   for ( var i = e.length-1 ; i >= 0 ; i-- ) {
      for ( var j = c.length-1 ; j >= 0 ; j-- ) {
         var lst = e[ i ].className.split( /\s+/ ), pos = lst.indexOf( c[ j ] );
         if ( pos < 0 && ( toggle || toggle === undefined ) ) { // Absent and need to add
            e[ i ].className += ' ' + c[ j ];
         } else if ( pos >= 0 && ( ! toggle || toggle === undefined ) ) { // Exists and need to remove
            lst.splice( pos, 1 );
            e[ i ].className = lst.join( ' ' );
         }
      }
   }
   return e;
};

//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Asynchronous programming
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Countdown Latch object
 */
_.Latch = function( countdown, ondone ) {
   if ( typeof( countdown ) === 'function' ) {
      ondone = countdown;
      countdown = 0;
   }
   this.count = countdown;
   this.ondone = ondone;
};
_.Latch.prototype = {
   "count" : 0,
   "ondone" : null,

   /** Count up. */
   "count_up" : function _latch_countup( value ) {
      if ( value === undefined ) value = 1;
      this.count += value;
   },

   /** Count down.  If count reach 0 then run ondone. */
   "count_down" : function _latch_countdown( value ) {
      if ( value === undefined ) value = 1;
      this.count -= value;
      if ( this.count < 0 ) throw "IllegalStateException: Latch count below zero";
      if ( this.count === 0 ) _.call( this.ondone, this );
   },

   /** Return a function that can be used to countdown this latch */
   "count_down_function" : function _latch_countdown_function( value ) {
      var latch = this;
      return function _latch_countdown_callback() { latch.count_down( value ); };
   }
};

/**
 * Create a new executor
 * 
 * @param {type} thread   Max. number of parallel jobs.
 * @param {type} interval Minimal interval between job start.
 * @returns {_.Executor}  New executor object
 */
_.Executor = function( thread, interval ) {
   if ( thread ) this.thread = thread;
   if ( interval ) this.interval = interval;
   this.running = [];
   this.waiting = [];
};
_.Executor.prototype = {
   "_paused": false, // Whether this executor is paused.
   "_lastRun": 0, // Last job run time.
   "_timer" : 0,  // Timer for next notice() event, if interval > 0.
   "thread" : 1,
   "interval": 0,
   "running": [],
   "waiting": [],
   "add": function _executor_add ( runnable, param /*...*/ ) {
      return this.addTo.apply( this, [ this.waiting.length ].concat( _.ary( arguments ) ) );
   },
   "asap": function _executor_asap ( runnable, param /*...*/ ) {
      return this.addTo.apply( this, [0].concat( _.ary( arguments ) ) );
   },
   "addTo": function _executor_addTo ( index, runnable, param /*...*/ ) {
      if ( ! runnable.name ) runnable.name = runnable.toString().match(/^function\s+([^\s(]+)/)[1];
      _.debug('Queue task ' + runnable.name );
      var arg = [ runnable ].concat( _.ary( arguments, 2 ) );
      this.waiting.splice( index, 0, arg );
      return this.notice();
   },
   "finish" : function _executor_finish ( id ) {
      var r = this.running[id];
      _.debug('Finish task #' + id + ' ' + r[0].name );
      this.running[id] = null;
      return this.notice();
   },
   "clear"  : function _executor_clear () { this.waiting = []; },
   "pause"  : function _executor_pause () { this._paused = true; if ( this._timer ) clearTimeout( this._timer ); return this; },
   "resume" : function _executor_resume () { this._paused = false; this.notice(); return this; },
   /**
    * Check state of threads and schedule tasks to fill the threads.
    * This method always return immediately; tasks will run after current script finish.
    * 
    * @returns {_executor_notice}
    */
   "notice" : function _executor_notice () {
      this._timer = 0;
      if ( this._paused ) return this;
      var exe = this;

      function _executor_schedule_notice ( delay ) {
         if ( exe._timer ) clearTimeout( exe._timer );
         exe._timer = setTimeout( _.callfunc( exe.notice, exe ), delay );
         return exe;
      }

      function _executor_run ( ii, r ){
         _.debug('Start task #' + ii + ' ' + r[0].name );
         try {
            if ( r[0].apply( null, [ ii ].concat( r.slice(1) ) ) !== false ) exe.finish( ii );
         } catch ( e ) {
            _.error( e );
            exe.finish( ii );
         }
      }

      var delay = this.interval <= 0 ? 0 : Math.max( 0, -(new Date()).getTime() + this._lastRun + this.interval );
      if ( delay > 12 ) return _executor_schedule_notice ( delay ); // setTimeout is not accurate so allow 12ms deviations
      for ( var i = 0 ; i < this.thread && this.waiting.length > 0 ; i++ ) {
         if ( ! this.running[i] ) {
            var r = exe.waiting.splice( 0, 1 )[0];
            exe.running[i] = r;
            //_.debug('Schedule task #' + i + ' ' + r[0].name );
            exe._lastRun = new Date().getTime();
            setImmediate( _.callfunc( _executor_run, null, i, r ) );
            if ( exe.interval > 0 ) return _executor_schedule_notice ( exe.interval );
         }
      }
      return this;
   }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Helper objects
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

_.EventManager = function _EventManager( owner, events ) {
   this.owner = owner;
   var lst = {};
   for ( var i = 0, l = events.length ; i < l ; i++ ) {
      lst[events[i]] = null;
   }
   this.lst = _.noExt( lst );
};
_.EventManager.prototype = {
   "lst" : {},
   "owner" : null,
   "add" : function _EventManager_add( event, listener ) {
      if ( this.lst[event] === undefined ) throw new Error("Unknown event");
      if ( this.lst[event] === null ) this.lst[event] = [];
      this.lst[event].push( listener );
   },
   "remove" : function _EventManager_remove( event, listener ) {
      var lst = this.lst[event];
      if ( lst === undefined ) throw new Error("Unknown event");
      if ( lst === null ) return;
      var i = lst.indexOf( listener );
      if ( i ) {
         lst.splice( i, 1 );
         if ( lst.length < 0 ) this.lst[event] = null;
      }
   },
   "fire" : function _EventManager_remove( event ) {
      var lst = this.lst[event];
      if ( lst === undefined ) throw new Error("Unknown event");
      if ( lst === null ) return;
      var l = lst.length, param = _.ary( arguments, 1 );
      for ( var i = 0 ; i < l ; i++ ) {
         lst[i].apply( this.owner, param );
      }
   }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Internationalisation and localisation
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/** Get language string and, if additional parameters are provided, format the parameters */
_.l = function _l( path, defaultValue, param /*...*/ ) {
   var l = _.l;
   var result = l.getset( path, undefined, l.currentLocale );
   if ( result === undefined ) result = ( defaultValue !== undefined || defaultValue === null ) ? defaultValue : path;
   if ( arguments.length > 2 ) {
      if ( arguments.length === 3 ) return l.format( result, param );
      else return l.format.apply( this, [result].concat( _.ary(arguments, 2) ) );
   }
   return result;
};

_.l.format = function _l_format( input, param /*...*/ ) {
   for ( var i = 1, l = arguments.length ; i < l ; i++ )
      input = input.replace( '%'+i, arguments[i] );
   return input;
};

/** Current locale for set and get operations. */
_.l.currentLocale = 'en';

/** Fallback locale in case localisation is not found */
_.l.fallbackLocale = 'en';

/** L10n resources. */
_.l.data = {};

/**
 * Set current locale.
 *
 * @param {String} lang  Locale to use. Pass in empty string, null, false etc. to use auto-detection
 * @returns {undefined}
 */
_.l.setLocale = function _l_setLocale( lang ) {
    if ( ! lang ) return _.l.detectLocale();
    if ( lang === _.l.currentLocale ) return;
    _.l.currentLocale = lang;
    _.l.event.fire( 'locale', lang );
};

/**
 * Override auto detect locale.
 *
 * @param {String} lang  Locale to use and save.
 * @returns {undefined}
 */
_.l.saveLocale = function _l_saveLocale( lang ) {
    if ( window.localStorage ) {
       if ( lang ) localStorage['_.l.locale'] = lang;
       else delete localStorage['_.l.locale'];
    }
    _.l.setLocale( lang );
};

/**
 * Detect user locale.  First check local session then check language setting.
 *
 * @param {String} defaultLocale  Default locale to use
 * @returns {undefined}
 */
_.l.detectLocale = function _l_detectLocale( defaultLocale ) {
    var l = _.l;
    var list = Object.keys( l.data );
    if ( defaultLocale ) l.fallbackLocale = defaultLocale;
    var pref = navigator.language || navigator.userLanguage;
    if ( window.localStorage ) pref = localStorage['_.l.locale'] || pref;
    if ( ! pref ) return;
    if ( list.indexOf( pref ) >= 0 ) return l.setLocale( pref );
    pref = pref.split( '-' )[0];
    if ( list.indexOf( pref ) >= 0 ) l.setLocale( pref );
};

/**
 * Get/set l10n resource on given path
 *
 * @param {type} path Path to get/set resource.
 * @param {type} set  Resource to set.  If null then regarded as get.
 * @param {type} locale Locale to use. NO DEFAULT.
 * @returns {varialbe} if set, return undefined.  If get, return the resource.
 */
_.l.getset = function _l_getset( path, set, locale ) {
   var p = path.split( '.' );
   var last = p.pop();
   p.unshift( locale );
   var base = this.data;
   // Explore path
   for ( var i = 0, l = p.length ; i < l ; i++ ) {
      var node = p[i];
      if ( base[node] === undefined ) base[node] = {};
      base = base[node];
   }
   // Set or get data
   if ( set !== undefined ) {
      base[last] = set;
   } else {
      if ( base[last] === undefined && locale !== this.fallbackLocale ) return this.getset( path, undefined, this.fallbackLocale );
      return base[last];
   }
};

/**
 * Set l10n resource on given path
 *
 * @param {type} path Path to set resource
 * @param {type} data Resource to set
 * @returns {undefined}
 */
_.l.set = function _l_set( path, data ) {
    _.l.getset( path, data, _.l.currentLocale );
    _.l.event.fire( 'set', path, data );
};

/**
 * Localise all child elements with a class name of 'i18n' using its initial textContent or value as resource path.
 *  e.g. <div class='i18n'> gui.frmCalcluate.lblHelp </div>
 *
 * @param {type} root Root element to localise, default to whole document
 * @returns {undefined}
 */
_.l.localise = function _l_localise( root ) {
   if ( root === undefined ) root = document.documentElement;
   var _l = _.l;
   var el = root.getElementsByClassName( "i18n" );
   for ( var i = 0, l = el.length ; i < l ; i++ ) {
      var e = el[i];
      var isInput = e.tagName === 'INPUT';
      var key = e.getAttribute("data-i18n");
      if ( ! key ) {
          key = ( isInput ? e.value : e.textContent ).trim();
          e.setAttribute("data-i18n", key );
      }
      var val = _l( key, key.split('.').pop() );
      e[ isInput ? 'value' : 'innerHTML' ] = val;
   }
};

_.l.event = new _.EventManager( _.l, ['set','locale'] );

_.debug('Sparrow loaded.');
_.time();