var nconf = require('nconf'),
	validator = require('validator');

module.exports = function(Meta) {
	Meta.tags = {};

	Meta.tags.parse = function(meta, link, callback) {
	  var metaTags = [{
          name: 'viewport',
          content: 'width=device-width, initial-scale=1.0, user-scalable=no'
        }, {
          name: 'content-type',
          content: 'text/html; charset=UTF-8'
        }, {
          name: 'apple-mobile-web-app-capable',
          content: 'yes'
        }, {
          property: 'og:site_name',
          content: Meta.config.title || 'NodeBB'
        }, {
          name: 'keywords',
          content: Meta.config.keywords || ''
        }, {
          name: 'msapplication-badge',
          content: 'frequency=30; polling-uri=' + nconf.get('url') + '/sitemap.xml'
        }, {
          name: 'msapplication-square150x150logo',
          content: Meta.config['brand:logo'] || ''
        }];
        
    var linkTags = [{
          rel: "icon",
          type: "image/x-icon",
          href: nconf.get('relative_path') + '/favicon.ico'
        }, {
          rel: 'apple-touch-icon',
          href: nconf.get('relative_path') + '/apple-touch-icon'
        }];
    
		meta = metaTags.concat(meta || []).map(function(tag) {
      if(!tag || typeof tag.content !== 'string') {
        winston.warn('Invalid meta tag. ', tag);
        return tag;
      }

      tag.content = validator.escape(tag.content);
      return tag;
    });

    link = linkTags.concat(link || []);

    callback(null, {
      meta: meta,
      link: link
    });
	};
};