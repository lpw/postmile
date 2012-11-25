/*
* Copyright (c) 2011 Eran Hammer-Lahav. All rights reserved. Copyrights licensed under the New BSD License.
* See LICENSE file included with this code project for license terms.
*/

// Load modules

var Hapi = require('hapi');
var Db = require('./db');
var User = require('./user');
var Tips = require('./tips');
var Suggestions = require('./suggestions');
var Sort = require('./sort');
var Task = require('./task');
var Email = require('./email');
var Last = require('./last');
var Stream = require('./stream');
var Storage = require('./storage');


// Declare internals

var internals = {

    maxMessageLength: 250
};


// Project definitions

exports.type = {};

exports.type.post = {

    title:          { type: 'string' },
    date:           { type: 'date',     empty: true },
    time:           { type: 'time',     empty: true },
    place:          { type: 'string',   empty: true },
    participants:   { type: 'object',                   set: false, array: true },
    priority:          { type: 'number' }	// -Lance.
};

exports.type.put = Hapi.Utils.clone(exports.type.post);
exports.type.put.title.required = true;

exports.type.participants = {

    participants:   { type: 'id',       array: true },      // type can also be email
    names:          { type: 'string',   array: true },
    // added for facebook sharing,  -Lance.
    facebookIds:          { type: 'string',   array: true },
    shareType:          { type: 'string' }
};

/* payload/schema not available w GET (could load fbid from db using userId)
// added new type for facebook shares - don't require it even tho req'd w facebookIds for compat/now,  -Lance.
exports.type.getFacebook = {
    facebookId:         { type: 'string' }	// required: true
};
*/

exports.type.uninvite = {

    participants:   { type: 'id',       array: true,    required: true }
};


// Get project information

exports.get = function (request, reply) {

    exports.load(request.params.id, request.userId, false, function (project, member, err) {

        if (project) {

            exports.participantsList(project, function (participants) {

                project.participants = participants;

                reply(project);
            });
        }
        else {

            reply(err);
        }
    } );
    // }, request.payload.facebookId );	// added for facebook share,  -Lance.
    // back for normal since we handle requests in web home with api's copy and link }, request.params.fbid );	// added for facebook share,  -Lance.
};


// Get list of projects for current user

exports.list = function (request, reply) {

    Sort.list('project', request.userId, 'participants.id', function (projects) {

        if (projects) {

            var list = [];
            for (var i = 0, il = projects.length; i < il; ++i) {

                var isPending = false;
                for (var p = 0, pl = projects[i].participants.length; p < pl; ++p) {

                    if (projects[i].participants[p].id &&
                        projects[i].participants[p].id === request.userId) {

                        isPending = projects[i].participants[p].isPending || false;
                        break;
                    }
                }

                var item = {
					id: projects[i]._id,
					title: projects[i].title,
					priority: projects[i].priority	// -Lance.
				};

                if (isPending) {

                    item.isPending = true;
                }

                list.push(item);
            }

            Last.load(request.userId, function (last, err) {

                if (last &&
                    last.projects) {

                    for (i = 0, il = list.length; i < il; ++i) {

                        if (last.projects[list[i].id]) {

                            list[i].last = last.projects[list[i].id].last;
                        }
                    }
                }

                // wait for checkAndLoadSamples: reply(list);
            });

			// put in sample lists here if none
			// if( projects.length <= 0 )
			// if( !internals.checkForSamples( projects ) ) 
			function checkAndLoadSamplesReply( sampleProjects ) {
				console.log( 'Project.list replying w ' + list.length + ' and now ' ) ;
				// console.log( 'Project.list replying w ' + list.length + ' and now ' + ( sampleProjects && sampleProjects.length ) + ' w agent ' + request.api.agent.os ) ;
				for (var i = 0 ; sampleProjects && i < sampleProjects.length; ++i) {
					var item = {
						id: sampleProjects[i]._id,
						title: sampleProjects[i].title,
						priority: sampleProjects[i].priority	// -Lance.
					};
					// if( sampleProjects[i].title !== 'Tips and Hints' || ( request.api.agent.os === 'iPhone' || request.api.agent.os === 'iPad' ) ) {	// don't add the tutorial list to anything but iOS
						list.push(item);
					// }
				}
				reply( list ) ;
			}
			internals.checkAndLoadSamples( request, projects, checkAndLoadSamplesReply ) ;

        }
        else {

            reply(Hapi.Error.notFound());
        }
    });
};


// Get list of projects for all users (for debug,  -Lance.)

exports.listall = function (request, reply) {

    var criteria = {};

    Db.query('project', criteria, function (projects, err) {

        if (err === null && projects) {

            var ownerSet = {};	// collect as set to avoid dups
            var list = [];

            for (var i = 0, il = projects.length; i < il; ++i) {

				var project = projects[i] ;

				var item = {
					id: project._id,
					title: project.title,
					created: project.created,
					domain: project.domain,
					owner: project.participants[0].id,
					// owner: name.display,
					priority: project.priority
				};

				list.push(item);
							
				// console.log( 'LANCE pushing project ' + project._id + ' of ' + projects.length ) ;

				/* too many, callbacks not being made
				
						var item = {
							id: project._id,
							title: project.title,
							created: project.created,
							domain: project.domain,
							// owner: project.participants[0].id,
							owner: name.display,
							priority: project.priority
						};

						list.push(item);
					
						console.log( 'LANCE cb ' + list.length + ' ' + projects.length ) ;
					
						if( list.length >= projects.length ) {
							reply(list);
						}
				
				function projectWithOwner( project ) {	// need function closer toover project

					User.quick( project.participants[0].id, function (name) {
					
					
						var item = {
							id: project._id,
							title: project.title,
							created: project.created,
							domain: project.domain,
							// owner: project.participants[0].id,
							owner: name.display,
							priority: project.priority
						};

						list.push(item);
					
						// console.log( 'LANCE cb ' + list.length + ' ' + projects.length ) ;
					
						if( list.length >= projects.length ) {
							reply(list);
						}
				
					});
					
				}

				projectWithOwner( projects[i] ) ;
				*/

				// owners.push( project.participants[0].id ) ;
				ownerSet[ project.participants[0].id ] = true ;	

			}
			
			ownerArray = [];
			for (var o in ownerSet) {
				ownerArray.push( o );
				// console.log( 'LANCE pushing owner ID ' + o + ' to ' + ownerArray.length ) ;
			}

			// first, remove any bogus owners (orphaned projects)
			Db.getMany('user', ownerArray, function (owners, err, notFound) {

				if (err !== null || owners.length !== ownerArray.length) {

		            for (var nfi = 0, nfl = notFound.length; nfi < nfl; ++nfi) {
						// console.log( 'LANCE removing owner ID ' + notFound[ nfi ] + ' at ' + ownerArray.indexOf( notFound[ nfi ] ) ) ;
						ownerArray.splice( ownerArray.indexOf( notFound[ nfi ] ), 1 ) ;
					}

				}

			});

			Db.getMany('user', ownerArray, function (owners, err, notFound) {

				if (err === null) {

					if (owners.length === ownerArray.length) {

						var ownerNames = {} ;
						for (var oi = 0, ol = owners.length; oi < ol; ++oi) {
							var owner = owners[ oi ] ;
							ownerNames[ owner._id ] = owner.name || owner.username || owner.email || owner._id ;
						}
			            
			            for (var li = 0, ll = list.length; li < ll; ++li) {
							
							var project = list[li] ;
							project.owner = ownerNames[ project.owner ] ;

						}
							
						reply( list );
						
					} else {

						reply(Hapi.Error.badRequest('Invalid user ID: ' + JSON.stringify(notFound)));

					}

				} else {

					reply(err);

				}

			});

        } else {

            // todo: use err callback(null, err);
            reply(Hapi.Error.notFound());

        }

    });

};


