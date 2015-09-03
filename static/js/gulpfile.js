var gulp = require('gulp');
var jshint = require('gulp-jshint');
var concat = require('gulp-concat');
var watch = require('gulp-watch');
 
gulp.task('default', ['jshint', 'concat']);

var js;
gulp.task('concat', function (cb) {
    var options = {};
    watch('controllers/*.js', options, function (e) {
        // console.log('e:'+JSON.stringify(e));
        // console.log('\n');
        console.log(new Date() + ' -- ' + e.history[0].replace(e.base, ''));
        //js = e.history[0].replace(e.base, '');
        gulp.src(['controllers/start.js','controllers/!(start)*.js',])
        .pipe(concat('app.js', {newLine: '\n'}))
        .pipe(gulp.dest('./'));
    });
});

// Lint JavaScript
gulp.task('jshint', function () {
  return gulp.src([
      'controllers/*.js'
    ])
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

[
  '/src/**/!(foobar)*.js', // all files that end in .js EXCEPT foobar*.js
  '/src/js/foobar.js',
]