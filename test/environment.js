'use strict';
const events = require('events');
const fs = require('fs');
const path = require('path');
const util = require('util');
const sinon = require('sinon');
const sinonTest = require('sinon-test');
const Generator = require('yeoman-generator');
const assert = require('yeoman-assert');
const TerminalAdapter = require('../lib/adapter');
const Environment = require('../lib/environment');

sinon.test = sinonTest.configureTest(sinon);
sinon.testCase = sinonTest.configureTestCase(sinon);

describe('Environment', () => {
  beforeEach(function () {
    this.env = new Environment([], {'skip-install': true});
  });

  afterEach(function () {
    this.env.removeAllListeners();
  });

  it('is an instance of EventEmitter', () => {
    assert.ok(new Environment() instanceof events.EventEmitter);
  });

  describe('constructor', () => {
    it('take arguments option', () => {
      const args = ['foo'];
      assert.equal(new Environment(args).arguments, args);
    });

    it('take arguments parameter option as string', () => {
      const args = 'foo bar';
      assert.deepEqual(new Environment(args).arguments, args.split(' '));
    });

    it('take options parameter', () => {
      const opts = {foo: 'bar'};
      assert.equal(new Environment(null, opts).options, opts);
    });

    it('instantiates a TerminalAdapter if none provided', function () {
      assert.ok(this.env.adapter instanceof TerminalAdapter);
    });

    it('uses the provided object as adapter if any', () => {
      const dummyAdapter = {};
      const env = new Environment(null, null, dummyAdapter);
      assert.equal(env.adapter, dummyAdapter, 'Not the adapter provided');
    });

    it('instantiates a mem-fs instance', function () {
      assert.ok(this.env.sharedFs);
    });
  });

  describe('#help()', () => {
    beforeEach(function () {
      this.env
        .register(path.join(__dirname, 'fixtures/generator-simple'))
        .register(path.join(__dirname, 'fixtures/generator-extend/support'));

      this.expected = fs.readFileSync(path.join(__dirname, 'fixtures/help.txt'), 'utf8').trim();

      // Lazy "update the help fixtures because something changed" statement
      // fs.writeFileSync(path.join(__dirname, 'fixtures/help.txt'), env.help().trim());
    });

    it('output the general help', function () {
      assert.textEqual(this.env.help().trim(), this.expected);
    });

    it('output the help with a custom bin name', function () {
      this.expected = this.expected.replace('Usage: init', 'Usage: gg');
      assert.textEqual(this.env.help('gg').trim(), this.expected);
    });
  });

  describe('#create()', () => {
    beforeEach(function () {
      this.Generator = Generator.extend();
      this.env.registerStub(this.Generator, 'stub');
      this.env.registerStub(this.Generator, 'stub:foo:bar');
      this.env.registerStub(this.Generator, '@scope/stub');
    });

    it('instantiate a generator', function () {
      assert.ok(this.env.create('stub') instanceof this.Generator);
    });

    it('instantiate a scoped generator', function () {
      assert.ok(this.env.create('@scope/stub') instanceof this.Generator);
    });

    it('pass options.arguments', function () {
      const args = ['foo', 'bar'];
      const generator = this.env.create('stub', {arguments: args});
      assert.deepEqual(generator.arguments, args);
    });

    it('pass options.arguments as string', function () {
      const args = 'foo bar';
      const generator = this.env.create('stub', {arguments: args});
      assert.deepEqual(generator.arguments, args.split(' '));
    });

    it('pass options.args (as `arguments` alias)', function () {
      const args = ['foo', 'bar'];
      const generator = this.env.create('stub', {args});
      assert.deepEqual(generator.arguments, args);
    });

    it('prefer options.arguments over options.args', function () {
      const args1 = ['yo', 'unicorn'];
      const args = ['foo', 'bar'];
      const generator = this.env.create('stub', {arguments: args1, args});
      assert.deepEqual(generator.arguments, args1);
    });

    it('default arguments to `env.arguments`', function () {
      const args = ['foo', 'bar'];
      this.env.arguments = args;
      const generator = this.env.create('stub');
      assert.notEqual(generator.arguments, args, 'expect arguments to not be passed by reference');
    });

    it('pass options.options', function () {
      const opts = {foo: 'bar'};
      const generator = this.env.create('stub', {options: opts});
      assert.equal(generator.options, opts);
    });

    it('default options to `env.options` content', function () {
      this.env.options = {foo: 'bar'};
      assert.equal(this.env.create('stub').options.foo, 'bar');
    });

    it('throws if Generator is not registered', function () {
      assert.throws(this.env.create.bind(this.end, 'i:do:not:exist'));
    });

    it('add the env as property on the options', function () {
      assert.equal(this.env.create('stub').options.env, this.env);
    });

    it('add the Generator resolved path on the options', function () {
      assert.equal(this.env.create('stub').options.resolved, this.env.get('stub').resolved);
    });

    it('adds the namespace on the options', function () {
      assert.equal(this.env.create('stub').options.namespace, 'stub');
    });

    it('adds the namespace as called on the options', function () {
      assert.equal(this.env.create('stub:foo:bar').options.namespace, 'stub:foo:bar');
    });
  });

  describe('#run()', () => {
    beforeEach(function () {
      const self = this;

      this.Stub = class extends Generator {
        constructor(args, opts) {
          super(args, opts);
          self.args = [args, opts];
        }

        exec() {}
      };

      this.runMethod = sinon.spy(Generator.prototype, 'run');
      this.env.registerStub(this.Stub, 'stub:run');
    });

    afterEach(function () {
      this.runMethod.restore();
    });

    it('runs a registered generator', function (done) {
      this.env.run(['stub:run'], () => {
        assert.ok(this.runMethod.calledOnce);
        done();
      });
    });

    it('pass args and options to the runned generator', function (done) {
      const args = ['stub:run', 'module'];
      const options = {'skip-install': true};
      this.env.run(args, options, () => {
        assert.ok(this.runMethod.calledOnce);
        assert.equal(this.args[0], 'module');
        assert.equal(this.args[1], options);
        done();
      });
    });

    it('without options, it default to env.options', function (done) {
      const args = ['stub:run', 'foo'];
      this.env.options = {some: 'stuff', 'skip-install': true};
      this.env.run(args, () => {
        assert.ok(this.runMethod.calledOnce);
        assert.equal(this.args[0], 'foo');
        assert.equal(this.args[1], this.env.options);
        done();
      });
    });

    it('without args, it default to env.arguments', function (done) {
      this.env.arguments = ['stub:run', 'my-args'];
      this.env.options = {'skip-install': true};
      this.env.run(() => {
        assert.ok(this.runMethod.calledOnce);
        assert.equal(this.args[0], 'my-args');
        assert.equal(this.args[1], this.env.options);
        done();
      });
    });

    it('can take string as args', function (done) {
      const args = 'stub:run module';
      this.env.run(args, () => {
        assert.ok(this.runMethod.calledOnce);
        assert.equal(this.args[0], 'module');
        done();
      });
    });

    it('can take no arguments', function () {
      this.env.arguments = ['stub:run'];
      this.env.run();
      assert.ok(this.runMethod.calledOnce);
    });

    it('launch error if generator is not found', function (done) {
      this.env.on('error', err => {
        assert.ok(err.message.indexOf('some:unknown:generator') >= 0);
        done();
      });
      this.env.run('some:unknown:generator');
    });

    it('returns the generator', function () {
      assert.ok(this.env.run('stub:run') instanceof Generator);
    });
  });

  describe('#registerModulePath()', () => {
    it('resolves to a directory if no file type specified', function () {
      const modulePath = path.join(__dirname, 'fixtures/generator-scoped/package');
      const specifiedJS = path.join(__dirname, 'fixtures/generator-scoped/package/index.js');
      const specifiedJSON = path.join(__dirname, 'fixtures/generator-scoped/package.json');
      const specifiedNode = path.join(__dirname, 'fixtures/generator-scoped/package/nodefile.node');

      assert.equal(specifiedJS, this.env.resolveModulePath(modulePath));
      assert.equal(specifiedJS, this.env.resolveModulePath(specifiedJS));
      assert.equal(specifiedJSON, this.env.resolveModulePath(specifiedJSON));
      assert.equal(specifiedNode, this.env.resolveModulePath(specifiedNode));
    });
  });

  describe('#register()', () => {
    beforeEach(function () {
      this.simplePath = path.join(__dirname, 'fixtures/generator-simple');
      this.extendPath = path.join(__dirname, './fixtures/generator-extend/support');
      assert.equal(this.env.namespaces().length, 0, 'env should be empty');
      this.env
        .register(this.simplePath, 'fixtures:generator-simple')
        .register(this.extendPath, 'scaffold');
    });

    it('store registered generators', function () {
      assert.equal(this.env.namespaces().length, 2);
    });

    it('determine registered Generator namespace and resolved path', function () {
      const simple = this.env.get('fixtures:generator-simple');
      assert.equal(typeof simple, 'function');
      assert.ok(simple.namespace, 'fixtures:generator-simple');
      assert.ok(simple.resolved, path.resolve(this.simplePath));

      const extend = this.env.get('scaffold');
      assert.equal(typeof extend, 'function');
      assert.ok(extend.namespace, 'scaffold');
      assert.ok(extend.resolved, path.resolve(this.extendPath));
    });

    it('throw when String is not passed as first parameter', () => {
      assert.throws(function () {
        this.env.register(() => {}, 'blop');
      });
      assert.throws(function () {
        this.env.register([], 'blop');
      });
      assert.throws(function () {
        this.env.register(false, 'blop');
      });
    });
  });

  describe('#registerStub()', () => {
    beforeEach(function () {
      this.simpleDummy = sinon.spy();
      this.completeDummy = function () {};
      util.inherits(this.completeDummy, Generator);
      this.env
        .registerStub(this.simpleDummy, 'dummy:simple')
        .registerStub(this.completeDummy, 'dummy:complete');
    });

    it('register a function under a namespace', function () {
      assert.equal(this.completeDummy, this.env.get('dummy:complete'));
    });

    it('throws if invalid generator', function () {
      assert.throws(this.env.registerStub.bind(this.env, [], 'dummy'), /stub\sfunction/);
    });

    it('throws if invalid namespace', function () {
      assert.throws(this.env.registerStub.bind(this.env, this.simpleDummy), /namespace/);
    });
  });

  describe('#namespaces()', () => {
    beforeEach(function () {
      this.env
        .register(path.join(__dirname, './fixtures/generator-simple'))
        .register(path.join(__dirname, './fixtures/generator-extend/support'))
        .register(path.join(__dirname, './fixtures/generator-extend/support'), 'support:scaffold');
    });

    it('get the list of namespaces', function () {
      assert.deepEqual(this.env.namespaces(), ['simple', 'extend:support', 'support:scaffold']);
    });
  });

  describe('#getGeneratorsMeta()', () => {
    beforeEach(function () {
      this.generatorPath = path.join(__dirname, './fixtures/generator-simple');
      this.env.register(this.generatorPath);
    });

    it('get the registered Generators metadatas', function () {
      const meta = this.env.getGeneratorsMeta().simple;
      assert.deepEqual(meta.resolved, require.resolve(this.generatorPath));
      assert.deepEqual(meta.namespace, 'simple');
    });
  });

  describe('#getGeneratorNames', () => {
    beforeEach(function () {
      this.generatorPath = path.join(__dirname, './fixtures/generator-simple');
      this.env.register(this.generatorPath);
    });

    it('get the registered generators names', function () {
      assert.deepEqual(this.env.getGeneratorNames(), ['simple']);
    });
  });

  describe('#namespace()', () => {
    it('create namespace from path', function () {
      assert.equal(this.env.namespace('backbone/all/index.js'), 'backbone:all');
      assert.equal(this.env.namespace('backbone/all/main.js'), 'backbone:all');
      assert.equal(this.env.namespace('backbone/all'), 'backbone:all');
      assert.equal(this.env.namespace('backbone/all.js'), 'backbone:all');
      assert.equal(this.env.namespace('backbone/app/index.js'), 'backbone:app');
      assert.equal(this.env.namespace('backbone.js'), 'backbone');

      assert.equal(this.env.namespace('generator-backbone/all.js'), 'backbone:all');
      assert.equal(this.env.namespace('generator-mocha/backbone/model/index.js'), 'mocha:backbone:model');
      assert.equal(this.env.namespace('generator-mocha/backbone/model.js'), 'mocha:backbone:model');
      assert.equal(this.env.namespace('node_modules/generator-mocha/backbone/model.js'), 'mocha:backbone:model');
    });

    it('create namespace from scoped path', function () {
      assert.equal(this.env.namespace('@dummyscope/generator-backbone/all.js'), '@dummyscope/backbone:all');
      assert.equal(this.env.namespace('@dummyscope/generator-mocha/backbone/model/index.js'), '@dummyscope/mocha:backbone:model');
      assert.equal(this.env.namespace('@dummyscope/generator-mocha/backbone/model.js'), '@dummyscope/mocha:backbone:model');
      assert.equal(this.env.namespace('/node_modules/@dummyscope/generator-mocha/backbone/model.js'), '@dummyscope/mocha:backbone:model');
    });

    it('handle relative paths', function () {
      assert.equal(this.env.namespace('../local/stuff'), 'local:stuff');
      assert.equal(this.env.namespace('./local/stuff'), 'local:stuff');
      assert.equal(this.env.namespace('././local/stuff'), 'local:stuff');
      assert.equal(this.env.namespace('../../local/stuff'), 'local:stuff');
    });

    it('handles weird paths', function () {
      assert.equal(this.env.namespace('////gen/all'), 'gen:all');
      assert.equal(this.env.namespace('generator-backbone///all.js'), 'backbone:all');
      assert.equal(this.env.namespace('generator-backbone/././all.js'), 'backbone:all');
      assert.equal(this.env.namespace('generator-backbone/generator-backbone/all.js'), 'backbone:all');
    });

    it('works with Windows\' paths', function () {
      assert.equal(this.env.namespace('backbone\\all\\main.js'), 'backbone:all');
      assert.equal(this.env.namespace('backbone\\all'), 'backbone:all');
      assert.equal(this.env.namespace('backbone\\all.js'), 'backbone:all');
    });

    it('remove lookups from namespace', function () {
      assert.equal(this.env.namespace('backbone/generators/all/index.js'), 'backbone:all');
      assert.equal(this.env.namespace('backbone/lib/generators/all/index.js'), 'backbone:all');
      assert.equal(this.env.namespace('some-lib/generators/all/index.js'), 'some-lib:all');
      assert.equal(this.env.namespace('my.thing/generators/app/index.js'), 'my.thing:app');
      assert.equal(this.env.namespace('meta/generators/generators-thing/index.js'), 'meta:generators-thing');
    });

    it('remove path before the generator name', function () {
      assert.equal(this.env.namespace('/Users/yeoman/.nvm/v0.10.22/lib/node_modules/generator-backbone/all/index.js'), 'backbone:all');
      assert.equal(this.env.namespace('/usr/lib/node_modules/generator-backbone/all/index.js'), 'backbone:all');
    });

    it('handle paths when multiples lookups are in it', function () {
      assert.equal(
        this.env.namespace('c:\\projects\\yeoman\\generators\\generator-example\\generators\\app\\index.js'),
        'example:app'
      );
    });
  });

  describe('#get()', () => {
    beforeEach(function () {
      this.generator = require('./fixtures/generator-mocha');
      this.env
        .register(path.join(__dirname, './fixtures/generator-mocha'), 'fixtures:generator-mocha')
        .register(path.join(__dirname, './fixtures/generator-mocha'), 'mocha:generator');
    });

    it('get a specific generator', function () {
      assert.equal(this.env.get('mocha:generator'), this.generator);
      assert.equal(this.env.get('fixtures:generator-mocha'), this.generator);
    });

    it('remove paths from namespace at resolution (for backward compatibility)', function () {
      assert.equal(this.env.get('mocha:generator:/a/dummy/path/'), this.generator);
      assert.equal(this.env.get('mocha:generator:C:\\foo\\bar'), this.generator);
    });

    it('works with Windows\' absolute paths', sinon.test(function () {
      const absolutePath = 'C:\\foo\\bar';

      const envMock = this.mock(this.env);

      envMock
          .expects('getByPath')
          .once()
          .withExactArgs(absolutePath)
          .returns(null);

      this.env.get(absolutePath);

      envMock.verify();
    }));

    it('fallback to requiring generator from a file path', function () {
      assert.equal(
        this.env.get(path.join(__dirname, './fixtures/generator-mocha')),
        this.generator
      );
    });

    it('returns undefined if namespace is not found', function () {
      assert.equal(this.env.get('not:there'), undefined);
      assert.equal(this.env.get(), undefined);
    });
  });

  describe('#error()', () => {
    it('delegate error handling to the listener', function (done) {
      const error = new Error('foo bar');
      this.env.on('error', err => {
        assert.equal(error, err);
        done();
      });
      this.env.error(error);
    });

    it('throws error if no listener is set', function () {
      assert.throws(this.env.error.bind(this.env, new Error()));
    });

    it('returns the error', function () {
      const error = new Error('foo bar');
      this.env.on('error', () => {});
      assert.equal(this.env.error(error), error);
    });
  });

  describe('#alias()', () => {
    it('apply regex and replace with alternative value', function () {
      this.env.alias(/^([^:]+)$/, '$1:app');
      assert.equal(this.env.alias('foo'), 'foo:app');
    });

    it('apply multiple regex', function () {
      this.env.alias(/^([a-zA-Z0-9:*]+)$/, 'generator-$1');
      this.env.alias(/^([^:]+)$/, '$1:app');
      assert.equal(this.env.alias('foo'), 'generator-foo:app');
    });

    it('apply latest aliases first', function () {
      this.env.alias(/^([^:]+)$/, '$1:all');
      this.env.alias(/^([^:]+)$/, '$1:app');
      assert.equal(this.env.alias('foo'), 'foo:app');
    });

    it('alias empty namespace to `:app` by default', function () {
      assert.equal(this.env.alias('foo'), 'foo:app');
    });
  });

  describe('.enforceUpdate()', () => {
    beforeEach(function () {
      this.env = new Environment();
      delete this.env.adapter;
      delete this.env.runLoop;
      delete this.env.sharedFs;
    });

    it('add an adapter', function () {
      Environment.enforceUpdate(this.env);
      assert(this.env.adapter);
    });

    it('add a runLoop', function () {
      Environment.enforceUpdate(this.env);
      assert(this.env.runLoop);
    });

    it('add a shared mem-fs instance', function () {
      Environment.enforceUpdate(this.env);
      assert(this.env.sharedFs);
    });
  });

  describe('.createEnv()', () => {
    it('create an environment', () => {
      const env = Environment.createEnv();
      assert(env instanceof Environment);
    });
  });

  describe('.namespaceToName()', () => {
    it('convert a namespace to a name', () => {
      const name = Environment.namespaceToName('mocha:generator');
      assert.equal(name, 'mocha');
    });
  });
});
