/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// added for testing,  -Lance.
var Api = require('./api');
var Utils = require('./utils');
var QueryString = require('querystring');
// var Err = require('./error');
var Vault = require('./vault');
var Https = require('https');

// Get home page

exports.get = function (req, res, next) {

	var secret = Vault.facebook[ req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) ].clientSecret ;	// clientId implied
	var fbsr ;	// has user oauth_tokan, more powerful than app access token
	if( req.body.signed_request && secret ) {	// just for facebook/testing
		fbsr = Utils.parse_signed_request( req.body.signed_request, secret );	// Utils.decrypt( secret, sr );
		console.log( 'Lance facebook ' + req.query.request_ids + ' ' + fbsr.user_id + ' ' + fbsr.oauth_token ) ;
	}
	
	if (req.api.profile && fbsr /*&& fbsr.oauth_token*/ && req.api.profile.facebook !== fbsr.user_id) {

		res.api.redirect = '/relogin';
        next();

	} else if (req.api.profile) {

        // res.api.redirect = req.api.profile.view ;
		// todo: what about request_id's ?
        res.api.view = req.api.profile.view ;

		// if( req.query.request_ids ) {	// fb req,  -Lance.
			// res.api.redirect += '#r=' + req.query.request_ids ;
		// }

		// todo: don't send dacebookId with get and other client-side stuff
		// finish routes for copy and join
		// parse and handle request in web home (call fb for details, then api's copy and link
		if( req.query.request_ids && fbsr && fbsr.oauth_token && req.api.profile.facebook === fbsr.user_id ) {	// fb req,  -Lance.
			
			var rids = req.query.request_ids.split( ',' ) ;

			// for each request
			for( var ri=0 ; ri < rids.length ; ri++ ) {

				var rid = rids[ri] ;
				
				console.log( 'Lance facebook req rid ' + rids[ri] + ' ' + rid ) ;

				// get req details from fb
				Utils.facebookRequest('GET', '/' + rid + '?' + QueryString.stringify({ oauth_token: /*data.access_token*/fbsr.oauth_token }), null, function (data, err) {	// body null or ''/' '?

					var jsonData ;
					try {
						jsonData = data && JSON.parse( data.data ) ;
					} catch( err ) {
						jsonData = data && data.data ;
					}
					
					if (jsonData && jsonData.src) {
									
						console.log( 'Lance facebook requesting ' + jsonData.type + ' of ' + jsonData.src ) ;
						
						// issue share join to api: copy or link
						// global.activeProjectId = jsonData;
						// Y.list.list.getAndGoToActiveList() ;
						
						if( jsonData.type === 'link' || jsonData.type === 'copy' ) {
							
							console.log( 'Lance facebook doing ' + jsonData.type + ' now...' ) ;
							
							// Api.clientCall('POST', '/project/' + jsonData.src + '/' + jsonData.type, '', function (result, err, code) {
							Api.call('POST', '/project/' + jsonData.src + '/' + jsonData.type + '/?fbid=' + fbsr.user_id, '', req.api.session, function (result, err, code) {
								
								if( result && result.status === 'ok' && result.id ) {

									console.log( 'Lance facebook did ' + jsonData.type + ' of ' +  jsonData.src + ' with ' + result + ' ' + err + ' ' + code ) ;
								
									// delete request moved uotside of conditional to delete even if in error
								
									// set active project Id in storage
									var jsonObject = { value: result.id } ;
									var json = JSON.stringify( jsonObject ) ;
									Api.call('POST', '/storage/activeProject', jsonObject, req.api.session, function (result, err, code) {
								
										if( result && result.status === 'ok' ) {
											console.log( 'Lance facebook stored activeProject ' + json + ' with ' + result + ' ' + err + ' ' + code ) ;
										} else {
											console.log( 'Lance facebook failed to store activeProject ' + json + ' with ' + result + ' ' + err + ' ' + code ) ;
										}
																
									});
									
								} else {
									
									console.log( 'Lance facebook failed to ' + jsonData.type + ' of ' +  jsonData.src + ' with ' + result + ' ' + err + ' ' + code ) ;
								
								}
								
							});

						} else {
							console.log( 'Lance facebook unkown share type ' + jsonData.type ) ;
						} 
						
					} else {
						console.log( 'Lance facebook req failed w ' + jsonData ) ;
					}
				
					// delete request
					if (data && data.id) {
											
						Utils.facebookRequest('DELETE', '/' + data.id + '?' + QueryString.stringify({ oauth_token: /*data.access_token*/fbsr.oauth_token }), null, function (data, err) {	// body null or ''/' '?

							console.log( 'Lance facebook deleted request ' + data.id + ' ' + data + ' ' + err ) ;

						});
				
					} else {
						console.log( 'Lance facebook delete req failed without data.id ' + data ) ;
					}
					
					// set active project Id in storage
								
				}) ;	
			
			}
				
		}
		
        next();
    }
    else {

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