// Get the shared list/project or the last-stored project, -Lance.

exports.active = function (request, reply) {

    /* giving up on parsing request id's
     * as it's too hard to get the host/web app 
     * and associated client secret from the vault
     * and parse the signed request
     * would've next pulled in from web side: 
     * exports.processFacebookAppRequests = function (rids, token, uid, session) {
     * function parse_signed_request(signed_request, secret) {
        var secret = Vault.facebook[ host ] ;   //host has to be pass in now as it's not in headers like on web side
        secret = secret && secret.clientSecret ;    // protect
        if( req.body.signed_request && secret ) {   // just for facebook/testing
            fbsr = parse_signed_request( req.body.signed_request, secret );   // Utils.decrypt( secret, sr );
        if( fbsr && fbsr.oauth_token && req.query.request_ids ) {
            Utils.processFacebookAppRequests( req.query.request_ids.split( ',' ), fbsr.oauth_token, fbsr.user_id, req.api.session ) ;    
    */

    function fallback() {
        request.params.id = 'activeProject' ;   // morph/reroute this current request into storage request
        function toId( as ) {
            as.id = as && as.activeProject ;
            reply( as ) ;
        }
        Storage.get( request, toId ) ;
    }
    function checkReply( r ) {
        if( r.id ) {
            reply( r ) ;
        } else {
            fallback() ;
        }
    }

    if( !request.query.request_ids && !request.query.rl ) {

        // perhaps should aways go through projexts looking for unclaimed share requests
        // but worried that getting fbid and going thru all proj/list too slow

        // all's ok, just nothing to share
        fallback() ;    // reply({ status: 'ok' });

    } else if( request.query.request_ids ) {    // should only get one of request_id's or l's

        if( request.query.fbid  ) {

            exports.fbr( request.query.fbid, checkReply ) ;

        } else {

            User.load(request.userId, function (user, err) {

                if (user && user.facebook) {

                    request.query.fbid = user.facebook ;    // todo, for now: sim as tho it were passed in
                    exports.fbr( request, checkReply ) ;

                } else {

                    fallback() ;    // reply(Hapi.Error.badRequest('no facebook id for request_ids'));

                }

            });

        }
        
    } else if( request.query.rl ) {  // don't even bother checking for request.query.fbid

        User.load(request.userId, function (user, err) {

            if (user && user.facebook) {

                Db.get('project', request.query.rl, function (project, err) {

                    if( err === null && project ) {
                        
                        internals.fbr( [project], request.userId, user.facebook, checkReply, request.server.settings.host ) ;

                    } else {

                        fallback() ;    // reply && reply(err||Hapi.Error.badRequest('no such project' + request.query.rl));

                    }

                });

            } else {

                fallback() ;    // reply(Hapi.Error.badRequest('no facebook id for rl'));

            }

        });

    }
    
};


// now that facebook isn't passing request_ids query parameter to us, we have to find them on our own
/* now doing it all here w fbr
exports.listFacebookRequestedProjects = function (request, reply) {
    exports.unsortedFacebookRequestList( request.query.fbid, function (projects, error) {
        if (projects) {
			reply(projects);
        } else {
            reply(Hapi.Error.notFound());
        }
    });
};
*/


// Update project properties

exports.post = function (request, reply) {

    exports.load(request.params.id, request.userId, true, function (project, member, err) {

        if (project) {

            if (Object.keys(request.payload).length > 0) {

                if (request.query.position === undefined) {

                    Db.update('project', project._id, Db.toChanges(request.payload), function (err) {

                        if (err === null) {

                            Stream.update({ object: 'project', project: project._id }, request);

                            if (request.payload.title !== project.title) {

                                for (var i = 0, il = project.participants.length; i < il; ++i) {

                                    if (project.participants[i].id) {

                                        Stream.update({ object: 'projects', user: project.participants[i].id }, request);
                                    }
                                }
                            }

                            reply({ status: 'ok' });
                        }
                        else {

                            reply(err);
                        }
                    });
                }
                else {

                    reply(Hapi.Error.badRequest('Cannot include both position parameter and project object in body'));
                }
            }
            else if (request.query.position || request.query.position===0) {	// need to check for 0 since that's false in js,  -Lance.

                Sort.set('project', request.userId, 'participants.id', request.params.id, request.query.position, function (err) {

                    if (err === null) {

                        Stream.update({ object: 'projects', user: request.userId }, request);
                        reply({ status: 'ok' });
                    }
                    else {

                        reply(err);
                    }
                });
            }
            else {

                reply(Hapi.Error.badRequest('Missing position parameter or project object in body'));
            }
        }
        else {

            reply(err);
        }
    });
};


// Create new project

