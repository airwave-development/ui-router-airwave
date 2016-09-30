/*global module:false*/
module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);
  var files = require('./files').files;

  // Project configuration.
  grunt.initConfig({
    builddir: 'build',
    pkg: grunt.file.readJSON('package.json'),
    buildtag: '-dev-' + grunt.template.today('yyyy-mm-dd'),
    meta: {
      banner: '/**\n' +
        ' * <%= pkg.description %>\n' +
        ' * @version v<%= pkg.version %><%= buildtag %>\n' +
        ' * @link <%= pkg.homepage %>\n' +
        ' * @license MIT License, http://www.opensource.org/licenses/MIT\n' +
        ' */'
    },
    clean: ['<%= builddir %>'],
    concat: {
      options: {
        banner: '<%= meta.banner %>\n\n' +
          '/* commonjs package manager support (eg componentjs) */\n' +
          'if (typeof module !== "undefined" && typeof exports !== "undefined" && module.exports === exports){\n' +
          '  module.exports = \'ui.router\';\n' +
          '}\n\n' +
          '(function (window, angular, undefined) {\n',
        footer: '})(window, window.angular);'
      },
      build: {
        src: files.src,
        dest: '<%= builddir %>/<%= pkg.name %>.js'
      }
    },
    uglify: {
      options: {
        banner: '<%= meta.banner %>\n'
      },
      build: {
        files: {
          '<%= builddir %>/<%= pkg.name %>.min.js': ['<banner:meta.banner>', '<%= concat.build.dest %>']
        }
      }
    },
    release: {
      files: ['<%= pkg.name %>.js', '<%= pkg.name %>.min.js'],
      src: '<%= builddir %>',
      dest: 'release'
    },
    jshint: {
      all: ['Gruntfile.js', 'src/*.js', '<%= builddir %>/<%= pkg.name %>.js'],
      options: {
        eqnull: true
      }
    },
    watch: {
      files: ['src/*.js', 'test/**/*.js'],
      tasks: ['build', 'karma:background:run']
    },
    connect: {
      server: {},
      sample: {
        options: {
          port: 5555,
          keepalive: true
        }
      }
    },
    karma: {
      options: {
        configFile: 'config/karma-1.4.9.js',
        singleRun: true,
        exclude: [],
        frameworks: ['jasmine'],
        reporters: 'dots', // 'dots' || 'progress'
        port: 8080,
        colors: true,
        autoWatch: false,
        autoWatchInterval: 0,
        browsers: [grunt.option('browser') || 'PhantomJS']
      },
      unit: {
        browsers: [grunt.option('browser') || 'PhantomJS']
      },
      debug: {
        singleRun: false,
        background: false,
        browsers: [grunt.option('browser') || 'Chrome']
      },
      ng108: {
        configFile: 'config/karma-1.0.8.js'
      },
      ng115: {
        configFile: 'config/karma-1.1.5.js'
      },
      ng1214: {
        configFile: 'config/karma-1.2.14.js'
      },
      ng130: {
        configFile: 'config/karma-1.3.0.js'
      },
      ng149: {
        configFile: 'config/karma-1.4.9.js'
      },
      ng150: {
        configFile: 'config/karma-1.5.0.js'
      },
      background: {
        background: true,
        browsers: [grunt.option('browser') || 'PhantomJS']
      },
      watch: {
        singleRun: false,
        autoWatch: true,
        autoWatchInterval: 1
      }
    },
    changelog: {
      options: {
        dest: 'CHANGELOG.md'
      }
    },
    ngdocs: {
      options: {
        dest: 'site',
        styles: ['ngdoc_assets/uirouter-docs.css'],
        html5Mode: false,
        title: 'UI Router',
        startPage: '/api/ui.router',
        navTemplate: 'ngdoc_assets/docnav.html'
      },
      api: {
        src: ['src/**/*.js'],
        title: 'API Reference'
      }
    }
  });

  grunt.registerTask('integrate', ['build', 'jshint', 'karma:ng108', 'karma:ng115', 'karma:ng1214', 'karma:ng130', 'karma:ng149', 'karma:ng150']);
  grunt.registerTask('default', ['build', 'jshint', 'karma:unit']);
  grunt.registerTask('build', 'Perform a normal build', ['concat', 'uglify']);
  grunt.registerTask('dist', 'Perform a clean build', ['clean', 'build']);
  grunt.registerTask('dist-docs', 'Perform a clean build and generate documentation', ['dist', 'ngdocs', 'widedocs']);
  grunt.registerTask('release', 'Tag and perform a release', ['prepare-release', 'dist', 'perform-release']);
  grunt.registerTask('dev', 'Run dev server and watch for changes', ['build', 'connect:server', 'karma:background', 'watch']);
  grunt.registerTask('sample', 'Run connect server with keepalive:true for sample app development', ['connect:sample']);

  grunt.registerTask('widedocs', 'Convert to bootstrap container-fluid', function() {
    promising(this,
      system(
        'sed -i.bak ' +
        '-e \'s/class="row"/class="row-fluid"/\' ' +
        '-e \'s/icon-cog"><\\/i>/icon-cog"><\\/i>Provider/\' ' +
        '-e \'s/role="main" class="container"/role="main" class="container-fluid"/\' site/index.html')
    );
  });


  grunt.registerTask('publish-pages', 'Publish a clean build, docs, and sample to github.io', function() {
    promising(this,
      ensureCleanMaster().then(function() {
        shjs.rm('-rf', 'build');
        return system('git checkout gh-pages');
      }).then(function() {
        return system('git merge master');
      }).then(function() {
        return system('grunt dist-docs');
      }).then(function() {
        return system('git commit -a -m \'Automatic gh-pages build\'');
      }).then(function() {
        return system('git checkout master');
      })
    );
  });

  grunt.registerTask('push-pages', 'Push published pages', function() {
    promising(this,
      ensureCleanMaster().then(function() {
        shjs.rm('-rf', 'build');
        return system('git checkout gh-pages');
      }).then(function() {
        return system('git push origin gh-pages');
      }).then(function() {
        return system('git checkout master');
      })
    );
  });

  grunt.registerTask('prepare-release', function() {
    var bower = grunt.file.readJSON('bower.json'),
      component = grunt.file.readJSON('component.json'),
      version = bower.version;
    if (version != grunt.config('pkg.version')) throw new Error('Version mismatch in bower.json');
    if (version != component.version) throw new Error('Version mismatch in component.json');

    promising(this,
      ensureCleanMaster().then(function() {
        return exec('git tag -l ' + version + '');
      }).then(function(result) {
        if (result.stdout.trim() !== '') throw new Error('Tag \'' + version + '\' already exists');
        grunt.config('buildtag', '');
        grunt.config('builddir', 'release');
      })
    );
  });

  grunt.registerTask('perform-release', function() {
    grunt.task.requires(['prepare-release', 'dist']);

    var version = grunt.config('pkg.version'),
      releasedir = grunt.config('builddir');

      promising(this,
        system('git add *').then(function () {
          return system('git commit -m \'release ' + version + '\'');
        }).then(function () {
          return system('git tag ' + version + '');
        })
      );
  });


  // Helpers for custom tasks, mainly around promises / exec
  var exec = require('faithful-exec'),
    shjs = require('shelljs');

  function system(cmd) {
    grunt.log.write('% ' + cmd + '\n');
    return exec(cmd).then(function(result) {
      grunt.log.write(result.stderr + result.stdout);
    }, function(error) {
      grunt.log.write(error.stderr + '\n');
      throw new Error('Failed to run \'' + cmd + '\'');
    });
  }

  function promising(task, promise) {
    var done = task.async();
    promise.then(function() {
      done();
    }, function(error) {
      grunt.log.write(error + '\n');
      done(false);
    });
  }

  function ensureCleanMaster() {
    return exec('git symbolic-ref HEAD').then(function(result) {
      if (result.stdout.trim() !== 'refs/heads/master') throw new Error('Not on legacy branch, aborting');
      return exec('git status --porcelain');
    }).then(function(result) {
      if (result.stdout.trim() !== '') throw new Error('Working copy is dirty, aborting');
    });
  }
};
