/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Express = require('express');
var Semver = require('semver');
var Os = require('os');
var Fs = require('fs');
var Crypto = require('crypto');
var UserAgent = require('user-agent')
var Utils = require('./utils');
var Login = require('./login');
var Err = require('./error');
var Log = require('./log');
var Session = require('./session');
var Vault = require('./vault');
var Email = require('./email');
var Config = require('./config');


// Declare internals

var internals = {};


// Send startup email

Email.send(Config.email.admin, 'NOTICE: Web server started', 'Started on ' + Os.hostname());


// Listen to uncaught exceptions

process.on('uncaughtException', function (err) {

    Log.err('Uncaught exception: ' + err.stack);

    Email.send(Config.email.admin, 'ERROR: Exception on web server', err.stack, '', function (err) {

        process.exit(1);
    });
});


// Create and configure server instance

exports.create = function (paths) {

    // Create server

    var tls = null;

    if (Config.process.web.tls) {

        var tls = {

            key: Fs.readFileSync(Config.process.web.tls.key),
            cert: Fs.readFileSync(Config.process.web.tls.cert)
        };
    }

    var server = (tls ? Express.createServer(tls) : Express.createServer());

    // Configure Server

    server.configure(function () {

        server.set('views', __dirname + '/views');
        server.set('view engine', 'jade');
        // -Lance. server.set('view options', { colons: true });
        server.set('view options', { colons: true, layout: false });

        server.use(Express.bodyParser());
        server.use(Express.cookieParser());

        server.use(server.router);

        server.use(Express.static(__dirname + '/static'));
        server.use(internals.notFound);
        server.use(internals.errorHandler);
    });

    // Load paths

    for (var i = 0; i < paths.length; ++i) {

        internals.setRoute(server, paths[i]);
    }

    // Start Server

    server.listen(Config.host.web.port, Config.host.web.domain);
    Log.info('Web Server started at ' + Config.host.uri('web'));

    // Start bouncer for port 80
    /*
    var bouncer = Express.createServer();
    bouncer.all(/.+/, function (req, res, next) {

    res.send('You are being redirected...', { 'Location': Config.host.uri('web') + req.url }, 307);
    });

    bouncer.listen(80, Config.host.web.domain);
    Log.info('Bouncer Server started at http://' + host + ':' + 80);
    */
    // Change OS User

    if (Config.process.web.runAs) {

        Log.info('Web Server switching users from ' + process.getuid() + ' to ' + Config.process.web.runAs);
        try {

            process.setuid(Config.process.web.runAs);
            Log.info('Web Server active user: ' + process.getuid());
        }
        catch (err) {

            Log.err('Failed setting uid: ' + err);
            process.exit(1);
        }
    }
};


// Route pre-processor

internals.preprocessRequest = function (req, res, next) {

    Log.info('Received', req);

    req.api = {};
    req.api.jar = {};
    res.api = {};
    res.api.jar = {};

    // Parse user-agent string

    var isNotWithStupid = true;
    if (req.headers['user-agent']) {

        req.api.agent = UserAgent.parse(req.headers['user-agent']);

        if (req.url !== '/imwithstupid' &&
            req.cookies.imwithstupid === undefined) {

            // Check user-agent version

            if (req.api.agent &&
                req.api.agent.name &&
                req.api.agent.version) {

                // Normalize version

                var version = (req.api.agent.name === 'chrome' ? req.api.agent.version.replace(/\.\d+$/, '') : req.api.agent.version);

                if (version.split(/\./g).length - 1 < 2) {

                    version += '.0';
                }

                // Check version

                isNotWithStupid = ((req.api.agent.name === 'chrome' && Semver.satisfies(version, '>= 11.x.x')) ||
                                   // (req.api.agent.name === 'safari' && Semver.satisfies(version, '>= 5.x.x')) ||
                                   (req.api.agent.name === 'safari' && Semver.satisfies(version, '>= 4.x.x')) ||	// for droid
                                   (req.api.agent.name === 'firefox' && Semver.satisfies(version, '>= 4.x.x')) ||
                                   // (req.api.agent.name === 'msie' && Semver.satisfies(version, '>= 8.x.x')) ||
									false );
            }
        }
    }

    if (isNotWithStupid) {

        // Load cookie jar

        if (req.cookies.jar) {

            req.api.jar = Utils.decrypt(Vault.jar.aes256Key, req.cookies.jar) || {};
            delete req.cookies.jar;
            res.api.clearJar = true;
        }

        // Load session information

        Session.load(req, res, function (session, profile) {

            req.api.session = session;
            req.api.profile = profile;

            // Set default view

            if (req.api.profile) {

                // req.api.profile.view = req.api.profile.view || '/view/';
				// use different html views depending on host reference,  -Lance.
				// req.api.profile.view = req.api.profile.view || '/view/' + req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) + '-min.html' ;
				// req.api.profile.view = req.api.profile.view || '/view/' + req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) + '-min.html' ;
				var env = { 
					hostname: req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' )
				}
				
				var mobile = false ;
				// if ( ( req.api.agent.os === 'iPhone' || req.api.agent.os === 'iPad' ) ) {	// && res.api.view.hasMobile) {
				// if ( ( req.api.agent.os === 'iPhone' || req.api.agent.os === 'iPad'  || req.api.agent.os === 'Linux' ) ) {	// && res.api.view.hasMobile) {
				if ( ( req.api.agent.os === 'iPhone' || req.api.agent.os === 'iPad'  ) || req.api.agent.full.indexOf( 'droid' ) >= 0 ) {	// && res.api.view.hasMobile) {
					mobile = true ;
				}
				if (req.query.mobile ) {	// === 'iPhone' ) {
					mobile = true ;
				}
				// todo: put listall in here (from home.js)?
				env[ 'mobile' ] = mobile ;
				
				var debug = false ;
				if (req.query.debuglpw ) {
					debug = true ;
					env[ 'debug' ] = debug ;
				}
				// env[ 'debug' ] = true ;
				// env[ 'debug' ] = debug ;

				env[ 'secure' ] = Config.process.web.tls ? true : false ;
				
				for( var a=2; a<process.argv.length; a++ ) {
					env[ process.argv[ a ] ] = true ;
				}
				
				// var template = mobile ? '../../clients/view/mlist' : '../../clients/view/list' ;
				var template = '../../clients/view/list' ;
				req.api.profile.view = { 
					// template: '../../clients/view/list', 
					template: template,
					locals: { 
						env: env
					}
				};

            }

            next();
        });
    }
    else {

        // Serve I'm with stupid page

        res.api.view = { template: 'stupid' };
        internals.finalizeResponse(req, res);
    }
};


