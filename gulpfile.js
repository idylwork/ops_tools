var gulp = require('gulp');
var browserSync = require('browser-sync').create();

gulp.task('browser-sync', () => {
  browserSync.init({
    server: {
      baseDir: "./",
      index: "c_start.html",
      reloadDelay: 600
    }
  });
});

gulp.task('reload', () => {
  browserSync.reload();
});

/** gulp dest 共有ファイルをdistフォルダへの書き出し */
gulp.task('dest', () => {
  gulp.src([
    '**',
    '!gulpfile.js',
    '!package.json',
    '!package-lock.json',
    '!node_modules',
    '!node_modules/**',
    '!dist',
    '!dist/**',
    '!scss',
    '!scss/**',
  ])
　.pipe(gulp.dest('dist/'));
});

/** SCSSのコンパイル */
var sass = require('gulp-sass');
gulp.task('sass', function(){
  gulp.src('./scss/**/*.scss')
    .pipe(sass({outputStyle: 'compressed'}))
    .pipe(gulp.dest('./css/'));
});
gulp.task('watch-sass', ['sass'], function(){
  var watcher = gulp.watch('./scss/**/*.scss', ['sass']);
  watcher.on('change', function(event) {
  });
});

/** gulp, gulp browser-sync オートリロード */
gulp.task('default', ['browser-sync'], () => {
  gulp.watch("scss/*.scss", ['sass']);
  gulp.watch("*.html", ['reload']);
  gulp.watch("css/*.css", ['reload']);
  gulp.watch("js/*.js", ['reload']);
  gulp.watch("project/*.txt", ['reload']);
});

/** gulp ejs テンプレートの更新 */
gulp.task("ejs", function() {
  gulp.src(
    ["app/dev/ejs/**/*.ejs",'!' + "app/dev/ejs/**/_*.ejs"] //注1
  )
  .pipe(ejs())
  .pipe(gulp.dest("app/public"))
});
