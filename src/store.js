import { Map } from 'immutable'
import _ from 'lodash'
import { createStore, compose } from 'redux'
import { installEffects } from './effects'

import DevTools from './devtools'

const enhancer = compose(
  installEffects(),
  // TODO exclude from production build
  // Required! Enable Redux DevTools with the monitors you chose
  DevTools.instrument()
)

let allActions = {}

export function makeActor(name) {
  if (typeof name !== 'string') {
    throw new Error("action name must be a string (got " + typeof name + ")")
  }
  if (allActions === null) {
    throw new Error("cannot create action '" + name + "' after makeStore")
  }
  if (allActions.hasOwnProperty(name)) {
    throw new Error("cannot create duplicate action: " + name)
  }
  const actor = (...args) => ({
    type: name,
    payload: args,
    args: args,
  })
  actor.key = name
  allActions[name] = actor
  return actor
}

export default function makeReducer(actionsToReducers, defaultState) {
  function reducer(state=defaultState, action) {
    if (reducers.hasOwnProperty(action.type)) {
      const args = action.hasOwnProperty("args") ? action.args : []
      return reducers[action.type](state, action, ...args)
    }
    return state
  }
  reducer.defaultState = defaultState
  const actions = reducer.actions = {}
  const reducers = {}
  _.each(actionsToReducers, (reduce, action) => {
    if (action.startsWith("ref:")) {
      action = {key: action.slice(4)}
      if (!allActions.hasOwnProperty(action.key)) {
        throw new Error("unknown action: " + action.key)
      }
    } else {
      action = makeActor(action)
      actions[action.key] = action
    }
    if (reducers.hasOwnProperty(action.key)) {
      throw new Error("duplicate reducer action: " + action.key)
    }
    reducers[action.key] = reduce
  })
  return reducer
}

export function makeStore(reducer, initialState=reducer.defaultState || Map()) {
  const store = createStore(reducer, initialState, enhancer)
  // disable adding more actions
  allActions = null
  return store
}
