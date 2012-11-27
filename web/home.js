/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// todo: just do the link here - call Api instead of redirection

// added for testing,  -Lance.
var Login = require('./login');
var Api = require('./api');
var Utils = require('./utils');
var QueryString = require('querystring');
// var Err = require('./error');
var Vault = require('./vault');
var Https = require('https');

// Get cache.manifest

exports.cacheManifest = function (req, res, next) {
	var result = 'CACHE MANIFEST\n' ;
	var hostname = req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) ;
	result += '# v5\n' ;
	result += '\n' ;
	result += 'CACHE:\n' ;
	result += '/favicon.ico\n' ;
	result += '/view/css/combo-mstyle-min.css\n' ;
	result += '/view/yui/yui-deps.js\n' ;
	result += '/view/js/mobile-combo-' + hostname + '-min.js\n' ;
	result += '/view/css/images/check2b_24_24x24.png\n' ;
	result += '/view/css/images/close-icon2.png\n' ;
	result += '/view/css/images/list4c_28x24.png\n' ;
	result += '/view/css/images/loading.gif\n' ;
	result += '/view/css/images/backarrow7_28x28.png\n' ;
	result += '/view/css/images/tripmeicon114.png'
	result += '/view/css/images/tripmeicon144.png'
	result += '/view/css/images/tripmeicon57.png'
	result += '/view/css/images/tripmeicon72.png'
	result += '/view/css/images/tripmestartup1496x2048.jpg'
	result += '/view/css/images/tripmestartup1536x2008.jpg'
	result += '/view/css/images/tripmestartup320x460.jpg'
	result += '/view/css/images/tripmestartup640x920.jpg'
	result += '/view/css/images/tripmestartup748x1024.jpg'
	result += '/view/css/images/tripmestartup768x1004.jpg'
	result += '\n' ;
	result += 'NETWORK:\n' ;
	result += '*\n' ;
	result += '\n' ;
	result += 'FALLBACK:\n' ;
	result += '\n' ;
    res.api.result = result ;
    next();
}

// Get home page

