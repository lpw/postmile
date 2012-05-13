/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Url = require('url');
var Os = require('os');
var OAuth = require('oauth');
var Https = require('https');
var QueryString = require('querystring');
var Utils = require('./utils');
var Api = require('./api');
var Err = require('./error');
var Session = require('./session');
var Vault = require('./vault');
var Tos = require('./tos');
var Config = require('./config');


// OAuth 1.0 clients

var twitterClient = new OAuth.OAuth('https://api.twitter.com/oauth/request_token',
                                    'https://api.twitter.com/oauth/access_token',
                                     Vault.twitter.clientId,
                                     Vault.twitter.clientSecret,
                                     '1.0',
                                     Config.host.uri('web') + '/auth/twitter',
                                     'HMAC-SHA1');

var yahooClient = new OAuth.OAuth('https://oauth03.member.mud.yahoo.com/oauth/v2/get_request_token',
                                  'https://oauth03.member.mud.yahoo.com/oauth/v2/get_token',
                                  Vault.yahoo.clientId,
                                  Vault.yahoo.clientSecret,
                                  '1.0',
                                  Config.host.uri('web') + '/auth/yahoo',
                                  'HMAC-SHA1');


// Login page

exports.login = function (req, res, next) {

    if (req.api.profile) {

        if (req.api.session.restriction === 'tos' ||
            !req.api.session.tos ||
            req.api.session.tos < Tos.minimumTOS) {

            // res.api.redirect = '/tos' + (req.query.next && req.query.next.charAt(0) === '/' ? '?next=' + encodeURIComponent(req.query.next) : '');
            // next();
			// Lance - just post a faux acceptance for now and save the redirect until we have maningful tos
		    Api.clientCall('POST', '/user/' + req.api.profile.id + '/tos/' + Tos.currentTOS, '', function (result, err, code) {

		        // Refresh token

		        Session.refresh(req, res, req.api.session, function (session, err) {

					// if we're redirecting just to refresh the cookies, let's find another way
		            res.api.redirect = '/tos' + (req.body.next ? '?next=' + encodeURIComponent(req.body.next) : '');
		            next();
		        });
		    });

        }
        else {

            res.api.redirect = req.query.next || req.api.profile.view;
            next();
        }
    }
    else {

        res.api.view = { template: 'login', hasMobile: true, locals: { logo: false, env: { next: (req.query.next ? encodeURIComponent(req.query.next) : '')}} };
        next();
    }
};


// Logout

exports.logout = function (req, res, next) {

    Session.logout(res, next);
};


// Relogin (for guest),  -Lance.

exports.relogin = function (req, res, next) {

    Session.relogin(res, next);
};


// Third party authentication (OAuth 1.0/2.0 callback URI)