exports.put = function (request, reply) {

    var project = request.payload;
    project.participants = [{ id: request.userId}];

	// Lance added the hostname to keep track of which app/site this project was created from
	// replace www. prefix, .port#, .com or whatever suffix
	// var hostname = request.headers.host.replace( /www./, '' ).replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) ;
	var hostname = request.server.settings.host ;
	project.domain = hostname ;

    Db.insert('project', project, function (items, err) {

        if (err === null) {

            Stream.update({ object: 'projects', user: request.userId }, request);
            reply({ status: 'ok', id: items[0]._id }, { created: 'project/' + items[0]._id });
        }
        else {

            reply(err);
        }
    });
};


// Delete a project

exports.del = function (request, reply) {

    exports.load(request.params.id, request.userId, false, function (project, member, err) {

        if (project) {

            // Check if owner

            if (exports.isOwner(project, request.userId)) {

                // Delete all tasks

                Task.delProject(project._id, function (err) {

                    if (err === null) {

                        // Delete project

                        Db.remove('project', project._id, function (err) {

                            if (err === null) {

                                Last.delProject(request.userId, project._id, function (err) { });

                                Stream.update({ object: 'project', project: project._id }, request);

                                for (var i = 0, il = project.participants.length; i < il; ++i) {

                                    if (project.participants[i].id) {

                                        Stream.update({ object: 'projects', user: project.participants[i].id }, request);
                                        Stream.drop(project.participants[i].id, project._id);
                                    }
                                }

                                reply({ status: 'ok' });
                            }
                            else {

                                reply(err);
                            }
                        });
                    }
                    else {

                        reply(err);
                    }
                });
            }
            else {

                // Leave project

                internals.leave(project, member, function (err) {

                    if (err === null) {

                        Stream.update({ object: 'project', project: project._id }, request);
                        Stream.update({ object: 'projects', user: request.userId }, request);
                        Stream.drop(request.userId, project._id);

                        reply({ status: 'ok' });
                    }
                    else {

                        reply(err);
                    }
                });
            }
        }
        else {

            reply(err);
        }
    });
};


// Get list of project tips

exports.tips = function (request, reply) {

    // Get project

    exports.load(request.params.id, request.userId, false, function (project, member, err) {

        if (project) {

            // Collect tips

            Tips.list(project, function (results) {

                reply(results);
            });
        }
        else {

            reply(err);
        }
    });
};


// Get list of project suggestions

exports.suggestions = function (request, reply) {

    // Get project

    exports.load(request.params.id, request.userId, false, function (project, member, err) {

        if (project) {

            // Collect tips

            Suggestions.list(project, request.userId, function (results) {

                reply(results);
            });
        }
        else {

            reply(err);
        }
    });
};


// Add new participants to a project

exports.participants = function (request, reply) {

    if (request.query.message) {

        if (request.query.message.length <= internals.maxMessageLength) {

            if (request.query.message.match('://') === null) {

                process();
            }
            else {

                reply(Hapi.Error.badRequest('Message cannot contain links'));
            }
        }
        else {

            reply(Hapi.Error.badRequest('Message length is greater than ' + internals.maxMessageLength));
        }
    }
    else {

        process();
    }

    function process() {

        if (request.payload.participants ||
            request.payload.names ||
			request.payload.facebookIds ) {	// added for facebook shares,  -Lance.

            exports.load(request.params.id, request.userId, true, function (project, member, err) {

				// var hostname = request.headers.host.replace( /www./, '' ).replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) ;
				// var hostname = request.query.hostname && request.query.hostname.replace( /www./, '' ).replace( /:.*/, '' ).replace( /\.[A-z]+$/, '' ) ;
				var hostname = request.server.settings.host ;

                if (project) {

                    var change = { $pushAll: { participants: []} };

                    // Cnovert facebook shares,  -Lance.

                    if (request.payload.facebookIds) {

                        for (var i = 0, il = request.payload.facebookIds.length; i < il; ++i) {
                            var participant = { 
								facebookId: request.payload.facebookIds[i], 
								display: request.payload.facebookIds[i], 
								domain: hostname, 
								shareType: request.payload.shareType
							};
                            change.$pushAll.participants.push(participant);
                        }

                        if (request.payload.participants === undefined && request.payload.names === undefined) {

                            // No naames or user accounts to invite, save project

                            Db.update('project', project._id, change, function (err) {

                                if (err === null) {

                                    // Return success

                                    finalize();
                                }
                                else {

                                    reply(err);
                                }
                            });
                        }
                    }

                    // Add pids (non-users)

                    if (request.payload.names) {

                        for (var i = 0, il = request.payload.names.length; i < il; ++i) {

                            var participant = { pid: Db.generateId(), display: request.payload.names[i] };
                            change.$pushAll.participants.push(participant);
                        }

                        if (request.payload.participants === undefined) {

                            // No user accounts to invite, save project

                            Db.update('project', project._id, change, function (err) {

                                if (err === null) {

                                    // Return success

                                    finalize();
                                }
                                else {

                                    reply(err);
                                }
                            });
                        }
                    }

                    // Add users or emails

                    if (request.payload.participants) {

                        // Get user

                        User.load(request.userId, function (user, err) {

                            if (user) {

                                // Lookup existing users

                                User.find(request.payload.participants, function (users, emailsNotFound, err) {

                                    if (err === null) {

                                        var prevParticipants = Hapi.Utils.map(project.participants, 'id');

                                        // Check for changes

                                        var contactsChange = { $set: {} };
                                        var now = Hapi.Utils.getTimestamp();

										var changedUsers = [];
                                        for (var i = 0, il = users.length; i < il; ++i) {

                                            // Add / update contact

                                            if (users[i]._id !== request.userId) {

                                                contactsChange.$set['contacts.' + users[i]._id] = { type: 'user', last: now };
                                            }

                                            // Add participant if new

                                            if (prevParticipants[users[i]._id] !== true) {

                                                change.$pushAll.participants.push({ id: users[i]._id, isPending: true });
												changedUsers.push(users[i]);
                                            }
                                        }

                                        var prevPids = Hapi.Utils.map(project.participants, 'email');

                                        var pids = [];
                                        for (i = 0, il = emailsNotFound.length; i < il; ++i) {

                                            contactsChange.$set['contacts.' + Db.encodeKey(emailsNotFound[i])] = { type: 'email', last: now };

                                            if (prevPids[emailsNotFound[i]] !== true) {

                                                var pid = {

                                                    pid: Db.generateId(),
                                                    display: emailsNotFound[i],
                                                    isPending: true,

                                                    // Internal fields

                                                    email: emailsNotFound[i],
                                                    code: Hapi.Utils.getRandomString(6),
                                                    inviter: user._id
                                                };

                                                change.$pushAll.participants.push(pid);
                                                pids.push(pid);
                                            }
                                        }

                                        // Update user contacts

                                        if (Object.keys(contactsChange.$set).length > 0) {

                                            Db.update('user', user._id, contactsChange, function (err) {

                                                // Non-blocking

                                                if (err === null) {

                                                    Stream.update({ object: 'contacts', user: user._id }, request);
                                                }
                                            });
                                        }

                                        // Update project participants

                                        if (change.$pushAll.participants.length > 0) {

                                            Db.update('project', project._id, change, function (err) {

                                                if (err === null) {

                                                    for (var i = 0, il = changedUsers.length; i < il; ++i) {

                                                        Stream.update({ object: 'projects', user: changedUsers[i]._id }, request);
                                                    }

                                                    // Invite new participants

                                                    Email.projectInvite(changedUsers, pids, project, request.query.message, user);

                                                    // Return success

                                                    finalize();
                                                }
                                                else {

                                                    reply(err);
                                                }
                                            });
                                        }
                                        else {

                                            reply(Hapi.Error.badRequest('All users are already project participants'));
                                        }
                                    }
                                    else {

                                        reply(err);
                                    }
                                });
                            }
                            else {

                                reply(Hapi.Error.internal(err));
                            }
                        });
                    }
                }
                else {

                    reply(err);
                }
            });
        }
        else {

            reply(Hapi.Error.badRequest('Body must contain a participants or names array'));
        }
    }

    function finalize() {

        Stream.update({ object: 'project', project: request.params.id }, request);

        // Reload project (changed, use direct DB to skip load processing)

        Db.get('project', request.params.id, function (project, err) {

            if (project) {

                exports.participantsList(project, function (participants) {

                    var response = { status: 'ok', participants: participants };

                    reply(response);
                });
            }
            else {

                reply(err);
            }
        });
    }
};


