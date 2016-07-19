'use strict';

var helpers = {};

helpers.buildMetaTag = function(tag) {
  var name = tag.name ? 'name="' + tag.name + '" ' : '',
    property = tag.property ? 'property="' + tag.property + '" ' : '',
    content = tag.content ? 'content="' + tag.content.replace(/\n/g, ' ') + '" ' : '';

  return '<meta ' + name + property + content + '/>';
};

helpers.buildLinkTag = function(tag) {
  var link = tag.link ? 'link="' + tag.link + '" ' : '',
    rel = tag.rel ? 'rel="' + tag.rel + '" ' : '',
    type = tag.type ? 'type="' + tag.type + '" ' : '',
    href = tag.href ? 'href="' + tag.href + '" ' : '';

  return '<link ' + link + rel + type + href + '/>';
};

module.exports = helpers;