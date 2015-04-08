'use strict'

let assert = require('assert')
let debug = require('debug')('co-using:semaphore')
let Promise = require('native-or-bluebird')

let defaultContainer = {}

let Semaphore = (function () {
  function Semaphore (maxCount, name, container) {
    if (!(this instanceof Semaphore)) {
      return new Semaphore(maxCount, name, container)
    }
    this.maxCount = maxCount || 16
    this.nc = name ? {n: name, c: container || defaultContainer} : null
  }

  let proto = Semaphore.prototype

  proto.acquire = function () {
    return this.acquireState().acquire()
  }

  proto.release = function (handle) {
    if (this.acquireState().release(handle)) {
      this.releaseState()
    }
  }

  proto.acquireState = function () {
    if (this.nc) {
      return this.nc.c[this.nc.n] || (this.nc.c[this.nc.n] = new SemaphoreState(this.maxCount, this.nc))
    }
    if (!this.state) {
      this.state = new SemaphoreState(this.maxCount, this.nc)
    }
    return this.state
  }

  proto.releaseState = function () {
    if (this.nc) {
      delete this.nc.c[this.nc.n]
    }
  }

  return Semaphore
})()

let SemaphoreState = (function () {
  function SemaphoreState (maxCount, nc) {
    this.nc = nc
    this.maxCount = maxCount
    this.count = 0
    this.pending = []
  }

  let proto = SemaphoreState.prototype

  proto.acquire = function () {
    return new Promise(function (resolve) {
      this.pending.push(resolve)
      this.awake()
    }.bind(this))
  }

  proto.release = function (handle) {
    this.nc && debug('release %s', this.nc.n)

    assert(handle !== null, 'Invalid attempt to release null semaphore handle')
    assert(handle.state === this, 'Invalid attempt to release semaphore handle')
    assert(this.count > 0)
    handle.state = null
    --this.count
    return !this.awake()
  }

  proto.awake = function awake () {
    while ((this.count < this.maxCount) && (this.pending.length)) {
      this.nc && debug('acquire %s', this.nc.n)

      ++this.count
      let resolve = this.pending.shift()
      resolve({state: this})
    }
    return this.count > 0
  }

  return SemaphoreState
})()

module.exports = Semaphore