// Remove participant from project

exports.uninvite = function (request, reply) {

    // Load project for write

    exports.load(request.params.id, request.userId, true, function (project, member, err) {

        if (project) {

            // Check if owner

            if (exports.isOwner(project, request.userId)) {

                // Check if single delete or batch

                if (request.params.user) {

                    // Single delete

                    if (request.userId !== request.params.user) {

                        // Lookup user

                        var uninvitedMember = exports.getMember(project, request.params.user);
                        if (uninvitedMember) {

                            internals.leave(project, uninvitedMember, function (err) {

                                if (err === null) {

                                    // Return success

                                    Stream.update({ object: 'projects', user: request.params.user }, request);
                                    Stream.drop(request.params.user, project._id);

                                    finalize();
                                }
                                else {

                                    reply(err);
                                }
                            });
                        }
                        else {

                            reply(Hapi.Error.notFound('Not a project participant'));
                        }
                    }
                    else {

                        reply(Hapi.Error.badRequest('Cannot uninvite self'));
                    }
                }
                else if (request.payload.participants) {

                    // Batch delete

                    var error = null;
                    var uninvitedMembers = [];

                    for (var i = 0, il = request.payload.participants.length; i < il; ++i) {

                        var removeId = request.payload.participants[i];

                        if (request.userId !== removeId) {

                            // Lookup user

                            var uninvited = exports.getMember(project, removeId);
                            if (uninvited) {

                                uninvitedMembers.push(uninvited);
                            }
                            else {

                                error = Hapi.Error.notFound('Not a project participant: ' + removeId);
                                break;
                            }
                        }
                        else {

                            error = Hapi.Error.badRequest('Cannot uninvite self');
                            break;
                        }
                    }

                    if (uninvitedMembers.length === 0) {

                        error = Hapi.Error.badRequest('No members to remove');
                    }

                    if (error === null) {

                        // Batch leave

                        batch(project, uninvitedMembers, 0, function (err) {

                            if (err === null) {

                                // Return success

                                finalize();
                            }
                            else {

                                reply(err);
                            }
                        });
                    }
                    else {

                        reply(error);
                    }
                }
                else {

                    reply(Hapi.Error.badRequest('No participant for removal included'));
                }
            }
            else {

                reply(Hapi.Error.badRequest('Not an owner'));
            }
        }
        else {

            reply(err);
        }
    });

    function batch(project, members, pos, callback) {

        if (pos >= members.length) {

            callback(null);
        }
        else {

            internals.leave(project, members[pos], function (err) {

                if (err === null) {

                    // Return success

                    if (members[pos].id) {

                        Stream.update({ object: 'projects', user: members[pos].id }, request);
                        Stream.drop(members[pos].id, project._id);
                    }

                    batch(project, members, pos + 1, callback);
                }
                else {

                    callback(err);
                }
            });
        }
    }

    function finalize() {

        Stream.update({ object: 'project', project: request.params.id }, request);

        // Reload project (changed, use direct DB to skip load processing)

        Db.get('project', request.params.id, function (project, err) {

            if (project) {

                exports.participantsList(project, function (participants) {

                    var response = { status: 'ok', participants: participants };

                    reply(response);
                });
            }
            else {

                reply(err);
            }
        });
    }
};


// Accept project invitation

exports.join = function (request, reply) {

    // The only place allowed to request a non-writable copy for modification
    exports.load(request.params.id, request.userId, false, function (project, member, err) {

        if (project) {

            // Verify user is pending

            if (member.isPending) {

                Db.updateCriteria('project', project._id, { 'participants.id': request.userId }, { $unset: { 'participants.$.isPending': 1} }, function (err) {

                    if (err === null) {

                        // Return success

                        Stream.update({ object: 'project', project: project._id }, request);
                        Stream.update({ object: 'projects', user: request.userId }, request);

                        reply({ status: 'ok' });
                    }
                    else {

                        reply(err);
                    }
                });
            }
            else {

                reply(Hapi.Error.badRequest('Already a member of the project'));
            }
        }
        else {

            reply(err);
        }
    });
};

