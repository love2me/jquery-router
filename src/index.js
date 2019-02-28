(function (window, $) {
  var Utils = {
    Warning: function (condition, text) {
      if (typeof condition !== 'boolean') {
        text = condition
        condition = true
      }
      if (condition) {
        console.warn('Router Warning: ' + text)
      }
    },
    Assert: function (condition, text) {
      if (typeof condition !== 'boolean') {
        text = condition
        condition = true
      }
      if (condition) {
        console.error('Router Error: ' + text)
      }
    },
    isObject: function (variable) {
      return Object.prototype.toString.call(variable) === '[object Object]'
    },
    isArray: function (variable) {
      return variable instanceof Array
    },
    isString: function (str) {
      return typeof str === 'string'
    },
    nextTick: function (fn) {
      setTimeout(fn)
    },
    replace: function (str, match, replace) {
      replace = replace || ''
      return str.replace(new RegExp(match, 'g'), replace)
    },
    getTemplateSource: function (url, successHandler, errorHandler) {
      if (!url) {
        return
      }
      return $.ajax({
        url: url
      })
    },
    elementIsExist: function (id) {
      return $('#' + id).length > 0
    },
    hashTransformer: function (hash) {
      hash = hash.replace(/#/g, '')
      return hash.split('?')[0]
    },
    genKey: function () {
      return Date.now().toFixed(3)
    },
    queryToStr: function (queryObj) {
      queryObj = queryObj || {}
      var queries = []
      for (var key in queryObj) {
        if (queryObj.hasOwnProperty(key)) {
          queries.push(key + '=' + queryObj[key])
        }
      }
      return queries.join('&')
    },
    getUrl: function (path) {
      const href = window.location.href
      const i = href.indexOf('#')
      const base = i >= 0 ? href.slice(0, i) : href
      return `${base}#${path}`
    }
  }
  /**
   * Router constructor
   * @param {Object} options
   */
  function Router (options) {
    this.options = options || {}
    this._routes = {}
    this.currentRoute = null
    this._queue = []
    this._caches = {}
    this.key = Utils.genKey()
    this.routeParams = null // auxiliary variable，use to set route params
    this.init()
  }
  Router.prototype.init = function () {
    this.initRoutes()
    this.hashChange()
    this.addListener()
  }
  /**
   * flattern and init Route
   * @param {*} routes 
   * @param {*} parentPath 
   */
  Router.prototype.initRoutes = function (routes, parentPath, level) {
    var that = this
    routes = routes || this.options
    parentPath = parentPath || ''
    level = level || 0
    Object.keys(routes).forEach(function (key) {
      if (key === 'el') {
        return
      }
      var route = Object.assign({}, routes[key])
      var path = parentPath + '/' + key
      route.el = routes.el
      route.path = path
      route.parent = parentPath
      route.level = level++
      var children = route.children
      if (children && Utils.isObject(children)) {
        that.initRoutes(children, path, level)
      }
      that._routes[path] = new Route(route)
    })
  }
  Router.prototype.addListener = function () {
    window.addEventListener('hashchange', this.hashChange.bind(this))
  }
  Router.prototype.hashChange = function (hash) {
    hash = Utils.isString(hash) ? hash : window.location.hash
    hash = Utils.hashTransformer(hash)
    var route = this._routes[hash]
    this.routeQueueRender(route)
  }
  /**
   * push state
   * @param {*} url 
   * @param {*} replace // use replaceState
   */
  Router.prototype.pushState = function (url, replace) {
    var history = window.history
    try {
      if (replace) {
        history.replaceState({ key: this.key }, '', url)
      } else {
        this.key = Utils.genKey()
        history.pushState({ key: this.key }, '', url)
      }
    } catch (e) {
      window.location[replace ? 'replace' : 'assign'](url)
    }
  }
  /**
   * router go function,router jump
   * @param {*} options 
   * @param {String} options.path
   * @param {Object} options.query
   * @param {Object} options.params
   */
  Router.prototype.go = function (options, replace) {
    if (Utils.isString(options)) {
      options = {
        path: options
      }
    } else {
      options = options || {}
    }
    if (!options.path) {
      Utils.Assert('Router.go方法必须包含path属性')
    }
    var url = options.path
    var query = Utils.queryToStr(options.query)
    if (query) {
      url += ('?' + query)
    }
    if (options.params && Utils.isObject(options.params)) {
      this.routeParams = options.params
    }
    this.pushState(Utils.getUrl(url), replace)
    this.hashChange()
  }
  Router.prototype.replace = function (options) {
    this.go(options, true)
  }
  Router.prototype.routeRender = function () {
    if (!this._queue.length || this._queue.length === 0) {
      return
    }
    var that = this
    this.currentRoute = this._queue.shift()
    if (this._queue.length === 0) {
      // set last load route query, params
      this.currentRoute.setQuery()
      if (this.routeParams) {
        this.currentRoute.setParams(this.routeParams)
        this.routeParams = null
      }
    }
    this.currentRoute.render(function () {
      if (that._queue.length > 0) {
        that.routeRender()
      }
    })
  }
  /**
   * render queue
   * @param {*} route 
   */
  Router.prototype.routeQueueRender = function (route) {
    var that = this
    this.analysisRouteMutations(this.computeRouteMutation(this.computeRouteQueue(this.currentRoute), this.computeRouteQueue(route)))
  }
  /**
   * compute queue
   * @param {*} route 
   */
  Router.prototype.computeRouteQueue = function (route) {
    if (!route) {
      return []
    }
    var queue = []
    while (route.parent) {
      queue.unshift(route)
      route = this._routes[route.parent]
    }
    queue.unshift(route)

    return queue
  }
  /**
   * compute route which delete or add in queue
   * @param {*} before 
   * @param {*} after 
   */
  Router.prototype.computeRouteMutation = function (before, after) {
    var index = 0, beforeLength = before.length, afterLength = after.length, 
        short = beforeLength > afterLength ? afterLength : beforeLength
    while (beforeLength && afterLength && index < short) {
      if (before[index].path !== after[index].path) {
        break
      }
      index++
    }
    var waitDelete = before.slice(index, beforeLength), waitAdd = after.slice(index === 0 ? index : index - 1, afterLength)
    // set current, prevent not add queue
    this.currentRoute = before[index - 1] || null
    return {
      delete: waitDelete,
      add: waitAdd
    }
  }
  /**
   * analysis mutations, delete queue and add queue
   * @param {*} routeMutations 
   */
  Router.prototype.analysisRouteMutations = function (routeMutations) {
    var deleteQueue = routeMutations.delete, addQueue = routeMutations.add
    if (this.routeQueueDestroy(deleteQueue)) {
      var addQueueLength = addQueue.length
      if (addQueueLength > 0) {
        this._queue = addQueue
        this.routeRender()
      }
    }
  }
  Router.prototype.routeQueueDestroy = function (queue) {
    var success = false
    for (var i = 0;i < queue.length;i++) {
      queue[i].destroy()
    }
    return true
  }
  /**
   * onLoad hook
   * @param {*} fn 
   */
  Router.prototype.onLoad = function (fn) {
    this.currentRoute.onLoad = fn
  }
  Router.prototype.onDestroy = function (fn) {
    this.currentRoute.onDestroy
  }
  Router.prototype.onError = function (fn) {
    this.currentRoute.onError = fn
  }
  Router.prototype.errorHandler = function () {
    var args = [].slice.call(arguments)
    var code = args[0]
    switch (code) {
      case 404:
        Utils.Assert('未找到资源：' + args[1])
        break
      default:
        Utils.Assert(code)
    }
  }
  /**
   * Route constructor
   * @param {*} options 
   */
  function Route (options) {
    this.optionValidate(options)
    this._options = options
    this.el = options.el
    this.path = options.path
    this.view = options.view
    this.controller = options.controller || null
    this.style = options.style || null
    this.query = {}
    this.params = {}
    this.parent = options.parent
    this._children = options.children
    this.level = options.level
    this.hasViewCache = false
    this.onLoad = function () {}
    this.onDestroy = function () {}
    this.onError = function () {}
  }
  Route.prototype.optionValidate = function (options) {
    var mustAttributes = ['el', 'view']
    for (var i = 0;i < mustAttributes.length;i++) {
      var attr = mustAttributes[i]
      if (!options[attr]) {
        return Utils.Assert('路由配置信息有误，路由路径：' + options.path)
      }
    }
  }
  Route.prototype.setQuery = function () {
    var queryStr = window.location.hash.split('?')[1]
    if (!queryStr) {
      return
    }
    var query = {}
    var queryArray = queryStr.split('&')
    queryArray.forEach(function (item) {
      var temp = item.split('=')
      query[temp[0]] = temp[1]
    })
    this.query = query
  }
  Route.prototype.setParams = function (params) {
    this.params =  params
  }
  /**
   * render, first render view, and render controller, style.
   * if element in queue, continue render next element
   */
  Route.prototype.render = function (cb) {
    var that = this
    this.renderView().then(() => {
      $.when(this.renderController(), this.renderStyle()).then((controller, style) => {
        if (controller && style) {
          // exec onLoad function when render completed
          that.onLoad()
          cb && cb()
        }
      })
    })
  }
  /**
   * render view, if has view cache, use cache.
   */
  Route.prototype.renderView = function () {
    var that = this
    var def = $.Deferred(), route = this
    var view = route.view
        hasViewCache = route.hasViewCache,
        el = route.el
    if (hasViewCache) {
      r(el, view)
    } else {
      Utils.getTemplateSource(view).then(function (data) {
        r(el, data)
        route.view = data
        route.hasViewCache = true
      })
    }

    function r (el, html) {
      var target = $(el)
      target = Utils.isArray(target) ? target[0] : target
      target.html(html)
      def.resolve(true)
    }

    return def
  }
  /**
   * append script
   */
  Route.prototype.renderController = function () {
    var def = $.Deferred()
    var route = this, controller = route.controller
    if (!controller) {
      def.resolve(true)
      return def
    }
    var element = document.createElement('script')
    route.scriptId = element.id = 'router_script_' + Utils.replace(route.path, '/', '_')
    if (Utils.elementIsExist(route.scriptId)) {
      def.resolve(true)
      return def
    }
    element.type = 'text/javascript'
    element.src = controller
    element.onload = function () {
      def.resolve(true)
    }
    element.onerror = function (err) {
      Utils.Assert('加载路由controller失败：' + controller)
    }
    $('html')[0].append(element)
    
    return def
  }
  /**
   * append style
   */
  Route.prototype.renderStyle = function () {
    var def = $.Deferred()
    var route = this, style = route.style
    if (!style) {
      def.resolve(true)
      return def
    }
    var element = document.createElement('link')
    route.styleId = element.id = 'router_style_' + Utils.replace(route.path, '/', '_')
    if (Utils.elementIsExist(route.styleId)) {
      def.resolve(true)
      return def
    }
    element.rel = "stylesheet"
    element.href = style
    element.onload = function () {
      def.resolve(true)
    }
    element.onerror = function () {
      Utils.Assert('加载路由stlye失败：' + style)
    }
    $('head')[0].append(element)

    return def
  }
  Route.prototype.destroy = function () {
    var el = this.el, controller = this.scriptId, style = this.styleId
    this.onDestroy()
    try {
      $(el).html('')
      // not remove script
      // $('#' + controller).remove()
      $('#' + style).remove()
    } catch (e) {
      if (e) {
        throw new Error(e)
      }
    }
    return true
  }
  
  // bind constructor
  window.Router = Router
})(window, jQuery)