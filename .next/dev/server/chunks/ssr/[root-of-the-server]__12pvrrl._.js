module.exports = [
"[externals]/react/jsx-runtime [external] (react/jsx-runtime, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("react/jsx-runtime", () => require("react/jsx-runtime"));

module.exports = mod;
}),
"[externals]/react [external] (react, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("react", () => require("react"));

module.exports = mod;
}),
"[project]/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
exports._ = _interop_require_default;
}),
"[project]/node_modules/next/dist/shared/lib/modern-browserslist-target.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

// Note: This file is JS because it's used by the taskfile-swc.js file, which is JS.
// Keep file changes in sync with the corresponding `.d.ts` files.
/**
 * These are the minimum browser versions that we consider "modern" and thus compile for by default.
 * This list was generated using `pnpm browserslist "baseline widely available"` on 2025-10-01.
 */ const MODERN_BROWSERSLIST_TARGET = [
    'chrome 111',
    'edge 111',
    'firefox 111',
    'safari 16.4'
];
module.exports = MODERN_BROWSERSLIST_TARGET;
}),
"[project]/node_modules/next/dist/shared/lib/entry-constants.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    UNDERSCORE_GLOBAL_ERROR_ROUTE: null,
    UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY: null,
    UNDERSCORE_NOT_FOUND_ROUTE: null,
    UNDERSCORE_NOT_FOUND_ROUTE_ENTRY: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    UNDERSCORE_GLOBAL_ERROR_ROUTE: function() {
        return UNDERSCORE_GLOBAL_ERROR_ROUTE;
    },
    UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY: function() {
        return UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY;
    },
    UNDERSCORE_NOT_FOUND_ROUTE: function() {
        return UNDERSCORE_NOT_FOUND_ROUTE;
    },
    UNDERSCORE_NOT_FOUND_ROUTE_ENTRY: function() {
        return UNDERSCORE_NOT_FOUND_ROUTE_ENTRY;
    }
});
const UNDERSCORE_NOT_FOUND_ROUTE = '/_not-found';
const UNDERSCORE_NOT_FOUND_ROUTE_ENTRY = `${UNDERSCORE_NOT_FOUND_ROUTE}/page`;
const UNDERSCORE_GLOBAL_ERROR_ROUTE = '/_global-error';
const UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY = `${UNDERSCORE_GLOBAL_ERROR_ROUTE}/page`;
}),
"[project]/node_modules/next/dist/shared/lib/constants.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    APP_CLIENT_INTERNALS: null,
    APP_PATHS_MANIFEST: null,
    APP_PATH_ROUTES_MANIFEST: null,
    AdapterOutputType: null,
    BARREL_OPTIMIZATION_PREFIX: null,
    BLOCKED_PAGES: null,
    BUILD_ID_FILE: null,
    BUILD_MANIFEST: null,
    CLIENT_PUBLIC_FILES_PATH: null,
    CLIENT_REFERENCE_MANIFEST: null,
    CLIENT_STATIC_FILES_PATH: null,
    CLIENT_STATIC_FILES_RUNTIME_MAIN: null,
    CLIENT_STATIC_FILES_RUNTIME_MAIN_APP: null,
    CLIENT_STATIC_FILES_RUNTIME_POLYFILLS: null,
    CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL: null,
    CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH: null,
    CLIENT_STATIC_FILES_RUNTIME_WEBPACK: null,
    COMPILER_INDEXES: null,
    COMPILER_NAMES: null,
    CONFIG_FILES: null,
    DEFAULT_RUNTIME_WEBPACK: null,
    DEFAULT_SANS_SERIF_FONT: null,
    DEFAULT_SERIF_FONT: null,
    DEV_CLIENT_MIDDLEWARE_MANIFEST: null,
    DEV_CLIENT_PAGES_MANIFEST: null,
    DYNAMIC_CSS_MANIFEST: null,
    EDGE_RUNTIME_WEBPACK: null,
    EDGE_UNSUPPORTED_NODE_APIS: null,
    EXPORT_DETAIL: null,
    EXPORT_MARKER: null,
    FUNCTIONS_CONFIG_MANIFEST: null,
    IMAGES_MANIFEST: null,
    INTERCEPTION_ROUTE_REWRITE_MANIFEST: null,
    MIDDLEWARE_BUILD_MANIFEST: null,
    MIDDLEWARE_MANIFEST: null,
    MIDDLEWARE_REACT_LOADABLE_MANIFEST: null,
    MODERN_BROWSERSLIST_TARGET: null,
    NEXT_BUILTIN_DOCUMENT: null,
    NEXT_FONT_MANIFEST: null,
    PAGES_MANIFEST: null,
    PHASE_ANALYZE: null,
    PHASE_DEVELOPMENT_SERVER: null,
    PHASE_EXPORT: null,
    PHASE_INFO: null,
    PHASE_PRODUCTION_BUILD: null,
    PHASE_PRODUCTION_SERVER: null,
    PHASE_TEST: null,
    PREFETCH_HINTS: null,
    PRERENDER_MANIFEST: null,
    REACT_LOADABLE_MANIFEST: null,
    ROUTES_MANIFEST: null,
    RSC_MODULE_TYPES: null,
    SERVER_DIRECTORY: null,
    SERVER_FILES_MANIFEST: null,
    SERVER_PROPS_ID: null,
    SERVER_REFERENCE_MANIFEST: null,
    STATIC_PROPS_ID: null,
    STATIC_STATUS_PAGES: null,
    STRING_LITERAL_DROP_BUNDLE: null,
    SUBRESOURCE_INTEGRITY_MANIFEST: null,
    SYSTEM_ENTRYPOINTS: null,
    TRACE_OUTPUT_VERSION: null,
    TURBOPACK_CLIENT_BUILD_MANIFEST: null,
    TURBOPACK_CLIENT_MIDDLEWARE_MANIFEST: null,
    TURBO_TRACE_DEFAULT_MEMORY_LIMIT: null,
    UNDERSCORE_GLOBAL_ERROR_ROUTE: null,
    UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY: null,
    UNDERSCORE_NOT_FOUND_ROUTE: null,
    UNDERSCORE_NOT_FOUND_ROUTE_ENTRY: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    APP_CLIENT_INTERNALS: function() {
        return APP_CLIENT_INTERNALS;
    },
    APP_PATHS_MANIFEST: function() {
        return APP_PATHS_MANIFEST;
    },
    APP_PATH_ROUTES_MANIFEST: function() {
        return APP_PATH_ROUTES_MANIFEST;
    },
    AdapterOutputType: function() {
        return AdapterOutputType;
    },
    BARREL_OPTIMIZATION_PREFIX: function() {
        return BARREL_OPTIMIZATION_PREFIX;
    },
    BLOCKED_PAGES: function() {
        return BLOCKED_PAGES;
    },
    BUILD_ID_FILE: function() {
        return BUILD_ID_FILE;
    },
    BUILD_MANIFEST: function() {
        return BUILD_MANIFEST;
    },
    CLIENT_PUBLIC_FILES_PATH: function() {
        return CLIENT_PUBLIC_FILES_PATH;
    },
    CLIENT_REFERENCE_MANIFEST: function() {
        return CLIENT_REFERENCE_MANIFEST;
    },
    CLIENT_STATIC_FILES_PATH: function() {
        return CLIENT_STATIC_FILES_PATH;
    },
    CLIENT_STATIC_FILES_RUNTIME_MAIN: function() {
        return CLIENT_STATIC_FILES_RUNTIME_MAIN;
    },
    CLIENT_STATIC_FILES_RUNTIME_MAIN_APP: function() {
        return CLIENT_STATIC_FILES_RUNTIME_MAIN_APP;
    },
    CLIENT_STATIC_FILES_RUNTIME_POLYFILLS: function() {
        return CLIENT_STATIC_FILES_RUNTIME_POLYFILLS;
    },
    CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL: function() {
        return CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL;
    },
    CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH: function() {
        return CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH;
    },
    CLIENT_STATIC_FILES_RUNTIME_WEBPACK: function() {
        return CLIENT_STATIC_FILES_RUNTIME_WEBPACK;
    },
    COMPILER_INDEXES: function() {
        return COMPILER_INDEXES;
    },
    COMPILER_NAMES: function() {
        return COMPILER_NAMES;
    },
    CONFIG_FILES: function() {
        return CONFIG_FILES;
    },
    DEFAULT_RUNTIME_WEBPACK: function() {
        return DEFAULT_RUNTIME_WEBPACK;
    },
    DEFAULT_SANS_SERIF_FONT: function() {
        return DEFAULT_SANS_SERIF_FONT;
    },
    DEFAULT_SERIF_FONT: function() {
        return DEFAULT_SERIF_FONT;
    },
    DEV_CLIENT_MIDDLEWARE_MANIFEST: function() {
        return DEV_CLIENT_MIDDLEWARE_MANIFEST;
    },
    DEV_CLIENT_PAGES_MANIFEST: function() {
        return DEV_CLIENT_PAGES_MANIFEST;
    },
    DYNAMIC_CSS_MANIFEST: function() {
        return DYNAMIC_CSS_MANIFEST;
    },
    EDGE_RUNTIME_WEBPACK: function() {
        return EDGE_RUNTIME_WEBPACK;
    },
    EDGE_UNSUPPORTED_NODE_APIS: function() {
        return EDGE_UNSUPPORTED_NODE_APIS;
    },
    EXPORT_DETAIL: function() {
        return EXPORT_DETAIL;
    },
    EXPORT_MARKER: function() {
        return EXPORT_MARKER;
    },
    FUNCTIONS_CONFIG_MANIFEST: function() {
        return FUNCTIONS_CONFIG_MANIFEST;
    },
    IMAGES_MANIFEST: function() {
        return IMAGES_MANIFEST;
    },
    INTERCEPTION_ROUTE_REWRITE_MANIFEST: function() {
        return INTERCEPTION_ROUTE_REWRITE_MANIFEST;
    },
    MIDDLEWARE_BUILD_MANIFEST: function() {
        return MIDDLEWARE_BUILD_MANIFEST;
    },
    MIDDLEWARE_MANIFEST: function() {
        return MIDDLEWARE_MANIFEST;
    },
    MIDDLEWARE_REACT_LOADABLE_MANIFEST: function() {
        return MIDDLEWARE_REACT_LOADABLE_MANIFEST;
    },
    MODERN_BROWSERSLIST_TARGET: function() {
        return _modernbrowserslisttarget.default;
    },
    NEXT_BUILTIN_DOCUMENT: function() {
        return NEXT_BUILTIN_DOCUMENT;
    },
    NEXT_FONT_MANIFEST: function() {
        return NEXT_FONT_MANIFEST;
    },
    PAGES_MANIFEST: function() {
        return PAGES_MANIFEST;
    },
    PHASE_ANALYZE: function() {
        return PHASE_ANALYZE;
    },
    PHASE_DEVELOPMENT_SERVER: function() {
        return PHASE_DEVELOPMENT_SERVER;
    },
    PHASE_EXPORT: function() {
        return PHASE_EXPORT;
    },
    PHASE_INFO: function() {
        return PHASE_INFO;
    },
    PHASE_PRODUCTION_BUILD: function() {
        return PHASE_PRODUCTION_BUILD;
    },
    PHASE_PRODUCTION_SERVER: function() {
        return PHASE_PRODUCTION_SERVER;
    },
    PHASE_TEST: function() {
        return PHASE_TEST;
    },
    PREFETCH_HINTS: function() {
        return PREFETCH_HINTS;
    },
    PRERENDER_MANIFEST: function() {
        return PRERENDER_MANIFEST;
    },
    REACT_LOADABLE_MANIFEST: function() {
        return REACT_LOADABLE_MANIFEST;
    },
    ROUTES_MANIFEST: function() {
        return ROUTES_MANIFEST;
    },
    RSC_MODULE_TYPES: function() {
        return RSC_MODULE_TYPES;
    },
    SERVER_DIRECTORY: function() {
        return SERVER_DIRECTORY;
    },
    SERVER_FILES_MANIFEST: function() {
        return SERVER_FILES_MANIFEST;
    },
    SERVER_PROPS_ID: function() {
        return SERVER_PROPS_ID;
    },
    SERVER_REFERENCE_MANIFEST: function() {
        return SERVER_REFERENCE_MANIFEST;
    },
    STATIC_PROPS_ID: function() {
        return STATIC_PROPS_ID;
    },
    STATIC_STATUS_PAGES: function() {
        return STATIC_STATUS_PAGES;
    },
    STRING_LITERAL_DROP_BUNDLE: function() {
        return STRING_LITERAL_DROP_BUNDLE;
    },
    SUBRESOURCE_INTEGRITY_MANIFEST: function() {
        return SUBRESOURCE_INTEGRITY_MANIFEST;
    },
    SYSTEM_ENTRYPOINTS: function() {
        return SYSTEM_ENTRYPOINTS;
    },
    TRACE_OUTPUT_VERSION: function() {
        return TRACE_OUTPUT_VERSION;
    },
    TURBOPACK_CLIENT_BUILD_MANIFEST: function() {
        return TURBOPACK_CLIENT_BUILD_MANIFEST;
    },
    TURBOPACK_CLIENT_MIDDLEWARE_MANIFEST: function() {
        return TURBOPACK_CLIENT_MIDDLEWARE_MANIFEST;
    },
    TURBO_TRACE_DEFAULT_MEMORY_LIMIT: function() {
        return TURBO_TRACE_DEFAULT_MEMORY_LIMIT;
    },
    UNDERSCORE_GLOBAL_ERROR_ROUTE: function() {
        return _entryconstants.UNDERSCORE_GLOBAL_ERROR_ROUTE;
    },
    UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY: function() {
        return _entryconstants.UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY;
    },
    UNDERSCORE_NOT_FOUND_ROUTE: function() {
        return _entryconstants.UNDERSCORE_NOT_FOUND_ROUTE;
    },
    UNDERSCORE_NOT_FOUND_ROUTE_ENTRY: function() {
        return _entryconstants.UNDERSCORE_NOT_FOUND_ROUTE_ENTRY;
    }
});
const _interop_require_default = __turbopack_context__.r("[project]/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [ssr] (ecmascript)");
const _modernbrowserslisttarget = /*#__PURE__*/ _interop_require_default._(__turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/modern-browserslist-target.js [ssr] (ecmascript)"));
const _entryconstants = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/entry-constants.js [ssr] (ecmascript)");
const COMPILER_NAMES = {
    client: 'client',
    server: 'server',
    edgeServer: 'edge-server'
};
const COMPILER_INDEXES = {
    [COMPILER_NAMES.client]: 0,
    [COMPILER_NAMES.server]: 1,
    [COMPILER_NAMES.edgeServer]: 2
};
var AdapterOutputType = /*#__PURE__*/ function(AdapterOutputType) {
    /**
   * `PAGES` represents all the React pages that are under `pages/`.
   */ AdapterOutputType["PAGES"] = "PAGES";
    /**
   * `PAGES_API` represents all the API routes under `pages/api/`.
   */ AdapterOutputType["PAGES_API"] = "PAGES_API";
    /**
   * `APP_PAGE` represents all the React pages that are under `app/` with the
   * filename of `page.{j,t}s{,x}`.
   */ AdapterOutputType["APP_PAGE"] = "APP_PAGE";
    /**
   * `APP_ROUTE` represents all the API routes and metadata routes that are under `app/` with the
   * filename of `route.{j,t}s{,x}`.
   */ AdapterOutputType["APP_ROUTE"] = "APP_ROUTE";
    /**
   * `PRERENDER` represents an ISR enabled route that might
   * have a seeded cache entry or fallback generated during build
   */ AdapterOutputType["PRERENDER"] = "PRERENDER";
    /**
   * `STATIC_FILE` represents a static file (ie /_next/static)
   */ AdapterOutputType["STATIC_FILE"] = "STATIC_FILE";
    /**
   * `MIDDLEWARE` represents the middleware output if present
   */ AdapterOutputType["MIDDLEWARE"] = "MIDDLEWARE";
    return AdapterOutputType;
}({});
const PHASE_EXPORT = 'phase-export';
const PHASE_ANALYZE = 'phase-analyze';
const PHASE_PRODUCTION_BUILD = 'phase-production-build';
const PHASE_PRODUCTION_SERVER = 'phase-production-server';
const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';
const PHASE_TEST = 'phase-test';
const PHASE_INFO = 'phase-info';
const PAGES_MANIFEST = 'pages-manifest.json';
const APP_PATHS_MANIFEST = 'app-paths-manifest.json';
const APP_PATH_ROUTES_MANIFEST = 'app-path-routes-manifest.json';
const BUILD_MANIFEST = 'build-manifest.json';
const FUNCTIONS_CONFIG_MANIFEST = 'functions-config-manifest.json';
const SUBRESOURCE_INTEGRITY_MANIFEST = 'subresource-integrity-manifest';
const NEXT_FONT_MANIFEST = 'next-font-manifest';
const EXPORT_MARKER = 'export-marker.json';
const EXPORT_DETAIL = 'export-detail.json';
const PRERENDER_MANIFEST = 'prerender-manifest.json';
const PREFETCH_HINTS = 'prefetch-hints.json';
const ROUTES_MANIFEST = 'routes-manifest.json';
const IMAGES_MANIFEST = 'images-manifest.json';
const SERVER_FILES_MANIFEST = 'required-server-files';
const DEV_CLIENT_PAGES_MANIFEST = '_devPagesManifest.json';
const MIDDLEWARE_MANIFEST = 'middleware-manifest.json';
const TURBOPACK_CLIENT_MIDDLEWARE_MANIFEST = '_clientMiddlewareManifest.js';
const TURBOPACK_CLIENT_BUILD_MANIFEST = 'client-build-manifest.json';
const DEV_CLIENT_MIDDLEWARE_MANIFEST = '_devMiddlewareManifest.json';
const REACT_LOADABLE_MANIFEST = 'react-loadable-manifest.json';
const SERVER_DIRECTORY = 'server';
const CONFIG_FILES = [
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
    // process.features can be undefined on Edge runtime
    // TODO: Remove `as any` once we bump @types/node to v22.10.0+
    ...process?.features?.typescript ? [
        'next.config.mts'
    ] : []
];
const BUILD_ID_FILE = 'BUILD_ID';
const BLOCKED_PAGES = [
    '/_document',
    '/_app',
    '/_error'
];
const CLIENT_PUBLIC_FILES_PATH = 'public';
const CLIENT_STATIC_FILES_PATH = 'static';
const STRING_LITERAL_DROP_BUNDLE = '__NEXT_DROP_CLIENT_FILE__';
const NEXT_BUILTIN_DOCUMENT = '__NEXT_BUILTIN_DOCUMENT__';
const BARREL_OPTIMIZATION_PREFIX = '__barrel_optimize__';
const CLIENT_REFERENCE_MANIFEST = 'client-reference-manifest';
const SERVER_REFERENCE_MANIFEST = 'server-reference-manifest';
const MIDDLEWARE_BUILD_MANIFEST = 'middleware-build-manifest';
const MIDDLEWARE_REACT_LOADABLE_MANIFEST = 'middleware-react-loadable-manifest';
const INTERCEPTION_ROUTE_REWRITE_MANIFEST = 'interception-route-rewrite-manifest';
const DYNAMIC_CSS_MANIFEST = 'dynamic-css-manifest';
const CLIENT_STATIC_FILES_RUNTIME_MAIN = `main`;
const CLIENT_STATIC_FILES_RUNTIME_MAIN_APP = `${CLIENT_STATIC_FILES_RUNTIME_MAIN}-app`;
const APP_CLIENT_INTERNALS = 'app-pages-internals';
const CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH = `react-refresh`;
const CLIENT_STATIC_FILES_RUNTIME_WEBPACK = `webpack`;
const CLIENT_STATIC_FILES_RUNTIME_POLYFILLS = 'polyfills';
const CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL = Symbol(CLIENT_STATIC_FILES_RUNTIME_POLYFILLS);
const DEFAULT_RUNTIME_WEBPACK = 'webpack-runtime';
const EDGE_RUNTIME_WEBPACK = 'edge-runtime-webpack';
const STATIC_PROPS_ID = '__N_SSG';
const SERVER_PROPS_ID = '__N_SSP';
const DEFAULT_SERIF_FONT = {
    name: 'Times New Roman',
    xAvgCharWidth: 821,
    azAvgWidth: 854.3953488372093,
    unitsPerEm: 2048
};
const DEFAULT_SANS_SERIF_FONT = {
    name: 'Arial',
    xAvgCharWidth: 904,
    azAvgWidth: 934.5116279069767,
    unitsPerEm: 2048
};
const STATIC_STATUS_PAGES = [
    '/500'
];
const TRACE_OUTPUT_VERSION = 1;
const TURBO_TRACE_DEFAULT_MEMORY_LIMIT = 6000;
const RSC_MODULE_TYPES = {
    client: 'client',
    server: 'server'
};
const EDGE_UNSUPPORTED_NODE_APIS = [
    'clearImmediate',
    'setImmediate',
    'BroadcastChannel',
    'ByteLengthQueuingStrategy',
    'CompressionStream',
    'CountQueuingStrategy',
    'DecompressionStream',
    'DomException',
    'MessageChannel',
    'MessageEvent',
    'MessagePort',
    'ReadableByteStreamController',
    'ReadableStreamBYOBRequest',
    'ReadableStreamDefaultController',
    'TransformStreamDefaultController',
    'WritableStreamDefaultController'
];
const SYSTEM_ENTRYPOINTS = new Set([
    CLIENT_STATIC_FILES_RUNTIME_MAIN,
    CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH,
    CLIENT_STATIC_FILES_RUNTIME_MAIN_APP
]);
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
}
}),
"[project]/node_modules/next/dist/shared/lib/is-plain-object.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    getObjectClassLabel: null,
    isPlainObject: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    getObjectClassLabel: function() {
        return getObjectClassLabel;
    },
    isPlainObject: function() {
        return isPlainObject;
    }
});
function getObjectClassLabel(value) {
    return Object.prototype.toString.call(value);
}
function isPlainObject(value) {
    if (getObjectClassLabel(value) !== '[object Object]') {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    /**
   * this used to be previously:
   *
   * `return prototype === null || prototype === Object.prototype`
   *
   * but Edge Runtime expose Object from vm, being that kind of type-checking wrongly fail.
   *
   * It was changed to the current implementation since it's resilient to serialization.
   */ return prototype === null || prototype.hasOwnProperty('isPrototypeOf');
}
}),
"[project]/node_modules/next/dist/lib/is-error.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    default: null,
    getProperError: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    /**
 * Checks whether the given value is a NextError.
 * This can be used to print a more detailed error message with properties like `code` & `digest`.
 */ default: function() {
        return isError;
    },
    getProperError: function() {
        return getProperError;
    }
});
const _isplainobject = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/is-plain-object.js [ssr] (ecmascript)");
/**
 * This is a safe stringify function that handles circular references.
 * We're using a simpler version here to avoid introducing
 * the dependency `safe-stable-stringify` into production bundle.
 *
 * This helper is used both in development and production.
 */ function safeStringifyLite(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (_key, value)=>{
        // If value is an object and already seen, replace with "[Circular]"
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular]';
            }
            seen.add(value);
        }
        return value;
    });
}
function isError(err) {
    return typeof err === 'object' && err !== null && 'name' in err && 'message' in err;
}
function getProperError(err) {
    if (isError(err)) {
        return err;
    }
    if ("TURBOPACK compile-time truthy", 1) {
        // provide better error for case where `throw undefined`
        // is called in development
        if (typeof err === 'undefined') {
            return Object.defineProperty(new Error('An undefined error was thrown, ' + 'see here for more info: https://nextjs.org/docs/messages/threw-undefined'), "__NEXT_ERROR_CODE", {
                value: "E98",
                enumerable: false,
                configurable: true
            });
        }
        if (err === null) {
            return Object.defineProperty(new Error('A null error was thrown, ' + 'see here for more info: https://nextjs.org/docs/messages/threw-undefined'), "__NEXT_ERROR_CODE", {
                value: "E336",
                enumerable: false,
                configurable: true
            });
        }
    }
    return Object.defineProperty(new Error((0, _isplainobject.isPlainObject)(err) ? safeStringifyLite(err) : err + ''), "__NEXT_ERROR_CODE", {
        value: "E394",
        enumerable: false,
        configurable: true
    });
}
}),
"[project]/node_modules/next/dist/server/route-modules/pages/vendored/contexts/html-context.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {

