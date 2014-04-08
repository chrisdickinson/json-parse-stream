var through = require('through')
  , duplex = require('duplex')
  , emit = require('emit-function')

module.exports = full

function full() {
  var stream = duplex()
    , tokens = tokenize()
    , parses = parse()

  stream.on('pipe', emit(tokens, 'pipe'))

  stream
    .on('_data',  tokens.write)
    .on('_end',   tokens.end)

  parses
    .on('data',   stream._data)
    .on('end',    stream._end)
    .on('error',  emit(stream, 'error'))

  tokens
    .on('error',  emit(stream, 'error'))
    .on('drain',  emit(stream, 'drain'))

  tokens.pipe(parses)

  return stream
}

var _ = 0 
  , VALUE = _++
  , VALUE_OBJECT = _++
  , VALUE_OBJECT_KEY = _++
  , VALUE_OBJECT_VALUE = _++
  , VALUE_ARRAY = _++
  , VALUE_ARRAY_VALUE = _++

var _ = 0
  , TOKEN_BASE = _++
  , TOKEN_NUMBER = _++
  , TOKEN_STRING = _++
  , TOKEN_NULL = _++
  , TOKEN_TRUE = _++
  , TOKEN_FALSE = _++
  , TOKEN_OBJECT_START = _++
  , TOKEN_OBJECT_END = _++
  , TOKEN_OBJECT_COLON = _++
  , TOKEN_ARRAY_START = _++
  , TOKEN_ARRAY_END = _++
  , TOKEN_COMMA = _++

var TYPES = {}

TYPES[VALUE_OBJECT] = 'object'
TYPES[VALUE_ARRAY] = 'array'

function parse() {
  var stream = through(write, end)
    , stack = [{mode: VALUE, value: null}]
    , keys = [null]
    , tokens = []
    , token

  return stream

  function unshift(mode, initial) {
    stack.unshift({
      mode: mode
    , value: initial
    , key: keys[0]
    , parent: stack[0]
    })
  }

  function shift() {
    var out = stack.shift()
      , real

    real = {
        value: out.value
      , key: out.key
      , parent: out.parent
      , type: out.value === null ? 'null' :
              out.mode === VALUE ? typeof out.value :
              TYPES[out.mode]
    }


    keys.shift()
    stream.queue(real)
    if(!stack.length) {
      return stream.queue(null)
    }

    stack[0].value[out.key] = out.value
  }

  function write(chunk) {
    tokens[tokens.length] = chunk
    advance()
    while(token) switch(stack[0].mode) {
      case VALUE: p_value(); break
      case VALUE_OBJECT: p_object(); break
      case VALUE_OBJECT_KEY: p_object_key(); break
      case VALUE_OBJECT_VALUE: p_object_value(); break
      case VALUE_ARRAY: p_array(); break
      case VALUE_ARRAY_VALUE: p_array_value(); break
    }
  }

  function p_value() {
    if(token.type === TOKEN_ARRAY_START) {
      stack[0].value = []
      stack[0].mode = VALUE_ARRAY
      return advance()
    }

    if(token.type === TOKEN_OBJECT_START) {
      stack[0].value = {} 
      stack[0].mode = VALUE_OBJECT
      return advance()
    }

    stack[0].value = token.data
    stack[0].mode = VALUE
    shift()
    advance()
  }

  function p_object() {
    if(token.type === TOKEN_OBJECT_END) {
      shift(), advance()
      return
    }
    if(!stack[0].has_children) {
      stack[0].mode = VALUE_OBJECT_KEY
      return
    }
    if(token.type === TOKEN_COMMA) {
      advance()
      stack[0].mode = VALUE_OBJECT_KEY
      return
    }
    error('unexpected token '+token.data)
  }

  function p_object_key() {
    if(token.type !== TOKEN_STRING) {
      return error('unexpected token '+token.data)
    }
    keys.unshift(token.data)
    stack[0].mode = VALUE_OBJECT_VALUE
    advance()
  }

  function p_object_value() {
    if(token.type !== TOKEN_OBJECT_COLON) {
      return error('unexpected token '+token.data)
    }

    stack[0].mode = VALUE_OBJECT
    stack[0].has_children = true
    advance()
    unshift(VALUE, null)
  }

  function p_array() {
    if(token.type === TOKEN_ARRAY_END) {
      shift(), advance()
      return
    }
    if(!stack[0].has_children) {
      stack[0].mode = VALUE_ARRAY_VALUE
      return
    }
    if(token.type === TOKEN_COMMA) {
      advance()
      stack[0].mode = VALUE_ARRAY_VALUE
      return
    }
    error('unexpected token '+token.data)
  }

  function p_array_value() {
    stack[0].mode = VALUE_ARRAY
    stack[0].has_children = true
    keys.unshift(stack[0].value.length)
    unshift(VALUE, null)
  }

  function end() {
    if(stack.length) {
      error('unexpected eof')
    }
    stream.queue(null)
  }

  function error(message) {
    stream.emit('error', new Error(message + (!token ? '' :
      ' at line '+token.line+', col '+token.col)))
  }

  function advance() {
    token = tokens.shift()
  }
}

