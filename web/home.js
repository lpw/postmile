/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// added for testing,  -Lance.
var Utils = require('./utils');

// Get home page

exports.get = function (req, res, next) {

	if( false ) {	// just for testing
		var sr = req.body.signed_request ;
		var secret = '1205a0b8e085d6061b2a2f71e94125cf' ;
		var dataFsr = Utils.parse_signed_request( sr, secret );
		// var dataFsr = Utils.decrypt( secret, sr );
		console.log( 'Lance home get ' + req.query.request_ids + ' ' + dataFsr ) ;
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

				console.log( 'Lance req rid ' + rids[ri] ) ;

				// get req details from fb
				
				// issue share join to api: copy or link

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


