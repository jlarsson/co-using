# co-using

Resource management with co

```javascript

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

[![npm][npm-image]][npm-url]
[![travis][travis-image]][travis-url]
[![license][license-image]][license-url]
[![js-standard-style][standard-image]][standard-url]

[travis-image]: https://img.shields.io/travis/jlarsson/co-using.svg?style=flat
[travis-url]: https://travis-ci.org/jlarsson/co-using
[npm-image]: https://img.shields.io/npm/v/co-using.svg?style=flat
[npm-url]: https://npmjs.org/package/co-using
[license-image]: https://img.shields.io/npm/l/co-using.svg?style=flat
[license-url]: LICENSE.md
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat
[standard-url]: https://github.com/feross/standard
