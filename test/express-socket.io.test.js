'use strict';
var expect = require('chai').expect
  , request = require('restler')
  , temp = require('temp')
  , fs = require('fs')
  , io = require('socket.io-client')
  , translator = require('../lib/express-socket.io')
  , apx = require('apx')
describe('Initializer Express-Socket.io',function(){
  describe('properties',function(){
    it('should have a name',function(){
      expect(translator.name).to.equal('express-socket.io')
    })
    it('should have a description',function(){
      expect(translator.description).to.equal('express HTTP Server with Socket.IO support')
    })
    it('should implement a translator start function',function(){
      expect(translator.start).to.be.a('function')
    })
    it('should implement a translator stop function',function(){
      expect(translator.stop).to.be.a('function')
    })
  })
  describe('start translator',function(){
    var inst
    before(function(done){
      apx.once('ready',function(apx){
        inst = translator.start(apx,done)
      })
      apx.start({
        testing: true,
        sysLogLevel: 2,
        cwd: __dirname,
        express: {
          logger: false
        },
        'socket-io': {
          logLevel: 0
        }
      })
    })
    after(function(done){
      apx.once('dead',function(){
        done()
      })
      apx.stop()
    })
    it('should listen on port 3000',function(done){
      request.get('http://localhost:3000').on('complete',function(body,res){
        expect(res.statusCode).to.equal(404)
        expect(body).to.equal('Cannot GET /\n')
        done()
      })
    })
    it('should accept socket.io connections',function(done){
      var socket = io.connect('http://localhost:3000')
      socket.on('connect',function(){
        done()
      })
    })
  })
  describe('Express',function(){
    var inst
    before(function(done){
      apx.once('ready',function(apx){
        inst = translator.start(apx,done)
      })
      apx.start({
        testing: true,
        sysLogLevel: 2,
        cwd: __dirname,
        express: {
          logger: false,
          routes: [
            {get: {path: '/get', file: 'action/get.js'}},
            {get: {path: '/getMethods', file: 'action/getMethods.js', methods: ['test']}},
            {get: {path: '/getQueryParams', file: 'action/getQueryParams.js'}},
            {get: {path: '/options', file: 'action/options.js'}},
            {get: {path: '/xml', file: 'action/xml.js'}},
            {get: {path: '/raw', file: 'action/raw.js'}},
            {get: {path: '/file', file: 'action/file.js'}},
            {post: {path: '/post', file: 'action/post.js'}},
            {post: {path: '/postParams', file: 'action/postParams.js'}},
            {post: {path: '/postMultipart', file: 'action/postMultipart.js'}}
          ]
        },
        'socket-io': {
          enabled: false,
          logLevel: 0
        }
      })
    })
    after(function(done){
      apx.once('dead',function(){
        done()
      })
      apx.stop()
    })
    describe('Routes and Requests',function(){
      it('should register routes for paths with get',function(done){
        request.get('http://localhost:3000/get').on('complete',function(body,res){
          expect(res.statusCode).to.equal(200)
          expect(body.foo).to.equal('bar')
          done()
        })
      })
      it('should register methods with routes',function(done){
        request.get('http://localhost:3000/getMethods/test').on('complete',function(body,res){
          expect(res.statusCode).to.equal(200)
          expect(res.headers['content-type']).to.equal('application/json; charset=utf8')
          done()
        })
      })
      it('should populate query string params on get',function(done){
        request.get('http://localhost:3000/getQueryParams',{
          query: {foo: 'bar'}
        }).on('complete',function(body,res){
          expect(res.statusCode).to.equal(200)
          expect(body.status).to.equal('ok')
          done()
        })
      })
      it('should route post requests',function(done){
        request.post('http://localhost:3000/post').on('complete',function(body,res){
          expect(res.statusCode).to.equal(200)
          expect(body.status).to.equal('ok')
          done()
        })
      })
      it('should populate post params',function(done){
        request.post('http://localhost:3000/postParams',{
          data: {foo: 'bar'}
        }).on('complete',function(body,res){
          expect(res.statusCode).to.equal(200)
          expect(body.status).to.equal('ok')
          done()
        })
      })
      it('should parse multipart forms with files',function(done){
        var tmpFile = temp.openSync()
        fs.writeSync(tmpFile.fd,'foo')
        var stats = fs.statSync(tmpFile.path)
        request.post('http://localhost:3000/postMultipart',{
          multipart: true,
          data: {
            foo: 'bar',
            'baz[0]': 'foo',
            'baz[1]': 'bar',
            'baz[2]': 'baz',
            myFile: request.file(tmpFile.path,'foo.txt',stats.size,stats.encoding,'text/plain')
          }
        }).on('complete',function(body,res){
          expect(res.statusCode).to.equal(200)
          expect(body.status).to.equal('ok')
          temp.cleanup()
          done()
        })
      })
    })
    it('should respond to options requests',function(done){
      request.get('http://localhost:3000/options',{
        method: 'options'
      }).on('complete',function(body,res){
        expect(res.statusCode).to.equal(200)
        expect(res.headers['access-control-allow-origin']).to.equal('*')
        expect(res.headers['access-control-allow-methods']).to.equal('GET,PUT,POST,DELETE,OPTIONS')
        expect(res.headers['access-control-allow-headers']).to.equal('Content-Type, Authorization, Content-Length, X-Requested-With')
        done()
      })
    })
    it('should output xml',function(done){
      request.get('http://localhost:3000/xml').on('complete',function(body,res){
        expect(res.statusCode).to.equal(200)
        expect(body.response.status[0]).to.equal('ok')
        expect(body.response.foo[0]).to.equal('bar')
        expect(res.headers['content-type']).to.equal('application/xml')
        done()
      })
    })
    it('should output raw data',function(done){
      request.get('http://localhost:3000/raw').on('complete',function(body,res){
        expect(res.statusCode).to.equal(200)
        expect(body).to.equal('foo bar baz')
        expect(res.headers['content-type']).to.equal('text/plain')
        done()
      })
    })
    it('should output a file',function(done){
      request.get('http://localhost:3000/file').on('complete',function(body,res){
        expect(res.statusCode).to.equal(200)
        expect(body).to.equal('foo bar baz')
        expect(res.headers['content-type']).to.equal('text/plain')
        expect(res.headers['content-disposition']).to.equal('attachment; filename="foo.txt"')
        done()
      })
    })
  })
  describe('Socket.IO',function(){
    var inst
    before(function(done){
      apx.once('ready',function(apx){
        inst = translator.start(apx,done)
      })
      apx.start({
        testing: true,
        sysLogLevel: 2,
        cwd: __dirname,
        express: {
          enabled: false
        },
        'socket-io': {
          logLevel: 0
        }
      })
    })
    after(function(done){
      apx.once('dead',function(){
        done()
      })
      apx.stop()
    })
    describe('Routes and Requests',function(){
      it('should register routes for paths with get')
      it('should register methods with routes')
      it('should populate query string params on get')
      it('should route post requests')
      it('should populate post params')
      it('should parse multipart forms with files')
    })
    it('should respond to options requests')
    it('should output xml')
    it('should output raw data')
    it('should output a file')
  })
})