var fs = require('fs')
  , parse = require('./index')

fs.createReadStream('package.json')
  .pipe(parse())
  .on('data', function(element) {
    console.log(element)
  })