// Accept project fb copy invitation

exports.copy = function (request, reply) {
	
	internals.copy( request.params.id, request.userId, request.query.fbid, reply ) ;
	
};

// internals for Accept project fb copy invitation

internals.copy = function (projectId, userId, facebookId, reply) {

    // The only place allowed to request a non-writable copy for modification
    exports.load(projectId, userId, false, function (project, member, err) {	// note the facebook id param after the function

        if (project) {

            // Not: Verify user is pending	if (member.isPending) else 'Already a member of the project'
			// Db.updateCriteria('project', project._id, { 'participants.id': request.userId }, { $unset: { 'participants.$.isPending': 1} }, function (err) {
			// Stream.update({ object: 'project', project: project._id }, request);
			// Stream.update({ object: 'projects', user: request.userId }, request);

			// todo: what about sharing a copy with public (don't want to delete the share/incivte)
			// update db w already-shared member
			// var participant = { pid: member.pid, display: member.display };
			// todo: just delete this participant
			member.facebookId = '' ;	// null ok?
			member.shareType = '' ;	// null ok?
			// member.display = '' ;	// null ok?
			// member.id = '' ;	// null ok?
            try {
    			Db.updateCriteria('project', projectId, { 'participants.facebookId': facebookId }, { $set: { 'participants.$': /*member*/{} } }, function (err) {
    				if (err === null) {
    					console.log( 'Lance project copy deshared ok ' ) ;
    					// reply && reply({ status: 'ok', id: project._id });
    				} else {
    					console.log( 'Lance project copy deshared failed with err: ' + err ) ;
    					// reply && reply(err);
    				}
    			});
            } catch( err ) {
                console.log( 'Lance project copy doc update failed: ' + err ) ;
                reply && reply(Hapi.Error.badRequest('Db update failed (proj prob already copied)'));                
            }

			// create new project clone but w userId as owner
		    // project.participants = [{ id: request.userId}];
			var oldItemId = project._id ;
			var originShareId = project.participants[0].id ;
			// todo: copy other project details
			project._id = null ;
			// project.participants = [{ id: member.id }] ;
			project.participants = [{ id: member.id, originShareType: 'copy', originShareId: originShareId, originShareName: 'Someone' }] ;
			// project.participants = [{ id: member.id, originShareType: 'copy', originShareId: originShareId, originShareName:  }] ;	// userId
		    User.expandIds([ originShareId ], function (users, usersMap) {
				var owner = usersMap[ originShareId ] ;
				if( owner ) {
					// project.participants = [{ id: member.id, originShareType: 'copy', originShareId: project.participants[0].id, originShareName: owner.display }] ;
					project.participants[0].originShareName = owner.display ;
				}

			    Db.insert('project', project, function (items, err) {	// project

			        if (err === null) {

			            // Stream.update({ object: 'projects', user: request.userId }, request);
			            // reply({ status: 'ok', id: items[0]._id }, { created: 'project/' + items[0]._id });
						project = items[0] ;	// for callback

						// has new participants - copy details?

						// copy tasks, no details
						// copy from Tasks.list

						// mark as copied w new id?

			            Sort.list('task', projectId, 'project', function (tasks) {

		                    for (var i = 0, il = tasks.length; i < il; ++i) {

		                        var task = tasks[i] ;

						        task.project = items[0]._id ;	// projectId;
						        task.status = task.status || 'open';	// shouldn't be needed
								task._id = null ;	// needs to be reset for insert

						        Db.insert('task', task, function (items, err) {

						            if (err === null) {

										console.log( 'Lance project copy - inserted task ' + items[0]._id + ' ' + tasks.length ) ;

						            }
						            else {

										console.log( 'Lance project copy - failed to insert tasks ' + err + ' ' + tasks.length ) ;

						            }

						        });

							}

			            });

						console.log( 'Lance project copy succeeded from ' + oldItemId + ' to ' + items[0]._id ) ;					
						reply && reply({ status: 'ok', id: project._id });

			        } else {

						console.log( 'Lance project load - copy failed from ' + oldItemId + ' with ' + err ) ;
						reply && reply(err);

			        }

			    });

		    });
	    
		} else {
		
			// todo: throw error
			console.log( 'Lance error wih no project, or shareType not copy or link ' + projectId + ' ' + userId + ' ' + err ) ;
			reply && reply(err);

		}

    // -Lance. });
	}, facebookId ) ;
	
};


// Accept project fb link invitation

exports.link = function (request, reply) {
	
	internals.link( request.params.id, request.userId, request.query.fbid, reply ) ;
	
};

// internals for Accept project fb link invitation

