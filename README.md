# json-parse-stream

emits elements of a json document as they're available.
similar to [JSONStream](http://npm.im/JSONStream), but emits
everything instead of a specified path.

```javascript
var fs = require('fs')
  , parse = require('json-parse-stream')

fs.createReadStream('package.json')
  .pipe(parse())
  .on('data', function(element) {
    console.log(element)
  })

/* truncated output:
...

{ type: 'string'
, value: 'json-parse-stream'
, key: 'name'
, parent: [parent object] }

...
*/

``` 

## events

`parse()` instances are readable/writable streams.

their `data` events take the following form:

```javascript

{ type: ['object', 'array', 'string', 'number', 'null', 'boolean']
, value: <the value represented at this node>
, key: "the key from the parent to this element" | undefined (for root objects)
, parent: <the parent node> }

```

you will get events for elements in order of most specific to least specific.

#### why not just use JSONParse?

> JSONParse is awesome, but the requirement of providing a path
> function precludes you from asking for multiple paths at once.
>
> As a bonus, the output of `json-parse-stream` will make it easy
> to write a wrapper for [CSSauron](http://npm.im/cssauron/) for
> querying. 


## license

MIT
