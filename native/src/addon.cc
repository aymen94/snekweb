#include <node_api.h>

// Deliberately a capability probe only. The JS implementation remains complete;
// add hot-path operations here only after repeatable benchmarks justify the boundary.
static napi_value available(napi_env env, napi_callback_info) {
  napi_value result;
  napi_get_boolean(env, true, &result);
  return result;
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "available", NAPI_AUTO_LENGTH, available, nullptr, &fn);
  napi_set_named_property(env, exports, "available", fn);
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
