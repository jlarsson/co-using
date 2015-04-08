'use strict'

let co = require('co')
module.exports = using

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
