coffeelint.lint = (source, userConfig = {}, literate = false) ->
  errors = []

  # When run from the browser it may not be able to find the ruleLoader.
  try
    ruleLoader = nodeRequire './ruleLoader'
    ruleLoader.loadFromConfig this, userConfig

  cache?.setConfig userConfig
  if cache?.has source then return cache?.get source
  config = mergeDefaultConfig(userConfig)

