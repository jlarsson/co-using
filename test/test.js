/* global describe, it */

'use strict'

let assert = require('assert')
let Promise = require('native-or-bluebird')
let using = require('../using')
let Mutex = require('../mutex')
let Semaphore = require('../semaphore')
let RwLock = require('../rwlock')

describe('using custom resource manager', function () {
  it('passes acquired resource to handler', function (done) {
    let acquireCalled = false
    let releaseCalled = false
    let resourceManager = {
      acquire: function () {
        acquireCalled = true
        return Promise.resolve(123)
      },
      release: function (val) {
        releaseCalled = true
        assert.equal(val, 123)
      }
    }
    using(resourceManager, function * (val) {
      assert.equal(val, 123)
    })
    .then(function () {
      assert(acquireCalled)
      assert(releaseCalled)
      done()
    })
    .catch(done)
  })
})

describe('using mutex', function () {
  it('restrict concurrency to 1', function (done) {
    testResource(Mutex(), {
      jobTime: 10,
      maxJobs: 10,
      expectedMaxActiveJobs: 1
    })
    .then(done, done)
  })
})

describe('using named mutex', function () {
  it('restrict concurrency to 1', function (done) {
    testResource(Mutex('mutex#1'), {
      jobTime: 10,
      maxJobs: 10,
      expectedMaxActiveJobs: 1
    })
    .then(done, done)
  })

  it('is keeps state in supplied container', function (done) {
    let container = {}
    using(Mutex('mutex#1', container), function * () {
      assert.ok(container.hasOwnProperty('mutex#1'), 'Expected state to be in naming container')
    })
    .then(function () {
      assert.ok(!container.hasOwnProperty('mutex#1'), 'Expected state to be removed from naming container')
    })
    .then(done, done)
  })
})

describe('using semaphore', function () {
  it('restrict concurrency to specified number', function (done) {
    testResource(Semaphore(10), {
      jobTime: 10,
      maxJobs: 100,
      expectedMaxActiveJobs: 10
    })
    .then(done, done)
  })
})

describe('using named semaphore', function () {
  it('restrict concurrency to specified number', function (done) {
    testResource(Semaphore(10, 'semaphore#1'), {
      jobTime: 10,
      maxJobs: 100,
      expectedMaxActiveJobs: 10
    })
    .then(done, done)
  })

  it('is keeps state in supplied container', function (done) {
    let container = {}
    using(Semaphore(10, 'semaphore#1', container), function * () {
      assert.ok(container.hasOwnProperty('semaphore#1'), 'Expected state to be in naming container')
    })
    .then(function () {
      assert.ok(!container.hasOwnProperty('semaphore#1'), 'Expected state to be removed from naming container')
    })
    .then(done, done)
  })
})

describe('using RwLock.read()', function () {
  it('restrict concurrency to specified number', function (done) {
    testResource(RwLock(10).read(), {
      jobTime: 10,
      maxJobs: 1000,
      expectedMaxActiveJobs: 10
    })
    .then(done, done)
  })
})

describe('using named RwLock.read()', function () {
  it('restrict concurrency to specified number', function (done) {
    testResource(RwLock(10, 'rwlock#1').read(), {
      jobTime: 10,
      maxJobs: 1000,
      expectedMaxActiveJobs: 10
    })
    .then(done, done)
  })

  it('is keeps state in supplied container', function (done) {
    let container = {}
    using(RwLock(10, 'rwlock#1', container).read(), function * () {
      assert.ok(container.hasOwnProperty('rwlock#1'), 'Expected state to be in naming container')
    })
    .then(function () {
      assert.ok(!container.hasOwnProperty('rwlock#1'), 'Expected state to be removed from naming container')
    })
    .then(done, done)
  })
})

describe('using RwLock.write()', function () {
  it('restrict concurrency to 1', function (done) {
    testResource(RwLock().write(), {
      jobTime: 10,
      maxJobs: 10,
      expectedMaxActiveJobs: 1
    })
    .then(done, done)
  })
})

describe('using named RwLock.write()', function () {
  it('restrict concurrency to 1', function (done) {
    testResource(RwLock('rwlock#1').write(), {
      jobTime: 10,
      maxJobs: 10,
      expectedMaxActiveJobs: 1
    })
    .then(done, done)
  })

  it('is keeps state in supplied container', function (done) {
    let container = {}
    using(RwLock(10, 'rwlock#1', container).write(), function * () {
      assert.ok(container.hasOwnProperty('rwlock#1'), 'Expected state to be in naming container')
    })
    .then(function () {
      assert.ok(!container.hasOwnProperty('rwlock#1'), 'Expected state to be removed from naming container')
    })
    .then(done, done)
  })
})

describe('interleaving readers and writers', function () {
  it('serializes correctly', function (done) {
    let rwlock = RwLock()
    let jobs = [reader('r1'), reader('r2'), reader('r3'),
      writer('w4'),
      reader('r5'), reader('r6'), reader('r7'),
      writer('w8')
    ]
    let expectedLogEntries = [
      ['read', 'r1', 'r2', 'r3'],
      ['write', 'w4'],
      ['read', 'r5', 'r6', 'r7'],
      ['write', 'w8']
    ]
    let logEntries = []

    return Promise.all(jobs)
      .then(function () {
        assert.deepEqual(logEntries, expectedLogEntries)
        done()
      })
      .catch(done)

    function log (type, name) {
      if (logEntries.length && (logEntries[logEntries.length - 1][0] === type)) {
        logEntries[logEntries.length - 1].push(name)
        return
      }
      logEntries.push([type, name])
    }
    function reader (name) {
      return using(rwlock.read(), function * () {
        delay(10)
        log('read', name)
        delay(10)
      })
    }
    function writer (name) {
      return using(rwlock.write(), function * () {
        delay(10)
        log('write', name)
        delay(10)
      })
    }
  })
})

function testResource (resource, options) {
  let startedJobs = 0
  let activeJobs = 0
  let maxActiveJobs = 0

  function createJob (i) {
    return function * () {
      ++startedJobs
      ++activeJobs
      if (activeJobs > maxActiveJobs) {
        maxActiveJobs = activeJobs
      }
      yield delay(options.jobTime)
      --activeJobs
    }
  }

  let jobs = []
  for (let i = 0; i < options.maxJobs; ++i) {
    jobs.push(using(resource, createJob(i)))
  }

  return Promise.all(jobs)
    .then(function () {
      assert.equal(maxActiveJobs, options.expectedMaxActiveJobs)
      assert.equal(activeJobs, 0)
      assert.equal(startedJobs, options.maxJobs)
    })
}

function delay (timeout) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve()
    }, timeout)
  })
}