// Setup route validation

internals.setRoute = function (server, config) {

    var routes = [];

    // Authentication

    switch (config.authentication) {

        case 'session': routes.push(internals.authenticate); break;
        default: break;
    }

    // Body structure

    if (config.body) {

        routes.push(internals.validateData(config.body));
    }

    // Set route

    switch (config.method) {

        case 'GET': server.get(config.path, internals.preprocessRequest, routes, config.handler, internals.finalizeResponse); break;
        case 'POST': server.post(config.path, internals.preprocessRequest, routes, config.handler, internals.finalizeResponse); break;
        default: process.exit(1); break;
    }
};


// Session authentication

internals.authenticate = function (req, res, next) {

    if (req.api.profile &&
        req.api.session) {

        // Check crumb for any non GET action

        if (req.method === 'GET') {
        
            next();
        }
        else if (req.body &&
                 req.body.crumb &&
                 req.body.crumb === Crypto.createHash('sha1').update(req.api.session.id).digest('base64')) {

            // Clean up if present

            delete req.body.crumb;
            next();
        }
        else {

            // Invalid crumb

            res.api.error = Err.badRequest('Invalid crumb');
            internals.finalizeResponse(req, res, next);
        }
    }
    else {

        // Missing session cookie

        res.api.redirect = '/login?next=' + encodeURIComponent(req.url);
        res.api.result = 'This page requires sign-in. You are being redirected...';
        internals.finalizeResponse(req, res);
    }
};


// Validate data

internals.validateData = function (definition) {

    return function (req, res, next) {

        var isInvalid = false;
        var err = '';

        // Check required variables

        for (var i in definition) {

            if (definition.hasOwnProperty(i)) {

                if (definition[i].optional === false) {

                    if (req.body[i] === undefined) {

                        err = 'missing required parameter';
                        isInvalid = true;
                        break;
                    }
                }
            }
        }

        if (isInvalid === false) {

            // Check each incoming variable

            for (i in req.body) {

                if (req.body.hasOwnProperty(i)) {

                    // Lookup variable definition

                    if (definition[i] === undefined) {

                        err = 'unknown parameter';
                        isInvalid = true;
                        break;
                    }

                    // Check for empty

                    if (definition.empty !== true) {

                        if (req.body[i] === undefined ||
                            req.body[i] === null ||
                            (typeof req.body[i] === 'number' && isNaN(req.body[i])) ||
                            (typeof req.body[i] === 'string' && req.body[i] === '')) {

                            err = 'empty value not allowed';
                            isInvalid = true;
                            break;
                        }
                    }
                }
            }
        }

        if (isInvalid) {

            res.api.error = Err.badRequest('\'' + i + '\': ' + err);
            internals.finalizeResponse(req, res, next);
        }
        else {

            next();
        }
    };
};


// Set default response headers and send response

