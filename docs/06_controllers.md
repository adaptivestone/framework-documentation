# Controllers


:::note

Controllers files part of  [framework inheritance process ](03_files-inheritance.md).

:::

TODO getExpressPAth, loading. yup, middleware


[NEW] Controller middleware now support methods. Previous only ALL was supported. Possible to start router with any method that supported by Express and middleware will be scoped by this method. If middleware route started from "/" then ALL method will be used (like previous bahaviour)

```javascript
  static get middleware() {
    return new Map([['GET/*', [PrepareAppInfo, GetUserByToken]]]);
  }
```

[NEW] controller unhandled rejection now handled with default error


[NEW] new route handler format with request validations and casting (yup based)

```javascript
  get routes() {
    return {
      post: {
        '/': {
          handler: this.postSample,
          request: yup.object().shape({
            count: yup.number().max(100)required(),
          })
        }
      }
    }
  }
  // send request with data  {count: "5000"}
  // will produce error with status 400 and {errors: {count:['Text error']}}


  postSample(req,res) =>{
    // on success validate we pass here.
    // {count: "5000"}
    console.log(req.appInfo.request)
    // {count: 5000} -> casted to number
  }

  [UPDATE] add warning when using 'req.body' directly
[BREAKING] Possible breaking. AsyncFunction now required for router handler (it always was but without checking of code)
[DEPRECATE] usage of 'validator' of controllers
[DEPRECATE] usage of 'isUseControllerNameForRouting' of controllers.

[NEW] ability to pass parameters to middleware

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        PrepareAppInfo,
        GetUserByToken,
        [RoleMiddleware, { roles: ['admin'] ]}]
      ]]
    ]);
  }
```

HTTP_HOST


[NEW] Rate limited middleware

As rate limited we using https://github.com/animir/node-rate-limiter-flexible

```javascript
  static get middleware() {
    return new Map([
      ['POST/login', [
        PrepareAppInfo,
        GetUserByToken,
        RateLimiter
      ]]
    ]);
  }
```

Be default rate key generated based on Route, IP and userID. But you can adjust it vie config (global) or via middleware parameters (see v 2.10.0)

Rate limiter have multiple backends (memory, redis and mongo). Buy default 'memory' backend activated

```javascript
  static get middleware() {
    return new Map([
      [
        'POST/login',
        [
          PrepareAppInfo,
          GetUserByToken,
          [
            RateLimiter,
            {
              consumeKeyComponents: { ip: false },
              limiterOptions: { points: 5 },
            },
          ],
        ],
      ],
    ]);
  }
```


[NEW] Rate limited middleware - ability to include request components (req.body) for key generation. Please not that you have no access to req.appInfo.request on this stage

```javascript
  static get middleware() {
    return new Map([
      ['POST/login', [
        PrepareAppInfo,
        GetUserByToken,
        [RateLimiter,{consumeKeyComponents: { ip: false, request:['email','phone'] }}]
      ]]
    ]);
  }
```