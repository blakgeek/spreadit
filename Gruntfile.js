module.exports = function(grunt) {

    require('load-grunt-tasks')(grunt);

    // Project configuration.
    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),
        concurrent: {
            example: {
                tasks: ['serve', 'watch:dev', 'open:example'],
                options: {
                    logConcurrentOutput: true
                }
            }
        },
        open: {
            example: {
                url: 'http://localhost:9099/example/index.html'
            }
        },
        copy: {
            dist: {
                expand: true,
                cwd: 'src',
                dest: 'dist',
                src: ['images/**/*']
            },
            dev: {
                expand: true,
                cwd: 'src',
                dest: 'dev',
                src: ['images/**/*']
            }
        },
        ngtemplates: {
            all: {
                options: {
                    module: 'bg.spreadit',
                    prefix: '/',
                    htmlmin: {
                        collapseWhitespace: true,
                        keepClosingSlash: true
                    }
                },
                cwd: 'src',
                src: '**/*.html',
                dest: '.tmp/spreadit.templates.js'
            }
        },
        clean: {
            dist: ['.tmp', 'dist'],
            dev: ['.tmp', 'dev']
        },
        concat: {
            dist: {
                src: ['src/module.js', 'src/**/*.js', '.tmp/**/*.js'],
                dest: 'dist/spreadit.js'
            },
            dev: {
                src: ['src/module.js', 'src/**/*.js', '.tmp/**/*.js'],
                dest: 'dev/spreadit.js'
            }
        },
        uglify: {
            dist: {
                files: {
                    'dist/spreadit.min.js': ['dist/spreadit.js']
                }
            }
        },
        sass: {
            options: {
                style: 'compressed',
                sourcemap: 'none'
            },
            dist: {
                expand: true,
                cwd: 'src/sass',
                src: ['**/*.scss'],
                dest: 'dist',
                ext: '.css'
            },
            dev: {
                expand: true,
                cwd: 'src/sass',
                src: ['**/*.scss'],
                dest: 'dev',
                ext: '.css'
            }
        },
        watch: {
            dev: {
                files: ['src/**/*', 'example/**/*'],
                tasks: 'dev',
                options: {
                    livereload: true
                }
            }
        },
        serve: {
            options: {
                port: 9099
            }
        }
    });

    grunt.registerTask('build', [
        'clean:dist',
        'copy:dist',
        'ngtemplates',
        'concat:dist',
        'uglify',
        'sass:dist'
    ]);

    grunt.registerTask('dev', [
        'clean:dev',
        'copy:dev',
        'ngtemplates',
        'concat:dev',
        'sass:dev'
    ]);

    grunt.registerTask('example', [
        'clean:dev',
        'copy:dev',
        'ngtemplates',
        'concat:dev',
        'sass:dev',
        'concurrent:example'
    ]);


};



