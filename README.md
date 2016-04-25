Resource management with co.

[![npm][npm-badge]][npm-url]
[![travis][ci-badge]][ci-url]
[![license][lic-badge]](LICENSE.md)
[![js-standard-style][style-badge]][style-url]

## Features
- automatic allocation and destruction of resources
- [co](https://www.npmjs.com/package/co)/[koa](https://www.npmjs.com/package/koa) friendly
- easy schema for resource management
- builtin synchronization resources - mutex, semaphore and read/write lock

```js
// actual implementation from using.js
function using (resource, gen) {
  return co(function * () {
    let handle = yield resource.acquire()
    try {
      return yield gen(handle)
    } finally {
      resource.release(handle)
    }
  })
}
```

## Example
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
The result of ```acquire``` should be a _thenable_-
```js
let resourceManager = {
  acquire: function () { return Promise.resolve(someValue) },
  release: function (resource) { ... }
}
```

## Extras

Mutexes (mutual exclusion), semaphores (limited parallel access) and read write locks are synchronization primitives that follows the ```acquire/release``` pattern very well. For your convenience, they are all included.

All primitives can be named and optionally scoped to a naming container. This is useful when you want to control access to resources not known in advance, such as files or database records. Memory is reclaimed for named resources not active in any execution path.

> Use ```DEBUG=co-using:* node --harmony <...>``` to get debug output.

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

[npm-badge]: https://img.shields.io/npm/v/co-using.svg?style=flat
[npm-url]: https://npmjs.org/package/co-using
[ci-badge]: https://img.shields.io/travis/jlarsson/co-using.svg?style=flat
[ci-url]: https://travis-ci.org/jlarsson/co-using
[lic-badge]: https://img.shields.io/npm/l/co-using.svg?style=flat
[style-badge]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat
[style-url]: https://github.com/feross/standard
