'use strict'

let assert = require('assert')
let debug = require('debug')('co-using:rwlock')
let Promise = require('native-or-bluebird')

module.exports = RwLock

function RwLock (maxReaders, name, container) {
  if (!(this instanceof RwLock)) {
    return new RwLock(maxReaders, name, container)
  }

  // prefer 0xFFFFFFFF over Number.MAX_SAFE_INTEGER as max readers
  let internal = new InternalRwLock(maxReaders || 4294967295, name, container)
  this.readLock = new ReadLock(internal)
  this.writeLock = new WriteLock(internal)
}

let proto = RwLock.prototype
proto.read = function () { return this.readLock }
proto.write = function () { return this.writeLock }

let InternalRwLock = (function () {
  let defaultContainer = {}
  
  function InternalRwLock (maxReaders, name, container) {
    this.pending = []
    this.writer = null
    this.maxReaders = maxReaders
    this.readers = 0

    this.nc = name ? {n: name, c: container || defaultContainer} : null
  }
  let proto = InternalRwLock.prototype

  proto.acquireState = function () {
    if (this.nc) {
      return this.nc.c[this.nc.n] || (this.nc.c[this.nc.n] = new RwLockState(this.maxReaders, this.nc))
    }
    if (!this.state) {
      this.state = new RwLockState(this.maxReaders)
    }
    return this.state
  }

  proto.releaseState = function () {
    if (this.nc) {
      delete this.nc.c[this.nc.n]
    }
  }

  return InternalRwLock
})()

let RwLockState = (function () {
  function RwLockState (maxReaders, nc) {
    this.pending = []
    this.writer = null
    this.maxReaders = maxReaders
    this.readers = 0
    this.nc = nc
  }
  let proto = RwLockState.prototype

  proto.acquireReadLock = function () {
    return new Promise(function (resolve) {
      this.pending.push({resolve: resolve, type: 'read'})
      this.awake()
    }.bind(this))
  }

  proto.releaseReadLock = function (handle) {
    this.nc && debug('release read %s', this.nc.n)
    assert(handle !== null, 'Invalid attempt to release null read lock handle')
    assert(handle.t === 'r', 'Invalid attempt to release read lock handle')
    assert(handle.o === this, 'Invalid attempt to release read lock handle')
    handle.o = handle.t = null
    --this.readers
    return !this.awake()
  }

  proto.acquireWriteLock = function () {
    return new Promise(function (resolve) {
      this.pending.push({resolve: resolve, type: 'write'})
      this.awake()
    }.bind(this))
  }

  proto.releaseWriteLock = function (handle) {
    this.nc && debug('release write %s', this.nc.n)
    assert(handle !== null, 'Invalid attempt to release null write lock handle')
    assert(handle === this.writer, 'Invalid attempt to release write lock handle')
    this.writer = null
    return !this.awake()
  }

  proto.awake = function () {
    if (this.writer) {
      // Writer is active, bail out
      return true
    }

    while ((this.pending.length) && (this.readers < this.maxReaders) && (this.pending[0].type === 'read')) {
      // Start all pending readers
      if (this.readers === this.maxReaders) {
        return true
      }

      this.nc && debug('acquire read %s', this.nc.n)

      let rec = this.pending.shift()
      ++this.readers
      rec.resolve({t: 'r', o: this})
    }

    if (this.readers > 0) {
      // Have some active readers, bail out
      return true
    }

    if (this.pending.length && (this.pending[0].type === 'write')) {
      this.nc && debug('acquire write %s', this.nc.n)
      let rec = this.pending.shift()
      this.writer = {t: 'w', o: this}
      rec.resolve(this.writer)
    }

    return this.readers > 0
  }

  return RwLockState
})()

let ReadLock = (function ReadLockModule () {
  function ReadLock (internal) {
    this.internal = internal
  }
  let proto = ReadLock.prototype

  proto.acquire = function () {
    return this.internal.acquireState().acquireReadLock()
  }

  proto.release = function (handle) {
    if (this.internal.acquireState().releaseReadLock(handle)) {
      this.internal.releaseState()
    }
  }

  return ReadLock
})()

let WriteLock = (function WriteLockModule () {
  function WriteLock (internal) {
    this.internal = internal
  }
  let proto = WriteLock.prototype

  proto.acquire = function () {
    return this.internal.acquireState().acquireWriteLock()
  }

  proto.release = function (handle) {
    if (this.internal.acquireState().releaseWriteLock(handle)) {
      this.internal.releaseState()
    }
  }

  return WriteLock
})()