exports.auth = function (req, res, next) {

    function entry() {

        // Preserve parameters for OAuth authorization callback

        if (req && req.query && req.query.x_next &&	// -Lance.
            req.query.x_next.charAt(0) === '/') {        // Prevent being used an open redirector

            res.api.jar.auth = { next: req.query.x_next };
        }

        switch (req.params.network) {

            case 'twitter': twitter(); break;
            case 'facebook': facebook(); break;
            case 'yahoo': yahoo(); break;
            case 'guest': guest(); break;	//  -Lance.

            default:

                res.api.error = Err.internal('Unknown third party network authentication', req.params.network);
                next();
                break;
        }
    }

    function twitter() {

        if (req.query.oauth_token === undefined) {

            // Sign-in Initialization

            twitterClient.getOAuthRequestToken(function (err, token, secret, authorizeUri, params) {

                if (err === null) {

                    res.api.jar.twitter = { token: token, secret: secret };
                    res.api.redirect = 'https://api.twitter.com/oauth/authenticate?oauth_token=' + token;
                    res.api.result = 'You are being redirected to Twitter to sign-in...';
                    next();
                }
                else {

                    res.api.error = Err.internal('Failed to obtain a Twitter request token', err);
                    next();
                }
            });
        }
        else {

            // Authorization callback

            if (req.query.oauth_verifier) {

                if (req.api.jar.twitter) {

                    var credentials = req.api.jar.twitter;
                    if (req.query.oauth_token === credentials.token) {

                        twitterClient.getOAuthAccessToken(credentials.token, credentials.secret, req.query.oauth_verifier, function (err, token, secret, params) {

                            if (err === null) {

                                if (params.user_id) {

                                    var account = {

                                        network: 'twitter',
                                        id: params.user_id,
                                        username: params.screen_name || ''
                                    };

                                    if (req.api.profile) {

                                        finalizedLogin(account);
                                    }
                                    else {

                                        twitterClient.getProtectedResource('http://api.twitter.com/1/account/verify_credentials.json', 'GET', token, secret, function (err, response) {

                                            if (err === null) {

                                                var data = null;
                                                try {

                                                    data = JSON.parse(response);
                                                }
                                                catch (e) {
                                                }

                                                if (data &&
                                                    data.name) {

                                                    account.name = data.name;
                                                }

                                                finalizedLogin(account);
                                            }
                                        });
                                    }
                                }
                                else {

                                    res.api.error = Err.internal('Invalid Twitter access token response', err);
                                    next();
                                }
                            }
                            else {

                                res.api.error = Err.internal('Failed to obtain a Twitter access token', err);
                                next();
                            }
                        });
                    }
                    else {

                        res.api.error = Err.internal('Twitter authorized request token mismatch');
                        next();
                    }
                }
                else {

                    res.api.error = Err.internal('Missing Twitter request token cookie');
                    next();
                }
            }
            else {

                res.api.error = Err.internal('Missing verifier parameter in Twitter authorization response');
                next();
            }
        }
    }

	// -Lance.
	function guest() {

		var d = new Date() ;
		var t = '' + d.getTime() ;
		var n = 'Guest ' + t ;
		var u = 'guest' + t ;

                                        var account = {

                                            network: 'guest',
                                            id: t,
                                            name: n,
                                            username: u,
                                            email: u + '@lwelsh.com'

                                        };

                                        finalizedLogin(account);

	}

    function facebook() {

        if (req.query.code === undefined) {

            // Sign-in Initialization

            var request = {

                protocol: 'https:',
                host: 'graph.facebook.com',
                pathname: '/oauth/authorize',
                query: {

                    // client_id: Vault.facebook.clientId,
					// use different fb app id depending on host reference,  -Lance.
					client_id: Vault.facebook[ req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) ].clientId,
                    response_type: 'code',
                    scope: 'email',
                    redirect_uri: Config.host.uri('web', req) + '/auth/facebook',	// added req context for domain/host,  -Lance.
                    state: Utils.getRandomString(22),
                    display: req.api.agent.os === 'iPhone' ? 'touch' : 'page'
                }
            };

            res.api.jar.facebook = { state: request.query.state };
            res.api.redirect = Url.format(request);
            res.api.result = 'You are being redirected to Facebook to sign-in...';
            next();
        }
        else {

            // Authorization callback

            if (req.api.jar.facebook &&
                req.api.jar.facebook.state) {

                if (req.api.jar.facebook.state === req.query.state) {

                    var query = {

                    	// client_id: Vault.facebook.clientId,
						// use different fb app id and secret depending on host reference,  -Lance.
						client_id: Vault.facebook[ req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) ].clientId,
                        client_secret: Vault.facebook[ req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) ].clientSecret,
                        grant_type: 'authorization_code',
                        code: req.query.code,
                        redirect_uri: Config.host.uri('web', req) + '/auth/facebook'	// added req context for domain/host,  -Lance.
                    };

                    var body = QueryString.stringify(query);

                    facebookRequest('POST', '/oauth/access_token', body, function (data, err) {

                        if (data) {

                            facebookRequest('GET', '/me?' + QueryString.stringify({ oauth_token: data.access_token }), null, function (data, err) {

                                if (err === null) {

                                    if (data &&
                                data.id) {

                                        var account = {

                                            network: 'facebook',
                                            id: data.id,
                                            name: data.name || 'Guest',	// || ''  -Lance.
                                            username: data.username || 'guest',	// || ''  -Lance.
                                            email: (data.email && data.email.match(/proxymail\.facebook\.com$/) === null ? data.email : '')
                                        };

                                        finalizedLogin(account);
                                    }
                                    else {

                                        res.api.error = Err.internal('Invalid Facebook profile response', err);
                                        next();
                                    }
                                }
                                else {

                                    res.api.error = err;
                                    next();
                                }
                            });
                        }
                        else {

                            res.api.error = err;
                            next();
                        }
                    });
                }
                else {

                    res.api.error = Err.internal('Facebook incorrect state parameter');
                    next();
                }
            }
            else {

                res.api.error = Err.internal('Missing Facebook state cookie');
                next();
            }
        }
    }

    function facebookRequest(method, path, body, callback) {

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

    function yahoo() {

        if (req.query.oauth_token === undefined) {

            // Sign-in Initialization

            yahooClient.getOAuthRequestToken(function (err, token, secret, authorizeUri, params) {

                if (err === null) {

                    res.api.jar.yahoo = { token: token, secret: secret };
                    res.api.redirect = 'https://api.login.yahoo.com/oauth/v2/request_auth?oauth_token=' + token;
                    res.api.result = 'You are being redirected to Yahoo! to sign-in...';
                    next();
                }
                else {

                    res.api.error = Err.internal('Failed to obtain a Yahoo! request token', err);
                    next();
                }
            });
        }
        else {

            // Authorization callback

            if (req.query.oauth_verifier) {

                if (req.api.jar.yahoo) {

                    credentials = req.api.jar.yahoo;

                    if (req.query.oauth_token === credentials.token) {

                        yahooClient.getOAuthAccessToken(credentials.token, credentials.secret, req.query.oauth_verifier, function (err, token, secret, params) {

                            if (err === null) {

                                if (params &&
                                    params.xoauth_yahoo_guid) {

                                    var account = {

                                        network: 'yahoo',
                                        id: params.xoauth_yahoo_guid
                                    };

                                    if (req.api.profile) {

                                        finalizedLogin(account);
                                    }
                                    else {

                                        yahooClient.getProtectedResource('http://social.yahooapis.com/v1/user/' + params.xoauth_yahoo_guid + '/profile?format=json', 'GET', token, secret, function (err, response) {

                                            if (err === null) {

                                                var data = null;
                                                try {

                                                    data = JSON.parse(response);
                                                }
                                                catch (e) {
                                                }

                                                if (data && data.profile && data.profile.nickname) {

                                                    account.name = data.profile.nickname;
                                                }

                                                finalizedLogin(account);
                                            }
                                        });
                                    }
                                }
                                else {

                                    res.api.error = Err.internal('Invalid Yahoo access token response', params);
                                    next();
                                }
                            }
                            else {

                                res.api.error = Err.internal('Failed to obtain a Yahoo access token', err);
                                next();
                            }
                        });
                    }
                    else {

                        res.api.error = Err.internal('Yahoo authorized request token mismatch');
                        next();
                    }
                }
                else {

                    res.api.error = Err.internal('Missing Yahoo request token cookie');
                    next();
                }
            }
            else {

                res.api.error = Err.internal('Missing verifier parameter in Yahoo authorization response');
                next();
            }
        }
    }

    function finalizedLogin(account) {

        if (req.api.profile) {

            // Link

            Api.clientCall('POST', '/user/' + req.api.profile.id + '/link/' + account.network, { 
					id: account.id 
					// we have more info now, that we didn't have before as guest, that we should now pass on.  -Lance.
					, email: account.email
					, name: account.name
					, network: account.network
					, username: account.username
				}, function (result, err, code) {

                // res.api.redirect = '/account/linked';	// -Lance.
				// res.api.redirect = '/view';	// reload view
                // next();
				
				if( result && result.status === 'relogin' ) {
					console.log( 'finalizedLogin relogin ' ) ;
					exports.relogin( req, res, next ) ;	// Session.refresh(req, res, req to /view
				/*  -Lance.
				} else if( code === 400 ) {
					// view, result, redirect, or error needed to send reply
					res.api.redirect = '/' ;	
					// exports.login( req, res, next ) ;	// Session.refresh(req, res, req to /view, does next()
					console.log( 'already linked ' ) ;
					// res.api.view = req.api.profile.view ;
					next() ;	//  or no op?
				} else {
					// done by entry?
					// res.api.redirect = '/view';	// reload view
	                // next();
					entry();	// recurse?
				}
				*/
				/*
				} else {
					// Login
					var tokenRequest = {
						grant_type: 'http://ns.postmile.net/' + account.network,
						x_user_id: account.id
					};

					var destination = req.api.jar.auth ? req.api.jar.auth.next : null;
					exports.loginCall(tokenRequest, res, next, destination, account);
				}
				*/
				} else {
					console.log( 'already linked ' ) ;
					res.api.redirect = '/' ;	
					next() ;
				}

            });
        }
        else {

            // Login

            var tokenRequest = {

                grant_type: 'http://ns.postmile.net/' + account.network,
                x_user_id: account.id
            };

            var destination = req.api.jar.auth ? req.api.jar.auth.next : null;
            exports.loginCall(tokenRequest, res, next, destination, account);
        }
    }

    entry();
};


