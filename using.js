'use strict'

let co = require('co')
module.exports = using

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
