/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Validator = require('validator');
var Crypto = require('crypto');
var Base64 = require('./base64');
var Log = require('./log');
// for the facebook util func
var Https = require('https');	
var Err = require('./error');
var Api = require('./api');	// for processFacebookAppRequest
var QueryString = require('querystring');	// for processFacebookAppRequest

// Get current date/time array

exports.getTimestamp = function () {

    return (new Date()).getTime();
};


// Clone object or array

exports.clone = function (obj) {

    if (obj === null ||
        obj === undefined) {

        return null;
    }

    var newObj = (obj instanceof Array) ? [] : {};

    for (var i in obj) {

        if (obj.hasOwnProperty(i)) {

            if (obj[i] && typeof obj[i] === 'object') {

                newObj[i] = exports.clone(obj[i]);
            }
            else {

                newObj[i] = obj[i];
            }
        }
    }

    return newObj;
};


// Validate email address

exports.checkEmail = function (email) {

    try {

        Validator.check(email).len(6, 64).isEmail();
    }
    catch (e) {

        return false;
    }

    return true;
};


// Random string

exports.getRandomString = function (size) {

    var randomSource = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var len = randomSource.length;

    var result = [];

    for (var i = 0; i < size; ++i) {

        result[i] = randomSource[Math.floor(Math.random() * len)];
    }

    return result.join('');
};


// AES256 Symmetric encryption