// Unlink account

exports.unlink = function (req, res, next) {

    if (req.body.network === 'twitter' ||
        req.body.network === 'facebook' ||
        req.body.network === 'yahoo') {

        Api.clientCall('DELETE', '/user/' + req.api.profile.id + '/link/' + req.body.network, '', function (result, err, code) {

            res.api.redirect = '/account/linked';
            next();
        });
    }
    else {

        res.api.redirect = '/account/linked';
        next();
    }
};


// Email token login

exports.emailToken = function (req, res, next) {

    var tokenRequest = {

        grant_type: 'http://ns.postmile.net/email',
        x_email_token: req.params.token
    };

    exports.loginCall(tokenRequest, res, next, null, null);
};


// Login common function

exports.loginCall = function (tokenRequest, res, next, destination, account) {

    tokenRequest.client_id = 'postmile.view';
    tokenRequest.client_secret = '';

    Api.clientCall('POST', '/oauth/token', tokenRequest, function (token, err, code) {

        if (token) {

            // Registered user

            Session.set(res, token, function (isValid, restriction) {

                if (isValid) {

                    if (token.x_action &&
                        token.x_action.type) {

                        switch (token.x_action.type) {

                            case 'reminder':

                                res.api.jar.message = 'You made it in! Now link your account to Facebook, Twitter, or Yahoo! to make sign-in easier next time.';
                                destination = '/account/linked';
                                break;

                            case 'verify':

                                res.api.jar.message = 'Email address verified';
                                destination = '/account/emails';
                                break;

                            case 'guest':

								// -Lance.
								// todo: change this back to no restriction = null and do set destination back to /tos as it shoud now pass?
								
                                // res.api.jar.message = 'guest';
								restriction = null ;	// override the api/db 

								// Api.clientCall('POST', '/user/' + tokenRequest.x_user_id + '/tos/' + Tos.currentTOS, '', function (result, err, code) {
									// // Refresh token?  Session.refresh...?
									// console.log( 'Lance: iplicited accepted TOS for guest user with ' + result + ' ' + err + ' ' + code ) ;
								// });

                                // destination = '/tos';	// should now be up-to-date and go to view
                                // destination = '/view';	now we're just rendering a root template
                                destination = '/';

                                break;
                        }
                    }

                    if (restriction === 'tos' &&
                        (destination === null || destination.indexOf('/account') !== 0)) {

                        res.api.redirect = '/tos' + (destination ? '?next=' + encodeURIComponent(destination) : '');
                        next();
                    }
                    else {

                        res.api.redirect = destination || '/';
                        next();
                    }
                }
                else {

                    res.api.error = Err.internal('Invalid response parameters from API server');
                    next();
                }
            });
        }
        else if (err &&
                 err.error &&
                 err.error === 'invalid_grant') {

            Session.clear(res);

            if (tokenRequest.grant_type === 'http://ns.postmile.net/email') {

                res.api.jar.message = err.error_description;
                res.api.redirect = '/';
                next();
            }
            else if (account) {

		// Never go to the sign-up page - just autosignup instead,  -Lance.
		if( true || account.network === 'guest' ) {

			// Auto Sign-up (just do it and hope it works)

			// res.api.jar.signup = account;
			// res.api.redirect = '/signup/register';

			    var registration = { network: [account.network, account.id] };
				registration.username = account.username.replace(/[^\w+-]+/g, "");;
				registration.email = account.email;
				registration.name = account.name;

			    // Api.clientCall('PUT', '/user' + (req.body.invite ? '?invite=' + encodeURIComponent(req.body.invite) : ''), registration, function (result, err, code)
			    Api.clientCall('PUT', '/user?invite=public', registration, function (result, err, code) {

				if (err === null) {

				    // Login new user

				    var tokenRequest = {

					grant_type: 'http://ns.postmile.net/' + account.network,
					x_user_id: account.id
				    };

					console.log( 'Lance PUT /user ok, calling loginCall ' ) ;

				    exports.loginCall(tokenRequest, res, next, '/welcome');	// welcome instead of view?

					console.log( 'Lance PUT /user ok after loginCall, redirecting' ) ;

					// do this above via token action
					// res.api.redirect = '/view';
           			// next();

				} else {

				    // Try again, based on kind of error (username already in use, etc)

					console.log( 'Lance PUT /user error: ' + err.code + ' - ' + err.error + ', ' + err.message ) ;

					next();

				}
			    });

		} else {

			// now we're just giong direct to login, skip signup, tos
			// by allowing any and all above
			res.xxx() ;	// fail
			
			// Sign-up
			// todo: fix this so when it fails because of invalid email or username (already taken), it tells the user to change it
			//	rather than staying in this infinite cycle (perhaps just a UI change - just ensure we are telling the UI here)

			res.api.jar.signup = account;
			res.api.redirect = '/signup/register';
			next();

		}

            }
            else {

                // Failed to login or register

                res.api.redirect = '/';
                next();
            }
        }
        else {

            res.api.error = Err.internal('Unexpected API response', err);
            next();
        }
    });
};


