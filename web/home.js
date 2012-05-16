/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// added for testing,  -Lance.
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
	
	if (req.api.profile) {

        // res.api.redirect = req.api.profile.view ;
		// todo: what about request_id's ?
        res.api.view = req.api.profile.view ;

		// if( req.query.request_ids ) {	// fb req,  -Lance.
			// res.api.redirect += '#r=' + req.query.request_ids ;
		// }

		// todo: don't send dacebookId with get and other client-side stuff
		// finish routes for copy and join
		// parse and handle request in web home (call fb for details, then api's copy and link
		if( req.query.request_ids ) {	// fb req,  -Lance.
			
			var rids = req.query.request_ids.split( ',' ) ;

			// for each request
			for( var ri=0 ; ri < rids.length ; ri++ ) {

				console.log( 'Lance facebook req rid ' + rids[ri] ) ;

				// get req details from fb
				Utils.facebookRequest('GET', '/' + rids[ri] + '?' + QueryString.stringify({ oauth_token: /*data.access_token*/fbsr.oauth_token }), null, function (data, err) {	// body null or ''/' '?

					if (data) {
									
						console.log( 'Lance facebook req rid ' + rids[ri] + ' worked w ' + data.data ) ;
						
						// issue share join to api: copy or link
						// global.activeProjectId = data.data;
						// Y.list.list.getAndGoToActiveList() ;

						// delete erquest
						// FB.api( response.id, 'delete', function(response) {
							// console.log( 'deleted request for ' + response.id + ' ' + response );
						// });

					} else {
						console.log( 'Lance facebook req rid ' + rids[ri] + ' failed w ' + data ) ;
					}
				
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

		res.api.redirect = '/auth/guest';
		// don't have to do this here/now as it's part of next's finalizeResponse
		// res.api.redirect = 'http://' + req.headers.host + '/auth/guest' ;
		// res.api.redirect = Config.host.uri('web', req) + '/auth/guest',	// added req context for domain/host,  -Lance.
	
        next();
    }
};