internals.finalizeResponse = function (req, res) {

    res.api.isReplied = false;
    res.setHeader('Cache-Control', 'none');

    // Cookies

    if (res.api.cookie ||
        res.api.jar) {

        var cookies = [];

        if (res.api.cookie) {

            for (var i in res.api.cookie.values) {

                if (res.api.cookie.values.hasOwnProperty(i)) {

                    var cookie = res.api.cookie.values[i];

                    if (res.api.cookie.attributes) {

                        for (var a in res.api.cookie.attributes) {

                            if (res.api.cookie.attributes.hasOwnProperty(a)) {

                                cookie += '; ' + res.api.cookie.attributes[a];
                            }
                        }
                    }

                    cookies.push(cookie);
                }
            }
        }

        if (Object.keys(res.api.jar).length > 0) {

            // Encrypt and Cookiefy

            cookies.push('jar=' + Utils.encrypt(Vault.jar.aes256Key, res.api.jar) + '; Path=/' + (Config.host.web.scheme === 'https' ? '; Secure' : ''));
        }
        else if (res.api.clearJar) {

            cookies.push('jar=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        }

        res.setHeader('Set-Cookie', cookies);
    }

    // Response

    if (res.api.view) {

        // Setup view variables

        var locals = res.api.view.locals || {};
        locals.env = locals.env || {};
        locals.host = Config.host;
        locals.profile = req.api.profile;
        // -Lance. locals.auth = { facebook: Vault.facebook.clientId ? true : false, twitter: Vault.twitter.clientId ? true : false, yahoo: Vault.yahoo.clientId ? true : false };
		var hostname = req.headers.host.replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) ;
        locals.auth = { 
			facebook: Vault.facebook[hostname] && Vault.facebook[hostname].clientId ? true : false, 
			twitter: Vault.twitter[hostname] && Vault.twitter[hostname].clientId ? true : false, 
			yahoo: Vault.yahoo[hostname] && Vault.yahoo[hostname].clientId ? true : false 
		};
        locals.authId = { 
			facebook: Vault.facebook[hostname] && Vault.facebook[hostname].clientId, 
			twitter: Vault.twitter[hostname] && Vault.twitter[hostname].clientId, 
			yahoo: Vault.yahoo[hostname] && Vault.yahoo[hostname].clientId 
		};
        locals.authName = { 
            facebook: Vault.facebook[hostname] && Vault.facebook[hostname].clientName || hostname, 
            twitter: Vault.twitter[hostname] && Vault.twitter[hostname].clientName || hostname, 
            yahoo: Vault.yahoo[hostname] && Vault.yahoo[hostname].clientName || hostname
        };
        locals.authPicture = { 
            facebook: Vault.facebook[hostname] && Vault.facebook[hostname].clientPicture, 
            twitter: Vault.twitter[hostname] && Vault.twitter[hostname].clientPicture, 
            yahoo: Vault.yahoo[hostname] && Vault.yahoo[hostname].clientPicture
        };
        locals.product = Config.product;

        // Add crumb

        if (req.api.session) {

            locals.crumb = Crypto.createHash('sha1').update(req.api.session.id).digest('base64');
        }

        // Set mobile environment

        // if ( ( req.api.agent.os === 'iPhone' || req.api.agent.os === 'iPad' ) &&
		if ( ( req.api.agent.os === 'iPhone' || req.api.agent.os === 'iPad' || req.api.agent.full.indexOf( 'droid' ) >= 0 ) &&
            res.api.view.hasMobile) {

            locals.layout = 'mobile';
            locals.isMobile = true;
        }
        else {

            locals.isMobile = false;
        }

        // Render view

        res.render(res.api.view.template, locals);
        Log.info('Replied', req);
    }
    else if (res.api.result || res.api.redirect) {

        if (res.api.redirect) {

            // var location = ((res.api.redirect.indexOf('http') !== 0 && res.api.redirect.indexOf('postmile://') !== 0) ? Config.host.uri('web') + res.api.redirect : res.api.redirect);
            // use req context for domain
            var location = ((res.api.redirect.indexOf('http') !== 0 && res.api.redirect.indexOf('postmile://') !== 0) ? Config.host.uri('web', req) + res.api.redirect : res.api.redirect);	// added req context for domain/host,  -Lance.
            res.send(res.api.result || 'You are being redirected...', { 'Location': location }, (req.method === 'GET' || location.indexOf('http') !== 0 ? 307 : 303));
        }
        else {

            res.send(res.api.result);
        }

        res.api.isReplied = true;
        Log.info('Replied', req);
    }
    else if (res.api.error) {

        internals.errorPage(res.api.error.code, req, res, res.api.error.text + (res.api.error.message ? ': ' + res.api.error.message : ''), res.api.isAPI);
        Log.err(res.api.error, req);
    }
};


internals.notFound = function (req, res, next) {

    if (res.api === undefined ||
        res.api.isReplied !== true) {

        internals.preprocessRequest(req, res, function () {

            internals.errorPage(Err.notFound().code, req, res, 'No such path or method');
            Log.info('Not found', req);
        });
    }
};


internals.errorHandler = function (err, req, res, next) {

    internals.errorPage((err && err.code === 'ENOTDIR') ? Err.notFound().code : Err.internal().code, req, res, 'Exception');
    Log.err(err, req);
};


// Get home page

internals.errorPage = function (code, req, res, message, isAPI) {

    if (res.api) {

        res.api.isReplied = true;
    }

    if (isAPI !== true) {

        var locals = {

            profile: (req && req.api && req.api.profile ? req.api.profile : null),
            error: message,
            code: code === 404 ? 404 : 500,
            message: (code === 404 ? 'the page you were looking for was not found' : 'something went wrong...'),
            env: {},
            host: Config.host,
            product: Config.product
        };

        res.render('error', locals);
    }
    else {

        res.send({ error: message }, code);
    }
};