internals.link = function (projectId, userId, facebookId, reply) {

    // The only place allowed to request a non-writable copy for modification
	exports.load(projectId, userId, false, function (project, member, err) {
	
		// we are only loading and checking project to ensure we've been granted permissions to share/load it
		// at this time, need no info fom project
		if (project) {

			// Not: Verify user is pending	if (member.isPending) else 'Already a member of the project'
			// Db.updateCriteria('project', project._id, { 'participants.id': request.userId }, { $unset: { 'participants.$.isPending': 1} }, function (err) {
			// Stream.update({ object: 'project', project: project._id }, request);
			// Stream.update({ object: 'projects', user: request.userId }, request);

			console.log( 'Lance linking ' + projectId + ' ' + project._id ) ;

			// clear facebookId?
			// member.facebookId = '' ;

            // if it's a public link, we need to add a new member
            // can't just replace the public facebookId "invite" as we could if it were a private invite to a particular facebookId
            // and we don't have to worry if it's a copy because then we'd get a whole new project as above copy code does
            if( member.facebookId === 'public' ) {

                // add to db w public-shared member
                var change = { $pushAll: { participants: []} };
                var participant = { 
                    id: userId
                };
                change.$pushAll.participants.push(participant);
                try {                
                    Db.update('project', project._id, change, function (err) {
                        if (err === null) {                            
                            console.log( 'Lance project public link ok ' ) ;
                            reply && reply({ status: 'ok', id: project._id });
                        } else {
                            console.log( 'Lance project public link failed with err: ' + err ) ;
                            reply && reply(err);
                        }
                    });
                } catch( err ) {
                    console.log( 'Lance project public link doc update failed: ' + err ) ;
                    reply && reply(Hapi.Error.badRequest('Db public update failed (proj prob already linked)'));                
                }

            } else if( member.facebookId === facebookId ) {

                // update db w already-shared member
                // var participant = { pid: member.pid, display: member.display };
                member.facebookId = '' ;    // null ok?
                member.shareType = '' ; // null ok?
                // member.display = ?
                try {                
                    Db.updateCriteria('project', projectId, { 'participants.facebookId': facebookId }, { $set: { 'participants.$': member } }, function (err) {

                        if (err === null) {
                            
                            console.log( 'Lance project link ok ' ) ;
                            reply && reply({ status: 'ok', id: project._id });
                            
                        } else {
                            
                            console.log( 'Lance project link failed with err: ' + err ) ;
                            reply && reply(err);
                            
                        }

                    });
                } catch( err ) {
                    console.log( 'Lance project link doc update failed: ' + err ) ;
                    reply && reply(Hapi.Error.badRequest('Db update failed (proj prob already linked)'));                
                }

            } else {
                console.log( 'Lance: Db public update failed (proj already linked: ' + err ) ;
                reply && reply(Hapi.Error.badRequest('Db public update failed (proj already linked)'));                
            }
	    
		} else {
			
			console.log( 'Lance error wih no project, or shareType for link ' + projectId + ' ' + userId + ' ' + err ) ;
			reply && reply(err);

		}

    // -Lance. });
	}, facebookId ) ;
	
};


// Load project from database and check for user rights

exports.load = function (projectId, userId, isWritable, callback, facebookId) {

    Db.get('project', projectId, function (item, err) {

        if (item) {

            var member = null;
            for (var i = 0, il = item.participants.length; i < il; ++i) {

                if (item.participants[i].id &&
                    item.participants[i].id === userId) {

                    member = item.participants[i];
                    if (member.isPending) {

                        item.isPending = true;
                    }

                    break;
                }

            }

            // reloop to get promote a participants match first over facebook match
            for (var i = 0, il = item.participants.length; !member && i < il; ++i) {

				// db manip was too complicated for a simple get, so simplified by adding copy and link join methods
				// check facebook invites,  -Lance.
				// x put facebookId's in as participants with facebook flag
				// todo: calc facebookId
				// L look in some precedence order, member, public, copy, link, etc.?
				// N put !item.participants[i].facebook in above userId check?
                if( (item.participants[i].facebookId &&
					facebookId &&
                    item.participants[i].facebookId === facebookId) 
					|| item.participants[i].facebookId === 'public' ) {

                    member = item.participants[i];
					// update member with userId
					member.id = userId ;
				
					/*
					if( member.shareType === 'link' ) {

						console.log( 'Lance linking ' + item.participants[i].facebookId ) ;

						// clear facebookId?
						// member.facebookId = '' ;
					
						// todo: update db w member
                        // var participant = { pid: member.pid, display: member.display };
                        Db.updateCriteria('project', projectId, { 'participants.facebookId': facebookId }, { $set: { 'participants.$': member } }, function (err) {
                            // callback(err);
							console.log( 'Lance Project load, converted facebookId to userId ' + facebookId + ' ' + userId ) ;
                        });
						
					} else if( member.shareType === 'copy' ) {
						
						// create new project clone but w userId as owner - prob shouldn't do this on a GET (id change, etc)
						// from put
						// just use item instead of project
						// var project = request.payload;
					    // project.participants = [{ id: request.userId}];
					    item.participants = [{ id: member.id }] ;	// userId
						var oldItemId = item._id ;
						item._id = null ;
						
					    Db.insert('project', item, function (items, err) {	// project

					        if (err === null) {
								
					            // Stream.update({ object: 'projects', user: request.userId }, request);
					            // reply({ status: 'ok', id: items[0]._id }, { created: 'project/' + items[0]._id });
								console.log( 'Lance project load - copy succeeded from ' + oldItemId + ' to ' + items[0]._id ) ;
								item = items[0] ;	// for callback
								
								// has new participants - copy details?
								
								// copy tasks, no details
								// copy from Tasks.list
								
								// mark as copied w new id
								
								// what about the imminent /tasks call to the original id - how to we make that work right?
								// I think we need a seperate clone call...
								
					        } else {

					            // reply(err);
								console.log( 'Lance project load - copy failed from ' + oldItemId + ' with ' + err ) ;

					        }
					
					    });
					    
					} else {
						
						// todo: throw error
						console.log( 'Lance error wih shareType not copy or link in participants ' + item.participants[i].id ) ;
						
					}
					*/
					
					// check to see what callback does with member
					
                    break;
                }

				// check public invite,  -Lance.
				// similar to above with item.participants[i].public

            }

            if (member) {

                if (isWritable === false ||
                    item.isPending !== true) {

                    callback(item, member, null);
                }
                else {

                    // Invitation pending
                    callback(null, null, Hapi.Error.forbidden('Must accept project invitation before making changes'));
                }
            }
            else {

                // Not allowed
                callback(null, null, Hapi.Error.forbidden('Not a project member'));
            }
        }
        else {

            if (err === null) {

                callback(null, null, Hapi.Error.notFound());
            }
            else {

                callback(null, null, err);
            }
        }
    });
};


// Get participants list

exports.participantsList = function (project, callback) {

    var userIds = [];
    for (var i = 0, il = project.participants.length; i < il; ++i) {

        if (project.participants[i].id) {

            userIds.push(project.participants[i].id);
        }
    }

    User.expandIds(userIds, function (users, usersMap) {

        var participants = [];
        for (var i = 0, il = project.participants.length; i < il; ++i) {

            var participant = null;

            if (project.participants[i].id) {

                // Registered user participant

                participant = usersMap[project.participants[i].id];

		// Lance added for sharing:
		// originShareType: 'copy', originShareId: project.participants[0].id, originShareName
		if( participant ) {
				participant.originShareType = project.participants[i].originShareType ;
				participant.originShareId = project.participants[i].originShareId ;
				participant.originShareName = project.participants[i].originShareName ;
		}

            }
            else if (project.participants[i].pid) {

                // Non-user participant

                participant = {

                    id: 'pid:' + project.participants[i].pid,
                    display: project.participants[i].display,
                    isPid: true
                };
            }

            if (participant) {

                if (project.participants[i].isPending) {

                    participant.isPending = project.participants[i].isPending;
                }

                participants.push(participant);
            }
        }

        callback(participants);
    });
};


