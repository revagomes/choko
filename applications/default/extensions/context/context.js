var async = require('async');
var expressUtils = require('express/lib/utils');
var contextMiddleware = require('./lib/contextMiddleware');

var context = module.exports;

/**
 * The init() hook.
 */
context.init = function(application, callback) {
  // Load all contexts.
  var Context = this.application.type('context');
  Context.list({}, function(err, contexts) {
    application.application.use(contextMiddleware(application));
    callback();
  });
};

/**
 * The permission() hook.
 */
context.permission = function(permissions, callback) {
  var newPermissions = {};

  newPermissions['manage-contexts'] = {
    title: 'Manage contexts',
    description: 'List, create and edit contexts.'
  };

  callback(null, newPermissions);
};

/**
 * The type() hook.
 */
context.type = function(types, callback) {
  var newTypes = {};

  newTypes['context'] = {
    title: 'Context',
    description: 'Contexts are sets of conditions that result in reactions.',
    fields: {
      name: {
        title: 'Name',
        type: 'text',
      },
      title: {
        title: 'Title',
        type: 'text',
      },
      conditions: {
        title: 'Conditions',
        type: 'reference',
        reference: {
          type: 'contextCondition',
          multiple: true,
          inline: true,
          object: true,
          titleField: 'type'
        }
      },
      reactions: {
        title: 'Reactions',
        type: 'reference',
        reference: {
          type: 'contextReaction',
          multiple: true,
          inline: true,
          titleField: 'type'
        }
      }
    },
    access: {
      'list': 'manage-contexts',
      'load': 'manage-contexts',
      'add': 'manage-contexts',
      'edit': 'manage-contexts',
      'delete': 'manage-contexts'
    },
    methods: {
      execute: function(request, response, callback) {
        var self = this;

        // Call callback bellow on the first conditionType that pass.
        // @todo: Eventually we may want to add an operator and also allow OR
        // and ANDs.
        this.conditions = this.conditions || {};
        async.detect(Object.keys(this.conditions), function(conditionTypeName, next) {
          self.application.load('contextConditionType', conditionTypeName, function(err, conditionType) {
            conditionType.check(request, self.conditions[conditionTypeName], function(match) {
              next(match);
            });
          });
        }, function(result) {
          if (!result) {
            return callback(false);
          }
          self.reactions = self.reactions || {};
          async.each(Object.keys(self.reactions), function(reactionTypeName, next) {
            self.application.load('contextReactionType', reactionTypeName, function(err, reactionType) {
              reactionType.react(request, response, self.reactions[reactionTypeName], function(err) {
                next(err);
              });
            });
          }, function() {
            callback(true);
          });
        });
      }
    }
  };

  newTypes['contextCondition'] = {
    title: 'Context condition',
    formTitle: 'Condition',
    description: 'Conditions that form contexts.',
    standalone: false,
    polymorphic: true,
    access: {
      'list': 'manage-contexts',
      'load': 'manage-contexts',
      'add': 'manage-contexts',
      'edit': 'manage-contexts',
      'delete': 'manage-contexts'
    }
  };

  newTypes['contextReaction'] = {
    title: 'Context reaction',
    formTitle: 'Reaction',
    description: 'Reactions a context can result on.',
    standalone: false,
    polymorphic: true,
    access: {
      'list': 'manage-contexts',
      'load': 'manage-contexts',
      'add': 'manage-contexts',
      'edit': 'manage-contexts',
      'delete': 'manage-contexts'
    }
  };

  callback(null, newTypes);
};

/**
 * The context() hook.
 */
context.context = function(contexts, callback) {
  var newContexts = {};

  newContexts['global'] = {
    title: 'Global',
    description: 'Application wide context.',
    weight: -10,
    conditions: {
      siteWide: true
    },
    reactions: {
      theme: 'default',
      layout: 'one-column',
      panel: {
        'navbar-header': [{
          name: 'brand',
          weight: 0
        }],
        'navbar-left': [{
          name: 'navigation-main',
          weight: 0
        }],
        'footer': [{
          name: 'powered-by',
          weight: 0
        }]
      }
    }
  };

  callback(null, newContexts);
};

/**
 * The contextConditionType() hook.
 */
context.contextConditionType = function(conditionTypes, callback) {
  var newConditionTypes = {};

  newConditionTypes['siteWide'] = {
    title: 'Site wide',
    standalone: false,
    check: function(request, value, callback) {
      callback(true);
    }
  };

  newConditionTypes['path'] = {
    title: 'Path',
    standalone: false,
    fields: {
      operator: {
        title: 'Operator',
        type: 'text'
      },
      value: {
        title: 'Value',
        type: 'text'
      }
    },
    check: function(request, urls, callback) {
      // Use express regex to match URL.
      var regex = expressUtils.pathRegexp(urls);
      async.detect(urls, function(url, next) {
        next(regex.exec(request.url));
      }, function(result) {
        callback(result !== undefined);
      });
    }
  };

  callback(null, newConditionTypes);
};

/**
 * The contextReactionType() hook.
 */
context.contextReactionType = function(reactionTypes, callback) {
  var newReactionTypes = {};

  newReactionTypes['addCSS'] = {
    title: 'Add CSS',
    description: 'Add a CSS file.',
    standalone: false,
    fields: {
      styles: {
        title: 'Styles',
        description: 'Styles to add.',
        type: 'text'
      }
    },
    react: function(request, response, styles, callback) {
      response.payload.styles = response.payload.styles ? response.payload.styles.merge(styles) : styles;
      callback();
    }
  };

  newReactionTypes['addJS'] = {
    title: 'Add JavaScript',
    description: 'Add a JavaScript file.',
    standalone: false,
    fields: {
      scripts: {
        title: 'Scripts',
        description: 'Scripts to add.',
        type: 'text'
      }
    },
    react: function(request, response, scripts, callback) {
      response.payload.scripts = response.payload.scripts ? response.payload.scripts.merge(scripts) : scripts;
      callback();
    }
  };

  callback(null, newReactionTypes);
};
