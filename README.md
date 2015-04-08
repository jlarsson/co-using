# co-using

[![npm](https://img.shields.io/npm/v/co-using.svg?style=flat)](https://npmjs.org/package/co-using)
[![travis](https://img.shields.io/travis/jlarsson/co-using.svg?style=flat)](https://travis-ci.org/jlarsson/co-using)
[![license](https://img.shields.io/npm/l/co-using.svg?style=flat)](LICENSE.md)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard)

Resource management with [co](https://www.npmjs.com/package/co) (v4).

Platform compatiblity is inherited from [co](https://www.npmjs.com/package/co#platform-compatibility).

```js
let using = require('co-using')

// Define how connections are created and destroyed
let connectionPool = {
  acquire: function () {
    return new Connection().openAsync()
  },
  release: function (connection) {
    connection.close()
  }
}

// Use a connection, ensuring it gets destroyed
using(connectionPool, function * (connection) {
  yield connection.queryAsync(...)
})
```

## Api

```js
require('co-using')(<resource manager>, <co 4 compatible generator>)
```

A resource manager is any object implementing ```acquire``` and ```release```.

### acquire
A function that returns a yieldable result. The result is then passed on to the generator and then finally to ```release```

### release
A function that accepts a result from ```acquire```, typically in the purpose of closing or destroying a resource.

The actual implementation of using is

```js
function using (resource, gen) {
  return co(function * () {
    let handle = yield resource.acquire()
    try {
      let result = yield gen(handle)
      resource.release(handle)
      return result
    } catch(err) {
      resource.release(handle)
      throw err
    }
  })
}
```

## Extras

Mutexes (mutual exclusion), semaphores (limited parallel access) and read write locks are synchronization primitives that follows the ```acquire/release``` pattern very well. For your convenience, they are all included.

> Bug tracking tip: ```acquire``` and ```release``` are echoed to [require('debug')('co-using:X')](https://www.npmjs.com/package/debug) for named instances, where **X** is _mutex_, _semaphore_ or _rwlock_. Logging takes place when happening, not when queued/requested.

### Mutex
Mutually exclusive access to generator code.

```js
let using = require('co-using')
let mutex = require('co-using/mutex')
let m = mutex()
using(m, function * () { ... })
```
A mutex can also be (globally) named,
```js
let m = mutex('mutex number one')
```
A mutex can also be named in a specific scope,
```javascript
let mutexNamingScope = {}
let m = mutex('mutex number one', mutexNamingScope)
```

### Semaphore
Limited parallel access to generator code.

```js
let using = require('co-using')
let semaphore = require('co-using/semaphore')
let sem = semaphore(10)
using(sem, function * () { ... })
```
A semaphore can also be (globally) named,
```js
let sem = semaphore(10, 'semaphore number one')
```
A semaphore can also be named in a specific scope,
```js
let semaphoreNamingScope = {}
let sem = semaphore('semaphore number one', semaphoreNamingScope)
```

### Read/Write lock
Parallel access to generator code, with the following restrictions
- if any writer is active, no other readers or writers can be active
- if any reader is active, only other readers up to specified limit can be active
- scheduling is fair, i.e. access is granted in the requested order

```js
let using = require('co-using')
let rwlock = require('co-using/rwlock')
let l = rwlock()
using(l.read(), function * () { ... })
using(l.write(), function * () { ... })
```

It is possible to specify max concurrency (default is many) of readers (note that for writers this is always 1).
```js
let l = rwlock(10)
```

A read/write lock can also be (globally) named,
```js
let l = rwlock(10, 'lock number one')
```
A read/write lock can also be named in a specific scope,
```js
let lockNamingScope = {}
let lock = rwlock(10, 'lock number one', lockNamingScope)
```
