'use strict'

let assert = require('assert')
let debug = require('debug')('co-using:mutex')
let Promise = require('native-or-bluebird')

let defaultContainer = {}

let Mutex = (function () {
  function Mutex (name, container) {
    if (!(this instanceof Mutex)) {
      return new Mutex(name, container)
    }
    this.nc = name ? {n: name, c: container || defaultContainer} : null
  }

  let proto = Mutex.prototype

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
      let n = this.nc.n
      let c = this.nc.c
      return c[n] || (c[n] = new MutexState(this.nc))
    }
    if (!this.state) {
      this.state = new MutexState()
    }
    return this.state
  }

  proto.releaseState = function () {
    if (this.nc) {
      delete this.nc.c[this.nc.n]
    }
  }

  return Mutex
})()

let MutexState = (function () {
  let MutexState = function (nc) {
    this.nc = nc
    this.pending = []
    this.current = null
  }

  let proto = MutexState.prototype

  proto.acquire = function () {
    return new Promise(function (resolve) {
      this.pending.push(resolve)
      this.awake()
    }.bind(this))
  }

  proto.release = function (handle) {
    this.nc && debug('release %s', this.nc.n)
    assert.ok(handle === this.current, 'Invalid attempt to release mutex handle')
    this.current = null
    return !this.awake()
  }

  proto.awake = function () {
    if (this.current) {
      return true
    }
    if (this.pending.length === 0) {
      return false
    }

    this.nc && debug('acquire %s', this.nc.n)

    this.current = {}
    let resolve = this.pending.shift()
    resolve(this.current)
    return true
  }

  return MutexState
})()

module.exports = Mutex