const e = new Error("Could not parse module '[project]/node_modules/next/dist/server/route-modules/pages/vendored/contexts/html-context.js', file not found");
e.code = 'MODULE_UNPARSABLE';
throw e;
}),
"[project]/node_modules/next/dist/shared/lib/encode-uri-path.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "encodeURIPath", {
    enumerable: true,
    get: function() {
        return encodeURIPath;
    }
});
function encodeURIPath(file) {
    return file.split('/').map((p)=>encodeURIComponent(p)).join('/');
}
}),
"[project]/node_modules/next/dist/lib/pretty-bytes.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/*
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/ Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return prettyBytes;
    }
});
const UNITS = [
    'B',
    'kB',
    'MB',
    'GB',
    'TB',
    'PB',
    'EB',
    'ZB',
    'YB'
];
/*
Formats the given number using `Number#toLocaleString`.
- If locale is a string, the value is expected to be a locale-key (for example: `de`).
- If locale is true, the system default locale is used for translation.
- If no value for locale is specified, the number is returned unmodified.
*/ const toLocaleString = (number, locale)=>{
    let result = number;
    if (typeof locale === 'string') {
        result = number.toLocaleString(locale);
    } else if (locale === true) {
        result = number.toLocaleString();
    }
    return result;
};
function prettyBytes(number, options) {
    if (!Number.isFinite(number)) {
        throw Object.defineProperty(new TypeError(`Expected a finite number, got ${typeof number}: ${number}`), "__NEXT_ERROR_CODE", {
            value: "E572",
            enumerable: false,
            configurable: true
        });
    }
    options = Object.assign({}, options);
    if (options.signed && number === 0) {
        return ' 0 B';
    }
    const isNegative = number < 0;
    const prefix = isNegative ? '-' : options.signed ? '+' : '';
    if (isNegative) {
        number = -number;
    }
    if (number < 1) {
        const numberString = toLocaleString(number, options.locale);
        return prefix + numberString + ' B';
    }
    const exponent = Math.min(Math.floor(Math.log10(number) / 3), UNITS.length - 1);
    number = Number((number / Math.pow(1000, exponent)).toPrecision(3));
    const numberString = toLocaleString(number, options.locale);
    const unit = UNITS[exponent];
    return prefix + numberString + ' ' + unit;
}
}),
"[project]/node_modules/next/dist/pages/_document.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/// <reference types="webpack/module.d.ts" />
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    Head: null,
    Html: null,
    Main: null,
    NextScript: null,
    default: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    Head: function() {
        return Head;
    },
    Html: function() {
        return Html;
    },
    Main: function() {
        return Main;
    },
    NextScript: function() {
        return NextScript;
    },
    /**
 * `Document` component handles the initial `document` markup and renders only on the server side.
 * Commonly used for implementing server side rendering for `css-in-js` libraries.
 */ default: function() {
        return Document;
    }
});
const _jsxruntime = __turbopack_context__.r("[externals]/react/jsx-runtime [external] (react/jsx-runtime, cjs)");
const _react = /*#__PURE__*/ _interop_require_wildcard(__turbopack_context__.r("[externals]/react [external] (react, cjs)"));
const _constants = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/constants.js [ssr] (ecmascript)");
const _getpagefiles = (()=>{
    const e = new Error("Cannot find module '../server/get-page-files'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
const _htmlescape = (()=>{
    const e = new Error("Cannot find module '../server/htmlescape'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
const _iserror = /*#__PURE__*/ _interop_require_default(__turbopack_context__.r("[project]/node_modules/next/dist/lib/is-error.js [ssr] (ecmascript)"));
const _htmlcontextsharedruntime = __turbopack_context__.r("[project]/node_modules/next/dist/server/route-modules/pages/vendored/contexts/html-context.js [ssr] (ecmascript)");
const _encodeuripath = __turbopack_context__.r("[project]/node_modules/next/dist/shared/lib/encode-uri-path.js [ssr] (ecmascript)");
const _tracer = (()=>{
    const e = new Error("Cannot find module '../server/lib/trace/tracer'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
const _utils = (()=>{
    const e = new Error("Cannot find module '../server/lib/trace/utils'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
/** Set of pages that have triggered a large data warning on production mode. */ const largePageDataWarnings = new Set();
function getDocumentFiles(buildManifest, pathname) {
    const sharedFiles = (0, _getpagefiles.getPageFiles)(buildManifest, '/_app');
    const pageFiles = (0, _getpagefiles.getPageFiles)(buildManifest, pathname);
    return {
        sharedFiles,
        pageFiles,
        allFiles: [
            ...new Set([
                ...sharedFiles,
                ...pageFiles
            ])
        ]
    };
}
function getPolyfillScripts(context, props) {
    // polyfills.js has to be rendered as nomodule without async
    // It also has to be the first script to load
    const { assetPrefix, buildManifest, assetQueryString, disableOptimizedLoading, crossOrigin } = context;
    return buildManifest.polyfillFiles.filter((polyfill)=>polyfill.endsWith('.js') && !polyfill.endsWith('.module.js')).map((polyfill)=>/*#__PURE__*/ (0, _jsxruntime.jsx)("script", {
            defer: !disableOptimizedLoading,
            nonce: props.nonce,
            crossOrigin: props.crossOrigin || crossOrigin,
            noModule: true,
            src: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(polyfill)}${assetQueryString}`
        }, polyfill));
}
function hasComponentProps(child) {
    return !!child && !!child.props;
}
function getDynamicChunks(context, props, files) {
    const { dynamicImports, assetPrefix, isDevelopment, assetQueryString, disableOptimizedLoading, crossOrigin } = context;
    return dynamicImports.map((file)=>{
        if (!file.endsWith('.js') || files.allFiles.includes(file)) return null;
        return /*#__PURE__*/ (0, _jsxruntime.jsx)("script", {
            async: !isDevelopment && disableOptimizedLoading,
            defer: !disableOptimizedLoading,
            src: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
            nonce: props.nonce,
            crossOrigin: props.crossOrigin || crossOrigin
        }, file);
    });
}
function getScripts(context, props, files) {
    var _buildManifest_lowPriorityFiles;
    const { assetPrefix, buildManifest, isDevelopment, assetQueryString, mutableAssetQueryString, disableOptimizedLoading, crossOrigin } = context;
    const normalScripts = files.allFiles.filter((file)=>file.endsWith('.js'));
    const lowPriorityScripts = (_buildManifest_lowPriorityFiles = buildManifest.lowPriorityFiles) == null ? void 0 : _buildManifest_lowPriorityFiles.filter((file)=>file.endsWith('.js'));
    return [
        ...normalScripts,
        ...lowPriorityScripts
    ].map((file)=>{
        // static/chunks/51e975e7b637a580.js should use the immutable id, while
        // static/Yj152X97rfGgF7NPcJEZs/_ssgManifest.js should use the deployment id
        const query = file.startsWith('static/chunks') ? assetQueryString : mutableAssetQueryString;
        return /*#__PURE__*/ (0, _jsxruntime.jsx)("script", {
            src: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${query}`,
            nonce: props.nonce,
            async: !isDevelopment && disableOptimizedLoading,
            defer: !disableOptimizedLoading,
            crossOrigin: props.crossOrigin || crossOrigin
        }, file);
    });
}
function getPreNextWorkerScripts(context, props) {
    const { assetPrefix, scriptLoader, crossOrigin, nextScriptWorkers } = context;
    // disable `nextScriptWorkers` in edge runtime
    if (!nextScriptWorkers || ("TURBOPACK compile-time value", "nodejs") === 'edge') return null;
    try {
        // @ts-expect-error: Prevent webpack from processing this require
        let { partytownSnippet } = __non_webpack_require__('@builder.io/partytown/integration');
        const children = Array.isArray(props.children) ? props.children : [
            props.children
        ];
        // Check to see if the user has defined their own Partytown configuration
        const userDefinedConfig = children.find((child)=>{
            var _child_props_dangerouslySetInnerHTML, _child_props;
            return hasComponentProps(child) && (child == null ? void 0 : (_child_props = child.props) == null ? void 0 : (_child_props_dangerouslySetInnerHTML = _child_props.dangerouslySetInnerHTML) == null ? void 0 : _child_props_dangerouslySetInnerHTML.__html.length) && 'data-partytown-config' in child.props;
        });
        return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
            children: [
                !userDefinedConfig && /*#__PURE__*/ (0, _jsxruntime.jsx)("script", {
                    "data-partytown-config": "",
                    dangerouslySetInnerHTML: {
                        __html: `
            partytown = {
              lib: "${assetPrefix}/_next/static/~partytown/"
            };
          `
                    }
                }),
                /*#__PURE__*/ (0, _jsxruntime.jsx)("script", {
                    "data-partytown": "",
                    dangerouslySetInnerHTML: {
                        __html: partytownSnippet()
                    }
                }),
                (scriptLoader.worker || []).map((file, index)=>{
                    const { strategy, src, children: scriptChildren, dangerouslySetInnerHTML, ...scriptProps } = file;
                    let srcProps = {};
                    if (src) {
                        // Use external src if provided
                        srcProps.src = src;
                    } else if (dangerouslySetInnerHTML && dangerouslySetInnerHTML.__html) {
                        // Embed inline script if provided with dangerouslySetInnerHTML
                        srcProps.dangerouslySetInnerHTML = {
                            __html: dangerouslySetInnerHTML.__html
                        };
                    } else if (scriptChildren) {
                        // Embed inline script if provided with children
                        srcProps.dangerouslySetInnerHTML = {
                            __html: typeof scriptChildren === 'string' ? scriptChildren : Array.isArray(scriptChildren) ? scriptChildren.join('') : ''
                        };
                    } else {
                        throw Object.defineProperty(new Error('Invalid usage of next/script. Did you forget to include a src attribute or an inline script? https://nextjs.org/docs/messages/invalid-script'), "__NEXT_ERROR_CODE", {
                            value: "E82",
                            enumerable: false,
                            configurable: true
                        });
                    }
                    return /*#__PURE__*/ (0, _react.createElement)("script", {
                        ...srcProps,
                        ...scriptProps,
                        type: "text/partytown",
                        key: src || index,
                        nonce: props.nonce,
                        "data-nscript": "worker",
                        crossOrigin: props.crossOrigin || crossOrigin
                    });
                })
            ]
        });
    } catch (err) {
        if ((0, _iserror.default)(err) && err.code !== 'MODULE_NOT_FOUND') {
            console.warn(`Warning: ${err.message}`);
        }
        return null;
    }
}
function getPreNextScripts(context, props) {
    const { scriptLoader, disableOptimizedLoading, crossOrigin } = context;
    const webWorkerScripts = getPreNextWorkerScripts(context, props);
    const beforeInteractiveScripts = (scriptLoader.beforeInteractive || []).filter((script)=>script.src).map((file, index)=>{
        const { strategy, ...scriptProps } = file;
        return /*#__PURE__*/ (0, _react.createElement)("script", {
            ...scriptProps,
            key: scriptProps.src || index,
            defer: scriptProps.defer ?? !disableOptimizedLoading,
            nonce: scriptProps.nonce || props.nonce,
            "data-nscript": "beforeInteractive",
            crossOrigin: props.crossOrigin || crossOrigin
        });
    });
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
        children: [
            webWorkerScripts,
            beforeInteractiveScripts
        ]
    });
}
function getHeadHTMLProps(props) {
    const { crossOrigin, nonce, ...restProps } = props;
    // This assignment is necessary for additional type checking to avoid unsupported attributes in <head>
    const headProps = restProps;
    return headProps;
}
function getNextFontLinkTags(nextFontManifest, dangerousAsPath, assetPrefix = '', assetQueryString = '') {
    if (!nextFontManifest) {
        return {
            preconnect: null,
            preload: null
        };
    }
    const appFontsEntry = nextFontManifest.pages['/_app'];
    const pageFontsEntry = nextFontManifest.pages[dangerousAsPath];
    const preloadedFontFiles = Array.from(new Set([
        ...appFontsEntry ?? [],
        ...pageFontsEntry ?? []
    ]));
    // If no font files should preload but there's an entry for the path, add a preconnect tag.
    const preconnectToSelf = !!(preloadedFontFiles.length === 0 && (appFontsEntry || pageFontsEntry));
    return {
        preconnect: preconnectToSelf ? /*#__PURE__*/ (0, _jsxruntime.jsx)("link", {
            "data-next-font": nextFontManifest.pagesUsingSizeAdjust ? 'size-adjust' : '',
            rel: "preconnect",
            href: "/",
            crossOrigin: "anonymous"
        }) : null,
        preload: preloadedFontFiles ? preloadedFontFiles.map((fontFile)=>{
            const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(fontFile)[1];
            return /*#__PURE__*/ (0, _jsxruntime.jsx)("link", {
                rel: "preload",
                href: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(fontFile)}${assetQueryString}`,
                as: "font",
                type: `font/${ext}`,
                crossOrigin: "anonymous",
                "data-next-font": fontFile.includes('-s') ? 'size-adjust' : ''
            }, fontFile);
        }) : null
    };
}
class Head extends _react.default.Component {
    static #_ = this.contextType = _htmlcontextsharedruntime.HtmlContext;
    getCssLinks(files) {
        const { assetPrefix, cssAssetQueryString, dynamicImports, dynamicCssManifest, crossOrigin, optimizeCss } = this.context;
        const cssFiles = files.allFiles.filter((f)=>f.endsWith('.css'));
        const sharedFiles = new Set(files.sharedFiles);
        // Unmanaged files are CSS files that will be handled directly by the
        // webpack runtime (`mini-css-extract-plugin`).
        let unmanagedFiles = new Set([]);
        let localDynamicCssFiles = Array.from(new Set(dynamicImports.filter((file)=>file.endsWith('.css'))));
        if (localDynamicCssFiles.length) {
            const existing = new Set(cssFiles);
            localDynamicCssFiles = localDynamicCssFiles.filter((f)=>!(existing.has(f) || sharedFiles.has(f)));
            unmanagedFiles = new Set(localDynamicCssFiles);
            cssFiles.push(...localDynamicCssFiles);
        }
        let cssLinkElements = [];
        cssFiles.forEach((file)=>{
            const isSharedFile = sharedFiles.has(file);
            const isUnmanagedFile = unmanagedFiles.has(file);
            const isFileInDynamicCssManifest = dynamicCssManifest.has(file);
            if (!optimizeCss) {
                cssLinkElements.push(/*#__PURE__*/ (0, _jsxruntime.jsx)("link", {
                    nonce: this.props.nonce,
                    rel: "preload",
                    href: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${cssAssetQueryString}`,
                    as: "style",
                    crossOrigin: this.props.crossOrigin || crossOrigin
                }, `${file}-preload`));
            }
            cssLinkElements.push(/*#__PURE__*/ (0, _jsxruntime.jsx)("link", {
                nonce: this.props.nonce,
                rel: "stylesheet",
                href: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${cssAssetQueryString}`,
                crossOrigin: this.props.crossOrigin || crossOrigin,
                "data-n-g": isUnmanagedFile ? undefined : isSharedFile ? '' : undefined,
                "data-n-p": isSharedFile || isUnmanagedFile || isFileInDynamicCssManifest ? undefined : ''
            }, file));
        });
        return cssLinkElements.length === 0 ? null : cssLinkElements;
    }
    getPreloadDynamicChunks() {
        const { dynamicImports, assetPrefix, assetQueryString, crossOrigin } = this.context;
        return dynamicImports.map((file)=>{
            if (!file.endsWith('.js')) {
                return null;
            }
            return /*#__PURE__*/ (0, _jsxruntime.jsx)("link", {
                rel: "preload",
                href: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
                as: "script",
                nonce: this.props.nonce,
                crossOrigin: this.props.crossOrigin || crossOrigin
            }, file);
        }) // Filter out nulled scripts
        .filter(Boolean);
    }
    getPreloadMainLinks(files) {
        const { assetPrefix, assetQueryString, scriptLoader, crossOrigin } = this.context;
        const preloadFiles = files.allFiles.filter((file)=>{
            return file.endsWith('.js');
        });
        return [
            ...(scriptLoader.beforeInteractive || []).map((file)=>/*#__PURE__*/ (0, _jsxruntime.jsx)("link", {
                    nonce: this.props.nonce,
                    rel: "preload",
                    href: file.src,
                    as: "script",
                    crossOrigin: this.props.crossOrigin || crossOrigin
                }, file.src)),
            ...preloadFiles.map((file)=>/*#__PURE__*/ (0, _jsxruntime.jsx)("link", {
                    nonce: this.props.nonce,
                    rel: "preload",
                    href: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
                    as: "script",
                    crossOrigin: this.props.crossOrigin || crossOrigin
                }, file))
        ];
    }
    getBeforeInteractiveInlineScripts() {
        const { scriptLoader } = this.context;
        const { nonce, crossOrigin } = this.props;
        return (scriptLoader.beforeInteractive || []).filter((script)=>!script.src && (script.dangerouslySetInnerHTML || script.children)).map((file, index)=>{
            const { strategy, children, dangerouslySetInnerHTML, src, ...scriptProps } = file;
            let html = '';
            if (dangerouslySetInnerHTML && dangerouslySetInnerHTML.__html) {
                html = dangerouslySetInnerHTML.__html;
            } else if (children) {
                html = typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : '';
            }
            return /*#__PURE__*/ (0, _react.createElement)("script", {
                ...scriptProps,
                dangerouslySetInnerHTML: {
                    __html: html
                },
                key: scriptProps.id || index,
                nonce: nonce,
                "data-nscript": "beforeInteractive",
                crossOrigin: crossOrigin || ("TURBOPACK compile-time value", void 0)
            });
        });
    }
    getDynamicChunks(files) {
        return getDynamicChunks(this.context, this.props, files);
    }
    getPreNextScripts() {
        return getPreNextScripts(this.context, this.props);
    }
    getScripts(files) {
        return getScripts(this.context, this.props, files);
    }
    getPolyfillScripts() {
        return getPolyfillScripts(this.context, this.props);
    }
    render() {
        const { styles, __NEXT_DATA__, dangerousAsPath, headTags, unstable_runtimeJS, unstable_JsPreload, disableOptimizedLoading, optimizeCss, assetPrefix, nextFontManifest, cssAssetQueryString } = this.context;
        const disableRuntimeJS = unstable_runtimeJS === false;
        const disableJsPreload = unstable_JsPreload === false || !disableOptimizedLoading;
        this.context.docComponentsRendered.Head = true;
        let { head } = this.context;
        let cssPreloads = [];
        let otherHeadElements = [];
        if (head) {
            head.forEach((child)=>{
                if (child && child.type === 'link' && child.props['rel'] === 'preload' && child.props['as'] === 'style') {
                    cssPreloads.push(child);
                } else {
                    if (child) {
                        otherHeadElements.push(/*#__PURE__*/ _react.default.cloneElement(child, {
                            'data-next-head': ''
                        }));
                    }
                }
            });
            head = cssPreloads.concat(otherHeadElements);
        }
        let children = _react.default.Children.toArray(this.props.children).filter(Boolean);
        // show a warning if Head contains <title> (only in development)
        if ("TURBOPACK compile-time truthy", 1) {
            children = _react.default.Children.map(children, (child)=>{
                var _child_props;
                const isReactHelmet = child == null ? void 0 : (_child_props = child.props) == null ? void 0 : _child_props['data-react-helmet'];
                if (!isReactHelmet) {
                    var _child_props1;
                    if ((child == null ? void 0 : child.type) === 'title') {
                        console.warn("Warning: <title> should not be used in _document.js's <Head>. https://nextjs.org/docs/messages/no-document-title");
                    } else if ((child == null ? void 0 : child.type) === 'meta' && (child == null ? void 0 : (_child_props1 = child.props) == null ? void 0 : _child_props1.name) === 'viewport') {
                        console.warn("Warning: viewport meta tags should not be used in _document.js's <Head>. https://nextjs.org/docs/messages/no-document-viewport-meta");
                    }
                }
                return child;
            // @types/react bug. Returned value from .map will not be `null` if you pass in `[null]`
            });
            if (this.props.crossOrigin) console.warn('Warning: `Head` attribute `crossOrigin` is deprecated. https://nextjs.org/docs/messages/doc-crossorigin-deprecated');
        }
        const files = getDocumentFiles(this.context.buildManifest, this.context.__NEXT_DATA__.page);
        const nextFontLinkTags = getNextFontLinkTags(nextFontManifest, dangerousAsPath, assetPrefix, cssAssetQueryString);
        const tracingMetadata = (0, _utils.getTracedMetadata)((0, _tracer.getTracer)().getTracePropagationData(), this.context.experimentalClientTraceMetadata);
        const traceMetaTags = (tracingMetadata || []).map(({ key, value }, index)=>/*#__PURE__*/ (0, _jsxruntime.jsx)("meta", {
                name: key,
                content: value
            }, `next-trace-data-${index}`));
        return /*#__PURE__*/ (0, _jsxruntime.jsxs)("head", {
            ...getHeadHTMLProps(this.props),
            children: [
                this.context.isDevelopment && /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
                    children: [
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("style", {
                            "data-next-hide-fouc": true,
                            dangerouslySetInnerHTML: {
                                __html: `body{display:none}`
                            }
                        }),
                        /*#__PURE__*/ (0, _jsxruntime.jsx)("noscript", {
                            "data-next-hide-fouc": true,
                            children: /*#__PURE__*/ (0, _jsxruntime.jsx)("style", {
                                dangerouslySetInnerHTML: {
                                    __html: `body{display:block}`
                                }
                            })
                        })
                    ]
                }),
                head,
                children,
                nextFontLinkTags.preconnect,
                nextFontLinkTags.preload,
                this.getBeforeInteractiveInlineScripts(),
                !optimizeCss && this.getCssLinks(files),
                !optimizeCss && /*#__PURE__*/ (0, _jsxruntime.jsx)("noscript", {
                    "data-n-css": this.props.nonce ?? ''
                }),
                !disableRuntimeJS && !disableJsPreload && this.getPreloadDynamicChunks(),
                !disableRuntimeJS && !disableJsPreload && this.getPreloadMainLinks(files),
                !disableOptimizedLoading && !disableRuntimeJS && this.getPolyfillScripts(),
                !disableOptimizedLoading && !disableRuntimeJS && this.getPreNextScripts(),
                !disableOptimizedLoading && !disableRuntimeJS && this.getDynamicChunks(files),
                !disableOptimizedLoading && !disableRuntimeJS && this.getScripts(files),
                optimizeCss && this.getCssLinks(files),
                optimizeCss && /*#__PURE__*/ (0, _jsxruntime.jsx)("noscript", {
                    "data-n-css": this.props.nonce ?? ''
                }),
                this.context.isDevelopment && // this element is used to mount development styles so the
                // ordering matches production
                // (by default, style-loader injects at the bottom of <head />)
                /*#__PURE__*/ (0, _jsxruntime.jsx)("noscript", {
                    id: "__next_css__DO_NOT_USE__"
                }),
                traceMetaTags,
                styles || null,
                /*#__PURE__*/ _react.default.createElement(_react.default.Fragment, {}, ...headTags || [])
            ]
        });
    }
}
function handleDocumentScriptLoaderItems(scriptLoader, __NEXT_DATA__, props) {
    var _children_find_props, _children_find, _children_find_props1, _children_find1;
    if (!props.children) return;
    const scriptLoaderItems = [];
    const children = Array.isArray(props.children) ? props.children : [
        props.children
    ];
    const headChildren = (_children_find = children.find((child)=>child.type === Head)) == null ? void 0 : (_children_find_props = _children_find.props) == null ? void 0 : _children_find_props.children;
    const bodyChildren = (_children_find1 = children.find((child)=>child.type === 'body')) == null ? void 0 : (_children_find_props1 = _children_find1.props) == null ? void 0 : _children_find_props1.children;
    // Scripts with beforeInteractive can be placed inside Head or <body> so children of both needs to be traversed
    const combinedChildren = [
        ...Array.isArray(headChildren) ? headChildren : [
            headChildren
        ],
        ...Array.isArray(bodyChildren) ? bodyChildren : [
            bodyChildren
        ]
    ];
    _react.default.Children.forEach(combinedChildren, (child)=>{
        var _child_type;
        if (!child) return;
        // When using the `next/script` component, register it in script loader.
        if ((_child_type = child.type) == null ? void 0 : _child_type.__nextScript) {
            if (child.props.strategy === 'beforeInteractive') {
                scriptLoader.beforeInteractive = (scriptLoader.beforeInteractive || []).concat([
                    {
                        ...child.props
                    }
                ]);
                return;
            } else if ([
                'lazyOnload',
                'afterInteractive',
                'worker'
            ].includes(child.props.strategy)) {
                scriptLoaderItems.push(child.props);
                return;
            } else if (typeof child.props.strategy === 'undefined') {
                scriptLoaderItems.push({
                    ...child.props,
                    strategy: 'afterInteractive'
                });
                return;
            }
        }
    });
    __NEXT_DATA__.scriptLoader = scriptLoaderItems;
}
class NextScript extends _react.default.Component {
    static #_ = this.contextType = _htmlcontextsharedruntime.HtmlContext;
    getDynamicChunks(files) {
        return getDynamicChunks(this.context, this.props, files);
    }
    getPreNextScripts() {
        return getPreNextScripts(this.context, this.props);
    }
    getScripts(files) {
        return getScripts(this.context, this.props, files);
    }
    getPolyfillScripts() {
        return getPolyfillScripts(this.context, this.props);
    }
    static getInlineScriptSource(context) {
        const { __NEXT_DATA__, largePageDataBytes } = context;
        try {
            const data = JSON.stringify(__NEXT_DATA__);
            if (largePageDataWarnings.has(__NEXT_DATA__.page)) {
                return (0, _htmlescape.htmlEscapeJsonString)(data);
            }
            const bytes = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : Buffer.from(data).byteLength;
            const prettyBytes = __turbopack_context__.r("[project]/node_modules/next/dist/lib/pretty-bytes.js [ssr] (ecmascript)").default;
            if (largePageDataBytes && bytes > largePageDataBytes) {
                if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
                ;
                console.warn(`Warning: data for page "${__NEXT_DATA__.page}"${__NEXT_DATA__.page === context.dangerousAsPath ? '' : ` (path "${context.dangerousAsPath}")`} is ${prettyBytes(bytes)} which exceeds the threshold of ${prettyBytes(largePageDataBytes)}, this amount of data can reduce performance.\nSee more info here: https://nextjs.org/docs/messages/large-page-data`);
            }
            return (0, _htmlescape.htmlEscapeJsonString)(data);
        } catch (err) {
            if ((0, _iserror.default)(err) && err.message.indexOf('circular structure') !== -1) {
                throw Object.defineProperty(new Error(`Circular structure in "getInitialProps" result of page "${__NEXT_DATA__.page}". https://nextjs.org/docs/messages/circular-structure`), "__NEXT_ERROR_CODE", {
                    value: "E490",
                    enumerable: false,
                    configurable: true
                });
            }
            throw err;
        }
    }
    render() {
        const { assetPrefix, buildManifest, unstable_runtimeJS, docComponentsRendered, assetQueryString, disableOptimizedLoading, crossOrigin } = this.context;
        const disableRuntimeJS = unstable_runtimeJS === false;
        docComponentsRendered.NextScript = true;
        if ("TURBOPACK compile-time truthy", 1) {
            if (this.props.crossOrigin) console.warn('Warning: `NextScript` attribute `crossOrigin` is deprecated. https://nextjs.org/docs/messages/doc-crossorigin-deprecated');
        }
        const files = getDocumentFiles(this.context.buildManifest, this.context.__NEXT_DATA__.page);
        return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
            children: [
                !disableRuntimeJS && buildManifest.devFiles ? buildManifest.devFiles.map((file)=>/*#__PURE__*/ (0, _jsxruntime.jsx)("script", {
                        src: `${assetPrefix}/_next/${(0, _encodeuripath.encodeURIPath)(file)}${assetQueryString}`,
                        nonce: this.props.nonce,
                        crossOrigin: this.props.crossOrigin || crossOrigin
                    }, file)) : null,
                disableRuntimeJS ? null : /*#__PURE__*/ (0, _jsxruntime.jsx)("script", {
                    id: "__NEXT_DATA__",
                    type: "application/json",
                    nonce: this.props.nonce,
                    crossOrigin: this.props.crossOrigin || crossOrigin,
                    dangerouslySetInnerHTML: {
                        __html: NextScript.getInlineScriptSource(this.context)
                    }
                }),
                disableOptimizedLoading && !disableRuntimeJS && this.getPolyfillScripts(),
                disableOptimizedLoading && !disableRuntimeJS && this.getPreNextScripts(),
                disableOptimizedLoading && !disableRuntimeJS && this.getDynamicChunks(files),
                disableOptimizedLoading && !disableRuntimeJS && this.getScripts(files)
            ]
        });
    }
}
function Html(props) {
    const { docComponentsRendered, locale, scriptLoader, deploymentId, __NEXT_DATA__ } = (0, _htmlcontextsharedruntime.useHtmlContext)();
    docComponentsRendered.Html = true;
    handleDocumentScriptLoaderItems(scriptLoader, __NEXT_DATA__, props);
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("html", {
        ...props,
        lang: props.lang || locale || undefined,
        "data-dpl-id": deploymentId || undefined
    });
}
function Main() {
    const { docComponentsRendered } = (0, _htmlcontextsharedruntime.useHtmlContext)();
    docComponentsRendered.Main = true;
    // @ts-ignore
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("next-js-internal-body-render-target", {});
}
class Document extends _react.default.Component {
    /**
   * `getInitialProps` hook returns the context object with the addition of `renderPage`.
   * `renderPage` callback executes `React` rendering logic synchronously to support server-rendering wrappers
   */ static getInitialProps(ctx) {
        return ctx.defaultGetInitialProps(ctx);
    }
    render() {
        return /*#__PURE__*/ (0, _jsxruntime.jsxs)(Html, {
            children: [
                /*#__PURE__*/ (0, _jsxruntime.jsx)(Head, {
                    nonce: this.props.nonce
                }),
                /*#__PURE__*/ (0, _jsxruntime.jsxs)("body", {
                    children: [
                        /*#__PURE__*/ (0, _jsxruntime.jsx)(Main, {}),
                        /*#__PURE__*/ (0, _jsxruntime.jsx)(NextScript, {
                            nonce: this.props.nonce
                        })
                    ]
                })
            ]
        });
    }
}
// Add a special property to the built-in `Document` component so later we can
// identify if a user customized `Document` is used or not.
const InternalFunctionDocument = function InternalFunctionDocument() {
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)(Html, {
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)(Head, {}),
            /*#__PURE__*/ (0, _jsxruntime.jsxs)("body", {
                children: [
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(Main, {}),
                    /*#__PURE__*/ (0, _jsxruntime.jsx)(NextScript, {})
                ]
            })
        ]
    });
};
Document[_constants.NEXT_BUILTIN_DOCUMENT] = InternalFunctionDocument;
}),
"[project]/node_modules/next/document.js [ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/pages/_document.js [ssr] (ecmascript)");
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__12pvrrl._.js.map