exports.encrypt = function (key, value) {

    var envelope = JSON.stringify({ v: value, a: exports.getRandomString(2) });

    var cipher = Crypto.createCipher('aes256', key);
    var enc = cipher.update(envelope, input_encoding = 'utf8', output_encoding = 'binary');
    enc += cipher.final(output_encoding = 'binary');

    var result = Base64.encode(enc).replace(/\+/g, '-').replace(/\//g, ':').replace(/\=/g, '');
    return result;
};


exports.decrypt = function (key, value) {

    var input = Base64.decode(value.replace(/-/g, '+').replace(/:/g, '/'));

    var decipher = Crypto.createDecipher('aes256', key);
    var dec = decipher.update(input, input_encoding = 'binary', output_encoding = 'utf8');
    dec += decipher.final(output_encoding = 'utf8');

    var envelope = null;

    try {

        envelope = JSON.parse(dec);
    }
    catch (e) {

        Log.err('Invalid encrypted envelope: ' + JSON.stringify(e));
    }

    return envelope ? envelope.v : null;
};


// added for parse facebook's signed request,  -Lance.

//npm install b64url
//A signed_request for testing:
//WGvK-mUKB_Utg0l8gSPvf6smzacp46977pTtcRx0puE.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImV4cGlyZXMiOjEyOTI4MjEyMDAsImlzc3VlZF9hdCI6MTI5MjgxNDgyMCwib2F1dGhfdG9rZW4iOiIxNTI1NDk2ODQ3NzczMDJ8Mi5ZV2NxV2k2T0k0U0h4Y2JwTWJRaDdBX18uMzYwMC4xMjkyODIxMjAwLTcyMTU5OTQ3NnxQaDRmb2t6S1IyamozQWlxVldqNXp2cTBmeFEiLCJ1c2VyIjp7ImxvY2FsZSI6ImVuX0dCIiwiY291bnRyeSI6ImF1In0sInVzZXJfaWQiOiI3MjE1OTk0NzYifQ

// function parse_signed_request(signed_request, secret) {
exports.parse_signed_request = function (signed_request, secret) {

    encoded_data = signed_request && signed_request.split('.',2);

    // check data
    if (!encoded_data || encoded_data.length < 2 ) {
        console.error('encoded_data not an array >= 2');
        return null;
    }

    // decode the data
    sig = encoded_data[0];
    // json = base64url.decode(encoded_data[1]);
    json = Base64.decode(encoded_data[1]);
    data = JSON.parse(json); // ERROR Occurs Here!

    // check algorithm - not relevant to error
    if (!data.algorithm || data.algorithm.toUpperCase() != 'HMAC-SHA256') {
        console.error('Unknown algorithm. Expected HMAC-SHA256');
        return null;
    }

    // check sig - not relevant to error
    expected_sig = Crypto.createHmac('sha256',secret).update(encoded_data[1]).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace('=','');
    if (sig !== expected_sig) {
        console.error('Bad signed JSON Signature!');
        return null;
    }

    return data;

}

// from Login.auth's facebook closure - maybe todo, bring this into app request closure
exports.facebookRequest = function (method, path, body, callback) {

    var options = {
        host: 'graph.facebook.com',
        port: 443,
        path: path,
        method: method
    };

    var hreq = Https.request(options, function (hres) {

        if (hres) {

            var response = '';

            hres.setEncoding('utf8');
            hres.on('data', function (chunk) {

                response += chunk;
            });

            hres.on('end', function () {

                var data = null;
                var error = null;

                try {

                    data = JSON.parse(response);
                }
                catch (err) {

                    data = QueryString.parse(response);     // Hack until Facebook fixes their OAuth implementation
                    // error = 'Invalid response body from Facebook token endpoint: ' + response + '(' + err + ')';
                }

                if (error === null) {

                    if (hres.statusCode === 200) {

                        callback(data, null);
                    }
                    else {

                        callback(null, Err.internal('Facebook returned OAuth error on token request', data));
                    }
                }
                else {

                    callback(null, Err.internal(error));
                }
            });
        }
        else {

            callback(null, Err.internal('Failed sending Facebook token request'));
        }
    });

    hreq.on('error', function (err) {

        callback(null, Err.internal('HTTP socket error', err));
    });

    if (body !== null) {

        hreq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
        hreq.write(body);
    }

    hreq.end();
}

// from Login.auth's facebook closure
exports.processFacebookAppRequests = function (rids, token, uid, session) {

	// var rids = req.query.request_ids.split( ',' ) ;

	console.log( 'Lance processFacebookAppRequests number:' + rids.length + ' uid:' + uid + ' token:' + token + ' session:' + session ) ;

	// for each request
	for( var ri=0 ; ri < rids.length ; ri++ ) {

		var rid = rids[ri] ;
	
		console.log( 'Lance facebook req rid ' + rids[ri] + ' ' + rid ) ;

		// get req details from fb
		exports.facebookRequest('GET', '/' + rid + '?' + QueryString.stringify({ oauth_token: /*data.access_token*//*fbsr.oauth_token*/token }), null, function (data, err) {	// body null or ''/' '?

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
			
				if( jsonData.type === 'link' || jsonData.type === 'copy' ) {	// change to 'shareType' to match param in api participants request protocol
				
					console.log( 'Lance facebook doing ' + jsonData.type + ' now...' ) ;
				
					// Api.clientCall('POST', '/project/' + jsonData.src + '/' + jsonData.type, '', function (result, err, code) {
					Api.call('POST', '/project/' + jsonData.src + '/' + jsonData.type + '?fbid=' + /*fbsr.user_id*/uid, '', /*req.api.*/session, function (result, err, code) {
					
						if( result && result.status === 'ok' && result.id ) {

							console.log( 'Lance facebook did ' + jsonData.type + ' of ' +  jsonData.src + ' with ' + result + ' ' + err + ' ' + code ) ;
					
							// delete request moved uotside of conditional to delete even if in error
					
							// set active project Id in storage
							var jsonObject = { value: result.id } ;
							var json = JSON.stringify( jsonObject ) ;
							Api.call('POST', '/storage/activeProject', jsonObject, /*req.api.*/session, function (result, err, code) {
					
								if( result && result.status === 'ok' ) {
									console.log( 'Lance facebook stored activeProject ' + json + ' with ' + result + ' ' + err + ' ' + code ) ;
								} else {
									console.log( 'Lance facebook failed to store activeProject ' + json + ' with ' + result + ' ' + err + ' ' + code ) ;
								}
													
							});
						
						} else {
						
							console.log( 'Lance facebook failed to ' + jsonData.type + ' ' +  jsonData.src + ' with ' + result + ' ' + err + ' ' + code ) ;
					
						}
					
					});

				} else {
					console.log( 'Lance facebook unkown share type ' + jsonData.type ) ;
				} 
			
			} else {
				console.log( 'Lance facebook req failed w ' + jsonData ) ;
			}
	
			// delete request - nah, don't
			/*
			if (data && data.id) {
								
				exports.facebookRequest('DELETE', '/' + data.id + '?' + QueryString.stringify({ oauth_token: //data.access_token.//.fbsr.oauth_token./token }), null, function (data, err) {	// body null or ''/' '?

					console.log( 'Lance facebook deleted request ' + data.id + ' ' + data + ' ' + err ) ;

				});
	
			} else {
				console.log( 'Lance facebook delete req failed without data.id ' + data ) ;
			}
			*/
		
			// set active project Id in storage
					
		}) ;	

	}
	
}