// Get participants map

exports.participantsMap = function (project) {

    var participants = { users: {}, emails: {} };

    for (var i = 0, il = project.participants.length; i < il; ++i) {

        if (project.participants[i].id) {

            // Registered user participant

            participants.users[project.participants[i].id] = true;
        }
        else if (project.participants[i].email) {

            // Non-user email-invited participant

            participants.emails[project.participants[i].email] = true;
        }
    }

    return participants;
};


// Get member

exports.getMember = function (project, userId) {

    var isPid = userId.indexOf('pid:') === 0;
    if (isPid) {

        userId = userId.substring(4);           // Remove 'pid:' prefix
    }

    for (var i = 0, il = project.participants.length; i < il; ++i) {

        if (isPid &&
            project.participants[i].pid &&
            project.participants[i].pid === userId) {

            return project.participants[i];
        }
        else if (project.participants[i].id &&
                 project.participants[i].id === userId) {

            return project.participants[i];
        }
    }

    return null;
};


// Check if member

exports.isMember = function (project, userId) {

    return (exports.getMember(project, userId) !== null);
};


// Check if owner

exports.isOwner = function (project, userId) {

    return (project.participants[0].id && project.participants[0].id === userId);
};


// Leave project

internals.leave = function (project, member, callback) {

    var isPid = (member.pid !== null && member.pid !== undefined);
    var userId = (isPid ? member.pid : member.id);

    // Check if user is assigned tasks

    Task.userTaskList(project._id, (isPid ? 'pid:' + userId : userId), function (tasks, err) {

        if (err === null) {

            if (tasks.length > 0) {

                // Check if removing a pid

                if (isPid === false) {

                    // Load user

                    User.load(userId, function (user, err) {

                        if (user) {

                            // Add unregistered project account (pid)

                            var display = (user.name ? user.name
                                                     : (user.username ? user.username
                                                                      : (user.emails && user.emails[0] && user.emails[0].address ? user.emails[0].address : null)));

                            var participant = { pid: Db.generateId(), display: display };

                            // Move any assignments to pid account (not details) and save tasks

                            var taskCriteria = { project: project._id, participants: userId };
                            var taskChange = { $set: { 'participants.$': 'pid:' + participant.pid} };
                            Db.updateCriteria('task', null, taskCriteria, taskChange, function (err) {

                                if (err === null) {

                                    // Save project

                                    Db.updateCriteria('project', project._id, { 'participants.id': userId }, { $set: { 'participants.$': participant} }, function (err) {

                                        if (err === null) {

                                            // Cleanup last information

                                            Last.delProject(userId, project._id, function (err) { });

                                            callback(null);
                                        }
                                        else {

                                            callback(err);
                                        }
                                    });
                                }
                                else {

                                    callback(err);
                                }
                            });
                        }
                        else {

                            callback(err);
                        }
                    });
                }
                else {

                    // Remove pid

                    if (member.isPending) {

                        // Remove invitation from pid

                        var participant = { pid: member.pid, display: member.display };
                        Db.updateCriteria('project', project._id, { 'participants.pid': userId }, { $set: { 'participants.$': participant } }, function (err) {

                            callback(err);
                        });
                    }
                    else {

                        callback(Hapi.Error.badRequest('Cannot remove pid user with task assignments'));
                    }
                }
            }
            else {

                var change = { $pull: { participants: {}} };
                change.$pull.participants[isPid ? 'pid' : 'id'] = userId;

                Db.update('project', project._id, change, function (err) {

                    if (err === null) {

                        if (isPid === false) {

                            // Cleanup last information

                            Last.delProject(userId, project._id, function (err) { });
                        }

                        callback(null);
                    }
                    else {

                        callback(err);
                    }
                });
            }
        }
        else {

            callback(err);
        }
    });
};


// Replace pid with actual user

exports.replacePid = function (project, pid, userId, callback) {

    // Move any assignments to pid account (not details) and save tasks

    var taskCriteria = { project: project._id, participants: 'pid:' + pid };
    var taskChange = { $set: { 'participants.$': userId} };
    Db.updateCriteria('task', null, taskCriteria, taskChange, function (err) {

        if (err === null) {

            // Check if user already a member

            if (exports.isMember(project, userId)) {

                // Remove Pid without adding

                Db.update('project', project._id, { $pull: { participants: { pid: pid}} }, function (err) {

                    if (err === null) {

                        callback(null);
                    }
                    else {

                        callback(err);
                    }
                });
            }
            else {

                // Replace pid with user

                Db.updateCriteria('project', project._id, { 'participants.pid': pid }, { $set: { 'participants.$': { id: userId}} }, function (err) {

                    if (err === null) {

                        callback(null);
                    }
                    else {

                        callback(err);
                    }
                });
            }
        }
        else {

            callback(err);
        }
    });
};


// Unsorted list

exports.unsortedList = function (userId, callback) {

    Db.query('project', { 'participants.id': request.userId }, function (projects, err) {

        if (err === null) {

            if (projects.length > 0) {

                var owner = [];
                var notOwner = [];

                for (var i = 0, il = projects.length; i < il; ++i) {

                    for (var p = 0, pl = projects[i].participants.length; p < pl; ++p) {

                        if (projects[i].participants[p].id &&
                            projects[i].participants[p].id === request.userId) {

                            projects[i]._isPending = projects[i].participants[p].isPending || false;

                            if (i == 0) {

                                projects[i]._isOwner = true;
                                owner.push(projects[i]);
                            }
                            else {

                                projects[i]._isOwner = false;
                                notOwner.push(projects[i]);
                            }

                            break;
                        }
                    }
                }

                callback(projects, owner, notOwner, null);
            }
            else {

                callback([], [], [], null);
            }
        }
        else {

            callback(null, null, null, err);
        }
    });
};


