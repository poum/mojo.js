import mojo, {Session} from '../lib/core.js';
import t from 'tap';

t.test('App', async t => {
  const app = mojo();

  t.equal(app.log.level, 'trace');
  app.log.level = 'fatal';

  app.config.appName = 'Test';
  app.models.test = {it: 'works'};

  app.validator.addSchema(
    {
      type: 'object',
      properties: {
        username: {type: 'string'}
      },
      required: ['username']
    },
    'user'
  );

  // GET /
  app.get('/', ctx => ctx.render({text: 'Hello Mojo!'}));

  // GET /☃
  app.get('/☃', ctx => ctx.render({text: 'Hello Snowman!'}));

  // * /methods
  app.any('/methods', ctx => ctx.render({text: ctx.req.method}));

  // PUT /json
  app.put('/json', async ctx => ctx.render({json: await ctx.req.json()}));

  // PUT /yaml
  app.put('/yaml', async ctx => ctx.render({yaml: await ctx.req.yaml()}));

  // GET /nested
  // *   /nested/methods
  const nested = app.under('/nested').to(async ctx => {
    if (ctx.req.query.get('auth') === '1') return;
    await ctx.render({text: 'Permission denied'});
    return false;
  });
  nested.get('/').to(ctx => ctx.render({text: 'Authenticated'}));
  const test = nested.any('/test').to({prefix: 'X:'});
  test.any('/methods').to(ctx => ctx.render({text: ctx.stash.prefix + ctx.req.method}));

  // * /exception/*
  app
    .any('/exception/:msg', ctx => {
      throw new Error(`Something went wrong: ${ctx.stash.msg}`);
    })
    .name('exception');

  // * /config
  app.any('/config').to(ctx => ctx.render({text: `${ctx.config.appName} ${ctx.models.test.it}`}));

  // * /request_id
  app.any('/request_id').to(ctx => ctx.render({text: ctx.req.requestId}));

  // DELETE /
  app.delete('/', ctx => ctx.render({text: 'Delete'}));

  // PATCH /
  app.patch('/', ctx => ctx.render({text: 'Patch'}));

  // OPTIONS /
  app.options('/', ctx => ctx.render({text: 'Options'}));

  // POST /
  app.post('/', async ctx => {
    await ctx.render({text: 'Post'});
    await ctx.render({text: 'failed!'});
  });

  // GET /custom/request_id
  const custom = app.under(ctx => (ctx.req.requestId = '123'));
  custom.get('/custom/request_id').to(ctx => ctx.render({text: ctx.req.requestId}));

  // GET /cookie
  app.get('/cookie', ctx => {
    const foo = ctx.req.getCookie('foo') ?? 'not present';
    if (foo === 'not present') ctx.res.setCookie('foo', 'present');
    return ctx.render({text: `Cookie: ${foo}`});
  });

  // GET /session/login/*
  app.get('/session/login/:name', async ctx => {
    const session = await ctx.session();
    session.user = ctx.stash.name;
    return ctx.render({text: `Login: ${ctx.stash.name}`});
  });

  // GET /session/members
  app.get('/session/members', async ctx => {
    const session = await ctx.session();
    const user = session.user ?? 'not logged in';
    const extra = ctx.req.getCookie('mojo-extra') ?? 'no extra cookie';
    ctx.res.setCookie('mojo-extra', 'with extra cookie');
    return ctx.render({text: `Member: ${user}, ${extra}`});
  });

  // GET /session/update/*
  app.get('/session/update/:name', async ctx => {
    const session = await ctx.session();
    session.user = ctx.stash.name;
    return ctx.render({text: `Update: ${session.user}`});
  });

  // GET /session/logout
  app.get('/session/logout', async ctx => {
    const session = await ctx.session();
    session.expires = 1;
    return ctx.render({text: `Logout: ${session.user}`});
  });

  // GET /session/expiration
  app.get('/session/expiration', async ctx => {
    const params = await ctx.params();
    const session = await ctx.session();

    const expiration = params.get('expiration');
    if (expiration !== null) {
      session.expiration = parseInt(expiration);
      session.value = 'works';
      return ctx.redirectTo('session_expiration');
    }

    await ctx.render({text: `expiration: ${session.expiration ?? 'none'}, value: ${session.value ?? 'none'}`});
  });

  // GET /flash
  app.get('/flash', async ctx => {
    const flash = await ctx.flash();
    const params = await ctx.params();
    const message = params.get('message');
    if (message !== null) flash.message = message;
    return ctx.render({text: `Flash: ${flash.message ?? 'none'}`});
  });

  // GET /ua
  app.get('/ua', async ctx => {
    const res = await ctx.ua.get(ua.server.urls[0] + 'config');
    return ctx.render({text: await res.text()});
  });

  // POST /form/data
  app.post('/form/data', async ctx => {
    const form = await ctx.req.form();
    const data = {first: form.get('first') ?? 'missing', second: form.get('second') ?? 'missing'};
    return ctx.render({json: data});
  });

  // POST /form/mixed
  app.post('/form/mixed', async ctx => {
    const params = await ctx.params();

    const data = {
      one: params.get('one') ?? 'missing',
      two: params.get('two') ?? 'missing',
      three: params.get('three') ?? 'missing'
    };

    return ctx.render({json: data});
  });

  // POST /form/upload
  app.post('/form/upload', async ctx => {
    const uploads = [];
    for await (const {fieldname, file, filename} of ctx.req.files({limits: {fileSize: 10}})) {
      const upload = {fieldname, filename};
      uploads.push(upload);

      const parts = [];
      for await (const chunk of file) {
        parts.push(chunk);
      }
      upload.content = Buffer.concat(parts).toString();
      upload.limit = file.truncated;
    }

    const params = await ctx.req.form();

    return ctx.render({json: {uploads, params: params.toObject()}});
  });

  // * /url_for
  app.any('/url_for/:msg').to({msg: 'fail'}, async ctx => {
    const form = await ctx.req.form();
    const target = form.get('target');
    const values = form.has('msg') ? {msg: form.get('msg')} : undefined;
    return ctx.render({text: ctx.urlFor(target, values)});
  });
  app.any('/websocket').websocket('/route').any('/works').name('websocket_route');

  // * /redirect
  app.any('/redirect', async ctx => {
    const form = await ctx.req.form();
    const options = form.has('status') ? {status: form.get('status')} : undefined;
    ctx.redirectTo(form.get('target'), options);
  });

  // PUT /maybe
  app.put('/maybe', async ctx => {
    const options = await ctx.req.json();
    if ((await ctx.render({...options})) === false) ctx.render({text: 'Fallback'});
  });

  // GET /res
  app.get('/res', async ctx => ctx.res.status(200).send('Hello World!'));

  // GET /content/negotiation
  // GET /content/negotiation.html
  // GET /content/negotiation.json
  app
    .get('/content/negotiation', {ext: ['html', 'json']}, async ctx => {
      await ctx.respondTo({
        html: ctx => ctx.render({text: 'Some HTML', format: 'html'}),
        json: ctx => ctx.render({json: {some: 'JSON'}})
      });
    })
    .to({ext: null});

  // GET /content/negotiation/fallback
  app.get('/content/negotiation/fallback', async ctx => {
    await ctx.respondTo({
      any: ctx => ctx.render({text: 'Fallback'}),
      json: ctx => ctx.render({json: {just: 'JSON'}})
    });
  });

  // GET /accepts
  app.get('/accepts', {ext: ['txt']}).to({
    ext: null,
    fn: async ctx => {
      const allowed = (await ctx.req.json()) ?? undefined;
      await ctx.render({json: {accepts: ctx.accepts(allowed)}});
    }
  });

  // GET /ip
  app.get('/ip', ctx => ctx.render({text: `Address: ${ctx.req.ip}`}));

  // GET /protocol
  app.get('/protocol', ctx => ctx.render({text: `Protocol: ${ctx.req.protocol}`}));

  // PUT /schema/user
  app.put('/schema/user', async ctx => {
    const validate = ctx.schema('user');
    const data = await ctx.req.json();
    const result = validate(data);
    await ctx.render({json: {valid: result.isValid}});
  });

  // PUT /schema/form
  app.put('/schema/form', async ctx => {
    const validate = ctx.schema({
      type: 'object',
      properties: {
        test: {type: 'string'}
      },
      required: ['test']
    });

    const params = await ctx.params();
    const result = validate(params.toObject());

    await ctx.render({json: {valid: result.isValid}});
  });

  // PUT /schema/dynamic
  app.put('/schema/dynamic', async ctx => {
    const validate = ctx.schema({
      $id: 'test123',
      type: 'object',
      properties: {
        test: {type: 'number'}
      },
      required: ['test']
    });

    const data = await ctx.req.json();
    const result = validate(data);

    await ctx.render({json: {valid: result.isValid, errors: result.errors}});
  });

  // GET /gzip
  app.get('/gzip', ctx => ctx.render({text: 'a'.repeat(2048)}));

  const ua = await app.newTestUserAgent({tap: t});

  t.test('Options', t => {
    const app = mojo();
    t.same(app.config, {});
    t.equal(app.exceptionFormat, 'html');
    t.equal(app.mode, 'development');
    t.same(app.secrets, ['Insecure']);

    const app2 = mojo({config: {it: 'works'}, exceptionFormat: 'json', mode: 'production', secrets: ['Secure']});
    t.same(app2.config, {it: 'works'});
    t.equal(app2.exceptionFormat, 'json');
    t.equal(app2.mode, 'production');
    t.same(app2.secrets, ['Secure']);
    t.end();
  });

  await t.test('Hello World', async () => {
    t.equal(app.router.cache.itemCount, 0);
    (await ua.getOk('/')).statusIs(200).headerIs('Content-Length', '11').bodyIs('Hello Mojo!');
    t.equal(app.router.cache.itemCount, 1);
    (await ua.getOk('/')).statusIs(200).headerLike('Content-Length', /1/).bodyLike(/Mojo/);
    t.equal(app.router.cache.itemCount, 1);
  });

  await t.test('IRI', async () => {
    (await ua.getOk('/☃')).statusIs(200).bodyIs('Hello Snowman!');
  });

  await t.test('Methods', async () => {
    (await ua.deleteOk('/methods')).statusIs(200).bodyIs('DELETE');
    (await ua.getOk('/methods')).statusIs(200).bodyIs('GET');
    (await ua.headOk('/methods')).statusIs(200).bodyIs('');
    (await ua.optionsOk('/methods')).statusIs(200).bodyIs('OPTIONS');
    (await ua.patchOk('/methods')).statusIs(200).bodyIs('PATCH');
    (await ua.postOk('/methods')).statusIs(200).bodyIs('POST');
    (await ua.putOk('/methods')).statusIs(200).bodyIs('PUT');

    (await ua.deleteOk('/')).statusIs(200).bodyIs('Delete');
    (await ua.patchOk('/')).statusIs(200).bodyIs('Patch');
    (await ua.optionsOk('/')).statusIs(200).bodyIs('Options');
    (await ua.postOk('/')).statusIs(200).bodyIs('Post');
  });

  await t.test('JSON', async () => {
    (await ua.putOk('/json', {json: {hello: 'world'}})).statusIs(200).jsonIs({hello: 'world'});
    (await ua.putOk('/json', {json: {i: ['♥ mojo']}})).statusIs(200).jsonIs({i: ['♥ mojo']});
    (await ua.putOk('/json', {json: {i: ['♥ mojo']}})).statusIs(200).jsonIs('♥ mojo', '/i/0');
  });

  await t.test('YAML', async () => {
    (await ua.putOk('/yaml', {yaml: {hello: 'world'}})).statusIs(200).yamlIs({hello: 'world'});
    (await ua.putOk('/yaml', {yaml: {i: ['♥ mojo']}})).statusIs(200).yamlIs({i: ['♥ mojo']});
    (await ua.putOk('/yaml', {yaml: {i: ['♥ mojo']}})).statusIs(200).yamlIs('♥ mojo', '/i/0');
  });

  await t.test('Not found', async () => {
    (await ua.putOk('/does_not_exist')).statusIs(404).typeIs('text/plain; charset=utf-8');
  });

  await t.test('Exception', async () => {
    (await ua.getOk('/exception/works')).statusIs(500).bodyLike(/Error: Something went wrong: works/);
  });

  await t.test('Nested routes', async () => {
    (await ua.getOk('/nested?auth=1')).statusIs(200).bodyIs('Authenticated');
    (await ua.getOk('/nested?auth=0')).statusIs(200).bodyIs('Permission denied');
    (await ua.getOk('/nested/test/methods?auth=1')).statusIs(200).bodyIs('X:GET');
    (await ua.putOk('/nested/test/methods?auth=1')).statusIs(200).bodyIs('X:PUT');
    (await ua.postOk('/nested/test/methods?auth=1')).statusIs(200).bodyIs('X:POST');
    (await ua.getOk('/nested/test/methods?auth=0')).statusIs(200).bodyIs('Permission denied');
    (await ua.getOk('/nested/test?auth=1')).statusIs(404);
    (await ua.getOk('/nested/test/foo?auth=1')).statusIs(404);
  });

  await t.test('Config and models', async () => {
    (await ua.getOk('/config')).statusIs(200).bodyIs('Test works');
  });

  await t.test('Request ID', async () => {
    (await ua.getOk('/request_id')).statusIs(200).bodyLike(/^[0-9]+-[0-9a-z]{6}$/);
    (await ua.getOk('/custom/request_id')).statusIs(200).bodyIs('123');
  });

  await t.test('Cookie', async () => {
    (await ua.getOk('/cookie')).statusIs(200).bodyIs('Cookie: not present');
    (await ua.getOk('/cookie')).statusIs(200).bodyIs('Cookie: present');
    (await ua.getOk('/cookie')).statusIs(200).bodyIs('Cookie: present');
  });

  await t.test('UserAgent', async () => {
    (await ua.getOk('/ua')).statusIs(200).bodyIs('Test works');
  });

  await t.test('urlFor', async () => {
    const baseUrl = ua.server.urls[0];
    (await ua.postOk('/url_for', {form: {target: '/foo'}})).statusIs(200).bodyIs(`${baseUrl}foo`);
    (await ua.postOk('/url_for', {form: {target: '/foo/bar.txt'}})).statusIs(200).bodyIs(`${baseUrl}foo/bar.txt`);
    (await ua.postOk('/url_for', {form: {target: 'current'}})).statusIs(200).bodyIs(`${baseUrl}url_for`);
    (await ua.postOk('/url_for', {form: {target: 'current', msg: 'test'}}))
      .statusIs(200)
      .bodyIs(`${baseUrl}url_for/test`);
    (await ua.postOk('/url_for', {form: {target: 'https://mojolicious.org'}}))
      .statusIs(200)
      .bodyIs('https://mojolicious.org');
    (await ua.postOk('/url_for', {form: {target: 'websocket_route'}}))
      .statusIs(200)
      .bodyIs(`${baseUrl}websocket/route/works`.replace(/^http/, 'ws'));
    (await ua.postOk('/url_for', {form: {target: 'exception', msg: 'test'}}))
      .statusIs(200)
      .bodyIs(`${baseUrl}exception/test`);
  });

  await t.test('redirectTo', async () => {
    const baseUrl = ua.server.urls[0];
    (await ua.postOk('/redirect', {form: {target: '/foo'}}))
      .statusIs(302)
      .headerIs('Location', `${baseUrl}foo`)
      .bodyIs('');
    (await ua.postOk('/redirect', {form: {target: '/foo', status: '301'}}))
      .statusIs(301)
      .headerIs('Location', `${baseUrl}foo`)
      .bodyIs('');
    (await ua.postOk('/redirect', {form: {target: 'websocket_route'}}))
      .statusIs(302)
      .headerIs('Location', `${baseUrl}websocket/route/works`.replace(/^http/, 'ws'))
      .bodyIs('');
    (await ua.postOk('/redirect', {form: {target: 'https://mojolicious.org'}}))
      .statusIs(302)
      .headerIs('Location', 'https://mojolicious.org')
      .bodyIs('');
  });

  await t.test('Maybe render', async () => {
    (await ua.putOk('/maybe', {json: {text: 'Works', maybe: true}})).statusIs(200).bodyIs('Works');
    (await ua.putOk('/maybe', {json: {text: 'Works', maybe: false}})).statusIs(200).bodyIs('Works');
    (await ua.putOk('/maybe', {json: {template: 'missing', maybe: true}})).statusIs(200).bodyIs('Fallback');
    (await ua.putOk('/maybe', {json: {template: 'missing', maybe: false}})).statusIs(500);
    (await ua.putOk('/maybe', {json: {template: 'missing'}})).statusIs(500);
  });

  await t.test('Response API', async () => {
    (await ua.getOk('/res'))
      .statusIs(200)
      .headerExists('Content-Length')
      .headerExistsNot('Content-Type')
      .bodyIs('Hello World!');
  });

  await t.test('Session', async t => {
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: not logged in, no extra cookie');
    (await ua.getOk('/session/login/kraih')).statusIs(200).bodyIs('Login: kraih');
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: kraih, with extra cookie');
    (await ua.getOk('/session/update/sri')).statusIs(200).bodyIs('Update: sri');
    (await ua.getOk('/session/logout')).statusIs(200).bodyIs('Logout: sri');
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: not logged in, with extra cookie');

    (await ua.getOk('/session/login/kraih')).statusIs(200).bodyIs('Login: kraih');
    t.match(ua.res.get('Set-Cookie'), /Path=\//);
    t.match(ua.res.get('Set-Cookie'), /HttpOnly/);
    t.match(ua.res.get('Set-Cookie'), /SameSite=Lax/);
    t.match(ua.res.get('Set-Cookie'), /mojo=/);
    (await ua.getOk('/session/logout')).statusIs(200).bodyIs('Logout: kraih');

    (await ua.getOk('/session/members', {headers: {Cookie: 'mojo=something'}}))
      .statusIs(200)
      .bodyIs('Member: not logged in, with extra cookie');
    const realValue = 'mojo=eyJ1c2VyIjoia3JhaWgiLCJleHBpcmVzIjoxNjIwOTQwOTIzfQ--';
    (await ua.getOk('/session/members', {headers: {Cookie: realValue}}))
      .statusIs(200)
      .bodyIs('Member: not logged in, with extra cookie');
    (await ua.getOk('/session/members', {headers: {Cookie: 'realValue--abcdef'}}))
      .statusIs(200)
      .bodyIs('Member: not logged in, with extra cookie');

    (await ua.getOk('/session/expiration')).statusIs(200).bodyIs('expiration: none, value: none');
    (await ua.getOk('/session/expiration?expiration=120')).statusIs(302).bodyIs('');
    (await ua.getOk('/session/expiration')).statusIs(200).bodyIs('expiration: 120, value: works');
    (await ua.getOk('/session/expiration?expiration=0')).statusIs(302).bodyIs('');
    (await ua.getOk('/session/expiration')).statusIs(200).bodyIs('expiration: 0, value: works');
    (await ua.getOk('/session/expiration')).statusIs(200).bodyIs('expiration: 0, value: works');
  });

  await t.test('Flash', async () => {
    (await ua.getOk('/flash')).statusIs(200).bodyIs('Flash: none');
    (await ua.getOk('/flash?message=Hello')).statusIs(200).bodyIs('Flash: none');
    (await ua.getOk('/flash')).statusIs(200).bodyIs('Flash: Hello');
    (await ua.getOk('/flash')).statusIs(200).bodyIs('Flash: none');

    (await ua.getOk('/flash')).statusIs(200).bodyIs('Flash: none');
    (await ua.getOk('/flash?message=Hello')).statusIs(200).bodyIs('Flash: none');
    (await ua.getOk('/flash?message=World')).statusIs(200).bodyIs('Flash: Hello');
    (await ua.getOk('/flash?message=!')).statusIs(200).bodyIs('Flash: World');
    (await ua.getOk('/flash')).statusIs(200).bodyIs('Flash: !');
    (await ua.getOk('/flash')).statusIs(200).bodyIs('Flash: none');

    (await ua.getOk('/flash?message=Hello')).statusIs(200).bodyIs('Flash: none');
    (await ua.getOk('/')).statusIs(200).bodyIs('Hello Mojo!');
    (await ua.getOk('/flash?message=World')).statusIs(200).bodyIs('Flash: Hello');
    (await ua.getOk('/')).statusIs(200).bodyIs('Hello Mojo!');
    (await ua.getOk('/flash?message=!')).statusIs(200).bodyIs('Flash: World');
    (await ua.getOk('/flash')).statusIs(200).bodyIs('Flash: !');
    (await ua.getOk('/flash')).statusIs(200).bodyIs('Flash: none');
  });

  await t.test('Session (secret rotation)', async t => {
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: not logged in, with extra cookie');
    (await ua.getOk('/session/login/kraih')).statusIs(200).bodyIs('Login: kraih');
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: kraih, with extra cookie');

    app.secrets.unshift('AlsoInsecure');
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: kraih, with extra cookie');

    t.equal(app.secrets.pop(), 'Insecure');
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: kraih, with extra cookie');
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: kraih, with extra cookie');
    (await ua.getOk('/session/logout')).statusIs(200).bodyIs('Logout: kraih');
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: not logged in, with extra cookie');
  });

  await t.test('Session (bad cookies)', async t => {
    const cookieJar = ua.cookieJar;
    ua.cookieJar = null;

    (await ua.getOk('/session/members', {headers: {Cookie: 'mojo=invalid'}}))
      .statusIs(200)
      .bodyIs('Member: not logged in, no extra cookie');
    (await ua.getOk('/session/members', {headers: {Cookie: '--'}}))
      .statusIs(200)
      .bodyIs('Member: not logged in, no extra cookie');
    (await ua.getOk('/session/members', {headers: {Cookie: 'mojo=very--bar'}}))
      .statusIs(200)
      .bodyIs('Member: not logged in, no extra cookie');
    (await ua.getOk('/session/members', {headers: {Cookie: 'mojo=very--very--bar'}}))
      .statusIs(200)
      .bodyIs('Member: not logged in, no extra cookie');
    (await ua.getOk('/session/members', {headers: {Cookie: ''}}))
      .statusIs(200)
      .bodyIs('Member: not logged in, no extra cookie');

    const encrypted = await Session.encrypt(app.secrets[0], '{"user":"test"}');
    t.same(await Session.decrypt(app.secrets, encrypted), '{"user":"test"}');
    t.same(await Session.decrypt(app.secrets, `fails${encrypted}`), null);
    (await ua.getOk('/session/members', {headers: {Cookie: `mojo=${encrypted}`}}))
      .statusIs(200)
      .bodyIs('Member: test, no extra cookie');

    ua.cookieJar = cookieJar;
  });

  await t.test('Session (different cookie name)', async t => {
    app.session.cookieName = 'myapp-session';
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: not logged in, with extra cookie');
    (await ua.getOk('/session/login/kraih')).statusIs(200).bodyIs('Login: kraih');
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: kraih, with extra cookie');
    t.match(ua.res.get('Set-Cookie'), /myapp-session=/);
    (await ua.getOk('/session/logout')).statusIs(200).bodyIs('Logout: kraih');
    (await ua.getOk('/session/members')).statusIs(200).bodyIs('Member: not logged in, with extra cookie');
  });

  await t.test('Content negotiation', async () => {
    (await ua.getOk('/content/negotiation', {headers: {Accept: 'application/json'}}))
      .statusIs(200)
      .typeIs('application/json; charset=utf-8')
      .jsonIs({some: 'JSON'});
    (await ua.getOk('/content/negotiation', {headers: {Accept: 'text/html'}}))
      .statusIs(200)
      .typeIs('text/html; charset=utf-8')
      .bodyIs('Some HTML');
    (await ua.getOk('/content/negotiation', {headers: {Accept: 'text/plain'}})).statusIs(204).bodyIs('');

    (await ua.getOk('/content/negotiation.json'))
      .statusIs(200)
      .typeIs('application/json; charset=utf-8')
      .jsonIs({some: 'JSON'});
    (await ua.getOk('/content/negotiation.html')).statusIs(200).typeIs('text/html; charset=utf-8').bodyIs('Some HTML');
    (await ua.getOk('/content/negotiation.txt')).statusIs(404);

    (await ua.getOk('/content/negotiation.json', {headers: {Accept: 'application/json'}}))
      .statusIs(200)
      .typeIs('application/json; charset=utf-8')
      .jsonIs({some: 'JSON'});
    (await ua.getOk('/content/negotiation.html', {headers: {Accept: 'text/html'}}))
      .statusIs(200)
      .typeIs('text/html; charset=utf-8')
      .bodyIs('Some HTML');

    (await ua.getOk('/content/negotiation.html', {headers: {Accept: 'application/json'}}))
      .statusIs(200)
      .typeIs('text/html; charset=utf-8')
      .bodyIs('Some HTML');
    (await ua.getOk('/content/negotiation.json', {headers: {Accept: 'text/html'}}))
      .statusIs(200)
      .typeIs('application/json; charset=utf-8')
      .jsonIs({some: 'JSON'});

    (await ua.getOk('/content/negotiation', {headers: {Accept: 'text/plain, application/json'}}))
      .statusIs(200)
      .typeIs('application/json; charset=utf-8')
      .jsonIs({some: 'JSON'});
    (await ua.getOk('/content/negotiation', {headers: {Accept: 'text/plain, application/json, */*'}}))
      .statusIs(200)
      .typeIs('application/json; charset=utf-8')
      .jsonIs({some: 'JSON'});
    (await ua.getOk('/content/negotiation', {headers: {Accept: '*/*, application/json'}}))
      .statusIs(200)
      .typeIs('application/json; charset=utf-8')
      .jsonIs({some: 'JSON'});
    (await ua.getOk('/content/negotiation', {headers: {Accept: 'application/json, text/html;Q=1.5'}}))
      .statusIs(200)
      .typeIs('text/html; charset=utf-8')
      .bodyIs('Some HTML');

    (await ua.getOk('/content/negotiation/fallback', {headers: {Accept: 'application/json'}}))
      .statusIs(200)
      .typeIs('application/json; charset=utf-8')
      .jsonIs({just: 'JSON'});
    (await ua.getOk('/content/negotiation/fallback', {headers: {Accept: 'text/plain'}}))
      .statusIs(200)
      .typeIs('text/plain; charset=utf-8')
      .bodyIs('Fallback');
    (await ua.getOk('/content/negotiation/fallback'))
      .statusIs(200)
      .typeIs('text/plain; charset=utf-8')
      .bodyIs('Fallback');
  });

  await t.test('Content negotiation (accepts)', async () => {
    (await ua.getOk('/accepts', {headers: {Accept: 'application/json'}, json: null}))
      .statusIs(200)
      .jsonIs({accepts: ['json']});
    (await ua.getOk('/accepts', {headers: {Accept: 'application/json, text/html;Q=1.5'}, json: null}))
      .statusIs(200)
      .jsonIs({accepts: ['html', 'json']});

    (await ua.getOk('/accepts.txt', {headers: {Accept: 'application/json, text/html;Q=1.5'}, json: null}))
      .statusIs(200)
      .jsonIs({accepts: ['txt', 'html', 'json']});

    (
      await ua.getOk('/accepts.txt', {
        headers: {Accept: 'application/json, text/html;Q=1.5'},
        json: ['json', 'html']
      })
    )
      .statusIs(200)
      .jsonIs({accepts: ['html', 'json']});
    (await ua.getOk('/accepts', {headers: {Accept: 'application/json, text/html;Q=1.5'}, json: ['json']}))
      .statusIs(200)
      .jsonIs({accepts: ['json']});

    (await ua.getOk('/accepts', {json: null})).statusIs(200).jsonIs({accepts: null});
    (await ua.getOk('/accepts', {headers: {Accept: 'application/json, text/html;Q=1.5'}, json: ['png']}))
      .statusIs(200)
      .jsonIs({accepts: null});
    (await ua.getOk('/accepts', {headers: {Accept: 'application/json, text/html;Q=1.5'}, json: []}))
      .statusIs(200)
      .jsonIs({accepts: null});
  });

  await t.test('Reverse proxy (X-Forwarded-For)', async () => {
    (await ua.getOk('/ip')).statusIs(200).bodyUnlike(/104\.24\.31\.8/);
    (await ua.getOk('/ip', {headers: {'X-Forwarded-For': '104.24.31.8'}})).statusIs(200).bodyUnlike(/104\.24\.31\.8/);

    ua.server.reverseProxy = true;
    (await ua.getOk('/ip')).statusIs(200).bodyUnlike(/104\.24\.31\.8/);
    (await ua.getOk('/ip', {headers: {'X-Forwarded-For': '104.24.31.8'}})).statusIs(200).bodyIs('Address: 104.24.31.8');
    (await ua.getOk('/ip', {headers: {'X-Forwarded-For': '192.0.2.2, 192.0.2.1'}}))
      .statusIs(200)
      .bodyIs('Address: 192.0.2.1');
    (await ua.getOk('/ip', {headers: {'X-Forwarded-For': '192.0.2.2,192.0.2.1'}}))
      .statusIs(200)
      .bodyIs('Address: 192.0.2.1');
    ua.server.reverseProxy = false;
  });

  await t.test('Reverse proxy (X-Forwarded-Proto)', async () => {
    (await ua.getOk('/protocol')).statusIs(200).bodyIs('Protocol: http');
    (await ua.getOk('/protocol', {headers: {'X-Forwarded-Proto': 'https'}})).statusIs(200).bodyIs('Protocol: http');

    ua.server.reverseProxy = true;
    (await ua.getOk('/protocol')).statusIs(200).bodyIs('Protocol: http');
    (await ua.getOk('/protocol', {headers: {'X-Forwarded-Proto': 'https'}})).statusIs(200).bodyIs('Protocol: https');
    ua.server.reverseProxy = false;
  });

  await t.test('multipart/form-data', async () => {
    (await ua.postOk('/form/data', {formData: {first: 'works'}}))
      .statusIs(200)
      .jsonIs({first: 'works', second: 'missing'});

    (await ua.postOk('/form/data', {formData: {first: 'One', second: 'Two'}}))
      .statusIs(200)
      .jsonIs({first: 'One', second: 'Two'});
  });

  await t.test('Mixed forms', async () => {
    (await ua.postOk('/form/mixed?one=works')).statusIs(200).jsonIs({one: 'works', two: 'missing', three: 'missing'});

    (await ua.postOk('/form/mixed', {query: {two: 'works'}}))
      .statusIs(200)
      .jsonIs({one: 'missing', two: 'works', three: 'missing'});

    (await ua.postOk('/form/mixed', {form: {three: 'works'}}))
      .statusIs(200)
      .jsonIs({one: 'missing', two: 'missing', three: 'works'});

    (await ua.postOk('/form/mixed?one=works', {form: {two: 'too'}}))
      .statusIs(200)
      .jsonIs({one: 'works', two: 'too', three: 'missing'});

    (await ua.postOk('/form/mixed?two=works', {formData: {three: 'works'}}))
      .statusIs(200)
      .jsonIs({one: 'missing', two: 'works', three: 'works'});
  });

  await t.test('Uploads', async t => {
    (
      await ua.postOk('/form/upload', {formData: {test: {content: 'Hello!', filename: 'test.txt'}, it: 'works'}})
    ).statusIs(200);
    const data = JSON.parse(ua.body);
    t.same(data.uploads, [{fieldname: 'test', filename: 'test.txt', content: 'Hello!', limit: false}]);
    t.same(data.params, {it: 'works'});

    (await ua.postOk('/form/upload', {formData: {test: {content: 'Hello World!', filename: 'test2.txt'}}})).statusIs(
      200
    );
    const data2 = JSON.parse(ua.body);
    t.same(data2.uploads, [{fieldname: 'test', filename: 'test2.txt', content: 'Hello Worl', limit: true}]);
    t.same(data2.params, {});

    (
      await ua.postOk('/form/upload', {
        formData: {
          test: {content: 'Hello', filename: 'test2.txt'},
          test2: {content: 'World', filename: 'test3.txt'},
          test3: {content: '!', filename: 'test4.txt'},
          test4: 'One',
          test5: 'Two'
        }
      })
    ).statusIs(200);
    const data3 = JSON.parse(ua.body);
    t.same(data3.uploads, [
      {fieldname: 'test', filename: 'test2.txt', content: 'Hello', limit: false},
      {fieldname: 'test2', filename: 'test3.txt', content: 'World', limit: false},
      {fieldname: 'test3', filename: 'test4.txt', content: '!', limit: false}
    ]);
    t.same(data3.params, {test4: 'One', test5: 'Two'});

    (await ua.postOk('/form/upload', {formData: {it: 'works'}})).statusIs(200);
    const data4 = JSON.parse(ua.body);
    t.same(data4.uploads, []);
    t.same(data4.params, {it: 'works'});
  });

  await t.test('Validation', async t => {
    (await ua.putOk('/schema/user', {json: {username: 'kraih'}})).statusIs(200).jsonIs({valid: true});
    (await ua.putOk('/schema/user', {json: {user: 'kraih'}})).statusIs(200).jsonIs({valid: false});
    (await ua.putOk('/schema/user', {json: {username: 'sri'}})).statusIs(200).jsonIs({valid: true});

    t.notOk(app.validator.schema('test123'));
    (await ua.putOk('/schema/dynamic', {json: {test: 123}})).statusIs(200).jsonIs({valid: true, errors: []});
    t.ok(app.validator.schema('test123'));
    (await ua.putOk('/schema/dynamic', {json: {test: '123'}})).statusIs(200).jsonIs({
      valid: false,
      errors: [
        {
          instancePath: '/test',
          schemaPath: '#/properties/test/type',
          message: 'must be number'
        }
      ]
    });

    (await ua.putOk('/schema/form', {form: {test: 'works'}})).statusIs(200).jsonIs({valid: true});
    (await ua.putOk('/schema/form', {form: {test2: 'fails'}})).statusIs(200).jsonIs({valid: false});

    (await ua.putOk('/schema/form', {formData: {test: 'works'}})).statusIs(200).jsonIs({valid: true});
    (await ua.putOk('/schema/form', {formData: {test2: 'fails'}})).statusIs(200).jsonIs({valid: false});

    (await ua.putOk('/schema/form', {query: {test: 'works'}})).statusIs(200).jsonIs({valid: true});
    (await ua.putOk('/schema/form', {query: {test2: 'fails'}})).statusIs(200).jsonIs({valid: false});

    (await ua.putOk('/schema/form?test=works')).statusIs(200).jsonIs({valid: true});
    (await ua.putOk('/schema/form?test2=fails')).statusIs(200).jsonIs({valid: false});
  });

  await t.test('Compression', async () => {
    (await ua.getOk('/gzip'))
      .statusIs(200)
      .headerIsnt('Content-Length', '2048')
      .headerIs('Content-Encoding', 'gzip')
      .headerIs('Vary', 'Accept-Encoding')
      .bodyIs('a'.repeat(2048));

    app.renderer.autoCompress = false;
    (await ua.getOk('/gzip'))
      .statusIs(200)
      .headerIs('Content-Length', '2048')
      .headerIsnt('Content-Encoding', 'gzip')
      .headerIsnt('Vary', 'Accept-Encoding')
      .bodyIs('a'.repeat(2048));
    app.renderer.autoCompress = true;

    (await ua.getOk('/gzip'))
      .statusIs(200)
      .headerIsnt('Content-Length', '2048')
      .headerIs('Content-Encoding', 'gzip')
      .headerIs('Vary', 'Accept-Encoding')
      .bodyIs('a'.repeat(2048));

    (await ua.getOk('/gzip', {headers: {'Accept-Encoding': 'nothing'}}))
      .statusIs(200)
      .headerIs('Content-Length', '2048')
      .headerIsnt('Content-Encoding', 'gzip')
      .headerIs('Vary', 'Accept-Encoding')
      .bodyIs('a'.repeat(2048));
  });

  await t.test('Mock context', async () => {
    const ctx = app.newMockContext();
    t.same(ctx.req.raw.method, 'GET');
    t.same(ctx.req.raw.url, '/');
    t.same(ctx.req.raw.headers, {});
    t.same(ctx.currentRoute(), null);

    ctx.stash.hello = 'mojo';
    t.equal(ctx.stash.hello, 'mojo');
    t.equal(await ctx.renderToString({inline: 'Test: <%= hello %>'}), 'Test: mojo');
    t.equal(app.newMockContext().tag('p', {class: 'test'}, 'Hello!').toString(), '<p class="test">Hello!</p>');

    ctx.req.raw.headers.host = 'example.com';
    t.equal(ctx.urlFor('websocket_route'), 'ws://example.com/websocket/route/works');

    const ctx2 = app.newMockContext({method: 'POST', url: '/test', headers: {host: 'mojolicious.org'}});
    t.same(ctx2.req.raw.method, 'POST');
    t.same(ctx2.req.raw.url, '/test');
    t.same(ctx2.req.raw.headers, {host: 'mojolicious.org'});
    t.equal(ctx2.req.baseUrl, 'http://mojolicious.org');
    t.equal(ctx2.req.url.toString(), 'http://mojolicious.org/test');
  });

  t.test('Forbidden helpers', t => {
    let result;
    try {
      app.addHelper('render', function () {
        throw new Error('Fail!');
      });
    } catch (error) {
      result = error;
    }
    t.match(result, /The name "render" is already used in the prototype chain/);

    try {
      app.addHelper('isWebSocket', function () {
        throw new Error('Fail!');
      });
    } catch (error) {
      result = error;
    }
    t.match(result, /The name "isWebSocket" is already used in the prototype chain/);

    t.end();
  });

  await ua.stop();
});