function tokenize() {
  var stream = through(write, end)
    , accum = []
    , mode = TOKEN_BASE
    , errored = false
    , line = 1
    , pos = 0
    , col = 0
    , current
    , modes
    , idx
    , len

  var backslash = false
    , dotted = false
    , exponent = false
    , exponent_seen_digit = false
    , zero_start = false
    , unicode_character = []
    , unicode_remaining = 0 
    , last 

  modes = [
      t_base
    , t_number
    , t_string
    , t_null
    , t_true
    , t_false
  ]

  stream.on('pipe', function(source) {
    if(source.setEncoding) {
      source.setEncoding('utf8')
    }
  })

  return stream

  function write(chunk) {
    chunk = chunk.split('')
    for(idx = 0, len = chunk.length; idx < len; ++idx, ++pos, ++col) {
      modes[mode](last = chunk[idx])
    }
  }

  function end() {
    if(accum.length) {
      modes[mode]('')
      if(accum.length) {
        last = '(eof)'
        return error()
      }
    }
    stream.queue(null)
  }

  function t_base(c) {
    switch(c) {
      case '{': return emit(TOKEN_OBJECT_START, c)
      case '}': return emit(TOKEN_OBJECT_END, c)
      case ':': return emit(TOKEN_OBJECT_COLON, c)
      case '[': return emit(TOKEN_ARRAY_START, c)
      case ']': return emit(TOKEN_ARRAY_END, c)
      case ',': return emit(TOKEN_COMMA, c)
      case '-':
      case '0': case '1': case '2': case '3': 
      case '4': case '5': case '6': case '7': 
      case '8': case '9': mode = TOKEN_NUMBER; return t_number(c)
      case '"': mode = TOKEN_STRING; return
      case 't': mode = TOKEN_TRUE; return t_true(c)
      case 'f': mode = TOKEN_FALSE; return t_false(c)
      case 'n': mode = TOKEN_NULL; return t_null(c)
      case '\n': return ++line, col = 0
    }

    if(/\s/.test(c)) {
      return
    }

    return error()
  }

  function error() {
    if(errored) {
      return
    }
    errored = true
    stream.emit(
        'error'
      , new Error('unexpected token `'+JSON.stringify(last)+'` (@'+pos+'; line '+line+', col '+col+')')
    )
  }

  function t_string(c) {
    if(unicode_remaining) {
      if(!/[a-fA-F0-9]/.test(c)) {
        return error()
      }
      unicode_character[unicode_character.length] = c
      if(unicode_remaining == 1) {
        accum[accum.length] = String.fromCharCode(parseInt(unicode_character.join(''), 16))
        unicode_character.length = 0
      } 
      --unicode_remaining
      return
    }

    if(backslash) {
      var out = {
        '"': '"'
      , '\\': '\\'
      , 'b': '\b'
      , 'f': '\f'
      , 'n': '\n'
      , 'r': '\r'
      , 't': '\t'
      }[c]

      if(out !== undefined) {
        accum[accum.length] = out 
      } else if(c === 'u') {
        unicode_remaining = 4
      } else {
        error()
      }
      backslash = false
      return
    }

    if(c === '\\') {
      backslash = true
      return
    }

    if(c === '"') {
      emit(mode, accum.join(''))
      return
    }

    var cc = c.charCodeAt(0)
    if(cc <= 0x1F) {
      error()
    }

    accum[accum.length] = c
  }

  function t_number(c) {
    var okay = false

    if(exponent) {
      if(c === '+' || c === '-') {
        if(exponent_seen_digit) {
          return error()
        }
        exponent_seen_digit = true
        okay = true
      } else {
        exponent_seen_digit = true
      }
    } else {
      if(c === '-') {
        if(accum.length !== 0) {
          return error()
        }
        okay = true
      }

      if(c === '.') {
        if(dotted || accum.length === 0 || (accum[0] === '-' && accum.length === 1)) {
          return error()
        }
        okay = dotted = true
        zero_start = false
      }

      if(c === 'E' || c === 'e') {
        if(!/\d/.test(accum[accum.length - 1])) {
          return error()
        }
        okay = exponent = true
      }
    }

    if(okay || /\d/.test(c)) {
      accum[accum.length] = c
      if(accum.length === 1 && c === '0') {
        zero_start = true
      } else if(accum.length === 2 && accum[0] === '-' && c === '0') {
        zero_start = true
      } else if(zero_start && /\d/.test(c)) {
        return error()
      }
      return
    }

    var out = Number(accum.join(''))

    // one last sanity check!
    if(isNaN(out)) {
      return error()
    }
    --idx // back this char off
    emit(mode, out)
  }

  function t_true(c) {
    accum[accum.length] = c
    if(accum.length !== 4) {
      return
    }
    if(accum.join('') !== 'true') {
      return error()
    }
    emit(mode, true)
  }

  function t_false(c) {
    accum[accum.length] = c
    if(accum.length !== 5) {
      return
    }
    if(accum.join('') !== 'false') {
      return error()
    }
    emit(mode, false)
  }

  function t_null(c) {
    accum[accum.length] = c
    if(accum.length !== 4) {
      return
    }
    if(accum.join('') !== 'null') {
      return error()
    }
    emit(mode, null)
  }

  function emit(type, data) {
    stream.queue({
        type: type
      , data: data
      , line: line
      , pos: pos
      , col: col
    })
    unicode_remaining =
    unicode_character.length = 0

    backslash =
    dotted =
    exponent_seen_digit = 
    zero_start =
    exponent = false
    accum.length = 0
    mode = TOKEN_BASE
  }
}
