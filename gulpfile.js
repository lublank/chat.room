/*
 | Gulpfile.js
 |  自动化打包脚本
 |  需要nodejs环境和npm包管理程序（nodejs comes with npm installed）
 |  安装前往：https://docs.npmjs.com/getting-started/installing-node
 |
 |  该脚本主要的打包工作有：
 |     1) 将public/vendor目录下指定vendorLibs中的文件以及公共js一并打包成
 |         public/js/all.js文件；
 |
 |     2) 将resources/assets/js目录下的非子级目录下的js文件分别
 |         打包成入口文件；
 |
 |     3) 将app.less打包成public/css/app.css，并上插件css，打包成all.css；
 |
 |     4) 将public/dist/js目录下的所有js文件，以及public/dist/css目录下的所有
 |         css文件加入版本控制（version），在public/build目录下生成
 |         带hash值的文件；html的引用路径不变，均由
 |         helpers.elixir.resolve来对应；
 */
var elixir = require('laravel-elixir');
var walkSync = require('walk-sync');

/*
 |--------------------------------------------------------------------------
 | Elixir Asset Management
 |--------------------------------------------------------------------------
 |
 | Elixir provides a clean, fluent API for defining some basic Gulp tasks
 | for your Laravel application. By default, we are compiling the Sass
 | file for our application, as well as publishing vendor resources.
 |
 */
// Compile Without Source Maps
// http://laravel.com/docs/5.2/elixir
elixir.config.sourcemaps = false;

elixir(function(mix) {
  //By default, the task will place the compiled CSS for this example in public/css/app.css
  //mix.sass('app.scss');

  //compile the page less
  //By default, less files are stored in resources/assets/less
  mix.less('app.less', 'public/dist/css/app.css');

  //all css
  mix.styles([
    'vendor/bootstrap/dist/css/bootstrap.css',
    'public/vendor/jQuery-contextMenu/dist/jquery.contextMenu.min.css',
    'dist/css/app.css'
  ], 'public/dist/css/all.css', 'public');

  //plugin js
  mix.scripts([
    'public/vendor/jquery/dist/jquery.js',
    'public/vendor/bootstrap/dist/js/bootstrap.js',
    'public/vendor/socket.io-client/socket.io.js',
    'public/vendor/jQuery-contextMenu/dist/jquery.contextMenu.js'
  ], 'public/dist/js/all.js', './');

  var scripts = walkSync('resources/assets/js', {globs: ['*.js'], directories: false});

  scripts.forEach(function (script) {
    mix.scripts(script, 'public/dist/js', 'resources/assets/js');
  });
  //copy the fonts
  //mix.copy('public/vendor/bootstrap/fonts', 'public/fonts');

  mix.version(['dist/css/*.css', 'dist/js/*.js']);//add the version
});