exports.get = function (req, res, next) {

	if( req.query.listall ) {	// -Lance.
	    // res.api.view = req.api.profile.view ;
	    var locals = {
	        env: {
		        debug: true,
		        listall: true,
				mobile: ( req.api.agent.os === 'iPhone' || req.api.agent.os === 'iPad' ),
				hostname: req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' )
	        }
	    };
	    res.api.view = { template: '../../clients/view/list', locals: locals };
	    next();
		return ;
	}

	var secret = Vault.facebook[ req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) ] ;	//clientId implied
	secret = secret && secret.clientSecret ;	// protect
	var fbsr ;	// has user oauth_tokan, more powerful than app access token
	if( req.body.signed_request && secret ) {	// just for facebook/testing
		fbsr = Utils.parse_signed_request( req.body.signed_request, secret );	// Utils.decrypt( secret, sr );
		console.log( 'Lance facebook ' + req.query.request_ids + ' ' + fbsr.user_id + ' ' + fbsr.oauth_token ) ;
	}
	
	console.log( 'Lance facebook before if req.api.profile ' + req.api.profile + ' ' + ( req.api.profile ? req.api.profile.facebook : 'no profile for facebook id' ) ) ;

	// if (req.api.profile && fbsr && fbsr.oauth_token && req.api.profile.facebook !== fbsr.user_id) {
	// if (req.api.profile && fbsr && req.api.profile.facebook !== fbsr.user_id) {
	// if (req.api.profile && ( !req.api.profile.facebook || !fbsr || !fbsr.user_id || req.api.profile.facebook !== fbsr.user_id ) ) {
	// if (req.api.profile && fbsr && req.api.profile.facebook && req.api.profile.facebook !== fbsr.user_id ) {
	if ( false ) {

		console.log( 'Lance facebook redirecting to /relogin ' ) ;
		res.api.redirect = '/relogin';
        next();

	} else if (req.api.profile && fbsr && req.api.profile.facebook && /*fbsr.user_id &&*/ req.api.profile.facebook !== fbsr.user_id) {

		console.log( 'Lance facebook redirecting to /relogin ' ) ;
		res.api.redirect = '/relogin';
        next();

	// } else if (req.api.profile) {
	} else if (req.api.profile && req.api.profile.facebook ) {

		console.log( 'Lance facebook proessing req.api.profile ' ) ;
        // res.api.redirect = req.api.profile.view ;
		// todo: what about request_id's ?
        res.api.view = req.api.profile.view ;
        /* was moving to replace line above bc pulled from way above to get local.env: 
	    var locals = {
	        env: {
		        debug: true,
		        listall: true,
				mobile: ( req.api.agent.os === 'iPhone' || req.api.agent.os === 'iPad' ),
				*/
				//hostname: req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' )
				/*
	        }
	    };
	    res.api.view = { template: '../../clients/view/list', locals: locals };
	    */

		// if( req.query.request_ids ) {	// fb req,  -Lance.
			// res.api.redirect += '#r=' + req.query.request_ids ;
		// }

		// todo: don't send dacebookId with get and other client-side stuff
		// finish routes for copy and join
		// parse and handle request in web home (call fb for details, then api's copy and link
		/* facebook is no longer giving us request_ids query parameter
		if( req.query.request_ids && fbsr && fbsr.oauth_token && req.api.profile.facebook === fbsr.user_id ) {	// fb req,  -Lance.
			Utils.processFacebookAppRequests( req.query.request_ids.split( ',' ), fbsr.oauth_token, fbsr.user_id, req.api.session ) ;
		}
		*/
		/* doing this now pn api side in activeProject nka /project/actiev
		if( fbsr && fbsr.oauth_token && req.query.request_ids ) {
			
			Utils.processFacebookAppRequests( req.query.request_ids.split( ',' ), fbsr.oauth_token, fbsr.user_id, req.api.session ) ;
			
		} else {

			// Utils.queryAndProcessFacebookAppRequests( fbsr.oauth_token, fbsr.user_id, req.api.session ) ;

			Api.call('POST', '/projects/fbr' + '?fbid=' + req.api.profile.facebook, '', req.api.session, function (result, err, code) {

				if( result && result.status === 'ok' && result.id ) {

					console.log( 'Lance fbr successfully processed requests with ' + result.id + ' ' + err + ' ' + code ) ;

					// set active project Id in storage
					var jsonObject = { value: result.id } ;
					var json = JSON.stringify( jsonObject ) ;
					Api.call('POST', '/storage/activeProject', jsonObject, req.api.session, function (result, err, code) {
			
						if( result && result.status === 'ok' ) {
							console.log( 'Lance fbr stored activeProject ' + json + ' with ' + result + ' ' + err + ' ' + code ) ;
						} else {
							console.log( 'Lance fbr failed to store activeProject ' + json + ' with ' + result + ' ' + err + ' ' + code ) ;
						}
											
					});

				} else {
					console.log( 'Lance fbr did not find any requests to process with ' + err + ' ' + code ) ;
				}
			});

		}
		*/
		
        next();

	} else if( req.api.profile ) {
		
		console.log( 'Lance facebook req.api.profile.view ' ) ;
        res.api.view = req.api.profile.view ;
        next();

	} else if( fbsr && fbsr.user_id ) {
		
		console.log( 'Lance facebook fbsr  w id' ) ;
		// res.api.redirect = '/auth/facebook';	// I don't think this would keep the fbsr
		// next();	login will do this if it's passed	
		req.params.network = 'facebook' ;	// fake this	
		Login.auth( req, res, next ) ;	// fbsr will be redecrypted from req.body

	} else if( fbsr /* && !fbsr.user_id */ ) {	// but no id, no permissions granted yet to app
		
		console.log( 'Lance facebook fbsr but no id' ) ;
		// res.api.redirect = '/auth/facebook';	// I don't think this would keep the fbsr
		// next();	login will do this if it's passed	
		req.params.network = 'facebook' ;	// fake this	
		Login.auth( req, res, next ) ;	// fbsr will be redecrypted from req.body

	} else if( false ) {
		
		console.log( 'Lance facebook login reqd ' ) ;
		res.api.redirect = '/?login=reqd';
        next();

	}
    else {

				console.log( 'Lance facebook redirecting to /auth/facebook ' ) ;

        var locals = {

            logo: false,
            env: {

                message: req.api.jar.message || ''
            }
        };

		// Let them go in as guest,  -Lance.

        // res.api.view = { template: 'home', locals: locals };

		// res.api.redirect = '/auth/guest';
		// don't have to do this here/now as it's part of next's finalizeResponse
		// res.api.redirect = 'http://' + req.headers.host + '/auth/guest' ;
		// res.api.redirect = Config.host.uri('web', req) + '/auth/guest',	// added req context for domain/host,  -Lance.
	
		// until we refocus on solo website, just use facebook
		res.api.redirect = '/auth/facebook';
		
        next();
    }
};

exports.all = function (req, res, next) {

    // res.api.view = req.api.profile.view ;
    var locals = {
        env: {
	        all: true,
            message: req.api.jar.message || ''
        }
    };
    res.api.view = { template: '../../clients/view/list', locals: locals };
    next();

};