/* now that facebook isn't passing request_ids query parameter to us, we have to find them on our own
exports.unsortedFacebookRequestList = function (facebookId, callback) {
    Db.query('project', { 'participants.facebookId': facebookId }, function (projects, err) {
        if (err === null) {
            if (projects.length > 0) {
                callback(projects, null);
            } else {
                callback([], null);
            }
        } else {
            callback(null, err);
        }
    });
};
*/

// now that facebook isn't passing request_ids query parameter to us, we have to find them on our own
/* todo: obsolete this */
exports.fbr = function (request, reply) {
	
    Db.query('project', { 'participants.facebookId': request.query.fbid }, function (projects, err) {

		if( err === null && projects ) {
			
			internals.fbr( projects, request.userId, request.query.fbid, reply, request.server.settings.host ) ;

        } else {

            reply && reply(err);

        }

    });

};

internals.fbr = function (projects, userId, facebookId, reply, hostname) {

            if (projects && projects.length > 0) {

                // var owner = [];
                // var notOwner = [];

				// find and process all the share requests
				// this is all so we can reply to the last share request (instead of the first) which is probably most recent, prob a better way
				var waitToReply = true ;
				var numRequests = 0 ;
				var badShares = 0 ;
				var oneReplyCalls = 0 ;
				function oneReply( status, error ) {
					// oneReply = null ;.
					// if( !replied ) { reply( status, error ) ; replied = true ; }
					// theOneReply = status ;	// ignore error - it's in status
					if( !waitToReply && ++oneReplyCalls >= numRequests ) {	// pre-inc expr for comp
						reply( status, error ) ;
					}
				}
	
                for (var i = 0, il = projects.length; i < il; ++i) {

					var project = projects[i] ;
					
                    for (var p = 0, pl = project.participants.length; p < pl; ++p) {

						var participant = project.participants[p] ;
                        if( (participant.facebookId &&
                            participant.facebookId === facebookId &&
							( !hostname || !participant.domain || participant.domain === hostname ) )
							|| participant.facebookId === 'public' ) {

							if( participant.shareType === 'copy' ) {
								numRequests++ ;
								internals.copy( project._id, userId, facebookId, oneReply ) ;
							} else if( participant.shareType === 'link' ) {
								numRequests++ ;
								internals.link( project._id, userId, facebookId, oneReply ) ;
							} else {
								badShares++ ;
								console.log( 'Project::internals.processFacebookRequests: unkown shareType ' + participant.shareType ) ;
							}
							

                        }
                    }
                }

				// just in case a callback happens before we finish iterating through the copy/link share requests
				waitToReply = false ;
				
				// this is returning ok before the copy/link shares have finished, successfully or not.
                // might not yet have correct copy id:
				// reply && reply({ status: 'ok', id: projects[0]._id }, null);	// todo: choose based on time?
				if( numRequests > 0 ) {
					;
				} else if( badShares > 0 ) {
					reply(Hapi.Error.badRequest('Project::internals.fbr: unkown shareType '));
				} else {
					reply(Hapi.Error.badRequest('Project::internals.fbr: no facebookId matches in shares '));
				}
            }
            else {

            	reply && reply(Hapi.Error.notFound());
            }

};


// Delete an empty project (verified by caller)

exports.delEmpty = function (projectId, callback) {

    // Delete all tasks

    Task.delProject(projectId, function (err) {

        if (err === null) {

            // Delete project

            Db.remove('project', project._id, function (err) {

                callback(err);
            });
        }
        else {

            callback(err);
        }
    });
};


// put in sample lists here

internals.checkAndLoadSamples = function( request, projects, reply ) {
	
	var samples = [
		{ title: 'Sample List', id: '505a4bf0172ffeb95e000142' },
		{ title: 'Tips and Hints (swipe right to open)', id: '505a4c99172ffeb95e000148' },
		// extra one made before I understood they won't render per client code: { title: 'Tips and Hints (swipe right to open)', id: '505a689e7ad4d1764900000f' },
		// { title: 'Tips and Hints (desktop web)', id: '505a4c99172ffeb95e000148' },
		// { title: 'Hi!', id: '5052c4adc7f6862ed50000cc' }
	] ;
	var sampleProjectArray = [] ;

// console.log( 'checkAndLoadSamples: looking at ' + samples.length + ' samples ' ) ;
	for( var s = 0, sl = samples.length; s < sl; ++s ) {

		var found = 0 ;
		
// console.log( 'checkAndLoadSamples: looking for ' + projects.length + ' projects for ' + samples[ s ].title ) ;
		for( var p = 0, pl = projects.length; p < pl && found <= 0; ++p ) {

// console.log( 'checkAndLoadSamples: comparing ' + projects[ p ].title + ' project to sample ' + samples[ s ].title ) ;
			if( projects[ p ].title == samples[ s ].title ) {
			
				found++ ;
				
			}
// console.log( 'checkAndLoadSamples: compared ' + found ) ;
			
		}
		
// console.log( 'checkAndLoadSamples: status of sample ' + samples[ s ].title + ' ' + found ) ;
		if( found <= 0
				&& ( projects.length <= 0 || samples[ s ].title !== 'Sample List' ) ) {	// don't add a sample list if there's already lists
			// internals.copy( samples[ s ].id, request.userId, request.query.fbid,  ) ;
			sampleProjectArray.push( samples[ s ].id ) ;			
		}
		
	}

// console.log( 'checkAndLoadSamples: calling Db.getMany w ' + sampleProjectArray.length ) ;
    Db.getMany('project', sampleProjectArray, function (sampleProjects, err, notFound) {
	
		function checkAndLoadSamplesReply( result ) {
// console.log( 'checkAndLoadSamples: checkAndLoadSamplesReply ' + ( result && result.status ) ) ;
			if( result && result.status === 'ok' /*&& result.id*/ ) {
				reply( sampleProjects ) ;
			} else {
				reply( null ) ;
			}
		}

		if (err === null && sampleProjects.length === sampleProjectArray.length) {
			
// console.log( 'checkAndLoadSamples: calling internals.fbr w ' + sampleProjects.length ) ;
			internals.fbr( sampleProjects, request.userId, request.query.fbid, checkAndLoadSamplesReply ) ;

        } else {

			console.log( 'checkAndLoadSamples: getMany failed ' + err ) ;
			reply( null ) ;
			
        }

    });
		
}

