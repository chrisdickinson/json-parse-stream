var test = require('tape')
  , parses = require('./index')

test('test bad numbers', function(assert) {
  // also errors: 2e+3.2, 2e3E3, but we 
  // emit the "good data" portion of them.
  var bad = ['01', '--1', '1.2.3', '2e3+2', '10.e12', '10e']
    , ecount = 0
    , parse
  for(var i = 0, len = bad.length; i < len; ++i) {
    (function(item) {
      parse = parses()
      parse
        .on('data', function(d) { assert.fail('should never be okay but got '+d.value+' for '+item) })
        .on('error', function() { ++ecount })
      parse.write(item)
      parse.end()
    })(bad[i])
  }

  assert.equal(ecount, bad.length)
  assert.end()
})

test('test good numbers', function(assert) {
  var good = ['0', '0.1', '0.1e1', '0.2e+2', '0.2e-2', '2E20', '2E-2', '2E+2'
             ,'10', '12345', '67890', '123455.123445']
    , ecount = 0
    , parse

  for(var i = 0, len = good.length; i < len; ++i) {
    (function(item) {
      parse = parses()
      parse
        .on('error', function(d) { assert.fail('should never be bad but got '+d+' for '+item) })
        .on('data', function(d) { assert.equal(d.value, JSON.parse(item), item+' should equal JSON.parse(item)') })
      parse.write(item)
      parse.end()
    })(good[i])
  }

  assert.end() 
})

test('test booleans and null', function(assert) {
  parses().on('data', check(true)).write('true')
  parses().on('data', check(false)).write('false')
  parses().on('data', check(null)).write('null')

  assert.end()

  function check(shouldbe) {
    return function(data) {
      assert.equal(data.value, shouldbe, data.value+' should be '+shouldbe)
    }
  }
})

test('test top level arrays', function(assert) {
  parses().on('data', check).write('[]')
  assert.end()

  function check(data) {
    assert.deepEqual(data.value, [])
  }
})

test('test top level objects', function(assert) {
  parses().on('data', check).write('{}')
  assert.end()

  function check(data) {
    assert.deepEqual(data.value, {})
  }
})

test('in-depth', function(assert) {
  var p = parses()
    , expected = [
      {key: 'hey', value: 'guys'}
    , {key: 0, value: 'are'}
    , {key: 1, value: 'okay'}
    , {key: 'things', value: ['are', 'okay']}
    , {value: {hey: 'guys', things: ['are', 'okay']}} 
    ]
  p.on('data', check)

  p.write('{')
  p.write('"hey"')
  p.write(':')
  p.write('"guys"')
  p.write(', "things": ["are", "okay"]')
  p.write('}')
  p.end()

  assert.end()

  function check(data) {
    var next = expected.shift()
    assert.equal(data.key, next.key)
    assert.deepEqual(data.value, next.value) 
  }
})

test('test bad strings', function(assert) {
  var bad = ['"unterminated', '"not enough unicode \\u00 asdf"'
            , '"bad \\escape"', '"bad \n control char"']
    , ecount = 0
    , parse
  for(var i = 0, len = bad.length; i < len; ++i) {
    (function(item) {
      parse = parses()
      parse
        .on('data', function(d) { assert.fail('should never be okay but got '+d.value+' for '+item) })
        .on('error', function(e) { ++ecount; console.log('# '+e) })
      parse.write(item)
      parse.end()
    })(bad[i])
  }

  assert.equal(ecount, bad.length)
  assert.end()
})

test('unicode character in string', function(assert) {
  var p = parses()
    , expected = [ {key: '\u0002hey', value: 'guys\u0003'}
                  ,{value: {'\u0002hey': 'guys\u0003'}} 
                  ]
    
  p.on('data', check)

  p.write('{')
  p.write('"\\u0002hey"')
  p.write(':')
  p.write('"guys\\u0003"')
  p.write('}')
  p.end()

  assert.end()

  function check(data) {
    var next = expected.shift()
    assert.equal(data.key, next.key)
    assert.equal(data.value, next.value) 
  }
})
